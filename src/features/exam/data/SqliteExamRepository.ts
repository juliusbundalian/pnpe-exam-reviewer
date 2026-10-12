import { canonicalJson } from '../../../core/content/Fingerprint';
import type { SqlDatabase } from '../../../core/storage/sqlite/SqlDatabase';
import { stored, textValue } from '../../../core/storage/sqlite/rows';
import { SafeIntegerSchema } from '../../content/domain/catalog';
import {
  GeneratedIdSchema,
  OwnerContextSchema,
  StudyError,
  type OwnerContext,
  type OwnerGuard,
} from '../../study/domain/study';
import {
  ExamAttemptSchema,
  ExamChangeSchema,
  ExamResultSchema,
  scoreExam,
  type ExamAttempt,
  type ExamChange,
  type ExamResult,
} from '../domain/exam';
import type { ExamRepository } from '../domain/ExamRepository';
import { examOwnerKeys, readExamAttempt, readExamResult } from './examSqlRows';

function input<T>(
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
  value: unknown,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new StudyError('invalid-content');
  return parsed.data;
}

export class SqliteExamRepository implements ExamRepository {
  constructor(
    private readonly db: SqlDatabase,
    private readonly guard: OwnerGuard,
  ) {}

  private check(owner: OwnerContext): void {
    input(OwnerContextSchema, owner);
    if (!this.guard.isCurrent(owner)) throw new StudyError('auth-required');
  }

  private async access<T>(
    owner: OwnerContext,
    work: (tx: SqlDatabase) => Promise<T>,
    beforeCommit?: () => void,
  ): Promise<T> {
    this.check(owner);
    try {
      const value = await this.db.exclusive(
        async (tx) => {
          this.check(owner);
          return work(tx);
        },
        () => {
          this.check(owner);
          beforeCommit?.();
        },
      );
      this.check(owner);
      return value;
    } catch (error) {
      if (error instanceof StudyError) throw error;
      throw new StudyError('storage-unavailable');
    }
  }

  active(owner: OwnerContext): Promise<ExamAttempt | null> {
    return this.access(owner, async (tx) => {
      const row = (
        await tx.all(
          "SELECT attempt_id FROM exam_attempts WHERE uid = ? AND device_id = ? AND status = 'active'",
          examOwnerKeys(owner),
        )
      )[0];
      return row ? readExamAttempt(tx, owner, textValue(row.attempt_id)) : null;
    });
  }

  attempt(owner: OwnerContext, id: string): Promise<ExamAttempt | null> {
    input(GeneratedIdSchema, id);
    return this.access(owner, (tx) => readExamAttempt(tx, owner, id));
  }

