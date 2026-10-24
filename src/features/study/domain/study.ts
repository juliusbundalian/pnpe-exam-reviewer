import { z } from 'zod';
import {
  CatalogEntrySchema,
  GenerationSchema,
  SafeIdSchema,
  SafeIntegerSchema,
} from '../../content/domain/catalog';
import { QuestionSchema } from '../../content/domain/question';
import { isTaxonomyPair } from '../../content/domain/taxonomy';

export const GeneratedIdSchema = SafeIdSchema.max(128);
export const OwnerContextSchema = z
  .strictObject({
    uid: SafeIdSchema.max(128),
    deviceId: GeneratedIdSchema,
    epoch: SafeIntegerSchema,
  })
  .readonly();
export type OwnerContext = z.infer<typeof OwnerContextSchema>;
export interface OwnerGuard {
  /** Recheck after asynchronous work and immediately before every local commit. */
  isCurrent(owner: OwnerContext): boolean;
}

export const StudyScopeSchema = z
  .strictObject({
    categoryId: QuestionSchema.unwrap().shape.categoryId,
    subcategoryId: QuestionSchema.unwrap().shape.subcategoryId.optional(),
  })
  .refine(
    (scope) => !scope.subcategoryId || isTaxonomyPair(scope.categoryId, scope.subcategoryId),
    'Invalid taxonomy pair',
  )
  .readonly();
export type StudyScope = z.infer<typeof StudyScopeSchema>;
export const ManifestItemSchema = z
  .strictObject({ ordinal: SafeIntegerSchema, entry: CatalogEntrySchema })
  .readonly();
export type ManifestItem = z.infer<typeof ManifestItemSchema>;
export const SessionStatusSchema = z.enum(['active', 'completed', 'archived']);
const ordinals = z
  .array(SafeIntegerSchema)
  .refine((values) => new Set(values).size === values.length, 'Duplicate viewed ordinal')
  .readonly();
export const SessionStateSchema = z
  .strictObject({
    sequence: SafeIntegerSchema,
    position: SafeIntegerSchema,
    status: SessionStatusSchema,
    viewedOrdinals: ordinals,
  })
  .readonly();
export type SessionState = z.infer<typeof SessionStateSchema>;

export const ReviewerSessionSchema = z
  .strictObject({
    id: GeneratedIdSchema,
    uid: OwnerContextSchema.unwrap().shape.uid,
    deviceId: GeneratedIdSchema,
    scope: StudyScopeSchema,
    generation: GenerationSchema,
    catalogValidatedAt: SafeIntegerSchema.nullable().default(null),
    createdAt: SafeIntegerSchema,
    shuffleQuestions: z.boolean(),
    items: z.array(ManifestItemSchema).min(1).readonly(),
    ...SessionStateSchema.unwrap().shape,
  })
  .superRefine((session, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (session.position >= session.items.length) issue('Position outside manifest');
    if (session.items.some((item, index) => item.ordinal !== index))
      issue('Manifest ordinals must be contiguous and ordered');
    if (new Set(session.items.map((item) => item.entry.id)).size !== session.items.length)
      issue('Duplicate logical question ID');
    if (
      session.items.some(
        (item) =>
          item.entry.categoryId !== session.scope.categoryId ||
          (session.scope.subcategoryId && item.entry.subcategoryId !== session.scope.subcategoryId),
      )
    )
      issue('Manifest outside scope');
    if (session.viewedOrdinals.some((ordinal) => ordinal >= session.items.length))
      issue('Viewed ordinal outside manifest');
    const allViewed = session.viewedOrdinals.length === session.items.length;
    if (
      (session.status === 'completed' && !allViewed) ||
      (session.status === 'active' && allViewed)
    )
      issue('Completion must agree with viewed membership');
  })
  .readonly();
export type ReviewerSession = z.infer<typeof ReviewerSessionSchema>;

export const BookmarkSchema = z
  .strictObject({
    uid: OwnerContextSchema.unwrap().shape.uid,
    questionId: SafeIdSchema,
    entry: CatalogEntrySchema,
    createdAt: SafeIntegerSchema,
    updatedAt: SafeIntegerSchema,
    deleted: z.boolean(),
    serverRevision: SafeIntegerSchema,
  })
  .superRefine((bookmark, ctx) => {
    if (bookmark.questionId !== bookmark.entry.id)
      ctx.addIssue({ code: 'custom', message: 'Pinned question identity mismatch' });
    if (bookmark.updatedAt < bookmark.createdAt)
      ctx.addIssue({ code: 'custom', message: 'Update predates creation' });
  })
  .readonly();
export type Bookmark = z.infer<typeof BookmarkSchema>;

const operationFields = {
  id: GeneratedIdSchema,
  uid: OwnerContextSchema.unwrap().shape.uid,
  deviceId: GeneratedIdSchema,
  recordId: SafeIdSchema,
  localSequence: SafeIntegerSchema,
  createdAt: SafeIntegerSchema,
  attempts: SafeIntegerSchema,
  nextAttemptAt: SafeIntegerSchema,
};
export const StudyOperationSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({
      ...operationFields,
      kind: z.literal('publishSession'),
      session: ReviewerSessionSchema,
    }),
    z.strictObject({
      ...operationFields,
      kind: z.literal('sessionState'),
      state: SessionStateSchema,
    }),
    z.strictObject({
      ...operationFields,
      kind: z.literal('bookmarkState'),
      bookmark: BookmarkSchema,
      baseRevision: SafeIntegerSchema,
    }),
  ])
  .superRefine((operation, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    switch (operation.kind) {
      case 'publishSession':
        if (
          operation.uid !== operation.session.uid ||
          operation.deviceId !== operation.session.deviceId ||
          operation.recordId !== operation.session.id ||
          operation.localSequence !== operation.session.sequence
        )
          issue('Publication identity/sequence mismatch');
        break;
      case 'sessionState':
        if (!GeneratedIdSchema.safeParse(operation.recordId).success)
          issue('Unsafe session identity');
        if (operation.localSequence !== operation.state.sequence) issue('State sequence mismatch');
        break;
      case 'bookmarkState':
        if (
          operation.uid !== operation.bookmark.uid ||
          operation.recordId !== operation.bookmark.questionId ||
          operation.baseRevision !== operation.bookmark.serverRevision
        )
          issue('Bookmark identity/base revision mismatch');
        break;
    }
  })
  .readonly();
export type StudyOperation = z.infer<typeof StudyOperationSchema>;

const messages = {
  'auth-required': 'Please sign in to continue studying.',
  'permission-denied': 'Your access could not be verified. Please sign in again.',
  network: 'You appear to be offline. Please try again when connected.',
  'invalid-content': 'This question could not be loaded. Please try again.',
  'empty-scope': 'No questions are available for this topic yet.',
  'storage-unavailable': 'Your study data could not be saved. Please try again.',
  'storage-corrupt': 'Your saved study data could not be read. Please try again.',
  conflict: 'Your saved question changed on another device. Please try again.',
} as const;
export type StudyErrorCode = keyof typeof messages;
export class StudyError extends Error {
  constructor(readonly code: StudyErrorCode) {
    super(messages[code]);
    this.name = 'StudyError';
  }
}
export class BookmarkConflictError extends StudyError {
  readonly remote: Bookmark;
  constructor(remote: unknown) {
    super('conflict');
    this.name = 'BookmarkConflictError';
    const parsed = BookmarkSchema.safeParse(remote);
    if (!parsed.success) throw new StudyError('invalid-content');
    this.remote = parsed.data;
  }
}
