import type { Question } from '../../../src/features/content/domain/question';

export function testQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'fixture-percentage',
    version: 1,
    categoryId: 'quantitativeReasoning',
    subcategoryId: 'basicConcepts',
    prompt: [{ kind: 'text', text: 'What is 15% of 200?', marks: [] }],
    choices: [
      { id: 'c1', blocks: [{ kind: 'text', text: '20', marks: [] }] },
      { id: 'c2', blocks: [{ kind: 'text', text: '30', marks: [] }] },
    ],
    correctChoiceId: 'c2',
    choiceOrderPolicy: 'fixed',
    status: 'active',
    isCurrentEvent: false,
    sources: [
      {
        sourceId: 'synthetic-test-only',
        checksum: '0'.repeat(64),
        section: 'fixture',
        originalNumber: '1',
        pages: { start: 1, end: 1 },
        originalChoiceLabels: ['A', 'B'],
        originalAnswer: 'B',
        evidenceLocator: 'tests/fixtures/content/question.ts',
        links: [],
        imageLocations: [],
        corrections: [],
      },
    ],
    createdAt: '2026-10-04T00:00:00Z',
    updatedAt: '2026-10-04T00:00:00Z',
    ...overrides,
  };
}
