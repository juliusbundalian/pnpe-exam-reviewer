import type { ConfigRepository } from '../core/config/ConfigRepository';
import type { Clock } from '../core/clock/Clock';

export type PublicAppearance = 'system' | 'light' | 'dark';
export interface PublicSnapshot {
  publicReady: true;
  readyAt: number;
  appearance: PublicAppearance;
  remoteStatus: 'loading' | 'settled' | 'timedOut';
  recoveryMessage: string | null;
}
export interface PublicState {
  publicReady: true;
  getSnapshot(): PublicSnapshot;
  subscribe(listener: () => void): () => void;
  reportRecovery(): void;
  dispose(): void;
}
export async function initializePublicState({
  config,
  appearance,
  clock,
}: {
  config: ConfigRepository;
  appearance: { load(): Promise<PublicAppearance> };
  clock: Clock;
}): Promise<PublicState> {
  let active = true;
  let snapshot: PublicSnapshot = {
    publicReady: true,
    readyAt: clock.now(),
    appearance: 'system',
    remoteStatus: 'loading',
    recoveryMessage: null,
  };
  const listeners = new Set<() => void>();
  const update = (patch: Partial<PublicSnapshot>) => {
    if (!active) return;
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  };
  const reportRecovery = () =>
    update({
      recoveryMessage:
        'Some saved settings are unavailable or online services could not be reached. You can keep browsing with local defaults and retry by reopening the app.',
    });
  const timer = setTimeout(() => update({ remoteStatus: 'timedOut' }), 5000);
  // Local storage and native/network operations can all hang. None gates Home.
  void Promise.resolve()
    .then(() => appearance.load())
    .then((value) => update({ appearance: value }))
    .catch(reportRecovery);
  void Promise.resolve()
    .then(() => config.loadCached())
    .catch(reportRecovery);
  void Promise.resolve()
    .then(() => config.refresh())
    .catch(reportRecovery)
    .finally(() => {
      clearTimeout(timer);
      update({ remoteStatus: 'settled' });
    });
  return {
    publicReady: true,
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reportRecovery,
    dispose: () => {
      active = false;
      clearTimeout(timer);
      listeners.clear();
    },
  };
}
