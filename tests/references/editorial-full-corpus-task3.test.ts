import { historicalOverlays } from './historical-overlays';
import { resolve } from 'node:path';
import { QuestionSchema } from '../../src/features/content/domain/question';
import {
  loadCandidates,
  loadOverlays,
  loadIdentityRegistry,
  loadApprovedPublication,
} from '../../tools/questions/source-workflow';

const root = resolve(__dirname, '../..');

test('all 190 notes retain source lineage, stable identity, source issues and honest authored/draft gates', async () => {
  const candidates = (await loadCandidates(root)).filter((c) => c.original.sourceId === 'notes');
  const overlays = historicalOverlays(await loadOverlays(root)).filter((o) =>
    o.sourceKey.startsWith('notes:'),
  );
  const registry = await loadIdentityRegistry(root);
  expect(candidates).toHaveLength(190);
  expect(overlays).toHaveLength(190);
  expect(new Set(overlays.map((o) => o.sourceKey))).toEqual(
    new Set(candidates.map((c) => c.original.sourceKey)),
  );
  for (const c of candidates) {
    const o = overlays.find((o) => o.sourceKey === c.original.sourceKey)!;
    const q = o.proposed as {
      id: string;
      sources: {
        sourceId: string;
        section: string;
        originalNumber: string;
        originalAnswer: string | null;
        originalChoiceLabels: string[];
        pages: { start: number; end: number };
        checksum: string;
        evidenceLocator: string;
        links: string[];
        imageLocations: string[];
        corrections: { reason: string }[];
      }[];
    };
    expect(q.id).toBe(registry[o.sourceKey]);
    expect(o.approval).toBeUndefined();
    const ref = q.sources.find(
      (s) => `${s.sourceId}:${s.section}:${s.originalNumber}` === o.sourceKey,
    )!;
    expect(ref).toBeDefined();
    expect(ref.originalAnswer).toBe(c.original.rawAnswer);
    expect(ref.originalChoiceLabels).toEqual((c.original.rawChoices ?? []).map((x) => x.label));
    expect(ref.pages).toEqual({ start: c.original.pageStart, end: c.original.pageEnd });
    expect(ref.checksum).toBe(c.original.evidence.checksum);
    expect(ref.evidenceLocator).toBe(c.original.evidence.locator);
    expect(ref.links).toEqual(c.original.evidence.links);
    expect(ref.imageLocations).toEqual(c.original.evidence.imageLocations);
    for (const issue of c.issues) expect(o.review?.issues).toContainEqual(issue);
    const unresolved = o.review?.issues?.filter(
      (i) => i.blocking && !o.review?.resolutions?.some((r) => r.code === i.code),
    );
    if (o.status === 'needsReview') {
      const parsed = QuestionSchema.parse(q);
      expect(unresolved).toEqual([]);
      expect(parsed.choices.length).toBeGreaterThanOrEqual(3);
      const texts = parsed.choices.map((x) => JSON.stringify(x.blocks));
      expect(new Set(texts).size).toBe(texts.length);
      expect(ref.corrections.some((x) => x.reason.includes('Authored MCQ conversion'))).toBe(true);
      expect(o.review?.factualVerification?.sourceUrl).toMatch(/^https:\/\//);
    } else if (o.status === 'rejected') {
      expect(o.rationale).toMatch(/duplicate of /);
      expect(o.review?.issues?.some((i) => i.code === 'task4-duplicate')).toBe(true);
      QuestionSchema.parse(q);
    } else {
      expect(o.status).toBe('draft');
      expect(unresolved?.length).toBeGreaterThan(0);
      expect(o.review?.issues?.find((i) => i.code === 'task3-unresolved')?.message).toContain(
        o.sourceKey,
      );
    }
  }
  expect(await loadApprovedPublication(root)).toHaveLength(529);
});

test('PNP30 reviews the preserved 1901 inauguration claim without certifying an unsupported date', async () => {
  const c = (await loadCandidates(root)).find(
    (c) => c.original.sourceKey === 'notes:PNP Law and History:30',
  )!;
  const o = historicalOverlays(await loadOverlays(root)).find(
    (o) => o.sourceKey === c.original.sourceKey,
  )!;
  const q = o.proposed as { prompt: { text: string }[] };
  expect(c.original.rawPrompt).toMatch(/inaugurated.*August 8, 1901/);
  expect(q.prompt[0]!.text).toBe(c.original.rawPrompt);
  expect(o.status).toBe('draft');
  expect(o.rationale).toContain('8 August 1901 inauguration date');
  expect(o.rationale).toContain('Act No. 175');
  expect(o.rationale).toContain('PNP18');
  expect(o.rationale).not.toMatch(/Police Service Anniversary|current.policy|anniversary policy/);
  expect(o.review?.factualVerification).toBeUndefined();
  expect(o.evidence).toContain('https://lawphil.net/statutes/acts/act1901/act_175_1901.html');
});
