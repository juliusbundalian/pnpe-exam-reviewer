import { z } from 'zod';
export const sourcePageSchema = z.object({
  page: z.number().int().positive(),
  text: z.string(),
  blocks: z.array(z.unknown()),
  links: z.array(z.string().url()),
  imageRefs: z.array(z.string()),
  imagePlacements: z
    .array(
      z.object({
        imageRef: z.string(),
        xref: z.number().int().positive(),
        bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
      }),
    )
    .optional(),
});

export const sourceDocumentSchema = z
  .object({
    sourceId: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    pageCount: z.number().int().positive(),
    pages: z.array(sourcePageSchema),
  })
  .superRefine((document, context) => {
    if (
      document.pages.length !== document.pageCount ||
      document.pages.some((page, index) => page.page !== index + 1)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Page count and ordered page numbering must agree',
      });
    }
  });

export type SourcePage = z.infer<typeof sourcePageSchema>;
export type SourceDocument = z.infer<typeof sourceDocumentSchema>;
