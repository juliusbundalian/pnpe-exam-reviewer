import { schemas } from '../../../core/config/schemas';
import { stored, storedJson, integer, textValue } from '../../../core/storage/sqlite/rows';
import type { SqlDatabase } from '../../../core/storage/sqlite/SqlDatabase';
import { CatalogEntrySchema } from '../../content/domain/catalog';
import { QuestionSchema } from '../../content/domain/question';
import { StudyError, type OwnerContext } from '../../study/domain/study';
import {
  ExamAttemptSchema,
  ExamResultSchema,
  type ExamAttempt,
  type ExamResult,
} from '../domain/exam';

export function examOwnerKeys(owner: OwnerContext): readonly string[] {
  return [owner.uid, owner.deviceId];
}

export async function readExamAttempt(
  db: SqlDatabase,
  owner: OwnerContext,
  id: string,
): Promise<ExamAttempt | null> {
  const row = (
    await db.all('SELECT * FROM exam_attempts WHERE uid = ? AND device_id = ? AND attempt_id = ?', [
      ...examOwnerKeys(owner),
      id,
    ])
  )[0];
  if (!row) return null;
  const items = await db.all(
    'SELECT * FROM exam_questions WHERE uid = ? AND device_id = ? AND attempt_id = ? ORDER BY ordinal',
    [...examOwnerKeys(owner), id],
  );
  const questions = items.map((item, ordinal) => {
    if (integer(item.ordinal) !== ordinal) throw new StudyError('storage-corrupt');
    return {
      entry: storedJson(CatalogEntrySchema, item.entry_json),
      question: storedJson(QuestionSchema, item.question_json),
      choiceOrder: storedJson(z.array(z.string().min(1)), item.choice_order_json),
      selectedChoiceId:
        item.selected_choice_id === null ? null : textValue(item.selected_choice_id),
      flagged: integer(item.flagged) === 1,
    };
  });
  return stored(ExamAttemptSchema, {
    id: textValue(row.attempt_id),
    uid: textValue(row.uid),
    deviceId: textValue(row.device_id),
    generation: textValue(row.generation),
    config: storedJson(schemas.config.shape.mockExam, row.config_json),
    startedAt: integer(row.started_at),
    deadlineAt: integer(row.deadline_at),
    lastEffectiveAt: integer(row.last_effective_at),
    position: integer(row.position),
    status: textValue(row.status),
    questions,
  });
}

export async function readExamResult(
  db: SqlDatabase,
  owner: OwnerContext,
  id: string,
): Promise<ExamResult | null> {
  const row = (
    await db.all(
      'SELECT result_json FROM exam_results WHERE uid = ? AND device_id = ? AND attempt_id = ?',
      [...examOwnerKeys(owner), id],
    )
  )[0];
  if (!row) return null;
  const result = storedJson(ExamResultSchema, row.result_json);
  if (result.uid !== owner.uid || result.deviceId !== owner.deviceId || result.attemptId !== id) {
    throw new StudyError('storage-corrupt');
  }
  return result;
}
import { z } from 'zod';
