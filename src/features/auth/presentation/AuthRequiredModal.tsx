export type AuthRequiredModalProps = {
  visible: boolean;
  title: string;
  message: string;
  onSignIn(): void;
  onRegister(): void;
  onCancel(): void;
  restoreFocusTarget?: { readonly current: AccessibilityFocusTarget | null };
};
export function AuthRequiredModal({
  visible,
  title,
  message,
  onSignIn,
  onRegister,
  onCancel,
  restoreFocusTarget,
}: AuthRequiredModalProps) {
  return (
    <AppModal
      visible={visible}
      title={title}
      onClose={onCancel}
      {...(restoreFocusTarget ? { restoreFocusTarget } : {})}
    >
      <AppText>{message}</AppText>
      <AppButton variant="primary" label="Sign In" onPress={onSignIn} />
      <AppButton variant="secondary" label="Register" onPress={onRegister} />
      <AppButton variant="text" label="Maybe Later" onPress={onCancel} />
    </AppModal>
  );
}
import { AppModal, type AccessibilityFocusTarget } from '../../../core/components/AppModal';
import { AppText } from '../../../core/components/AppText';
import { AppButton } from '../../../core/components/AppButton';
