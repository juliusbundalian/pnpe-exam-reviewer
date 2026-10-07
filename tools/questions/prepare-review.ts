import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { coverageReport } from './coverage';
import { buildReviewPacket, writeReviewPacket } from './review-packet';
import { loadApprovedPublication, loadCandidates, loadOverlays } from './source-workflow';

export async function prepareReview(
  args: readonly string[],
  root = resolve(__dirname, '../..'),
): Promise<void> {
  if (args.length !== 1 || args[0] !== 'short-initial')
    throw new Error('Use prepare-review.ts short-initial');
  const candidates = await loadCandidates(root);
  const overlays = await loadOverlays(root);
  const eligible = await loadApprovedPublication(root);
  const shortKeys = new Set(
    candidates.filter((c) => c.original.sourceId === 'short').map((c) => c.original.sourceKey),
  );
  const batch = overlays.filter((o) => shortKeys.has(o.sourceKey));
  if (
    shortKeys.size !== 20 ||
    batch.length !== 20 ||
    new Set(batch.map((o) => o.sourceKey)).size !== 20
  )
    throw new Error('First packet requires all 20 short occurrences');
  if (batch.some((o) => o.approval)) throw new Error('Preparation cannot stamp approvals');
  const coverage = coverageReport(candidates, overlays, eligible);
  const packet = buildReviewPacket('short-initial', candidates, batch);
  const directory = await writeReviewPacket(root, packet);
  await writeFile(join(directory, 'coverage.json'), `${JSON.stringify(coverage, null, 2)}\n`, {
    flag: 'wx',
  });
  console.log(
    `Packet: ${directory}\nDigest: ${packet.manifest.packetDigest}\nEligible: ${eligible.length}`,
  );
  for (const quota of coverage.quotas)
    console.log(
      `${quota.categoryId}: shortage ${quota.shortage} (eligible ${quota.eligible}/${quota.required})`,
    );
}
if (require.main === module)
  prepareReview(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
