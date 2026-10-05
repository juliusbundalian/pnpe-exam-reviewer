import { render, screen, userEvent } from '@testing-library/react-native';
import { AuthRequiredModal } from '../../src/features/auth/presentation/AuthRequiredModal';
import { ThemeProvider } from '../../src/core/theme/ThemeProvider';
import { AccessibilityInfo, Modal, Platform, View } from 'react-native';
import * as Native from 'react-native';
import { createRef } from 'react';
import { act } from '@testing-library/react-native';

test.each(['light', 'dark'] as const)(
  'prompt buttons dispatch only their selected action in %s',
  async (appearance) => {
    const cancel = jest.fn();
    const signIn = jest.fn();
    const register = jest.fn();
    render(
      <ThemeProvider initialAppearance={appearance}>
        <AuthRequiredModal
          visible
          title="Sign in to continue"
          message="Save your progress with an account."
          onCancel={cancel}
          onSignIn={signIn}
          onRegister={register}
        />
      </ThemeProvider>,
    );
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Maybe Later' }));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(signIn).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
    await user.press(screen.getByRole('button', { name: 'Sign In' }));
    await user.press(screen.getByRole('button', { name: 'Register' }));
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledTimes(1);
    for (const button of screen.getAllByRole('button'))
      expect(button).toHaveStyle({ minHeight: 44 });
    expect(screen.getByRole('header', { name: 'Sign in to continue' })).toBeVisible();
  },
);

test.each(['ios', 'android'] as const)(
  'modal focuses heading and restores launcher in %s',
  (platform) => {
    const os = jest.replaceProperty(Platform, 'OS', platform);
    const setFocus = jest
      .spyOn(AccessibilityInfo, 'setAccessibilityFocus')
      .mockImplementation(() => {});
    const nodeHandle = jest
      .spyOn(jest.requireActual<typeof Native>('react-native'), 'findNodeHandle')
      .mockReturnValue(42);
    const launcher = createRef<View>();
    const props = {
      title: 'Sign in to continue',
      message: 'Continue',
      onCancel: jest.fn(),
      onSignIn: jest.fn(),
      onRegister: jest.fn(),
      restoreFocusTarget: launcher,
    };
    const tree = render(
      <ThemeProvider>
        <View ref={launcher} />
        <AuthRequiredModal visible {...props} />
      </ThemeProvider>,
      { createNodeMock: () => ({}) },
    );
    act(() => screen.UNSAFE_getByType(Modal).props.onShow());
    expect(nodeHandle).toHaveBeenCalled();
    expect(setFocus).toHaveBeenCalledTimes(1);
    const dismiss = screen.UNSAFE_getByType(Modal).props.onDismiss;
    tree.rerender(
      <ThemeProvider>
        <View ref={launcher} />
        <AuthRequiredModal visible={false} {...props} />
      </ThemeProvider>,
    );
    if (platform === 'ios') act(() => dismiss());
    expect(setFocus).toHaveBeenCalledTimes(2);
    setFocus.mockRestore();
    nodeHandle.mockRestore();
    os.restore();
  },
);

test('hidden prompt exposes no controls', () => {
  render(
    <ThemeProvider>
      <AuthRequiredModal
        visible={false}
        title="Sign in"
        message="Continue"
        onCancel={jest.fn()}
        onSignIn={jest.fn()}
        onRegister={jest.fn()}
      />
    </ThemeProvider>,
  );
  expect(screen.queryByRole('button')).toBeNull();
});
