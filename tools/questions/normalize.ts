import type { SourceRecord, SourceIssue } from './parsers/types';
import { issue } from './parsers/shared';
export interface NormalizedCandidate {
  original: SourceRecord;
  state: 'needsReview';
  proposed: {
    prompt: { kind: 'text'; text: string }[] | null;
    choices: { id: string; blocks: { kind: 'text'; text: string }[] }[] | null;
    correctChoiceId: string | null;
    explanation: { kind: 'text'; text: string }[] | null;
    stimulus: { id: string; version: number; blocks: { kind: 'text'; text: string }[] } | null;
  };
  taxonomyProposal: { categoryId: string; subcategoryId: string } | null;
  issues: SourceIssue[];
}
export function normalizeText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/\u200b/g, '')
    .replace(/[\t ]+/g, ' ')
    .trim();
}
function proposal(record: SourceRecord): NormalizedCandidate['taxonomyProposal'] {
  const mappings: Record<string, [string, string]> = {
    II: ['communicationSkills', 'vocabulary'],
    III: ['communicationSkills', 'grammar'],
    IV: ['communicationSkills', 'grammar'],
    V: ['communicationSkills', 'readingComprehension'],
    VI: ['communicationSkills', 'readingComprehension'],
    VII: ['communicationSkills', 'grammar'],
    VIII: ['communicationSkills', 'grammar'],
    X: ['criticalThinking', 'patternAnalysis'],
    XII: ['criticalThinking', 'wordAnalogy'],
    XV: ['criticalThinking', 'patternAnalysis'],
    'LOGICAL REASONING': ['criticalThinking', 'logicalReasoning'],
    'Philippine Constitution': ['generalInformation', 'constitutionAndLaws'],
    'Criminal Justice System': ['generalInformation', 'criminalJusticeSystem'],
    'Current Events': ['generalInformation', 'currentEvents'],
  };
  const pair = mappings[record.section];
  return pair ? { categoryId: pair[0], subcategoryId: pair[1] } : null;
}
export function normalize(record: SourceRecord): NormalizedCandidate {
  const issues = record.issues.map((item) => ({ ...item }));
  const textBlocks = (text: string) => [{ kind: 'text' as const, text: normalizeText(text) }];
  const choices =
    record.rawChoices?.map((choice, index) => ({
      id: `choice-${index + 1}`,
      blocks: textBlocks(choice.text),
    })) ?? null;
  if (!record.rawPrompt || /^_+$/.test(record.rawPrompt))
    issues.push(issue('missing-prompt', 'No usable source stem; source wording retained'));
  if (!choices || choices.length < 2)
    issues.push(issue('missing-choices', 'No complete supplied alternatives'));
  if (record.rawChoices) {
    const labels = record.rawChoices.map((choice) => choice.label.toUpperCase());
    if (new Set(labels).size !== labels.length)
      issues.push(
        issue('duplicate-label', 'Repeated source label cannot uniquely address an answer'),
      );
    const texts = record.rawChoices.map((choice) => normalizeText(choice.text).toLowerCase());
    if (new Set(texts).size !== texts.length)
      issues.push(
        issue('duplicate-alternative', 'Repeated rendered alternatives need editorial resolution'),
      );
  }
  const key =
    record.rawAnswer?.match(/^(?:Letter\s+)?([A-Fa-f])(?:[.)\s]|$)/)?.[1]?.toUpperCase() ??
    (record.section === 'VII' ? record.rawAnswer?.match(/\(([1-5])\)/)?.[1] : undefined);
  const matches =
    record.rawChoices
      ?.map((choice, index) => ({ label: choice.label.toUpperCase(), index }))
      .filter((choice) => choice.label === key) ?? [];
  const correctChoiceId = matches.length === 1 ? `choice-${matches[0]!.index + 1}` : null;
  if (!correctChoiceId)
    issues.push(
      issue(
        'unresolved-key',
        'Source key is missing or cannot uniquely resolve to a supplied choice',
      ),
    );
  const taxonomyProposal = proposal(record);
  if (!taxonomyProposal)
    issues.push(
      issue(
        'taxonomy-review',
        'Section alone does not establish an approved requested subcategory',
      ),
    );
  issues.push(issue('editorial-review', 'Source assertion is not editorial approval', false));
  return {
    original: record,
    state: 'needsReview',
    proposed: {
      prompt: record.rawPrompt ? textBlocks(record.rawPrompt) : null,
      choices,
      correctChoiceId,
      explanation: record.rawExplanation ? textBlocks(record.rawExplanation) : null,
      stimulus: record.stimulus
        ? { id: record.stimulus.id, version: 1, blocks: textBlocks(record.stimulus.text) }
        : null,
    },
    taxonomyProposal,
    issues,
  };
}
