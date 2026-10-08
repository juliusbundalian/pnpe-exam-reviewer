import { QuestionSchema, type Question } from '../../src/features/content/domain/question';
import { CatalogEntrySchema, type CatalogEntry } from '../../src/features/content/domain/catalog';
import type {
  ReviewerSession,
  Bookmark,
  OwnerContext,
} from '../../src/features/study/domain/study';
import { testQuestion } from './content/question';

export const owner: OwnerContext = { uid: 'fixture-user', deviceId: 'fixture-device', epoch: 1 };
export const generation = 'a'.repeat(64);
export function studyQuestion(overrides: Partial<Question> = {}): Question {
  return QuestionSchema.parse(
    testQuestion({
      id: 'fixture-grammar',
      categoryId: 'communicationSkills',
      subcategoryId: 'grammar',
      prompt: [
        { kind: 'text', text: '😀 Café is open.', marks: [{ start: 3, end: 7, role: 'target' }] },
      ],
      stimulus: {
        id: 'fixture-passage',
        version: 1,
        blocks: [{ kind: 'text', text: 'A shared passage.', marks: [] }],
      },
      explanation: [
        {
          kind: 'math',
          expression: '(1 + 2) / 3',
          accessibleText: 'one plus two, divided by three',
        },
      ],
      ...overrides,
    }),
  );
}
export function studyEntry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return CatalogEntrySchema.parse({
    id: 'fixture-grammar',
    version: 1,
    categoryId: 'communicationSkills',
    subcategoryId: 'grammar',
    status: 'active',
    isCurrentEvent: false,
    supportedKinds: ['math', 'text'],
    stimulus: { id: 'fixture-passage', version: 1 },
    assets: [],
    ...overrides,
  });
}
export function studySession(overrides: Partial<ReviewerSession> = {}): ReviewerSession {
  return {
    id: 'fixture-device_session',
    uid: owner.uid,
    deviceId: owner.deviceId,
    scope: { categoryId: 'communicationSkills' },
    generation,
    createdAt: 100,
    shuffleQuestions: true,
    items: [
      { ordinal: 0, entry: studyEntry() },
      { ordinal: 1, entry: studyEntry({ id: 'fixture-second' }) },
    ],
    position: 0,
    viewedOrdinals: [],
    sequence: 0,
    status: 'active',
    ...overrides,
  };
}
export function studyBookmark(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    uid: owner.uid,
    questionId: 'fixture-grammar',
    entry: studyEntry(),
    createdAt: 100,
    updatedAt: 100,
    deleted: false,
    serverRevision: 0,
    ...overrides,
  };
}
