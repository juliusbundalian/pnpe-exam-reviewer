import {
  CatalogSnapshotSchema,
  type CatalogSnapshot,
} from '../../src/features/content/domain/catalog';
import { taxonomy, type CategoryId } from '../../src/features/content/domain/taxonomy';
import { studyEntry } from './study';
import { defaults } from '../../src/core/config/defaults';
import { selectExamEntries } from '../../src/features/exam/domain/selection';
import { ExamAttemptSchema, scoreExam, type ExamResult } from '../../src/features/exam/domain/exam';
import { testQuestion } from './content/question';

const counts: Record<CategoryId, number> = {
  generalInformation: 134,
  communicationSkills: 276,
  quantitativeReasoning: 41,
  criticalThinking: 78,
};

export function examCatalog(): CatalogSnapshot {
  const entries = taxonomy.flatMap((category) => {
    const subcategories = category.subcategories.filter((item) => item.id !== 'currentEvents');
    return Array.from({ length: counts[category.id] }, (_, index) =>
      studyEntry({
        id: `${category.id}-${index}`,
        categoryId: category.id,
        subcategoryId: subcategories[index % subcategories.length]!.id,
        stimulus:
          category.id === 'communicationSkills' && index < 2
            ? { id: 'shared-passage', version: 1 }
            : undefined,
      }),
    );
  });
  return CatalogSnapshotSchema.parse({
    generation: 'a'.repeat(64),
    revision: 2,
    validatedAt: 100,
    entries,
  });
}

export function examResult(): ExamResult {
  const config = defaults.config.mockExam;
  const entries = selectExamEntries(examCatalog(), config, 1_000, { next: () => 0 });
  const attempt = ExamAttemptSchema.parse({
    id: 'exam-fixture',
    uid: 'alice',
    deviceId: 'device-one',
    generation: 'a'.repeat(64),
    config,
    startedAt: 1_000,
    deadlineAt: 1_000 + config.durationMinutes * 60_000,
    lastEffectiveAt: 1_000,
    position: 0,
    status: 'active',
    questions: entries.map((entry) => ({
      entry,
      question: testQuestion({
        id: entry.id,
        version: entry.version,
        categoryId: entry.categoryId,
        subcategoryId: entry.subcategoryId,
        stimulus: entry.stimulus
          ? { ...entry.stimulus, blocks: [{ kind: 'text', text: 'Shared', marks: [] }] }
          : undefined,
      }),
      choiceOrder: ['c1', 'c2'],
      selectedChoiceId: null,
      flagged: false,
    })),
  });
  return scoreExam(attempt, 'manual', 2_000);
}
