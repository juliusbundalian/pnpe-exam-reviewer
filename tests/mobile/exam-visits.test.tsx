import { renderHook, waitFor } from '@testing-library/react-native';
import { useExamVisits } from '../../src/features/exam/presentation/useExamVisits';
import type { KeyValueStore } from '../../src/core/storage/KeyValueStore';

function memory() {
  const values = new Map<string, string>();
  const storage: KeyValueStore = {
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => {
      values.set(key, value);
    },
    remove: async (key) => {
      values.delete(key);
    },
  };
  return storage;
}
const scope = { uid: 'alice', deviceId: 'device-one', attemptId: 'exam-one', questionCount: 150 };

test('visit history survives reopening and never marks questions jumped over as visited', async () => {
  const storage = memory();
  const first = renderHook<ReadonlySet<number>, { position: number }>(
    ({ position }) => useExamVisits(storage, { ...scope, position }),
    {
      initialProps: { position: 0 },
    },
  );
  first.rerender({ position: 3 });
  await waitFor(() => expect(first.result.current.has(3)).toBe(true));
  first.unmount();
  const second = renderHook(() => useExamVisits(storage, { ...scope, position: 3 }));
  await waitFor(() => expect(second.result.current.has(0)).toBe(true));
  expect(second.result.current.has(1)).toBe(false);
  expect(second.result.current.has(2)).toBe(false);
});

test('visit history is isolated by account, device and attempt', async () => {
  const storage = memory();
  const first = renderHook(() => useExamVisits(storage, { ...scope, position: 5 }));
  await waitFor(() => expect(first.result.current.has(5)).toBe(true));
  first.unmount();
  for (const different of [{ uid: 'bob' }, { deviceId: 'device-two' }, { attemptId: 'exam-two' }]) {
    const next = renderHook(() => useExamVisits(storage, { ...scope, ...different, position: 0 }));
    await waitFor(() => expect(next.result.current.has(0)).toBe(true));
    expect(next.result.current.has(5)).toBe(false);
    next.unmount();
  }
});

test('storage failure leaves in-memory visit history usable', async () => {
  const storage: KeyValueStore = {
    get: async () => {
      throw new Error('unavailable');
    },
    set: async () => {},
    remove: async () => {},
  };
  const hook = renderHook<ReadonlySet<number>, { position: number }>(
    ({ position }) => useExamVisits(storage, { ...scope, position }),
    {
      initialProps: { position: 0 },
    },
  );
  hook.rerender({ position: 7 });
  await waitFor(() => expect(hook.result.current.has(7)).toBe(true));
  expect(hook.result.current.has(0)).toBe(true);
  expect(hook.result.current.has(1)).toBe(false);
});
