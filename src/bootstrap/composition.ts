import type { ConfigRepository } from '../core/config/ConfigRepository';
import { noOpAnalytics, type AnalyticsService } from '../core/analytics/AnalyticsService';
import type { KeyValueStore } from '../core/storage/KeyValueStore';
import { systemClock } from '../core/clock/Clock';
import { AppError } from '../core/errors/AppError';
import {
  AuthenticationCoordinator,
  type AuthenticationHandlers,
} from '../features/auth/application/AuthenticationCoordinator';
import { RegistrationController } from '../features/auth/application/RegistrationController';
import type { AuthenticationRepository } from '../features/auth/domain/AuthenticationRepository';
import type { ProfileRepository } from '../features/auth/domain/ProfileRepository';
import { FirebaseAuthenticationRepository } from '../features/auth/data/FirebaseAuthenticationRepository';
import { FirebaseProfileRepository } from '../features/auth/data/FirebaseProfileRepository';
import {
  createNativeAuthenticationSdk,
  createNativeProfileSdk,
} from '../features/auth/data/nativeRepositoryFacades';
import { createNativeCategoryRepository } from '../features/content/data/nativeCategoryFacade';
import { FirebaseCategoryRepository } from '../features/content/data/FirebaseCategoryRepository';
import type { CategoryRepository } from '../features/content/domain/CategoryRepository';
import type { PublicDependencies } from './PublicBootstrapProvider';

export interface AppPorts {
  config: ConfigRepository;
  auth: AuthenticationRepository;
  profiles: ProfileRepository;
  categories: CategoryRepository;
  storage: KeyValueStore;
  analytics?: AnalyticsService;
}
export interface AppDependencies extends AppPorts {
  analytics: AnalyticsService;
  coordinator: AuthenticationCoordinator;
  registration: RegistrationController;
  bindNavigation(handlers: AuthenticationHandlers): () => void;
  dispose(): void;
}
export function createAppDependencies(ports: AppPorts): AppDependencies {
  const registration = new RegistrationController(ports.auth, ports.profiles);
  let handlers: AuthenticationHandlers | null = null;
  const pending: (() => void)[] = [];
  // The coordinator owns the sole repository observation. Forward actual observations,
  // never coordinator UI snapshots, before the coordinator can resume navigation.
  const observedAuth: AuthenticationRepository = {
    ...ports.auth,
    signIn: (email, password) => ports.auth.signIn(email, password),
    register: (email, password) => ports.auth.register(email, password),
    requestPasswordReset: (email) => ports.auth.requestPasswordReset(email),
    signOut: () => ports.auth.signOut(),
    observe: (listener) =>
      ports.auth.observe((state) => {
        registration.synchronizeAuth(state);
        listener(state);
      }),
  };
  const coordinator = new AuthenticationCoordinator(observedAuth, ports.storage, systemClock, {
    resume: async (action, user, id) => {
      if (handlers) await handlers.resume(action, user, id);
      else
        pending.push(() => {
          void handlers?.resume(action, user, id);
        });
    },
    returnTo: (origin) => {
      if (handlers) handlers.returnTo(origin);
      else pending.push(() => handlers?.returnTo(origin));
    },
  });
  return {
    ...ports,
    analytics: ports.analytics ?? noOpAnalytics,
    coordinator,
    registration,
    bindNavigation(next) {
      handlers = next;
      for (const navigation of pending.splice(0)) navigation();
      return () => {
        if (handlers === next) handlers = null;
      };
    },
    dispose() {
      coordinator.dispose();
      registration.dispose();
      pending.length = 0;
      handlers = null;
    },
  };
}

export function composeNativeApp(publicDependencies: PublicDependencies): AppDependencies {
  const repositories = publicDependencies.nativeServices().then(async (services) => {
    if (!services.available) throw new AppError('authentication-unavailable');
    const [authSdk, profileSdk, categories] = await Promise.all([
      createNativeAuthenticationSdk(services.auth),
      createNativeProfileSdk(services.firestore),
      createNativeCategoryRepository(services.firestore),
    ]);
    return {
      auth: new FirebaseAuthenticationRepository(authSdk),
      profiles: new FirebaseProfileRepository(profileSdk),
      categories,
    };
  });
  // Attach rejection handling immediately; Home does not await native services.
  void repositories.catch(() => undefined);
  const fallback = new FirebaseCategoryRepository({ listCategories: async () => [] });
  const auth: AuthenticationRepository = {
    observe(listener) {
      let active = true;
      let unsubscribe = () => {};
      listener({ status: 'resolving' });
      const timer = setTimeout(() => {
        if (active) listener({ status: 'recoveryRequired', previousUid: null });
      }, 5000);
      void repositories.then(
        (ports) => {
          clearTimeout(timer);
          if (active) unsubscribe = ports.auth.observe(listener);
        },
        () => {
          clearTimeout(timer);
          if (active) listener({ status: 'recoveryRequired', previousUid: null });
        },
      );
      return () => {
        active = false;
        clearTimeout(timer);
        unsubscribe();
      };
    },
    signIn: async (email, password) => (await repositories).auth.signIn(email, password),
    register: async (email, password) => (await repositories).auth.register(email, password),
    requestPasswordReset: async (email) => (await repositories).auth.requestPasswordReset(email),
    signOut: async () => (await repositories).auth.signOut(),
  };
  return createAppDependencies({
    config: publicDependencies.config,
    storage: publicDependencies.safeStorage,
    auth,
    profiles: {
      get: async (uid) => (await repositories).profiles.get(uid),
      save: async (uid, profile) => (await repositories).profiles.save(uid, profile),
    },
    categories: {
      list: async () => {
        try {
          return await (await repositories).categories.list();
        } catch {
          return fallback.list();
        }
      },
    },
  });
}
