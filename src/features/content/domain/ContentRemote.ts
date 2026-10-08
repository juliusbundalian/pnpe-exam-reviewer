import { z } from 'zod';
import { GenerationSchema, SafeIntegerSchema } from './catalog';
import type { QuestionRef } from './catalog';

export const CatalogHeadSchema = z.strictObject({
  generation: GenerationSchema,
  revision: SafeIntegerSchema,
});

/** Server-source transport only; incomplete discovery is never a usable catalog. */
export interface ContentRemote {
  readHead(): Promise<{ generation: string; revision: number }>;
  listShards(
    generation: string,
    afterId: string | null,
    limit: number,
  ): Promise<readonly { id: string; entries: unknown }[]>;
  revision(ref: QuestionRef): Promise<unknown>;
}
