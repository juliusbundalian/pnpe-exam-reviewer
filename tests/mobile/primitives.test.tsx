import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppButton } from '../../src/core/components/AppButton';
import { AppScreen } from '../../src/core/components/AppScreen';
import { EmptyView, ErrorView, LoadingView } from '../../src/core/components/StateViews';
import { ThemeProvider } from '../../src/core/theme/ThemeProvider';
import { createRef } from 'react';
import type { View } from 'react-native';

test('button forwards its native launch ref for accessibility focus restoration', () => {
  const ref = createRef<View>();
  const rendered = render(
    <ThemeProvider>
      <AppButton ref={ref} variant="primary" label="Launch" />
    </ThemeProvider>,
  );
  expect(ref.current?.props.accessibilityLabel).toBe('Launch');
  rendered.unmount();
  expect(ref.current).toBeNull();
});

test.each(['light', 'dark'] as const)(
  'button exposes disabled state and adequate target in %s',
  (appearance) => {
    const onPress = jest.fn();
    render(
      <ThemeProvider initialAppearance={appearance}>
        <AppButton variant="primary" label="Continue" disabled onPress={onPress} />
      </ThemeProvider>,
    );
    const button = screen.getByRole('button', { name: 'Continue' });
    expect(button).toBeDisabled();
    expect(button).toHaveStyle({ minHeight: 44 });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  },
);

test('error and empty states offer a labelled retry; loading announces its state', () => {
  const retry = jest.fn();
  const tree = render(
    <ThemeProvider>
      <AppScreen>
        <ErrorView message="Unable to load coverage" onRetry={retry} />
      </AppScreen>
    </ThemeProvider>,
  );
  expect(screen.getByText('Unable to load coverage')).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
  expect(retry).toHaveBeenCalledTimes(1);
  tree.rerender(
    <ThemeProvider>
      <EmptyView message="No available content" onRetry={retry} />
    </ThemeProvider>,
  );
  expect(screen.getByText('No available content')).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
  expect(retry).toHaveBeenCalledTimes(2);
  tree.rerender(
    <ThemeProvider>
      <LoadingView message="Loading coverage" />
    </ThemeProvider>,
  );
  expect(screen.getByRole('progressbar', { name: 'Loading coverage' })).toBeVisible();
});
