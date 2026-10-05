import type { KeyValueStore } from '../storage/KeyValueStore';
export type Appearance = 'system' | 'light' | 'dark';
export const preferenceKey = 'pnpe.appearance';
export function restoreAppearance(raw: string | null): Appearance {
  if (raw === null) return 'system';
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === 'object' &&
      value !== null &&
      'version' in value &&
      value.version === 1 &&
      'appearance' in value &&
      (value.appearance === 'system' || value.appearance === 'light' || value.appearance === 'dark')
    )
      return value.appearance;
  } catch {
    /* Invalid preferences safely follow the OS. */
  }
  return 'system';
}
export function appearanceAdapter(storage: KeyValueStore) {
  return { load: async () => restoreAppearance(await storage.get(preferenceKey)) };
}
