import Constants from 'expo-constants';
import { version } from '../../package.json';
import type { ConfigModels } from '../core/config/schemas';

// This foundation has no OTA version updates. App config derives package.json's
// version; this reads that metadata, not the native binary version/build number.
function appVersion(): string {
  return Constants.expoConfig?.version ?? version;
}
export const APP_VERSION = appVersion();

function compareVersions(left: string, right: string): number {
  const parts = (value: string) => {
    const [core, ...pre] = value.split('+')[0]!.split('-');
    return { core: core!.split('.').map(BigInt), pre: pre.length ? pre.join('-').split('.') : [] };
  };
  const a = parts(left);
  const b = parts(right);
  for (let i = 0; i < 3; i++) {
    if (a.core[i]! < b.core[i]!) return -1;
    if (a.core[i]! > b.core[i]!) return 1;
  }
  if (!a.pre.length || !b.pre.length) return a.pre.length ? -1 : b.pre.length ? 1 : 0;
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i];
    const y = b.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    const xNumeric = /^\d+$/.test(x);
    const yNumeric = /^\d+$/.test(y);
    if (xNumeric && yNumeric) return BigInt(x) < BigInt(y) ? -1 : 1;
    if (xNumeric !== yNumeric) return xNumeric ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return 0;
}

export function startBlock(info: ConfigModels['app_info']): string | null {
  if (info.maintenanceMode)
    return (
      info.maintenanceMessage ||
      'New study sessions are temporarily unavailable during maintenance. You can keep browsing.'
    );
  if (compareVersions(appVersion(), info.minimumSupportedVersion) < 0)
    return 'Update the app to start a new study session. Public browsing remains available.';
  return null;
}
