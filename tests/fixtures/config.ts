import type { KeyValueStore } from '../../src/core/storage/KeyValueStore';
import type { ConfigKey, RemoteConfigService } from '../../src/core/config/ConfigRepository';
import { defaults } from '../../src/core/config/defaults';

export class MemoryKeyValueStore implements KeyValueStore {
  readonly values = new Map<string, string>();
  failReads = false;
  failWrites = false;
  async get(key: string): Promise<string | null> {
    if (this.failReads) throw new Error('storage unavailable');
    return this.values.get(key) ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    if (this.failWrites) throw new Error('storage unavailable');
    this.values.set(key, value);
  }
  async remove(key: string): Promise<void> {
    this.values.delete(key);
  }
}

export class StubRemoteConfigService implements RemoteConfigService {
  failFetch = false;
  parameters: Record<ConfigKey, string> = {
    app_info: JSON.stringify(defaults.app_info),
    data: JSON.stringify(defaults.data),
    config: JSON.stringify(defaults.config),
  };
  async fetch(): Promise<Record<ConfigKey, string>> {
    if (this.failFetch) throw new Error('network unavailable');
    return this.parameters;
  }
}
