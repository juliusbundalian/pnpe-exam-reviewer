import { z } from 'zod';
import { ContentBlockSchema } from './content';
import { isTaxonomyPair, taxonomy } from './taxonomy';

const nonempty = z.string().trim().min(1);
const version = z.number().int().positive();
const timestamp = z.iso.datetime({ offset: true });
const blocks = z.array(ContentBlockSchema).min(1).readonly();
const SourceRefSchema = z
  .strictObject({
    sourceId: nonempty,
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
    section: nonempty,
    originalNumber: nonempty,
    pages: z
      .strictObject({ start: z.number().int().positive(), end: z.number().int().positive() })
      .refine((pages) => pages.end >= pages.start)
      .readonly(),
    originalChoiceLabels: z.array(nonempty).readonly(),
    originalAnswer: nonempty,
    evidenceLocator: nonempty,
    links: z.array(z.url()).readonly(),
    imageLocations: z.array(nonempty).readonly(),
    corrections: z
      .array(z.strictObject({ reason: nonempty, evidenceLocator: nonempty }).readonly())
      .readonly(),
  })
  .readonly();

function rendered(block: z.infer<typeof ContentBlockSchema>): string {
  switch (block.kind) {
    case 'text':
      return block.text;
    case 'math':
      return block.expression;
    case 'image':
    case 'diagram':
      return `${block.id}@${block.version}`;
    case 'table':
      return JSON.stringify([block.headers, ...block.rows]);
  }
}

export const QuestionSchema = z
  .strictObject({
    id: nonempty,
    version,
    categoryId: z.enum(taxonomy.map((category) => category.id)),
    subcategoryId: z.enum(
      taxonomy.flatMap((category) => category.subcategories.map((child) => child.id)),
    ),
    prompt: blocks,
    choices: z
      .array(z.strictObject({ id: nonempty, blocks }).readonly())
      .min(2)
      .readonly(),
    correctChoiceId: nonempty,
    choiceOrderPolicy: z.enum(['fixed', 'shuffle']),
    sources: z.array(SourceRefSchema).min(1).readonly(),
    createdAt: timestamp,
    updatedAt: timestamp,
    status: z.enum(['active', 'inactive', 'archived']),
    isCurrentEvent: z.boolean(),
    explanation: blocks.optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    stimulus: z.strictObject({ id: nonempty, version, blocks }).readonly().optional(),
    reviewedTimeContext: nonempty.optional(),
    publishedAt: timestamp.optional(),
    asOfDate: z.iso.date().optional(),
    expiresAt: timestamp.optional(),
    verification: z
      .strictObject({ sourceUrl: z.url(), verifiedAt: timestamp, asOfDate: z.iso.date() })
      .readonly()
      .optional(),
  })
  .superRefine((q, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    if (!isTaxonomyPair(q.categoryId, q.subcategoryId))
      issue('subcategoryId', 'Invalid taxonomy pair');
    if (!q.choices.some((choice) => choice.id === q.correctChoiceId))
      issue('correctChoiceId', 'Unknown choice ID');
    if (new Set(q.choices.map((choice) => choice.id)).size !== q.choices.length)
      issue('choices', 'Duplicate choice ID');
    const alternatives = q.choices.map((choice) =>
      choice.blocks
        .map(rendered)
        .join(' ')
        .normalize('NFKC')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase(),
    );
    if (new Set(alternatives).size !== alternatives.length)
      issue('choices', 'Duplicate rendered alternative');
    if (Date.parse(q.updatedAt) < Date.parse(q.createdAt))
      issue('updatedAt', 'Update predates creation');
    if (
      q.isCurrentEvent &&
      (!q.reviewedTimeContext || !q.publishedAt || !q.asOfDate || !q.expiresAt || !q.verification)
    )
      issue('isCurrentEvent', 'Current events require reviewed dates and verification provenance');
    if (q.expiresAt && q.publishedAt && Date.parse(q.expiresAt) <= Date.parse(q.publishedAt))
      issue('expiresAt', 'Expiry must follow publication');
    if (q.verification && q.asOfDate && q.verification.asOfDate !== q.asOfDate)
      issue('verification', 'Verification must cover the stated as-of date');
  })
  .readonly();

export type Question = z.infer<typeof QuestionSchema>;
