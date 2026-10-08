import type { z } from 'zod';
import { StudyError } from '../../../features/study/domain/study';

export function stored<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new StudyError('storage-corrupt');
  return result.data;
}
export function storedJson<T>(schema: z.ZodType<T>, value: unknown): T {
  try {
    if (typeof value !== 'string') throw new Error('Expected stored JSON');
    return stored(schema, JSON.parse(value));
  } catch {
    throw new StudyError('storage-corrupt');
  }
}
export function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new StudyError('storage-corrupt');
  return value;
}
export function textValue(value: unknown): string {
  if (typeof value !== 'string') throw new StudyError('storage-corrupt');
  return value;
}
