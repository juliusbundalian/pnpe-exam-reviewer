import { Firestore, type DocumentReference } from 'firebase-admin/firestore';
import { QuestionSchema, type Question } from '../../src/features/content/domain/question';
import type { CatalogEntry, ImportStore } from './import-store';
import { canonicalJson } from './editorial';
import { checkedTarget } from './cli';
import { assertFirestoreDocument } from './firestore-limits';

function documentId(id: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id) || Buffer.byteLength(id) > 1500 || /^__.*__$/.test(id))
    throw new Error('Unsafe Firestore document ID');
  return id;
}
function bounded(value: unknown) {
  assertFirestoreDocument(value);
  const json = canonicalJson(value);
  if (Buffer.byteLength(json) > 700 * 1024) throw new Error('Document exceeds 700 KiB');
  return JSON.parse(json) as Record<string, unknown>;
}
export class FirebaseImportStore implements ImportStore {
  readonly projectId: string;
  private readonly db: Firestore;
  constructor(rawTarget: {
    projectId: string;
    mode: 'emulator' | 'production';
    emulatorHost?: string;
  }) {
    const target = checkedTarget(rawTarget.projectId, rawTarget.emulatorHost);
    if (rawTarget.mode !== target.mode)
      throw new Error('Explicit matching emulator/production mode required');
    // The SDK gives this environment variable precedence over constructor options.
    if (
      process.env.FIRESTORE_EMULATOR_HOST !== undefined &&
      process.env.FIRESTORE_EMULATOR_HOST !== target.emulatorHost
    )
      throw new Error('Emulator environment/target mismatch');
    this.projectId = target.projectId;
    this.db = new Firestore(
      target.emulatorHost
        ? {
            projectId: target.projectId,
            host: target.emulatorHost,
            ssl: false,
            // Explicit emulator-only auth prevents ADC even if local credentials exist.
            customHeaders: { Authorization: 'Bearer owner' },
            credentials: {
              client_email: 'emulator@localhost',
              private_key: 'emulator-only-no-signing',
            },
            universeDomain: 'googleapis.com',
          }
        : { projectId: target.projectId },
    );
  }
  private revision(id: string, version: number) {
    if (!Number.isSafeInteger(version) || version < 1) throw new Error('Invalid revision');
    return this.db.doc(`questions/${documentId(id)}/versions/${version}`);
  }
  private shard(generation: string, id: string) {
    if (!/^[a-f0-9]{64}$/.test(generation)) throw new Error('Invalid generation');
    return this.db.doc(`questionCatalogs/${generation}/shards/${documentId(id)}`);
  }
  async readRevision(id: string, version: number): Promise<Question | null> {
    const snapshot = await this.revision(id, version).get();
    return snapshot.exists ? QuestionSchema.parse(snapshot.data()) : null;
  }
  async readHead(): Promise<{ generation: string | null; revision: number }> {
    const snapshot = await this.db.doc('questionCatalogs/current').get();
    if (!snapshot.exists) return { generation: null, revision: 0 };
    const generation: unknown = snapshot.get('generation'),
      revision: unknown = snapshot.get('revision');
    if (
      typeof generation !== 'string' ||
      !/^[a-f0-9]{64}$/.test(generation) ||
      typeof revision !== 'number' ||
      !Number.isSafeInteger(revision) ||
      revision < 1
    )
      throw new Error('Invalid catalog head');
    return { generation, revision };
  }
  private async createImmutable(reference: DocumentReference, value: unknown) {
    const data = bounded(value);
    try {
      await reference.create(data);
    } catch (error) {
      if ((error as { code?: number }).code !== 6) throw error;
      const prior = await reference.get();
      if (!prior.exists || canonicalJson(prior.data()) !== canonicalJson(data))
        throw new Error('Immutable document conflict');
    }
  }
  async createRevision(question: Question): Promise<void> {
    const q = QuestionSchema.parse(question);
    await this.createImmutable(this.revision(q.id, q.version), q);
  }
  async writeShard(
    generation: string,
    id: string,
    entries: readonly CatalogEntry[],
  ): Promise<void> {
    if (!entries.length || entries.length > 200) throw new Error('Invalid shard count');
    await this.createImmutable(this.shard(generation, id), { entries });
  }
  async readShard(generation: string, id: string): Promise<readonly CatalogEntry[]> {
    const snapshot = await this.shard(generation, id).get();
    if (!snapshot.exists) return [];
    const entries: unknown = snapshot.get('entries');
    if (!Array.isArray(entries)) throw new Error('Invalid shard');
    return entries as CatalogEntry[];
  }
  async publishHead(expectedRevision: number, generation: string): Promise<void> {
    if (
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0 ||
      expectedRevision >= Number.MAX_SAFE_INTEGER ||
      !/^[a-f0-9]{64}$/.test(generation)
    )
      throw new Error('Invalid catalog head update');
    const reference = this.db.doc('questionCatalogs/current');
    const data = bounded({ generation, revision: expectedRevision + 1 });
    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const revision: unknown = snapshot.exists ? snapshot.get('revision') : 0;
      if (revision !== expectedRevision) throw new Error('Catalog head changed');
      transaction.set(reference, data);
    });
  }
}
