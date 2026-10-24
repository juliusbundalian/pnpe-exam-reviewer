import { schemas } from '../../../core/config/schemas';
import type { Clock } from '../../../core/clock/Clock';
import type { IdentitySource } from '../../../core/identity/IdentitySource';
import type { RandomSource } from '../../../core/random/RandomSource';
import type { ContentRepository } from '../../content/domain/ContentRepository';
import { CatalogSnapshotSchema, SafeIntegerSchema } from '../../content/domain/catalog';
import { validateRevision } from '../../content/domain/revisionValidation';
import {
  OwnerContextSchema,
  StudyError,
  type OwnerContext,
  type OwnerGuard,
} from '../../study/domain/study';
import {
  ExamAttemptSchema,
  effectiveExamNow,
  type ExamAttempt,
  type ExamChange,
  type ExamResult,
} from '../domain/exam';
import type { ExamRepository } from '../domain/ExamRepository';
import { selectExamEntries, type ExamConfig } from '../domain/selection';

export interface MonotonicClock {
  now(): number;
}

function checkedTime(value: number): number {
  if (!SafeIntegerSchema.safeParse(value).success) throw new StudyError('invalid-content');
  return value;
}

function shuffleChoices(ids: string[], random: RandomSource): void {
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const draw = random.next();
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new StudyError('invalid-content');
    const other = Math.floor(draw * (index + 1));
    const value = ids[index]!;
    ids[index] = ids[other]!;
    ids[other] = value;
  }
}

export class ExamService {
  private startQueue: Promise<unknown> = Promise.resolve();
  private anchors = new Map<string, { persistedAt: number; monotonicAt: number }>();

  constructor(
    private readonly repository: ExamRepository,
    private readonly content: ContentRepository,
    private readonly clock: Clock,
    private readonly random: RandomSource,
    private readonly identity: IdentitySource,
    private readonly guard: OwnerGuard,
    private readonly startAllowed: () => boolean,
    private readonly monotonic: MonotonicClock,
  ) {}

  private check(owner: OwnerContext): void {
    if (!OwnerContextSchema.safeParse(owner).success || !this.guard.isCurrent(owner))
      throw new StudyError('auth-required');
  }

  private remember(attempt: ExamAttempt): void {
    this.anchors.set(attempt.id, {
      persistedAt: attempt.lastEffectiveAt,
      monotonicAt: checkedTime(this.monotonic.now()),
    });
  }

  private observedNow(attempt: ExamAttempt): number {
    const current = checkedTime(this.monotonic.now());
    const anchor = this.anchors.get(attempt.id);
    if (!anchor) {
      this.anchors.set(attempt.id, {
        persistedAt: attempt.lastEffectiveAt,
        monotonicAt: current,
      });
    }
    const baseline = anchor ?? { persistedAt: attempt.lastEffectiveAt, monotonicAt: current };
    return effectiveExamNow(
      { ...attempt, lastEffectiveAt: Math.max(attempt.lastEffectiveAt, baseline.persistedAt) },
      checkedTime(this.clock.now()),
      Math.max(0, current - baseline.monotonicAt),
    );
  }

