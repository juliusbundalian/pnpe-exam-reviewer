import { LegalScreen } from '../features/settings/presentation/LegalScreen';
import { useConfig } from '../bootstrap/AppProviders';
import { useSafeBack } from '../navigation/useSafeBack';
export default function Route() {
  const config = useConfig('app_info');
  const onBack = useSafeBack();
  return <LegalScreen title="Terms" url={config.termsUrl} onBack={onBack} />;
}
