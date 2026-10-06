import { AboutScreen } from '../features/settings/presentation/AboutScreen';
import { APP_VERSION } from '../navigation/startAvailability';
import { useSafeBack } from '../navigation/useSafeBack';
export default function AboutRoute() {
  const onBack = useSafeBack();
  return <AboutScreen version={APP_VERSION} onBack={onBack} />;
}