  start(owner: OwnerContext, config: ExamConfig): Promise<ExamAttempt> {
    const next = this.startQueue.then(async () => {
      this.check(owner);
      const existing = await this.repository.active(owner);
      this.check(owner);
      if (existing) return this.resume(owner, existing.id);
      if (!this.startAllowed()) throw new StudyError('permission-denied');
      const parsedConfig = schemas.config.shape.mockExam.safeParse(config);
      if (!parsedConfig.success) throw new StudyError('invalid-content');
      const raw = await this.content.catalog(owner);
      this.check(owner);
      const parsedCatalog = CatalogSnapshotSchema.safeParse(raw);
      if (!parsedCatalog.success) throw new StudyError('invalid-content');
      const selected = selectExamEntries(
        parsedCatalog.data,
        parsedConfig.data,
        checkedTime(this.clock.now()),
        this.random,
      );
      const questions = [];
      for (let offset = 0; offset < selected.length; offset += 8) {
        const batch = await Promise.all(
          selected.slice(offset, offset + 8).map(async (entry) => {
            const rawQuestion = await this.content.question(owner, entry);
            this.check(owner);
            const question = validateRevision(rawQuestion, entry);
            const choiceOrder = question.choices.map((choice) => choice.id);
            if (parsedConfig.data.shuffleAnswers && question.choiceOrderPolicy === 'shuffle') {
              shuffleChoices(choiceOrder, this.random);
            }
            return {
              entry,
              question,
              choiceOrder,
              selectedChoiceId: null,
              flagged: false,
            };
          }),
        );
        questions.push(...batch);
      }
      this.check(owner);
      const startedAt = checkedTime(this.clock.now());
      const candidate = ExamAttemptSchema.safeParse({
        id: this.identity.nextId(),
        uid: owner.uid,
        deviceId: owner.deviceId,
        generation: parsedCatalog.data.generation,
        config: parsedConfig.data,
        startedAt,
        deadlineAt: startedAt + parsedConfig.data.durationMinutes * 60_000,
        lastEffectiveAt: startedAt,
        position: 0,
        questions,
        status: 'active',
      });
      if (!candidate.success) throw new StudyError('invalid-content');
      const saved = await this.repository.create(owner, candidate.data, () => {
        this.check(owner);
        if (!this.startAllowed()) throw new StudyError('permission-denied');
      });
      this.check(owner);
      this.remember(saved);
      return saved;
    });
    this.startQueue = next.catch(() => undefined);
    return next;
  }

  async resume(owner: OwnerContext, id: string): Promise<ExamAttempt> {
    this.check(owner);
    const attempt = await this.repository.attempt(owner, id);
    this.check(owner);
    if (!attempt || attempt.status !== 'active') throw new StudyError('conflict');
    const now = this.observedNow(attempt);
    if (now >= attempt.deadlineAt) {
      await this.repository.finalize(owner, id, now, 'timeExpired');
      throw new StudyError('conflict');
    }
    const observed = await this.repository.observeTime(owner, id, now);
    this.check(owner);
    this.remember(observed);
    return observed;
  }

  async remaining(owner: OwnerContext, id: string): Promise<number> {
    this.check(owner);
    const attempt = await this.repository.attempt(owner, id);
    this.check(owner);
    if (!attempt || attempt.status !== 'active') return 0;
    const now = this.observedNow(attempt);
    if (now >= attempt.deadlineAt) {
      await this.repository.finalize(owner, id, now, 'timeExpired');
      return 0;
    }
    const observed = await this.repository.observeTime(owner, id, now);
    this.check(owner);
    this.remember(observed);
    return observed.deadlineAt - Math.max(now, observed.lastEffectiveAt);
  }

  async change(owner: OwnerContext, id: string, change: ExamChange): Promise<ExamAttempt> {
    this.check(owner);
    const attempt = await this.repository.attempt(owner, id);
    this.check(owner);
    if (!attempt || attempt.status !== 'active') throw new StudyError('conflict');
    const now = this.observedNow(attempt);
    if (now >= attempt.deadlineAt) {
      await this.repository.finalize(owner, id, now, 'timeExpired');
      throw new StudyError('conflict');
    }
    const saved = await this.repository.change(owner, id, change, now, () =>
      this.observedNow(attempt),
    );
    this.check(owner);
    this.remember(saved);
    return saved;
  }

  async submit(
    owner: OwnerContext,
    id: string,
    reason: 'manual' | 'timeExpired',
  ): Promise<ExamResult> {
    this.check(owner);
    const attempt = await this.repository.attempt(owner, id);
    this.check(owner);
    if (!attempt) throw new StudyError('invalid-content');
    const now = this.observedNow(attempt);
    const result = await this.repository.finalize(
      owner,
      id,
      now,
      now >= attempt.deadlineAt ? 'timeExpired' : reason,
    );
    this.check(owner);
    return result;
  }
}
