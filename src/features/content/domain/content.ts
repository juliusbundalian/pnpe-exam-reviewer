import { z } from 'zod';

const nonempty = z.string().refine((value) => value.trim().length > 0, 'Expected nonempty content');
const mark = z
  .strictObject({
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    role: z.enum(['target', 'emphasis']),
  })
  .readonly();
const text = z
  .strictObject({ kind: z.literal('text'), text: nonempty, marks: z.array(mark).readonly() })
  .superRefine((block, ctx) => {
    block.marks.forEach((span, index) => {
      if (span.start >= span.end || span.end > block.text.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['marks', index],
          message: 'Mark must select existing text',
        });
      }
    });
  });
const asset = {
  id: nonempty,
  version: z.number().int().positive(),
  uri: z
    .string()
    .refine(
      (uri) =>
        /^https:\/\//.test(uri)
          ? z.url().safeParse(uri).success
          : /^bundled:\/\/[A-Za-z0-9][A-Za-z0-9/_.-]*$/.test(uri),
      'Expected HTTPS or bundled URI',
    ),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: nonempty,
};
const table = z
  .strictObject({
    kind: z.literal('table'),
    headers: z.array(nonempty).min(1).readonly(),
    rows: z.array(z.array(nonempty).readonly()).min(1).readonly(),
  })
  .superRefine((block, ctx) => {
    block.rows.forEach((row, index) => {
      if (row.length !== block.headers.length)
        ctx.addIssue({
          code: 'custom',
          path: ['rows', index],
          message: 'Row width must match headers',
        });
    });
  });

export const ContentBlockSchema = z
  .discriminatedUnion('kind', [
    text,
    z.strictObject({ kind: z.literal('math'), expression: nonempty, accessibleText: nonempty }),
    z.strictObject({ kind: z.literal('image'), ...asset }),
    table,
    z.strictObject({ kind: z.literal('diagram'), ...asset }),
  ])
  .readonly();

export type ContentBlock = z.infer<typeof ContentBlockSchema>;
