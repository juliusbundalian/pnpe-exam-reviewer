import { z } from 'zod';

/** Embedded passage identity, never a document path or a normalized label. */
export const StimulusRefSchema = z
  .strictObject({
    id: z
      .string()
      .min(1)
      .max(1500)
      .refine((id) => id === id.trim(), 'Padded stimulus identity')
      .regex(/^[^\u0000-\u001f\u007f-\u009f\u2028\u2029\uD800-\uDFFF]+$/u)
      .refine(
        (id) =>
          Array.from(id).reduce((bytes, character) => {
            const point = character.codePointAt(0)!;
            return bytes + (point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4);
          }, 0) <= 1500,
        'Stimulus identity exceeds UTF-8 byte limit',
      ),
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  })
  .readonly();
