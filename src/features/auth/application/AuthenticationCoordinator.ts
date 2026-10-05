import type { Clock } from '../../../core/clock/Clock';
import { AppError } from '../../../core/errors/AppError';
import type { KeyValueStore } from '../../../core/storage/KeyValueStore';
import { resolveIntent } from '../../../navigation/routePolicy';
import type {
  AuthenticationRepository,
  AuthState,
  AuthUser,
} from '../domain/AuthenticationRepository';
import {
  intentCacheSchema,
  INTENT_LIFETIME_MS,
  protectedActionSchema,
  safeOriginSchema,
  type PendingIntent,
  type ProtectedAction,
  type SafeOrigin,
} from './intents';

export type CoordinatorState = {
  auth: AuthState;
  promptOpen: boolean;
  screen: 'none' | 'signIn' | 'registration' | 'passwordReset';
  pendingIntent: PendingIntent | null;
  origin: SafeOrigin | null;
  persistence: 'none' | 'saving' | 'saved' | 'memoryOnly';
  recoveryMessage: string | null;
  busy: boolean;
};
export type AuthenticationHandlers = {
  resume(action: ProtectedAction, user: AuthUser, operationId: string): Promise<void>;
  returnTo(origin: SafeOrigin): void;
};
export const INTENT_STORAGE_KEY = 'auth.pendingIntent.v1';
const STORAGE_WAIT_MS = 1500;
const storageRecovery =
  'Your request could not be saved or cleared on this device. Retry or cancel; it may not survive an app restart.';
let nextIntentId = 0;

export class AuthenticationCoordinator {
  private state: CoordinatorState = {
    auth: { status: 'resolving' },
    promptOpen: false,
    screen: 'none',
    pendingIntent: null,
    origin: null,
    persistence: 'none',
    recoveryMessage: null,
    busy: false,
  };
  private listeners = new Set<() => void>();
  private queue: Promise<void> = Promise.resolve();
  // Keep physical writes ordered after a UI timeout: late saves finish before cancellation removes.
  private storageQueue: Promise<unknown> = Promise.resolve();
  private unsubscribe: () => void = () => {};
  private generation = 0;
  private revision = 0;
  private observation = 0;
  private disposed = false;
  private signingOut = false;
  private request: Promise<void> | null = null;
  private needsRestore = true;
  private needsClear = false;
  private requestedScreen: 'signIn' | 'registration' | null = null;
  private knownUid: string | null = null;

  constructor(
    private repository: AuthenticationRepository,
    private store: KeyValueStore,
    private clock: Clock,
    private handlers: AuthenticationHandlers,
  ) {
    const revision = this.revision;
    void this.enqueue(() => this.restore(revision));
    this.observe();
  }

