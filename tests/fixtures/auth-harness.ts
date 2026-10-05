import { AuthenticationCoordinator } from '../../src/features/auth/application/AuthenticationCoordinator';
import type {
  AuthenticationRepository,
  AuthState,
  AuthUser,
} from '../../src/features/auth/domain/AuthenticationRepository';
import type { KeyValueStore } from '../../src/core/storage/KeyValueStore';

export const authUser = (uid: string): AuthUser => ({
  uid,
  email: `${uid}@example.test`,
  displayName: null,
});
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
export class MemoryIntentStore implements KeyValueStore {
  values = new Map<string, string>();
  get = jest.fn(async (key: string) => this.values.get(key) ?? null);
  set = jest.fn(async (key: string, value: string) => {
    this.values.set(key, value);
  });
  remove = jest.fn(async (key: string) => {
    this.values.delete(key);
  });
}
export class FakeAuthenticationRepository implements AuthenticationRepository {
  listeners = new Set<(state: AuthState) => void>();
  constructor(public state: AuthState) {}
  observe(listener: (state: AuthState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }
  emit(state: AuthState) {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }
  signIn = jest.fn(async () => authUser('user-a'));
  register = jest.fn(async () => authUser('user-a'));
  requestPasswordReset = jest.fn(async () => {});
  signOut = jest.fn(async () => {
    this.emit({ status: 'guest' });
  });
}
export async function flushTransitions() {
  for (let i = 0; i < 40; i++) await Promise.resolve();
}
export function createAuthHarness(
  options: { now?: number; state?: AuthState; store?: MemoryIntentStore } = {},
) {
  const clock = {
    value: options.now ?? 1000,
    now() {
      return this.value;
    },
  };
  const repository = new FakeAuthenticationRepository(options.state ?? { status: 'guest' });
  const store = options.store ?? new MemoryIntentStore();
  const resume = jest.fn(async () => {});
  const returnTo = jest.fn();
  const coordinator = new AuthenticationCoordinator(repository, store, clock, { resume, returnTo });
  return {
    clock,
    repository,
    store,
    resume,
    returnTo,
    coordinator,
    async emitAuthenticated(uid: string) {
      repository.emit({ status: 'authenticated', user: authUser(uid) });
      await flushTransitions();
    },
  };
}
