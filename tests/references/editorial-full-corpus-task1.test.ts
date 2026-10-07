import { resolve } from 'node:path';
import { QuestionSchema } from '../../src/features/content/domain/question';
import {
  loadCandidates,
  loadIdentityRegistry,
  loadOverlays,
  loadApprovedPublication,
} from '../../tools/questions/source-workflow';

const reviewedSections = new Set(['II', 'III', 'IV']);
const root = resolve(__dirname, '../..');

test('task 1 checkpoint accounts for every reviewed source and preserves canonical lineage and issues', async () => {
  const candidates = (await loadCandidates(root)).filter(
    (c) => c.original.sourceId === 'comprehensive' && reviewedSections.has(c.original.section),
  );
  const overlays = (await loadOverlays(root)).filter((o) =>
    candidates.some((c) => c.original.sourceKey === o.sourceKey),
  );
  const registry = await loadIdentityRegistry(root);
  expect(candidates).toHaveLength(100);
  expect(new Set(overlays.map((o) => o.sourceKey))).toEqual(
    new Set(candidates.map((c) => c.original.sourceKey)),
  );
  for (const c of candidates) {
    const o = overlays.find((item) => item.sourceKey === c.original.sourceKey)!;
    const q = QuestionSchema.parse(o.proposed);
    expect(q.id).toBe(registry[o.sourceKey]);
    expect(o.approval).toBeUndefined();
    expect(['needsReview', 'draft', 'rejected']).toContain(o.status);
    const source = q.sources.find(
      (s) => `${s.sourceId}:${s.section}:${s.originalNumber}` === o.sourceKey,
    )!;
    expect(source.originalAnswer).toBe(c.original.rawAnswer);
    expect(source.originalChoiceLabels).toEqual(
      c.original.rawChoices?.map((choice) => choice.label),
    );
    expect(source.pages).toEqual({ start: c.original.pageStart, end: c.original.pageEnd });
    expect(source.checksum).toBe(c.original.evidence.checksum);
    expect(source.evidenceLocator).toBe(c.original.evidence.locator);
    expect(source.links).toEqual(c.original.evidence.links);
    expect(source.imageLocations).toEqual(c.original.evidence.imageLocations);
    for (const issue of c.issues) expect(o.review?.issues).toContainEqual(issue);
    const unresolved =
      o.review?.issues?.filter(
        (issue) => issue.blocking && !o.review?.resolutions?.some((r) => r.code === issue.code),
      ) ?? [];
    if (o.status === 'needsReview') expect(unresolved).toEqual([]);
    if (o.status === 'draft') expect(unresolved.length).toBeGreaterThan(0);
    expect(q.choices.every((choice) => /^choice-\d+$/.test(choice.id))).toBe(true);
    expect(q.explanation?.length).toBeGreaterThan(0);
  }
  expect(await loadApprovedPublication(root)).toHaveLength(20);
});

test('visually conflicting vocabulary target stays blocked and removed alternatives keep their stable IDs', async () => {
  const overlays = await loadOverlays(root);
  const mismatch = overlays.find((o) => o.sourceKey === 'comprehensive:II:33')!;
  const q = QuestionSchema.parse(mismatch.proposed);
  expect(mismatch.status).toBe('draft');
  const prompt = q.prompt[0]!;
  expect(prompt.kind).toBe('text');
  if (prompt.kind === 'text')
    expect(prompt.marks.map((m) => prompt.text.slice(m.start, m.end))).toEqual(['flush out']);
  const duplicate = QuestionSchema.parse(
    overlays.find((o) => o.sourceKey === 'comprehensive:IV:2')!.proposed,
  );
  expect(duplicate.choices.map((c) => c.id)).toEqual([
    'choice-2',
    'choice-3',
    'choice-4',
    'choice-5',
  ]);
  expect(duplicate.sources[0]!.originalChoiceLabels).toEqual(['A', 'B', 'C', 'D', 'E']);
});
