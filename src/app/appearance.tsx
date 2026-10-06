import { AppearanceScreen } from '../features/settings/presentation/AppearanceScreen';
import { useSafeBack } from '../navigation/useSafeBack';
export default function AppearanceRoute() {
  const onBack = useSafeBack();
  return <AppearanceScreen onBack={onBack} />;
}
