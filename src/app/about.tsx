import { AboutScreen } from '../features/settings/presentation/AboutScreen';
import { APP_VERSION } from '../navigation/startAvailability';
export default function AboutRoute() {
  return <AboutScreen version={APP_VERSION} />;
}
