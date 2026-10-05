import { initializePublicState } from '../../src/bootstrap/initialize';
import { ConfigRepository } from '../../src/core/config/ConfigRepository';
import { MemoryKeyValueStore, StubRemoteConfigService } from '../fixtures/config';
import { RecoveryAwareKeyValueStore } from '../../src/core/storage/RecoveryAwareKeyValueStore';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function bootstrapHarness() {
  const remote = new StubRemoteConfigService();
  const pending = deferred<Awaited<ReturnType<typeof remote.fetch>>>();
  remote.fetch = () => pending.promise;
  const config = new ConfigRepository(remote, new MemoryKeyValueStore());
  return {
    config,
    remote,
    pending,
    start: () =>
      initializePublicState({
        config,
        appearance: { load: async () => 'dark' as const },
        clock: { now: () => Date.now() },
      }),
  };
}
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('network timeout cannot hold the public shell and stops its loading budget', async () => {
  const harness = bootstrapHarness();
  const state = await harness.start();
  expect(state.publicReady).toBe(true);
  await jest.advanceTimersByTimeAsync(0);
  expect(state.getSnapshot().appearance).toBe('dark');
  jest.advanceTimersByTime(4999);
  expect(state.getSnapshot().remoteStatus).toBe('loading');
  jest.advanceTimersByTime(1);
  expect(state.getSnapshot()).toMatchObject({ publicReady: true, remoteStatus: 'timedOut' });
  state.dispose();
  expect(jest.getTimerCount()).toBe(0);
});

test('late valid config updates the repository without replacing the public state', async () => {
  const harness = bootstrapHarness();
  const state = await harness.start();
  jest.advanceTimersByTime(5000);
  harness.remote.parameters.app_info = JSON.stringify({
    ...harness.config.get('app_info'),
    maintenanceMode: true,
  });
  harness.pending.resolve(harness.remote.parameters);
  await jest.advanceTimersByTimeAsync(0);
  expect(harness.config.get('app_info').maintenanceMode).toBe(true);
  expect(state.getSnapshot().publicReady).toBe(true);
  state.dispose();
});

test('hanging local reads cannot hold Home and disposal ignores late appearance', async () => {
  const harness = bootstrapHarness();
  const pending = deferred<'dark'>();
  harness.config.loadCached = () => new Promise(() => {});
  const state = await initializePublicState({
    config: harness.config,
    appearance: { load: () => pending.promise },
    clock: { now: () => 42 },
  });
  expect(state.getSnapshot()).toMatchObject({
    publicReady: true,
    appearance: 'system',
    readyAt: 42,
  });
  const before = state.getSnapshot();
  state.dispose();
  pending.resolve('dark');
  await jest.advanceTimersByTimeAsync(0);
  expect(state.getSnapshot()).toBe(before);
  expect(jest.getTimerCount()).toBe(0);
});

test('storage failure exposes safe public recovery messaging', async () => {
  const harness = bootstrapHarness();
  const state = await initializePublicState({
    config: harness.config,
    appearance: {
      load: async () => {
        throw new Error('private disk path');
      },
    },
    clock: { now: () => 1 },
  });
  await jest.advanceTimersByTimeAsync(0);
  expect(state.getSnapshot().recoveryMessage).toMatch(/settings.*unavailable/i);
  expect(state.getSnapshot().recoveryMessage).not.toContain('private');
  expect(state.publicReady).toBe(true);
  state.dispose();
});

test('config cache I/O failures report recovery even when repository retains defaults', async () => {
  const memory = new MemoryKeyValueStore();
  memory.failReads = true;
  let recovered = false;
  const storage = new RecoveryAwareKeyValueStore(memory, () => {
    recovered = true;
  });
  const config = new ConfigRepository(new StubRemoteConfigService(), storage);
  await config.loadCached();
  expect(recovered).toBe(true);
  expect(config.get('config').mockExam.questionCount).toBe(150);
});
