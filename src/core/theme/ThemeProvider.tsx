import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { KeyValueStore } from '../storage/KeyValueStore';
import { palettes, type ThemeColors } from './tokens';

export type Appearance = 'system' | 'light' | 'dark';
const preferenceKey = 'pnpe.appearance';
type AppearanceState = { appearance: Appearance };
type ThemeContextValue = {
  store: StoreApi<AppearanceState>;
  setAppearance(value: Appearance): Promise<void>;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);

function restoreAppearance(raw: string | null): Appearance {
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
    ) {
      return value.appearance;
    }
  } catch {
    /* Invalid preferences safely follow the OS. */
  }
  return 'system';
}

export function ThemeProvider({
  children,
  initialAppearance = 'system',
  storage,
}: {
  children: ReactNode;
  initialAppearance?: Appearance;
  storage?: KeyValueStore;
}) {
  const [store] = useState(() =>
    createStore<AppearanceState>(() => ({ appearance: initialAppearance })),
  );
  const selected = useRef(false);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    if (storage) {
      void storage
        .get(preferenceKey)
        .then((raw) => {
          if (active && !selected.current) store.setState({ appearance: restoreAppearance(raw) });
        })
        .catch(() => {
          /* Home remains available when preference storage cannot be read. */
        });
    }
    return () => {
      active = false;
    };
  }, [storage, store]);

  const setAppearance = async (appearance: Appearance) => {
    selected.current = true;
    store.setState({ appearance });
    if (storage) {
      const write = writes.current
        .catch(() => undefined)
        .then(() => storage.set(preferenceKey, JSON.stringify({ version: 1, appearance })));
      writes.current = write;
      await write;
    }
  };
  return <ThemeContext.Provider value={{ store, setAppearance }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): {
  colors: ThemeColors;
  appearance: Appearance;
  setAppearance(value: Appearance): Promise<void>;
} {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme requires ThemeProvider');
  const appearance = useStore(context.store, (state) => state.appearance);
  const systemScheme = useColorScheme();
  const mode = appearance === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : appearance;
  return { colors: palettes[mode], appearance, setAppearance: context.setAppearance };
}