  private update(patch: Partial<CoordinatorState>): void {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private enqueue(work: () => Promise<void>): Promise<void> {
    const result = this.queue.then(async () => {
      if (!this.disposed) await work();
    });
    this.queue = result.catch(() => {
      this.update({
        busy: false,
        recoveryMessage: new AppError('authentication-unavailable').userMessage,
      });
    });
    return this.queue;
  }

  private async storage<T>(work: () => Promise<T>): Promise<T> {
    const operation = this.storageQueue.then(work);
    this.storageQueue = operation.catch(() => {});
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Storage wait expired')), STORAGE_WAIT_MS);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  private observe(): void {
    this.unsubscribe();
    const observation = ++this.observation;
    this.unsubscribe = this.repository.observe((auth) => {
      if (this.disposed || this.signingOut || observation !== this.observation) return;
      const previous = this.state.auth;
      const identity = (state: AuthState) =>
        state.status === 'authenticated' ? state.user.uid : state.status;
      if (identity(previous) !== identity(auth)) this.generation++;
      if (
        this.knownUid !== null &&
        (auth.status === 'guest' ||
          (auth.status === 'authenticated' && this.knownUid !== auth.user.uid))
      ) {
        this.revision++;
        const hadIntent = this.state.pendingIntent !== null;
        this.clearState();
        if (hadIntent) {
          this.handlers.returnTo({ type: 'home' });
          void this.clearCache();
        }
      }
      if (auth.status === 'authenticated') this.knownUid = auth.user.uid;
      else if (auth.status === 'guest') this.knownUid = null;
      else if (auth.status === 'recoveryRequired' && auth.previousUid)
        this.knownUid = auth.previousUid;
      this.update({
        auth,
        ...(auth.status === 'recoveryRequired'
          ? {
              promptOpen: false,
              screen: 'none' as const,
              recoveryMessage: new AppError('authentication-unavailable').userMessage,
            }
          : {}),
      });
      const generation = this.generation;
      void this.enqueue(() => this.process(generation));
    });
  }

  private async restore(revision: number): Promise<void> {
    try {
      const raw = await this.storage(() => this.store.get(INTENT_STORAGE_KEY));
      if (this.disposed || revision !== this.revision) return;
      this.needsRestore = false;
      if (raw === null) return;
      let cached: unknown;
      try {
        cached = JSON.parse(raw);
      } catch {
        await this.clearCache();
        return;
      }
      const result = intentCacheSchema.safeParse(cached);
      if (!result.success || result.data.intent.createdAtMs > this.clock.now()) {
        await this.clearCache();
        return;
      }
      const intent = result.data.intent;
      this.update({ pendingIntent: intent, origin: intent.origin, persistence: 'saved' });
      await this.process(this.generation);
    } catch {
      this.update({ recoveryMessage: storageRecovery });
    }
  }

  private async clearCache(): Promise<boolean> {
    this.needsClear = true;
    try {
      await this.storage(() => this.store.remove(INTENT_STORAGE_KEY));
      this.needsClear = false;
      return true;
    } catch {
      this.update({ recoveryMessage: storageRecovery });
      return false;
    }
  }

  private clearState(): void {
    this.requestedScreen = null;
    this.update({
      pendingIntent: null,
      origin: null,
      promptOpen: false,
      screen: 'none',
      persistence: 'none',
      busy: false,
    });
  }

  private async process(generation: number): Promise<void> {
    if (this.disposed || this.signingOut || generation !== this.generation) return;
    const { auth, pendingIntent, origin } = this.state;
    if (auth.status === 'recoveryRequired') {
      this.update({
        promptOpen: false,
        screen: 'none',
        recoveryMessage: new AppError('authentication-unavailable').userMessage,
      });
      return;
    }
    if (this.state.persistence === 'saving') return;
    if (pendingIntent && pendingIntent.expiresAtMs <= this.clock.now()) {
      this.revision++;
      this.clearState();
      this.handlers.returnTo(pendingIntent.origin);
      await this.clearCache();
      return;
    }
    if (auth.status === 'authenticated') {
      if (pendingIntent) {
        const revision = this.revision;
        this.update({ busy: true });
        if (!(await this.clearCache())) {
          this.update({ busy: false });
          return;
        }
        if (this.disposed || generation !== this.generation || revision !== this.revision) return;
        const resolution = resolveIntent(pendingIntent, auth.user, this.clock.now());
        this.clearState();
        this.update({ recoveryMessage: null });
        if (resolution.type === 'return') this.handlers.returnTo(resolution.origin);
        else await this.handlers.resume(resolution.action, auth.user, pendingIntent.id);
      } else if (origin) {
        this.clearState();
        this.handlers.returnTo(origin);
      }
    } else if (pendingIntent && auth.status === 'guest' && this.state.screen === 'none') {
      this.update({ promptOpen: true });
    } else if (origin && auth.status === 'guest' && this.requestedScreen) {
      this.choose(this.requestedScreen);
    }
  }

  getSnapshot = (): CoordinatorState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  async requireAuthentication(action: ProtectedAction, origin: SafeOrigin): Promise<void> {
    const parsedAction = protectedActionSchema.safeParse(action);
    const parsedOrigin = safeOriginSchema.safeParse(origin);
    if (!parsedAction.success || !parsedOrigin.success)
      throw new AppError('authentication-unavailable');
    if (this.disposed || this.signingOut) return;
    if (this.request) return this.request;
    if (this.state.pendingIntent) return;
    const revision = ++this.revision;
    this.needsRestore = false;
    const createdAtMs = this.clock.now();
    const pendingIntent: PendingIntent = {
      id: `intent-${createdAtMs}-${++nextIntentId}-${Math.random().toString(36).slice(2, 12)}`,
      action: parsedAction.data,
      origin: parsedOrigin.data,
      createdAtMs,
      expiresAtMs: createdAtMs + INTENT_LIFETIME_MS,
    };
    this.update({
      pendingIntent,
      origin: pendingIntent.origin,
      persistence: 'saving',
      recoveryMessage: null,
    });
    this.request = this.enqueue(async () => {
      if (revision !== this.revision) return;
      try {
        await this.storage(() =>
          this.store.set(INTENT_STORAGE_KEY, JSON.stringify({ version: 1, intent: pendingIntent })),
        );
        if (revision === this.revision) this.update({ persistence: 'saved' });
      } catch {
        if (revision === this.revision)
          this.update({ persistence: 'memoryOnly', recoveryMessage: storageRecovery });
      }
      if (revision === this.revision) await this.process(this.generation);
    });
    try {
      await this.request;
    } finally {
      this.request = null;
    }
  }

  private choose(screen: CoordinatorState['screen']): void {
    if (this.state.auth.status !== 'guest' || !this.state.origin || this.signingOut) return;
    this.update({ screen, promptOpen: false });
  }
  chooseSignIn(): void {
    this.choose('signIn');
  }
  chooseRegistration(): void {
    this.choose('registration');
  }
  choosePasswordReset(): void {
    this.choose('passwordReset');
  }
  private begin(origin: SafeOrigin, screen: 'signIn' | 'registration'): void {
    const parsed = safeOriginSchema.safeParse(origin);
    if (!parsed.success) throw new AppError('authentication-unavailable');
    if (this.disposed || this.signingOut || this.state.pendingIntent) return;
    this.revision++;
    this.needsRestore = false;
    this.requestedScreen = screen;
    this.update({ origin: parsed.data });
    this.choose(screen);
  }
  beginSignIn(origin: SafeOrigin): void {
    this.begin(origin, 'signIn');
  }
  beginRegistration(origin: SafeOrigin): void {
    this.begin(origin, 'registration');
  }

  retry(): Promise<void> {
    if (this.disposed || this.signingOut) return Promise.resolve();
    this.update({ recoveryMessage: null });
    if (this.state.auth.status === 'resolving' || this.state.auth.status === 'recoveryRequired')
      this.observe();
    return this.enqueue(async () => {
      if (this.needsClear && !this.state.pendingIntent && !(await this.clearCache())) return;
      if (this.needsRestore) await this.restore(this.revision);
      else {
        const intent = this.state.pendingIntent;
        if (intent && this.state.persistence === 'memoryOnly') {
          const revision = this.revision;
          this.update({ persistence: 'saving' });
          try {
            await this.storage(() =>
              this.store.set(INTENT_STORAGE_KEY, JSON.stringify({ version: 1, intent })),
            );
            if (revision === this.revision) this.update({ persistence: 'saved' });
          } catch {
            if (revision === this.revision)
              this.update({ persistence: 'memoryOnly', recoveryMessage: storageRecovery });
          }
          if (revision !== this.revision) return;
        }
        await this.process(this.generation);
      }
    });
  }

  async cancel(): Promise<void> {
    if (this.disposed) return;
    this.generation++;
    this.revision++;
    this.needsRestore = false;
    const origin = this.state.origin;
    this.clearState();
    if (origin) this.handlers.returnTo(origin);
    await this.clearCache();
  }

  async signOut(): Promise<void> {
    if (this.disposed || this.signingOut) return;
    this.signingOut = true;
    this.generation++;
    this.observation++;
    this.unsubscribe();
    const clearing = this.cancel();
    this.knownUid = null;
    this.update({ auth: { status: 'resolving' } });
    try {
      await this.repository.signOut();
    } catch {
      this.update({
        auth: { status: 'recoveryRequired', previousUid: null },
        recoveryMessage: new AppError('authentication-unavailable').userMessage,
      });
    } finally {
      this.signingOut = false;
      if (!this.disposed && this.state.auth.status !== 'recoveryRequired') this.observe();
      await clearing;
    }
  }

  dispose(): void {
    this.generation++;
    this.revision++;
    this.observation++;
    this.disposed = true;
    this.unsubscribe();
    this.listeners.clear();
  }
}
