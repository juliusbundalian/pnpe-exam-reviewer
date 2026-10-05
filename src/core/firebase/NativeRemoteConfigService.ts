import type { FirebaseApp } from '@react-native-firebase/app';
import type { ConfigKey, RemoteConfigService } from '../config/ConfigRepository';
import { defaults } from '../config/defaults';

export class NativeRemoteConfigService implements RemoteConfigService {
  constructor(private readonly app: FirebaseApp) {}
  async fetch(): Promise<Record<ConfigKey, string>> {
    const sdk = await import('@react-native-firebase/remote-config');
    const config = sdk.getRemoteConfig(this.app);
    config.defaultConfig = {
      app_info: JSON.stringify(defaults.app_info),
      data: JSON.stringify(defaults.data),
      config: JSON.stringify(defaults.config),
    };
    config.settings = { fetchTimeoutMillis: 5000, minimumFetchIntervalMillis: 3600000 };
    await sdk.fetchAndActivate(config);
    return {
      app_info: sdk.getValue(config, 'app_info').asString(),
      data: sdk.getValue(config, 'data').asString(),
      config: sdk.getValue(config, 'config').asString(),
    };
  }
}
