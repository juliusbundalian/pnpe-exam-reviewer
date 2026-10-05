import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text, useColorScheme } from 'react-native';
import { ThemeProvider, useTheme } from '../../src/core/theme/ThemeProvider';
import type { KeyValueStore } from '../../src/core/storage/KeyValueStore';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

function Probe() {
  const { appearance, colors, setAppearance } = useTheme();
  return (
    <>
      <Text>{appearance}</Text>
      <Text testID="background">{colors.background}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Use dark"
        onPress={() => void setAppearance('dark')}
      >
        <Text>Dark</Text>
      </Pressable>
    </>
  );
}

function memoryStore(value: string | null = null): KeyValueStore {
  return {
    get: async () => value,
    set: async (_key, next) => {
      value = next;
    },
    remove: async () => {
      value = null;
    },
  };
}

test('dark choice persists a versioned value and restores on another mount', async () => {
  const storage = memoryStore();
  const first = render(
    <ThemeProvider storage={storage}>
      <Probe />
    </ThemeProvider>,
  );
  await waitFor(() => expect(screen.getByText('system')).toBeVisible());
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Use dark' })));
  expect(JSON.parse((await storage.get('pnpe.appearance')) ?? 'null')).toEqual({
    version: 1,
    appearance: 'dark',
  });
  first.unmount();
  render(
    <ThemeProvider storage={storage}>
      <Probe />
    </ThemeProvider>,
  );
  await waitFor(() => expect(screen.getByText('dark')).toBeVisible());
});

test.each(['bad json', '{"version":2,"appearance":"dark"}', '{"version":1,"appearance":"sepia"}'])(
  'corrupt preference %s falls back to System',
  async (value) => {
    render(
      <ThemeProvider initialAppearance="light" storage={memoryStore(value)}>
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByText('system')).toBeVisible());
  },
);

test('a slow stored preference does not overwrite a newer user choice', async () => {
  let resolveRead: (value: string | null) => void = () => undefined;
  const storage = memoryStore();
  storage.get = () =>
    new Promise((resolve) => {
      resolveRead = resolve;
    });
  render(
    <ThemeProvider storage={storage}>
      <Probe />
    </ThemeProvider>,
  );
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Use dark' })));
  await act(async () => resolveRead('{"version":1,"appearance":"light"}'));
  expect(screen.getByText('dark')).toBeVisible();
});

test('failed preference reads leave Home theme available', async () => {
  const storage = memoryStore();
  storage.get = async () => {
    throw new Error('unavailable');
  };
  render(
    <ThemeProvider storage={storage}>
      <Probe />
    </ThemeProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByText('system')).toBeVisible();
});

test('System follows live OS appearance but explicit Dark ignores it', async () => {
  jest.mocked(useColorScheme).mockReturnValue('light');
  const tree = render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
  const light = screen.getByTestId('background').props.children;
  jest.mocked(useColorScheme).mockReturnValue('dark');
  tree.rerender(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
  const dark = screen.getByTestId('background').props.children;
  expect(dark).not.toBe(light);
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Use dark' })));
  jest.mocked(useColorScheme).mockReturnValue('light');
  tree.rerender(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
  expect(screen.getByTestId('background').props.children).toBe(dark);
});

test('unspecified OS appearance falls back to a usable light palette', () => {
  jest.mocked(useColorScheme).mockReturnValue('unspecified');
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
  expect(screen.getByTestId('background')).toHaveTextContent('#f6f8fc');
});
