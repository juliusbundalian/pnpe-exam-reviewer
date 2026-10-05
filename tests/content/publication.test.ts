import { testQuestion } from '../fixtures/content/question';
import type { Question } from '../../src/features/content/domain/question';
import { contentDigest, publishable, publicationSet } from '../../tools/questions/publication';
import {
  canonicalJson,
  reviewDigest,
  combineBySourceKey,
  type EditorialOverlay,
} from '../../tools/questions/editorial';
import { normalize } from '../../tools/questions/normalize';
import { paragraphFixture } from './fixtures/source-records';

// Synthetic approvals exercise the gate only; never production editorial data.
function approvedOverlay(q: Question): EditorialOverlay {
  return {
    sourceKey: 'test:1',
    proposed: q,
    rationale: 'Synthetic gate fixture',
    evidence: [],
    status: 'approved',
    approval: { reviewer: 'test-only', at: '2026-10-04T00:00:00Z', digest: contentDigest(q) },
  };
}
test('currentEvents taxonomy cannot bypass time-sensitive safeguards with a false flag', () => {
  const q = testQuestion({
    categoryId: 'generalInformation',
    subcategoryId: 'currentEvents',
    isCurrentEvent: false,
  });
  expect(publishable(approvedOverlay(q))).toEqual({
    ok: false,
    issues: ['QUESTION_SCHEMA_INVALID'],
  });
});

test('editing an approved key invalidates approval', () => {
  const approved = approvedOverlay(testQuestion());
  approved.proposed = testQuestion({ correctChoiceId: 'c1' });
  expect(publishable(approved)).toMatchObject({ ok: false });
});

test('valid content without editorial approval does not publish', () => {
  expect(
    publishable({
      sourceKey: 'test:1',
      proposed: testQuestion(),
      rationale: 'synthetic',
      evidence: [],
      status: 'draft',
    }),
  ).toMatchObject({ ok: false });
});

test('canonical object ordering is recursive while arrays retain order', () => {
  expect(canonicalJson({ z: [{ b: 2, a: 1 }], a: 0 })).toBe('{"a":0,"z":[{"a":1,"b":2}]}');
  expect(contentDigest(testQuestion())).toBe(
    contentDigest({ ...testQuestion(), prompt: testQuestion().prompt }),
  );
  expect(canonicalJson([2, 1])).toBe('[2,1]');
});

test.each([
  testQuestion({ choices: [...testQuestion().choices].reverse() }),
  testQuestion({ updatedAt: '2026-10-05T00:00:00Z' }),
  testQuestion({
    stimulus: {
      id: 'passage',
      version: 1,
      blocks: [{ kind: 'text', text: 'Required context', marks: [] }],
    },
  }),
])('changed choices, dates or stimulus invalidate exact approval (%#)', (question) => {
  const overlay = approvedOverlay(testQuestion());
  overlay.proposed = question;
  expect(publishable(overlay)).toEqual({ ok: false, issues: ['EDITORIAL_APPROVAL_STALE'] });
});

test('synthetic exact approval publishes structural valid content', () => {
  expect(publishable(approvedOverlay(testQuestion()))).toEqual({
    ok: true,
    question: testQuestion(),
  });
});

test('structural validation precedes approval checks', () => {
  expect(
    publishable({ ...approvedOverlay(testQuestion()), proposed: { broken: true } }),
  ).toMatchObject({ ok: false, issues: expect.arrayContaining(['QUESTION_SCHEMA_INVALID']) });
});

test('source licensing evidence alone cannot approve content', () => {
  expect(
    publishable({
      sourceKey: 'test:1',
      proposed: testQuestion(),
      rationale: 'MIT software',
      evidence: ['LICENSE'],
      status: 'needsReview',
    }),
  ).toEqual({ ok: false, issues: ['EDITORIAL_APPROVAL_REQUIRED'] });
});

