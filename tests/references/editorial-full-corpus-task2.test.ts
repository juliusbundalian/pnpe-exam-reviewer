import { resolve } from 'node:path';
import { QuestionSchema } from '../../src/features/content/domain/question';
import { loadCandidates, loadOverlays, loadIdentityRegistry, loadApprovedPublication } from '../../tools/questions/source-workflow';
const root = resolve(__dirname, '../..');
const sections = new Set(['I', 'IX', 'XI', 'XIII', 'XIV', 'XV']);
test('task2 retains all165 occurrences, immutable lineage, issues and explicit blockers', async () => {
  const candidates = (await loadCandidates(root)).filter(c => c.original.sourceId === 'comprehensive' && sections.has(c.original.section));
  const overlays = (await loadOverlays(root)).filter(o => candidates.some(c => c.original.sourceKey === o.sourceKey));
  const registry = await loadIdentityRegistry(root);
  expect(candidates).toHaveLength(165);
  expect(overlays).toHaveLength(165);
  expect(new Set(overlays.map(o => o.sourceKey))).toEqual(new Set(candidates.map(c => c.original.sourceKey)));
  for (const c of candidates) {
    const o = overlays.find(o => o.sourceKey === c.original.sourceKey)!;
    const q = o.proposed as {id:string;sources:{sourceId:string;section:string;originalNumber:string;originalAnswer:string|null;originalChoiceLabels:string[];pages:{start:number;end:number};checksum:string;evidenceLocator:string;links:string[];imageLocations:string[]}[]};
    expect(q.id).toBe(registry[o.sourceKey]);
    expect(o.approval).toBeUndefined();
    const ref = q.sources.find((s) => `${s.sourceId}:${s.section}:${s.originalNumber}` === o.sourceKey);
    if (!ref) throw new Error(`Missing source reference: ${o.sourceKey}`);
    expect(ref.originalAnswer).toBe(c.original.rawAnswer);
    expect(ref.originalChoiceLabels).toEqual((c.original.rawChoices ?? []).map(x => x.label));
    expect(ref.pages).toEqual({start:c.original.pageStart,end:c.original.pageEnd});
    expect(ref.checksum).toBe(c.original.evidence.checksum);
    expect(ref.evidenceLocator).toBe(c.original.evidence.locator);
    expect(ref.links).toEqual(c.original.evidence.links);
    expect(ref.imageLocations).toEqual(c.original.evidence.imageLocations);
    for(const issue of c.issues)expect(o.review?.issues).toContainEqual(issue);
    const unresolved = o.review?.issues?.filter(i => i.blocking && !o.review?.resolutions?.some(r => r.code === i.code));
    if(o.status === 'needsReview') { QuestionSchema.parse(q); expect(unresolved).toEqual([]); }
    if(o.status === 'draft') expect(unresolved?.length).toBeGreaterThan(0);
  }
  const winner = QuestionSchema.parse(overlays.find(o => o.sourceKey === 'comprehensive:XIV:20')!.proposed);
  expect(winner.sources.map(s => `${s.section}:${s.originalNumber}`)).toEqual(['XIV:20','XIV:26']);
  expect(overlays.find(o => o.sourceKey === 'comprehensive:XIV:26')!.status).toBe('rejected');
  expect(await loadApprovedPublication(root)).toHaveLength(20);
});
