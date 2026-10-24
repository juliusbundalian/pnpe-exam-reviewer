import { useEffect, useState } from 'react';
import type { KeyValueStore } from '../../../core/storage/KeyValueStore';

type VisitScope = {
  uid: string;
  deviceId: string;
  attemptId: string;
  position: number;
  questionCount: number;
};
const queues = new WeakMap<KeyValueStore, Promise<void>>();

function readVisits(raw: string | null, count: number): number[] {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (
      typeof value !== 'object' ||
      value === null ||
      !('version' in value) ||
      value.version !== 1 ||
      !('visited' in value)
    )
      return [];
    const visits: unknown = value.visited;
    return Array.isArray(visits) &&
      visits.length <= count &&
      visits.every((index) => Number.isInteger(index) && index >= 0 && index < count)
      ? (visits as number[])
      : [];
  } catch {
    return [];
  }
}

/** Presentation metadata only; never changes exam answers, scoring or its deadline. */
export function useExamVisits(
  storage: KeyValueStore,
  scope: VisitScope | null,
): ReadonlySet<number> {
  const key = scope
    ? `pnpe.exam-visits.v1:${JSON.stringify([scope.uid, scope.deviceId, scope.attemptId])}`
    : null;
  const position = scope?.position ?? 0;
  const count = scope?.questionCount ?? 0;
  const [snapshot, setSnapshot] = useState<{ key: string | null; visited: ReadonlySet<number> }>({
    key: null,
    visited: new Set(),
  });
  useEffect(() => {
    if (key === null) return;
    let active = true;
    setSnapshot((previous) => ({
      key,
      visited: new Set([...(previous.key === key ? previous.visited : []), position]),
    }));
    // Serialize across mounts so leaving/reopening cannot overwrite an in-flight visit.
    const work = (queues.get(storage) ?? Promise.resolve()).then(async () => {
      const visited = new Set(readVisits(await storage.get(key), count));
      visited.add(position);
      await storage.set(key, JSON.stringify({ version: 1, visited: [...visited] }));
      if (active)
        setSnapshot((previous) =>
          previous.key === key
            ? { key, visited: new Set([...previous.visited, ...visited]) }
            : previous,
        );
    });
    queues.set(
      storage,
      work.catch(() => undefined),
    );
    return () => {
      active = false;
    };
  }, [storage, key, position, count]);
  return snapshot.key === key ? snapshot.visited : new Set(scope ? [position] : []);
}
