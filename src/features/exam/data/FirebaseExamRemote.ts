import { canonicalJson } from '../../../core/content/Fingerprint';
import { contentReadError } from '../../content/data/FirebaseContentRemote';
import {
  GeneratedIdSchema,
  OwnerContextSchema,
  StudyError,
  type OwnerContext,
  type OwnerGuard,
} from '../../study/domain/study';
import { ExamResultSchema, type ExamResult, type ExamResultSummary } from '../domain/exam';
import type { ExamRemote } from '../domain/ExamRemote';
import {
  CloudExamItemSchema,
  CloudExamRootSchema,
  CloudExamSummarySchema,
  type CloudExamRoot,
} from './cloudExamSchemas';

export interface ExamCloudTransaction {
  get(path: string): Promise<unknown>;
  set(path: string, data: object): void;
}
export interface ExamCloudSdk {
  transaction<T>(check: () => void, action: (tx: ExamCloudTransaction) => Promise<T>): Promise<T>;
  readPage(
    check: () => void,
    path: string,
    afterId: string | null,
    limit: number,
  ): Promise<readonly { id: string; data: unknown }[]>;
}
function parsed<T>(schema: { parse(value: unknown): T }, value: unknown): T {
  try {
    return schema.parse(value);
  } catch {
    throw new StudyError('invalid-content');
  }
}
function sameWithoutTime(left: object, right: object): boolean {
  const stripped = (value: object) =>
    Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'writtenAt'));
  return canonicalJson(stripped(left)) === canonicalJson(stripped(right));
}

export class FirebaseExamRemote implements ExamRemote {
  constructor(
    private readonly sdk: ExamCloudSdk,
    private readonly guard: OwnerGuard,
  ) {}

  private check(owner: OwnerContext): void {
    parsed(OwnerContextSchema, owner);
    if (!this.guard.isCurrent(owner)) throw new StudyError('auth-required');
  }
  private async access<T>(owner: OwnerContext, work: () => Promise<T>): Promise<T> {
    this.check(owner);
    try {
      const value = await work();
      this.check(owner);
      return value;
    } catch (error) {
      throw contentReadError(error);
    }
  }
  private transaction<T>(owner: OwnerContext, work: (tx: ExamCloudTransaction) => Promise<T>) {
    return this.sdk.transaction(
      () => this.check(owner),
      async (tx) => {
        this.check(owner);
        const value = await work(tx);
        this.check(owner);
        return value;
      },
    );
  }

  private async page(
    owner: OwnerContext,
    path: string,
  ): Promise<readonly { id: string; data: unknown }[]> {
    const results: { id: string; data: unknown }[] = [];
    let after: string | null = null;
    for (;;) {
      this.check(owner);
      const items = await this.sdk.readPage(() => this.check(owner), path, after, 50);
      if (!items.length) return results;
      results.push(...items);
      after = items[items.length - 1]!.id;
      if (items.length < 50) return results;
    }
  }

  publish(owner: OwnerContext, value: ExamResult): Promise<void> {
    return this.access(owner, async () => {
      const result = parsed(ExamResultSchema, value);
      if (result.uid !== owner.uid || result.deviceId !== owner.deviceId)
        throw new StudyError('invalid-content');
      const summary = Object.fromEntries(
        Object.entries(result).filter(([key]) => key !== 'questions' && key !== 'syncState'),
      );
      const rootPath = `users/${owner.uid}/examAttempts/${result.attemptId}`;
      const root = parsed(CloudExamRootSchema, {
        uid: owner.uid,
        deviceId: owner.deviceId,
        attemptId: result.attemptId,
        itemCount: result.questions.length,
        phase: 'preparing',
        summary: parsed(CloudExamSummarySchema, summary),
        writtenAt: 0,
      });
      await this.transaction(owner, async (tx) => {
        const existing = await tx.get(rootPath);
        if (!existing) {
          tx.set(rootPath, root);
          return;
        }
        const saved = parsed(CloudExamRootSchema, existing);
        if (!sameWithoutTime({ ...saved, phase: 'preparing' }, root))
          throw new StudyError('conflict');
      });
      for (let ordinal = 0; ordinal < result.questions.length; ordinal += 1) {
        const item = parsed(CloudExamItemSchema, {
          uid: owner.uid,
          deviceId: owner.deviceId,
          attemptId: result.attemptId,
          ordinal,
          item: result.questions[ordinal],
          writtenAt: 0,
        });
        const path = `${rootPath}/items/${ordinal}`;
        await this.transaction(owner, async (tx) => {
          const existing = await tx.get(path);
          if (!existing) tx.set(path, item);
          else if (!sameWithoutTime(parsed(CloudExamItemSchema, existing), item))
            throw new StudyError('conflict');
        });
      }
      await this.transaction(owner, async (tx) => {
        const existing = parsed(CloudExamRootSchema, await tx.get(rootPath));
        if (!sameWithoutTime({ ...existing, phase: 'preparing' }, root))
          throw new StudyError('conflict');
        if (existing.phase === 'preparing')
          tx.set(rootPath, { ...existing, phase: 'ready', writtenAt: 0 });
      });
      const fetched = await this.result(owner, result.attemptId);
      if (canonicalJson(fetched) !== canonicalJson({ ...result, syncState: 'synced' }))
        throw new StudyError('invalid-content');
    });
  }

  history(owner: OwnerContext): Promise<readonly ExamResultSummary[]> {
    return this.access(owner, async () => {
      const roots = await this.page(owner, `users/${owner.uid}/examAttempts`);
      return roots
        .map(({ id, data }) => {
          const root = parsed(CloudExamRootSchema, data);
          if (root.uid !== owner.uid || root.attemptId !== id)
            throw new StudyError('invalid-content');
          return root;
        })
        .filter((root) => root.phase === 'ready')
        .map((root) => ({ ...root.summary, syncState: 'synced' as const }));
    });
  }

  result(owner: OwnerContext, attemptId: string): Promise<ExamResult> {
    return this.access(owner, async () => {
      parsed(GeneratedIdSchema, attemptId);
      const rootPath = `users/${owner.uid}/examAttempts/${attemptId}`;
      const raw = await this.transaction(owner, (tx) => tx.get(rootPath));
      if (!raw) throw new StudyError('invalid-content');
      const root: CloudExamRoot = parsed(CloudExamRootSchema, raw);
      if (root.uid !== owner.uid || root.attemptId !== attemptId || root.phase !== 'ready')
        throw new StudyError('invalid-content');
      const rows = await this.page(owner, `${rootPath}/items`);
      if (rows.length !== root.itemCount) throw new StudyError('invalid-content');
      const questions = rows
        .map(({ id, data }) => {
          const item = parsed(CloudExamItemSchema, data);
          if (
            item.uid !== owner.uid ||
            item.deviceId !== root.deviceId ||
            item.attemptId !== attemptId ||
            id !== String(item.ordinal) ||
            item.ordinal >= root.itemCount
          )
            throw new StudyError('invalid-content');
          return item;
        })
        .sort((a, b) => a.ordinal - b.ordinal);
      if (questions.some((item, index) => item.ordinal !== index))
        throw new StudyError('invalid-content');
      return parsed(ExamResultSchema, {
        ...root.summary,
        questions: questions.map((item) => item.item),
        syncState: 'synced',
      });
    });
  }
}
