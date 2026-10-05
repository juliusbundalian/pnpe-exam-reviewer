import { useState } from 'react';
import { Linking } from 'react-native';
import { schemas } from '../../../core/config/schemas';
import { AppScreen } from '../../../core/components/AppScreen';
import { AppText } from '../../../core/components/AppText';
import { AppButton } from '../../../core/components/AppButton';
export function LegalScreen({ title, url }: { title: string; url: string }) {
  const [failed, setFailed] = useState(false);
  const parsed = schemas.app_info.shape.termsUrl.safeParse(url);
  const valid = parsed.success && parsed.data !== '';
  async function open() {
    const checked = schemas.app_info.shape.termsUrl.safeParse(url);
    if (!checked.success || !checked.data) return;
    try {
      await Linking.openURL(checked.data);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }
  return (
    <AppScreen>
      <AppText variant="title">{title}</AppText>
      {valid ? (
        <>
          <AppText>{url}</AppText>
          <AppButton
            variant="primary"
            label={failed ? 'Retry' : `Open ${title}`}
            onPress={() => {
              void open();
            }}
          />
        </>
      ) : (
        <AppText>This legal content is currently unavailable.</AppText>
      )}
      {failed ? (
        <AppText accessibilityRole="alert">
          The browser could not open this page. Please retry.
        </AppText>
      ) : null}
    </AppScreen>
  );
}
