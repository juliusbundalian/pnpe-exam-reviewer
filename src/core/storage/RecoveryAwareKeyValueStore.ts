import type { KeyValueStore } from './KeyValueStore';
export class RecoveryAwareKeyValueStore implements KeyValueStore {
  constructor(
    private readonly storage: KeyValueStore,
    private readonly onFailure: () => void,
  ) {}
  async get(key: string) {
    try {
      return await this.storage.get(key);
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  async set(key: string, value: string) {
    try {
      await this.storage.set(key, value);
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  async remove(key: string) {
    try {
      await this.storage.remove(key);
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
}
