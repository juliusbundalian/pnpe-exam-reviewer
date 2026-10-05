import type { KeyValueStore } from '../storage/KeyValueStore';
import { z } from 'zod';
import { defaults } from './defaults';
import { isBoundedPayload, parseParameter, type ConfigKey, type ConfigModels } from './schemas';
export type { ConfigKey, ConfigModels } from './schemas';

export interface RemoteConfigService {
  fetch(): Promise<Record<ConfigKey, string>>;
}
const keys: readonly ConfigKey[] = ['app_info', 'data', 'config'];
const envelope = z.object({
  schemaVersion: z.literal(1),
  validatedAt: z.iso.datetime({ offset: true }),
  value: z.unknown(),
});

export class ConfigRepository {
  private values: ConfigModels = {
    app_info: parseParameter('app_info', JSON.stringify(defaults.app_info)),
    data: parseParameter('data', JSON.stringify(defaults.data)),
    config: parseParameter('config', JSON.stringify(defaults.config)),
  };
  private readonly listeners = new Set<() => void>();
  constructor(
    private readonly remote: RemoteConfigService,
    private readonly storage: KeyValueStore,
  ) {}
  async loadCached(): Promise<void> {
    for (const key of keys) {
      try {
        const raw = await this.storage.get(`remote-config:${key}`);
        // Envelope overhead is bounded independently, then the parameter is bounded again.
        if (!raw || !isBoundedPayload(raw, 256 * 1024 + 1024)) continue;
        const input: unknown = JSON.parse(raw);
        const cached = envelope.safeParse(input);
        if (!cached.success) continue;
        this.update(key, parseParameter(key, JSON.stringify(cached.data.value)));
      } catch {
        /* Public defaults/last-known-good values survive unavailable storage. */
      }
    }
  }
  async refresh(): Promise<void> {
    let parameters: Record<ConfigKey, string>;
    try {
      parameters = await this.remote.fetch();
    } catch {
      return;
    }
    for (const key of keys) {
      let value: ConfigModels[typeof key];
      try {
        value = parseParameter(key, parameters[key]);
      } catch {
        continue;
      }
      this.update(key, value);
      try {
        await this.storage.set(
          `remote-config:${key}`,
          JSON.stringify({ schemaVersion: 1, validatedAt: new Date().toISOString(), value }),
        );
      } catch {
        /* Valid memory updates remain usable when persistence fails. */
      }
    }
  }
  get<K extends ConfigKey>(key: K): ConfigModels[K] {
    return this.values[key];
  }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private update<K extends ConfigKey>(key: K, value: ConfigModels[K]): void {
    this.values[key] = value;
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        /* A consumer cannot interrupt other updates. */
      }
    }
  }
}
