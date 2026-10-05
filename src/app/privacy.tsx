import { LegalScreen } from '../features/settings/presentation/LegalScreen';
import { useConfig } from '../bootstrap/AppProviders';
export default function Route() {
  const config = useConfig('app_info');
  return <LegalScreen title="Privacy Policy" url={config.privacyPolicyUrl} />;
}
