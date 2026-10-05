import type { ConfigModels } from '../core/config/schemas';
export const APP_VERSION = '0.1.0';
export function startBlock(info: ConfigModels['app_info']): string | null {
  if (info.maintenanceMode)
    return (
      info.maintenanceMessage ||
      'New study sessions are temporarily unavailable during maintenance. You can keep browsing.'
    );
  const minimum = info.minimumSupportedVersion.split(/[.-]/).slice(0, 3).map(Number);
  const current = APP_VERSION.split('.').map(Number);
  for (let index = 0; index < 3; index++) {
    if ((minimum[index] ?? 0) > (current[index] ?? 0))
      return 'Update the app to start a new study session. Public browsing remains available.';
    if ((minimum[index] ?? 0) < (current[index] ?? 0)) break;
  }
  return null;
}