  create(
    owner: OwnerContext,
    candidate: ExamAttempt,
    beforeCommit?: () => void,
  ): Promise<ExamAttempt> {
    const value = input(ExamAttemptSchema, candidate);
    if (
      value.uid !== owner.uid ||
      value.deviceId !== owner.deviceId ||
      value.status !== 'active' ||
      value.position !== 0 ||
      value.questions.some((item) => item.selectedChoiceId !== null || item.flagged)
    )
      throw new StudyError('invalid-content');
    let inserted = false;
    return this.access(
      owner,
      async (tx) => {
        const row = (
          await tx.all(
            "SELECT attempt_id FROM exam_attempts WHERE uid = ? AND device_id = ? AND status = 'active'",
            examOwnerKeys(owner),
          )
        )[0];
        if (row) {
          const existing = await readExamAttempt(tx, owner, textValue(row.attempt_id));
          if (!existing) throw new StudyError('storage-corrupt');
          return existing;
        }
        await tx.run(
          'INSERT INTO exam_attempts (uid, device_id, attempt_id, generation, config_json, started_at, deadline_at, last_effective_at, position, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            ...examOwnerKeys(owner),
            value.id,
            value.generation,
            canonicalJson(value.config),
            value.startedAt,
            value.deadlineAt,
            value.lastEffectiveAt,
            value.position,
            value.status,
          ],
        );
        for (const [ordinal, item] of value.questions.entries()) {
          await tx.run(
            'INSERT INTO exam_questions (uid, device_id, attempt_id, ordinal, entry_json, question_json, choice_order_json, selected_choice_id, flagged) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              ...examOwnerKeys(owner),
              value.id,
              ordinal,
              canonicalJson(item.entry),
              canonicalJson(item.question),
              canonicalJson(item.choiceOrder),
              null,
              0,
            ],
          );
        }
        inserted = true;
        return value;
      },
      () => {
        if (inserted) beforeCommit?.();
      },
    );
  }

  change(
    owner: OwnerContext,
    id: string,
    change: ExamChange,
    now: number,
    effectiveNowAtCommit: () => number,
  ): Promise<ExamAttempt> {
    input(GeneratedIdSchema, id);
    const mutation = input(ExamChangeSchema, change);
    const at = input(SafeIntegerSchema, now);
    let deadlineAt: number | null = null;
    return this.access(
      owner,
      async (tx) => {
        const saved = await readExamAttempt(tx, owner, id);
        if (!saved) throw new StudyError('invalid-content');
        deadlineAt = saved.deadlineAt;
        if (saved.status !== 'active' || Math.max(at, saved.lastEffectiveAt) >= saved.deadlineAt)
          throw new StudyError('conflict');
        if (mutation.ordinal >= saved.questions.length) throw new StudyError('invalid-content');
        if (mutation.type === 'answer') {
          if (
            mutation.choiceId !== null &&
            !saved.questions[mutation.ordinal]!.choiceOrder.includes(mutation.choiceId)
          )
            throw new StudyError('invalid-content');
          await tx.run(
            'UPDATE exam_questions SET selected_choice_id = ? WHERE uid = ? AND device_id = ? AND attempt_id = ? AND ordinal = ?',
            [mutation.choiceId, ...examOwnerKeys(owner), id, mutation.ordinal],
          );
        } else if (mutation.type === 'flag') {
          await tx.run(
            'UPDATE exam_questions SET flagged = ? WHERE uid = ? AND device_id = ? AND attempt_id = ? AND ordinal = ?',
            [Number(mutation.flagged), ...examOwnerKeys(owner), id, mutation.ordinal],
          );
        }
        await tx.run(
          'UPDATE exam_attempts SET position = ?, last_effective_at = ? WHERE uid = ? AND device_id = ? AND attempt_id = ?',
          [
            mutation.type === 'move' ? mutation.ordinal : saved.position,
            Math.max(at, saved.lastEffectiveAt),
            ...examOwnerKeys(owner),
            id,
          ],
        );
        const updated = await readExamAttempt(tx, owner, id);
        if (!updated) throw new StudyError('storage-corrupt');
        return updated;
      },
      () => {
        const fresh = input(SafeIntegerSchema, effectiveNowAtCommit());
        if (deadlineAt !== null && fresh >= deadlineAt) throw new StudyError('conflict');
      },
    );
  }

  observeTime(owner: OwnerContext, id: string, now: number): Promise<ExamAttempt> {
    input(GeneratedIdSchema, id);
    const at = input(SafeIntegerSchema, now);
    return this.access(owner, async (tx) => {
      const saved = await readExamAttempt(tx, owner, id);
      if (!saved) throw new StudyError('invalid-content');
      if (saved.status !== 'active') throw new StudyError('conflict');
      await tx.run(
        'UPDATE exam_attempts SET last_effective_at = ? WHERE uid = ? AND device_id = ? AND attempt_id = ?',
        [Math.max(at, saved.lastEffectiveAt), ...examOwnerKeys(owner), id],
      );
      const updated = await readExamAttempt(tx, owner, id);
      if (!updated) throw new StudyError('storage-corrupt');
      return updated;
    });
  }

  finalize(
    owner: OwnerContext,
    id: string,
    now: number,
    reason: 'manual' | 'timeExpired',
  ): Promise<ExamResult> {
    input(GeneratedIdSchema, id);
    const at = input(SafeIntegerSchema, now);
    if (reason !== 'manual' && reason !== 'timeExpired') throw new StudyError('invalid-content');
    return this.access(owner, async (tx) => {
      const existing = await readExamResult(tx, owner, id);
      if (existing) return existing;
      const saved = await readExamAttempt(tx, owner, id);
      if (!saved) throw new StudyError('invalid-content');
      if (saved.status !== 'active') throw new StudyError('storage-corrupt');
      const effectiveAt = Math.max(at, saved.lastEffectiveAt);
      if (reason === 'timeExpired' && effectiveAt < saved.deadlineAt)
        throw new StudyError('invalid-content');
      const result = scoreExam(saved, reason, effectiveAt);
      await tx.run(
        "UPDATE exam_attempts SET status = 'completed', last_effective_at = ? WHERE uid = ? AND device_id = ? AND attempt_id = ?",
        [effectiveAt, ...examOwnerKeys(owner), id],
      );
      await tx.run(
        'INSERT INTO exam_results (uid, device_id, attempt_id, reason, ended_at, result_json) VALUES (?, ?, ?, ?, ?, ?)',
        [...examOwnerKeys(owner), id, result.reason, result.endedAt, canonicalJson(result)],
      );
      await tx.run(
        'INSERT INTO exam_outbox (uid, device_id, attempt_id, operation_id, created_at) VALUES (?, ?, ?, ?, ?)',
        [...examOwnerKeys(owner), id, `terminal-${id}`, effectiveAt],
      );
      return result;
    });
  }

  result(owner: OwnerContext, id: string): Promise<ExamResult | null> {
    input(GeneratedIdSchema, id);
    return this.access(owner, (tx) => readExamResult(tx, owner, id));
  }

  history(owner: OwnerContext): Promise<readonly ExamResult[]> {
    return this.access(owner, async (tx) => {
      const rows = await tx.all(
        'SELECT attempt_id FROM exam_results WHERE uid = ? AND device_id = ? ORDER BY ended_at DESC, attempt_id',
        examOwnerKeys(owner),
      );
      return Promise.all(
        rows.map(async (row) => {
          const result = await readExamResult(tx, owner, textValue(row.attempt_id));
          if (!result) throw new StudyError('storage-corrupt');
          return result;
        }),
      );
    });
  }

  pending(owner: OwnerContext): Promise<readonly ExamResult[]> {
    return this.access(owner, async (tx) => {
      const rows = await tx.all(
        'SELECT attempt_id FROM exam_outbox WHERE uid = ? AND device_id = ? ORDER BY created_at, attempt_id',
        examOwnerKeys(owner),
      );
      return Promise.all(
        rows.map(async (row) => {
          const result = await readExamResult(tx, owner, textValue(row.attempt_id));
          if (!result) throw new StudyError('storage-corrupt');
          return result;
        }),
      );
    });
  }

  acknowledge(owner: OwnerContext, id: string): Promise<void> {
    input(GeneratedIdSchema, id);
    return this.access(owner, async (tx) => {
      const result = await readExamResult(tx, owner, id);
      if (!result) return;
      const synced = stored(ExamResultSchema, { ...result, syncState: 'synced' });
      await tx.run(
        'UPDATE exam_results SET result_json = ? WHERE uid = ? AND device_id = ? AND attempt_id = ?',
        [canonicalJson(synced), ...examOwnerKeys(owner), id],
      );
      await tx.run('DELETE FROM exam_outbox WHERE uid = ? AND device_id = ? AND attempt_id = ?', [
        ...examOwnerKeys(owner),
        id,
      ]);
    });
  }
}
