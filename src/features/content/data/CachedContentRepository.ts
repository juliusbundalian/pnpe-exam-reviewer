import type { Clock } from '../../../core/clock/Clock';
import {
  OwnerContextSchema,
  StudyError,
  type OwnerContext,
  type OwnerGuard,
} from '../../study/domain/study';
import {
  CatalogEntrySchema,
  CatalogShardSchema,
  CatalogSnapshotSchema,
  SafeIdSchema,
  type CatalogEntry,
  type CatalogSnapshot,
} from '../domain/catalog';
import type { ContentCache, ContentRepository } from '../domain/ContentRepository';
import { CatalogHeadSchema, type ContentRemote } from '../domain/ContentRemote';
import { validateRevision } from '../domain/revisionValidation';
import type { Question } from '../domain/question';

export class CachedContentRepository implements ContentRepository {
  constructor(
    private readonly remote: ContentRemote,
    private readonly cache: ContentCache,
    private readonly clock: Clock,
    private readonly ownerGuard: OwnerGuard,
  ) {}
  private check(owner: OwnerContext): void {
    if (!OwnerContextSchema.safeParse(owner).success || !this.ownerGuard.isCurrent(owner))
      throw new StudyError('auth-required');
  }
  private async observed<T>(owner: OwnerContext, work: () => Promise<T>): Promise<T> {
    this.check(owner);
    try {
      const result = await work();
      this.check(owner);
      return result;
    } catch (error) {
      this.check(owner);
      throw error;
    }
  }
  private async discover(owner: OwnerContext): Promise<CatalogSnapshot> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const parsedHead = CatalogHeadSchema.safeParse(
        await this.observed(owner, () => this.remote.readHead()),
      );
      if (!parsedHead.success) throw new StudyError('invalid-content');
      const head = parsedHead.data;
      const entries: CatalogEntry[] = [],
        ids = new Set<string>();
      let cursor: string | null = null;
      for (;;) {
        const page = await this.observed(owner, () =>
          this.remote.listShards(head.generation, cursor, 50),
        );
        if (!Array.isArray(page) || page.length > 50) throw new StudyError('invalid-content');
        for (const shard of page) {
          if (!SafeIdSchema.safeParse(shard.id).success || (cursor !== null && shard.id <= cursor))
            throw new StudyError('invalid-content');
          const parsed = CatalogShardSchema.safeParse(shard.entries);
          if (!parsed.success) throw new StudyError('invalid-content');
          for (const entry of parsed.data) {
            if (ids.has(entry.id)) throw new StudyError('invalid-content');
            ids.add(entry.id);
            entries.push(entry);
          }
          cursor = shard.id;
        }
        if (page.length < 50) break;
      }
      const parsedFinal = CatalogHeadSchema.safeParse(
        await this.observed(owner, () => this.remote.readHead()),
      );
      if (!parsedFinal.success) throw new StudyError('invalid-content');
      const final = parsedFinal.data;
      if (head.generation !== final.generation || head.revision !== final.revision) continue;
      const parsed = CatalogSnapshotSchema.safeParse({
        ...head,
        validatedAt: this.clock.now(),
        entries,
      });
      if (!parsed.success) throw new StudyError('invalid-content');
      await this.observed(owner, () => this.cache.saveCatalog(parsed.data));
      return parsed.data;
    }
    throw new StudyError('conflict');
  }
  async catalog(owner: OwnerContext): Promise<CatalogSnapshot> {
    this.check(owner);
    try {
      return await this.discover(owner);
    } catch (error) {
      this.check(owner);
      if (!(error instanceof StudyError) || error.code !== 'network') throw error;
      return this.cachedCatalog(owner);
    }
  }
  async cachedCatalog(owner: OwnerContext): Promise<CatalogSnapshot> {
    const cached = await this.observed(owner, () => this.cache.catalog());
    if (!cached) throw new StudyError('network');
    const valid = CatalogSnapshotSchema.safeParse(cached);
    if (!valid.success) throw new StudyError('storage-corrupt');
    return valid.data;
  }
  async question(owner: OwnerContext, entry: CatalogEntry): Promise<Question> {
    this.check(owner);
    const parsed = CatalogEntrySchema.safeParse(entry);
    if (!parsed.success) throw new StudyError('invalid-content');
    const ref = { id: parsed.data.id, version: parsed.data.version };
    const cached = await this.observed(owner, () => this.cache.question(ref));
    if (cached) return validateRevision(cached, parsed.data);
    const raw = await this.observed(owner, () => this.remote.revision(ref));
    const question = validateRevision(raw, parsed.data);
    await this.observed(owner, () => this.cache.saveQuestion(parsed.data, question));
    return question;
  }
}
