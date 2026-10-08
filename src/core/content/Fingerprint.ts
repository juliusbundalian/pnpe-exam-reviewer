/** Implementations digest this canonical JSON, never insertion-order JSON or SDK objects. */
export interface Fingerprint {
  digest(value: unknown): Promise<string>;
}

export const MAX_CONTENT_BYTES = 700 * 1024;

/** Deterministic JSON for plain DTOs; omitted object fields match importer canonicalization. */
export function canonicalJson(value: unknown): string {
  const ancestors = new Set<object>();
  function sort(item: unknown): unknown {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return item;
    if (typeof item === 'number' && Number.isFinite(item)) return item;
    if (typeof item !== 'object' || item === null) throw new Error('Expected JSON content');
    if (ancestors.has(item)) throw new Error('Cyclic JSON content');
    if (
      !Array.isArray(item) &&
      Object.getPrototypeOf(item) !== Object.prototype &&
      Object.getPrototypeOf(item) !== null
    )
      throw new Error('Expected plain JSON content');
    ancestors.add(item);
    try {
      if (Array.isArray(item)) return Array.from(item, sort);
      return Object.fromEntries(
        Object.entries(item)
          .filter(([, child]) => child !== undefined)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, child]) => [key, sort(child)]),
      );
    } finally {
      ancestors.delete(item);
    }
  }
  return JSON.stringify(sort(value));
}

/** UTF-8 size without Buffer or a native dependency, including surrogate pairs. */
export function jsonBytes(value: unknown): number {
  const json = canonicalJson(value);
  let bytes = 0;
  for (const character of json) {
    const point = character.codePointAt(0)!;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
}