test('legal content requires primary-source factual verification bound to review approval', () => {
  const overlay = approvedOverlay(
    testQuestion({ categoryId: 'generalInformation', subcategoryId: 'constitutionAndLaws' }),
  );
  expect(publishable(overlay)).toMatchObject({ ok: false });
  overlay.review = {
    factualVerification: {
      sourceUrl: 'https://example.com/primary',
      verifiedAt: '2026-10-04T00:00:00Z',
      rationale: 'Checked primary authority',
    },
  };
  overlay.approval!.reviewDigest = reviewDigest(overlay.review);
  expect(publishable(overlay).ok).toBe(true);
  overlay.review.factualVerification!.rationale = 'Changed review';
  expect(publishable(overlay)).toEqual({ ok: false, issues: ['EDITORIAL_REVIEW_STALE'] });
});

test('stimulus assets require review of exact identity version and URI', () => {
  const asset = {
    kind: 'image' as const,
    id: 'figure',
    version: 1,
    uri: 'bundled://figure.png',
    width: 10,
    height: 10,
    alt: 'Figure',
  };
  const overlay = approvedOverlay(
    testQuestion({ stimulus: { id: 's', version: 1, blocks: [asset] } }),
  );
  expect(publishable(overlay)).toMatchObject({ ok: false });
  overlay.review = {
    assets: [
      { id: 'figure', version: 1, uri: asset.uri, status: 'reviewed', evidence: ['Visual review'] },
    ],
  };
  overlay.approval!.reviewDigest = reviewDigest(overlay.review);
  expect(publishable(overlay).ok).toBe(true);
});

test('authoritative source blockers require explicit evidenced resolution', () => {
  const overlay = approvedOverlay(testQuestion());
  const issues = [{ code: 'missing-choices', blocking: true, message: 'No supplied distractors' }];
  expect(publishable(overlay, { issues })).toMatchObject({ ok: false });
  overlay.review = {
    issues,
    resolutions: [
      {
        code: 'missing-choices',
        rationale: 'Separately authored conversion',
        evidence: ['Editorial worksheet'],
      },
    ],
  };
  overlay.approval!.reviewDigest = reviewDigest(overlay.review);
  expect(publishable(overlay, { issues }).ok).toBe(true);
  expect(
    publishable(overlay, {
      issues: [
        ...issues,
        { code: 'new-blocker', blocking: true, message: 'New extraction defect' },
      ],
    }),
  ).toMatchObject({ ok: false });
});

test('reconciliation preserves draft overlay bytes and exposes current blockers', () => {
  const candidate = normalize(paragraphFixture('A source passage'));
  const overlay = {
    ...approvedOverlay(testQuestion()),
    sourceKey: candidate.original.sourceKey,
    status: 'draft' as const,
  };
  const before = JSON.stringify(overlay);
  const combined = combineBySourceKey([candidate], [overlay]);
  expect(combined[0]?.overlay).toBe(overlay);
  expect(combined[0]?.issues).toEqual(candidate.issues);
  expect(JSON.stringify(overlay)).toBe(before);
  expect(() => combineBySourceKey([candidate], [overlay, overlay])).toThrow();
  expect(() => combineBySourceKey([candidate], [{ ...overlay, sourceKey: 'unknown' }])).toThrow();
});

test('empty publication set is honest and malformed approvals are errors', () => {
  expect(publicationSet([])).toEqual({ questions: [], errors: [] });
  const overlay = approvedOverlay(testQuestion());
  overlay.proposed = {};
  expect(publicationSet([{ overlay, issues: [] }])).toMatchObject({
    questions: [],
    errors: [{ sourceKey: 'test:1' }],
  });
});

test('removing previously approved review metadata invalidates approval', () => {
  const overlay = approvedOverlay(testQuestion());
  overlay.review = { issues: [] };
  overlay.approval!.reviewDigest = reviewDigest(overlay.review);
  delete overlay.review;
  expect(publishable(overlay)).toEqual({ ok: false, issues: ['EDITORIAL_REVIEW_STALE'] });
});

test('malformed reviewer identity cannot approve structurally valid questions', () => {
  const overlay = approvedOverlay(testQuestion());
  overlay.approval!.reviewer = ' ';
  expect(publishable(overlay)).toEqual({ ok: false, issues: ['EDITORIAL_SCHEMA_INVALID'] });
});

test('reordered question object keys have identical content hashes', () => {
  const question = testQuestion();
  const reversed = Object.fromEntries(Object.entries(question).reverse()) as Question;
  expect(contentDigest(reversed)).toBe(contentDigest(question));
});
