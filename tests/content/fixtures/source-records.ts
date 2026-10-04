import type { SourceDocument } from '../../../tools/questions/source-schema';
import type { SourceRecord } from '../../../tools/questions/parsers/types';

export function documentFixture(sourceId: string, texts: string[]): SourceDocument {
  return {
    sourceId,
    sha256: 'a'.repeat(64),
    pageCount: texts.length,
    pages: texts.map((text, i) => ({ page: i + 1, text, blocks: [], links: [], imageRefs: [] })),
  };
}
export function paragraphFixture(passage: string): SourceRecord {
  return {
    sourceKey: 'comprehensive:VI:1',
    sourceId: 'comprehensive',
    section: 'VI',
    ordinal: 1,
    pageStart: 1,
    pageEnd: 1,
    rawPrompt: 'Which should be the first sentence?',
    rawChoices: ['A', 'B', 'C', 'D', 'E'].map((label) => ({ label, text: `${label} sentence` })),
    rawAnswer: 'A. Letter A',
    rawExplanation: null,
    stimulus: { id: 'comprehensive:VI:group-1', text: passage },
    issues: [],
    evidence: {
      checksum: 'a'.repeat(64),
      locator: 'document.json#page=1',
      links: [],
      imageLocations: [],
    },
  };
}
