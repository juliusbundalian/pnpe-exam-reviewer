import { sourceRegistry, verifySource } from '../../tools/questions/source-registry';
import { sourcePageSchema, sourceDocumentSchema } from '../../tools/questions/source-schema';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pages from '../fixtures/content/source-pages.json';
test.each([[1], [1, 1], [2, 1]].map((numbers) => [numbers]))(
  'documents reject missing, duplicate or out-of-order pages (%#)',
  (numbers) => {
    const document = {
      sourceId: 'synthetic',
      sha256: '0'.repeat(64),
      pageCount: 2,
      pages: numbers.map((page) => ({ page, text: '', blocks: [], links: [], imageRefs: [] })),
    };
    expect(sourceDocumentSchema.safeParse(document).success).toBe(false);
  },
);

test('same filename is not evidence of the same reference', () => {
  expect(() => verifySource('short', new TextEncoder().encode('changed PDF'))).toThrow('checksum');
});

test.each(['references/evidence', 'src/evidence', 'data/editorial/evidence', '.'])(
  'extractor rejects protected output %s',
  (output) => {
    const result = spawnSync(
      'python3',
      ['tools/questions/extract.py', '--input', 'references/PNPE Reviewer.pdf', '--output', output],
      { encoding: 'utf8' },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Unsafe output');
  },
);

test('extractor rejects changed reference before creating evidence', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'pnpe-source-'));
  try {
    const input = join(temporary, 'PNPE Reviewer.pdf');
    writeFileSync(input, 'changed PDF');
    const result = spawnSync(
      'python3',
      ['tools/questions/extract.py', '--input', input, '--output', 'evidence/checksum-test'],
      { encoding: 'utf8' },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('checksum');
  } finally {
    rmSync(temporary, { recursive: true });
  }
});

test('source accounting matches inspected evidence', () => {
  expect(sourceRegistry.map((source) => source.expectedOccurrences)).toEqual([20, 477, 190]);
});

test('image-only evidence is retained and malformed page numbers rejected', () => {
  const imagePage = sourcePageSchema.parse(pages[0]);
  expect(imagePage.text).toBe('');
  expect(imagePage.imagePlacements?.[0]?.bbox).toEqual([73.5, 73.5, 525, 253.5]);
  expect(
    sourcePageSchema.parse({
      page: 150,
      text: '',
      blocks: [],
      links: [],
      imageRefs: ['images/a.png'],
    }).imageRefs,
  ).toEqual(['images/a.png']);
  expect(
    sourcePageSchema.safeParse({ page: 0, text: '', blocks: [], links: [], imageRefs: [] }).success,
  ).toBe(false);
});
