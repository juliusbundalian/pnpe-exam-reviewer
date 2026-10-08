import { canonicalJson, jsonBytes, MAX_CONTENT_BYTES } from '../../../core/content/Fingerprint';
import { StudyError } from '../../study/domain/study';
import { CatalogEntrySchema, QuestionRefSchema, type CatalogEntry } from './catalog';
import { QuestionSchema, type Question } from './question';

/** Projection of every required block, including explanation and shared stimulus. */
export function catalogEntryForQuestion(question: Question): CatalogEntry {
  const blocks = [
    ...question.prompt,
    ...question.choices.flatMap((choice) => choice.blocks),
    ...(question.explanation ?? []),
    ...(question.stimulus?.blocks ?? []),
  ];
  const assets = blocks
    .filter((block) => block.kind === 'image' || block.kind === 'diagram')
    .map((block) => ({ id: block.id, version: block.version, uri: block.uri }));
  return CatalogEntrySchema.parse({
    id: question.id,
    version: question.version,
    categoryId: question.categoryId,
    subcategoryId: question.subcategoryId,
    status: question.status,
    isCurrentEvent: question.isCurrentEvent,
    ...(question.publishedAt ? { publishedAt: question.publishedAt } : {}),
    ...(question.asOfDate ? { asOfDate: question.asOfDate } : {}),
    ...(question.expiresAt ? { expiresAt: question.expiresAt } : {}),
    supportedKinds: [...new Set(blocks.map((block) => block.kind))].sort(),
    ...(question.stimulus
      ? { stimulus: { id: question.stimulus.id, version: question.stimulus.version } }
      : {}),
    assets: [...new Map(assets.map((asset) => [canonicalJson(asset), asset])).values()],
  });
}

function normalized(entry: CatalogEntry): unknown {
  return {
    ...entry,
    supportedKinds: [...entry.supportedKinds].sort(),
    assets: [...entry.assets].sort((a, b) => {
      const left = canonicalJson(a),
        right = canonicalJson(b);
      return left < right ? -1 : left > right ? 1 : 0;
    }),
  };
}

/** Frozen entries are compared without applying new-session expiry eligibility. */
export function validateRevision(raw: unknown, entry: CatalogEntry): Question {
  try {
    if (jsonBytes(raw) > MAX_CONTENT_BYTES) throw new Error('Oversized revision');
    const question = QuestionSchema.parse(raw);
    // The legacy QuestionSchema trims identifiers; immutable transport identity must not.
    const dto = raw as {
      id: unknown;
      version: unknown;
      stimulus?: { id: unknown; version: unknown };
    };
    QuestionRefSchema.parse({ id: dto.id, version: dto.version });
    if (dto.stimulus)
      QuestionRefSchema.parse({ id: dto.stimulus.id, version: dto.stimulus.version });
    const expected = CatalogEntrySchema.parse(entry);
    if (
      canonicalJson(normalized(catalogEntryForQuestion(question))) !==
      canonicalJson(normalized(expected))
    )
      throw new Error('Revision does not match catalog');
    return question;
  } catch {
    throw new StudyError('invalid-content');
  }
}
