import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareReview } from '../../tools/questions/prepare-review';
import {
  loadApprovedPublication,
  loadCandidates,
  loadOverlays,
} from '../../tools/questions/source-workflow';
import { writeReviewPacket } from '../../tools/questions/review-packet';
import { normalize } from '../../tools/questions/normalize';
import { paragraphFixture } from './fixtures/source-records';
import type { EditorialOverlay } from '../../tools/questions/editorial';

jest.mock('../../tools/questions/source-workflow');
jest.mock('../../tools/questions/review-packet', () => ({
  ...jest.requireActual('../../tools/questions/review-packet'),
  writeReviewPacket: jest.fn(),
}));

const candidates = Array.from({ length: 20 }, (_, i) => {
  const candidate = normalize(paragraphFixture('Synthetic context'));
  candidate.original.sourceId = 'short';
  candidate.original.sourceKey = `short:fixture:${i}`;
  return candidate;
});
const overlays: EditorialOverlay[] = candidates.map((candidate) => ({
  sourceKey: candidate.original.sourceKey,
  proposed: {},
  status: 'draft',
  rationale: 'Synthetic only',
  evidence: [],
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(loadCandidates).mockResolvedValue(candidates);
  jest.mocked(loadOverlays).mockResolvedValue(overlays);
  jest.mocked(loadApprovedPublication).mockResolvedValue([]);
});

test.each([[], ['unknown'], ['short-initial', 'extra']])(
  'rejects invalid arguments %j before reservation',
  async (...args) => {
    const root = await mkdtemp(join(tmpdir(), 'prepare-review-'));
    try {
      await expect(prepareReview(args, root)).rejects.toThrow(
        'Use prepare-review.ts short-initial',
      );
      expect(await readdir(root)).toEqual([]);
      expect(writeReviewPacket).not.toHaveBeenCalled();
      expect(loadCandidates).not.toHaveBeenCalled();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);

test.each(['missing candidate', 'missing overlay', 'duplicate overlay', 'approval'])(
  'rejects %s before reservation',
  async (scenario) => {
    if (scenario === 'missing candidate')
      jest.mocked(loadCandidates).mockResolvedValue(candidates.slice(1));
    if (scenario === 'missing overlay')
      jest.mocked(loadOverlays).mockResolvedValue(overlays.slice(1));
    if (scenario === 'duplicate overlay')
      jest.mocked(loadOverlays).mockResolvedValue([...overlays.slice(1), overlays[1]!]);
    if (scenario === 'approval')
      jest.mocked(loadOverlays).mockResolvedValue([
        {
          ...overlays[0]!,
          approval: { reviewer: 'test-only', at: '2026-10-07T00:00:00Z', digest: 'a'.repeat(64) },
        },
        ...overlays.slice(1),
      ]);
    const root = await mkdtemp(join(tmpdir(), 'prepare-review-'));
    try {
      await expect(prepareReview(['short-initial'], root)).rejects.toThrow(
        scenario === 'approval'
          ? 'Preparation cannot stamp approvals'
          : 'First packet requires all 20 short occurrences',
      );
      expect(await readdir(root)).toEqual([]);
      expect(writeReviewPacket).not.toHaveBeenCalled();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
