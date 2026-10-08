import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { QuestionSchema } from '../../src/features/content/domain/question';
import { canonicalJson } from '../../tools/questions/editorial';
import { coverageReport } from '../../tools/questions/coverage';
import { buildReviewPacket } from '../../tools/questions/review-packet';
import {
  loadCandidates,
  loadOverlays,
  loadApprovedPublication,
} from '../../tools/questions/source-workflow';

const root = resolve(__dirname, '../..');
const read = async (path: string) => JSON.parse(await readFile(resolve(root, path), 'utf8'));

test('full-corpus review manifest reconciles every occurrence and binds exact current packets without granting approval', async () => {
  const index = await read('docs/verification/editorial-full-corpus/review-index.json');
  const manifest = await read('docs/verification/editorial-full-corpus/owner-review-manifest.json');
  const candidates = await loadCandidates(root);
  const overlays = await loadOverlays(root);
  expect(candidates).toHaveLength(687);
  expect(index.occurrences).toHaveLength(687);
  expect(new Set(index.occurrences.map((row: { sourceKey: string }) => row.sourceKey))).toEqual(
    new Set(candidates.map((c) => c.original.sourceKey)),
  );
  expect(index.totals).toEqual({ approved: 20, needsReview: 509, draft: 145, rejected: 13 });
  expect(index.packets).toHaveLength(20);
  const rows = [];
  for (const entry of index.packets) {
    const batch = overlays.filter((o) => entry.sourceKeys.includes(o.sourceKey));
    expect(batch).toHaveLength(entry.sourceKeys.length);
    const packet = buildReviewPacket(entry.batchId, candidates, batch);
    expect(packet.manifest.packetDigest).toBe(entry.packetDigest);
    expect(packet.manifest.rows).toEqual(entry.rows);
    // Read the actual linked immutable artifacts: reconstruction alone cannot detect
    // missing owner evidence or altered snapshots.
    expect(await read(entry.paths.manifest)).toEqual(packet.manifest);
    expect(await read(entry.paths.overlays)).toEqual(packet.overlays);
    expect(await readFile(resolve(root, entry.paths.review), 'utf8')).toBe(packet.markdown);
    expect(await read(entry.paths.coverage)).toEqual(
      coverageReport(
        candidates.filter((candidate) => entry.sourceKeys.includes(candidate.original.sourceKey)),
        batch,
        [],
      ),
    );
    rows.push(...packet.manifest.rows);
  }
  expect(rows).toHaveLength(667);
  expect(new Set(rows.map((r) => r.sourceKey)).size).toBe(667);
  const reviewable = overlays.filter((o) => o.status === 'needsReview');
  expect(manifest.revisions).toHaveLength(reviewable.length);
  expect(new Set(manifest.revisions.map((r: { sourceKey: string }) => r.sourceKey))).toEqual(
    new Set(reviewable.map((o) => o.sourceKey)),
  );
  for (const o of reviewable) {
    const q = QuestionSchema.parse(o.proposed);
    const r = manifest.revisions.find((r: { sourceKey: string }) => r.sourceKey === o.sourceKey);
    const row = rows.find((row) => row.sourceKey === o.sourceKey)!;
    expect(r).toMatchObject({ ...row, id: q.id, version: q.version });
    expect(o.approval).toBeUndefined();
    expect(
      o.review?.issues?.filter(
        (i) => i.blocking && !o.review?.resolutions?.some((r) => r.code === i.code),
      ),
    ).toEqual([]);
  }
  expect(manifest.manifestDigest).toBe(
    createHash('sha256').update(canonicalJson(manifest.revisions)).digest('hex'),
  );
  for (const [path, expected] of Object.entries(index.preservationHashes)) {
    expect(
      createHash('sha256')
        .update(await readFile(resolve(root, path)))
        .digest('hex'),
    ).toBe(expected);
  }
  expect(await loadApprovedPublication(root)).toHaveLength(20);
});

test('every rejected duplicate keeps stable identity and exact source lineage, with approved winner exception explicit', async () => {
  const reconciliation = await read('docs/verification/editorial-full-corpus/reconciliation.json');
  const overlays = await loadOverlays(root);
  const groups = reconciliation.groups;
  expect(groups).toHaveLength(13);
  expect(new Set(groups.map((g: { duplicate: string }) => g.duplicate))).toEqual(
    new Set(overlays.filter((o) => o.status === 'rejected').map((o) => o.sourceKey)),
  );
  for (const g of groups) {
    const winner = overlays.find((o) => o.sourceKey === g.winner)!;
    const duplicate = overlays.find((o) => o.sourceKey === g.duplicate)!;
    const w = winner.proposed as { id: string; sources: unknown[] };
    const d = duplicate.proposed as { id: string; sources: unknown[] };
    expect(d.id).toBe(g.duplicateId);
    expect(w.id).toBe(g.winnerId);
    expect(d.id).not.toBe(w.id);
    expect(duplicate.rationale).toContain(g.winner);
    expect(d.sources).toContainEqual(g.sourceRefs[1]);
    expect(w.sources).toContainEqual(g.sourceRefs[0]);
    if (winner.status === 'approved') {
      expect(g.lineagePolicy).toContain('transfer requires a new exact review/approval');
    } else {
      expect(winner.status).toBe('needsReview');
      const retained = w.sources.find((s: unknown) => {
        const ref = s as { sourceId: string; section: string; originalNumber: string };
        return `${ref.sourceId}:${ref.section}:${ref.originalNumber}` === g.duplicate;
      }) as Record<string, unknown>;
      const authoritative = Object.fromEntries(
        Object.entries(g.sourceRefs[1]).filter(([key]) => key !== 'corrections'),
      );
      expect(retained).toMatchObject(authoritative);
      if (!g.priorDisposition) expect(retained).toEqual(g.sourceRefs[1]);
    }
  }
});
