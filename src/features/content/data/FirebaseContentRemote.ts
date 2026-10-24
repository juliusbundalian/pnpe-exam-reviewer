import { z } from 'zod';
import { jsonBytes, MAX_CONTENT_BYTES } from '../../../core/content/Fingerprint';
import { StudyError } from '../../study/domain/study';
import {
  GenerationSchema,
  SafeIdSchema,
  QuestionRefSchema,
  type QuestionRef,
} from '../domain/catalog';
import { CatalogHeadSchema, type ContentRemote } from '../domain/ContentRemote';

/** The native facade implements both reads with server-only SDK functions. */
export interface ContentReadSdk {
  readDocument(path: string): Promise<unknown>;
  readPage(
    path: string,
    afterId: string | null,
    limit: number,
  ): Promise<readonly { id: string; data: unknown }[]>;
}
export function contentReadError(error: unknown): StudyError {
  if (error instanceof StudyError) return error;
  const raw =
    typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  const code = typeof raw === 'string' ? raw.replace(/^firestore\//, '') : '';
  if (code === 'permission-denied') return new StudyError('permission-denied');
  if (code === 'unauthenticated') return new StudyError('auth-required');
  if (code === 'unavailable' || code === 'deadline-exceeded') return new StudyError('network');
  return new StudyError('invalid-content');
}
export class FirebaseContentRemote implements ContentRemote {
  constructor(private readonly sdk: ContentReadSdk) {}
  private async read<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      throw contentReadError(error);
    }
  }
  readHead(): Promise<{ generation: string; revision: number }> {
    return this.read(async () =>
      CatalogHeadSchema.parse(await this.sdk.readDocument('questionCatalogs/current')),
    );
  }
  listShards(
    generation: string,
    afterId: string | null,
    limit: number,
  ): Promise<readonly { id: string; entries: unknown }[]> {
    return this.read(async () => {
      GenerationSchema.parse(generation);
      if (afterId !== null) SafeIdSchema.parse(afterId);
      if (!Number.isInteger(limit) || limit < 1 || limit > 50)
        throw new StudyError('invalid-content');
      const page = await this.sdk.readPage(`questionCatalogs/${generation}/shards`, afterId, limit);
      if (!Array.isArray(page) || page.length > limit) throw new StudyError('invalid-content');
      return page.map((document) => {
        SafeIdSchema.parse(document.id);
        if (jsonBytes(document.data) > MAX_CONTENT_BYTES) throw new StudyError('invalid-content');
        const dto = z.strictObject({ entries: z.unknown() }).parse(document.data);
        return { id: document.id, entries: dto.entries };
      });
    });
  }
  revision(ref: QuestionRef): Promise<unknown> {
    return this.read(async () => {
      const valid = QuestionRefSchema.parse(ref);
      const raw = await this.sdk.readDocument(`questions/${valid.id}/versions/${valid.version}`);
      if (jsonBytes(raw) > MAX_CONTENT_BYTES) throw new StudyError('invalid-content');
      return raw;
    });
  }
}
