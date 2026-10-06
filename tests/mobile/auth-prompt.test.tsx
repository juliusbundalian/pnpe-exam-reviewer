import { render, screen, userEvent } from '@testing-library/react-native';
import { AuthRequiredModal } from '../../src/features/auth/presentation/AuthRequiredModal';
import { ThemeProvider } from '../../src/core/theme/ThemeProvider';
import { AccessibilityInfo, AppState, Modal, Platform, View } from 'react-native';
import * as Native from 'react-native';
import { createRef } from 'react';
import { act } from '@testing-library/react-native';

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

function mockNativeWindowFocus() {
  const listeners = new Set<() => void>();
  const subscribe = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((event, listener) => {
      const callback = () => listener('active');
      if (event === 'focus') listeners.add(callback);
      return { remove: () => listeners.delete(callback) };
    });
  return {
    emit() {
      act(() => listeners.forEach((listener) => listener()));
    },
    restore: () => subscribe.mockRestore(),
  };
}

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
    const windowFocus = mockNativeWindowFocus();
    const setFocus = jest
      .spyOn(AccessibilityInfo, 'setAccessibilityFocus')
      .mockImplementation(() => {});
    const sendEvent = jest
      .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      .mockImplementation(() => {});
    const launcher = createRef<View>();
    const nodeHandle = jest
      .spyOn(jest.requireActual<typeof Native>('react-native'), 'findNodeHandle')
      .mockImplementation((target) => (target === launcher.current ? 42 : 41));
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
    expect(setFocus).toHaveBeenLastCalledWith(41);
    windowFocus.emit();
    expect(setFocus).toHaveBeenCalledTimes(1);
    expect(sendEvent).not.toHaveBeenCalled();
    const dismiss = screen.UNSAFE_getByType(Modal).props.onDismiss;
    tree.rerender(
      <ThemeProvider>
        <View ref={launcher} />
        <AuthRequiredModal visible={false} {...props} />
      </ThemeProvider>,
    );
    expect(setFocus).toHaveBeenCalledTimes(1);
    expect(sendEvent).not.toHaveBeenCalled();
    if (platform === 'ios') {
      act(() => dismiss());
      expect(setFocus).toHaveBeenCalledTimes(2);
      expect(setFocus).toHaveBeenLastCalledWith(42);
      expect(sendEvent).not.toHaveBeenCalled();
    } else {
      windowFocus.emit();
      expect(sendEvent).toHaveBeenCalledTimes(1);
      expect(sendEvent).toHaveBeenCalledWith(launcher.current, 'viewHoverEnter');
      expect(setFocus).toHaveBeenCalledTimes(1);
    }
    windowFocus.emit();
    expect(setFocus).toHaveBeenCalledTimes(platform === 'ios' ? 2 : 1);
    expect(sendEvent).toHaveBeenCalledTimes(platform === 'android' ? 1 : 0);
    setFocus.mockRestore();
    sendEvent.mockRestore();
    nodeHandle.mockRestore();
    windowFocus.restore();
    os.restore();
  },
);

test('Android cancels stale restoration when reopened or unmounted before native window focus', () => {
  const os = jest.replaceProperty(Platform, 'OS', 'android');
  const windowFocus = mockNativeWindowFocus();
  const setFocus = jest
    .spyOn(AccessibilityInfo, 'setAccessibilityFocus')
    .mockImplementation(() => {});
  const sendEvent = jest
    .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
    .mockImplementation(() => {});
  const launcher = createRef<View>();
  const nodeHandle = jest
    .spyOn(jest.requireActual<typeof Native>('react-native'), 'findNodeHandle')
    .mockImplementation((target) => (target === launcher.current ? 42 : 41));
  const props = {
    title: 'Sign in to continue',
    message: 'Continue',
    onCancel: jest.fn(),
    onSignIn: jest.fn(),
    onRegister: jest.fn(),
    restoreFocusTarget: launcher,
  };
  const prompt = (visible: boolean, mounted = true) => (
    <ThemeProvider>
      <View ref={launcher} />
      {mounted ? <AuthRequiredModal visible={visible} {...props} /> : null}
    </ThemeProvider>
  );
  const tree = render(prompt(true), { createNodeMock: () => ({}) });
  act(() => screen.UNSAFE_getByType(Modal).props.onShow());
  tree.rerender(prompt(false));
  expect(setFocus).toHaveBeenCalledTimes(1);
  tree.rerender(prompt(true));
  act(() => screen.UNSAFE_getByType(Modal).props.onShow());
  windowFocus.emit();
  expect(setFocus).toHaveBeenCalledTimes(2);
  expect(setFocus).toHaveBeenLastCalledWith(41);
  tree.rerender(prompt(false));
  tree.rerender(prompt(false, false));
  windowFocus.emit();
  expect(setFocus).toHaveBeenCalledTimes(2);
  expect(sendEvent).not.toHaveBeenCalled();
  setFocus.mockRestore();
  sendEvent.mockRestore();
  nodeHandle.mockRestore();
  windowFocus.restore();
  os.restore();
});

test('Android skips launcher restoration when its host ref is null', () => {
  const os = jest.replaceProperty(Platform, 'OS', 'android');
  const windowFocus = mockNativeWindowFocus();
  const sendEvent = jest
    .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
    .mockImplementation(() => {});
  const launcher = createRef<View>();
  const prompt = (visible: boolean) => (
    <ThemeProvider>
      <AuthRequiredModal
        visible={visible}
        title="Sign in"
        message="Continue"
        onCancel={jest.fn()}
        onSignIn={jest.fn()}
        onRegister={jest.fn()}
        restoreFocusTarget={launcher}
      />
    </ThemeProvider>
  );
  const tree = render(prompt(true));
  tree.rerender(prompt(false));
  windowFocus.emit();
  windowFocus.emit();
  expect(sendEvent).not.toHaveBeenCalled();
  sendEvent.mockRestore();
  windowFocus.restore();
  os.restore();
});

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
