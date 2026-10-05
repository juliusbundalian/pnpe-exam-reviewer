import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ThemeProvider } from '../core/theme/ThemeProvider';
import { appearanceAdapter } from '../core/theme/appearance';
import { PublicRecoveryNotice } from './PublicRecoveryNotice';
import { ConfigRepository } from '../core/config/ConfigRepository';
import { RecoveryAwareKeyValueStore } from '../core/storage/RecoveryAwareKeyValueStore';
import type { KeyValueStore } from '../core/storage/KeyValueStore';
import { initializeNativeFirebase, type NativeServices } from '../core/firebase/native';
import { systemClock } from '../core/clock/Clock';
import type { FirebaseEnvironment } from './environment';
import { initializePublicState, type PublicSnapshot, type PublicState } from './initialize';

export interface PublicDependencies {
  config: ConfigRepository;
  safeStorage: KeyValueStore;
  nativeServices(): Promise<NativeServices>;
}
const PublicContext = createContext<PublicDependencies | null>(null);
export function usePublicDependencies(): PublicDependencies {
  const value = useContext(PublicContext);
  if (!value) throw new Error('Public bootstrap provider is missing.');
  return value;
}
export function PublicBootstrapProvider({
  children,
  storage,
  environment,
}: {
  children: ReactNode;
  storage: KeyValueStore;
  environment: FirebaseEnvironment;
}) {
  const [composition] = useState(() => {
    let state: PublicState | undefined;
    let recoveryPending = false;
    const reportRecovery = () => {
      recoveryPending = true;
      state?.reportRecovery();
    };
    const safeStorage = new RecoveryAwareKeyValueStore(storage, reportRecovery);
    const nativeServices = () => initializeNativeFirebase(environment);
    const config = new ConfigRepository(
      {
        fetch: async () => {
          try {
            return await (await nativeServices()).remoteConfig.fetch();
          } catch (error) {
            if (environment.mode !== 'unconfigured') reportRecovery();
            throw error;
          }
        },
      },
      safeStorage,
    );
    return {
      config,
      safeStorage,
      nativeServices,
      attach(next: PublicState) {
        state = next;
        if (recoveryPending) next.reportRecovery();
      },
    };
  });
  const [snapshot, setSnapshot] = useState<PublicSnapshot | null>(null);
  useEffect(() => {
    let active = true;
    let state: PublicState | undefined;
    let unsubscribe: (() => void) | undefined;
    void initializePublicState({
      config: composition.config,
      appearance: appearanceAdapter(composition.safeStorage),
      clock: systemClock,
    }).then((next) => {
      if (!active) {
        next.dispose();
        return;
      }
      state = next;
      composition.attach(next);
      setSnapshot(next.getSnapshot());
      unsubscribe = next.subscribe(() => setSnapshot(next.getSnapshot()));
    });
    return () => {
      active = false;
      unsubscribe?.();
      state?.dispose();
    };
  }, [composition]);
  return (
    <PublicContext.Provider value={composition}>
      <ThemeProvider
        storage={composition.safeStorage}
        restoreOnMount={false}
        initialAppearance={snapshot?.appearance ?? 'system'}
      >
        {snapshot?.recoveryMessage ? (
          <PublicRecoveryNotice message={snapshot.recoveryMessage} />
        ) : null}
        {children}
      </ThemeProvider>
    </PublicContext.Provider>
  );
}
