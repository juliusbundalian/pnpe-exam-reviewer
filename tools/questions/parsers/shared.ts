import type { SourceDocument, SourcePage } from '../source-schema';
import type { SourceIssue, SourceRecord } from './types';
import { sourceRegistry } from '../source-registry';

export const issue = (code: string, message: string, blocking = true): SourceIssue => ({
  code,
  message,
  blocking,
});
export function lines(page: SourcePage): string[] {
  return page.text
    .replace(/\u200b/g, '')
    .split('\n')
    .map((line) => line.trim());
}
export function startRecord(
  document: SourceDocument,
  section: string,
  ordinal: number,
  page: number,
  prompt: string,
): SourceRecord {
  return {
    sourceKey: `${document.sourceId}:${section}:${ordinal}`,
    sourceId: document.sourceId,
    section,
    ordinal,
    pageStart: page,
    pageEnd: page,
    rawPrompt: prompt || null,
    rawChoices: null,
    rawAnswer: null,
    rawExplanation: null,
    stimulus: null,
    issues: [],
    evidence: {
      checksum: document.sha256,
      locator: `evidence/reference-extraction/${document.sourceId}/document.json#page=${page}`,
      links: [],
      imageLocations: [],
    },
  };
}
export type Field = 'rawPrompt' | 'rawAnswer' | 'rawExplanation' | 'choice';
export function append(record: SourceRecord, field: Field, text: string): void {
  if (field === 'choice') {
    const choice = record.rawChoices?.at(-1);
    if (choice) choice.text += `\n${text}`;
  } else record[field] = record[field] ? `${record[field]}\n${text}` : text;
}
export function capture(record: SourceRecord, page: SourcePage): void {
  record.pageEnd = page.page;
  record.evidence.links = [...new Set([...record.evidence.links, ...page.links])];
}
export function numbered(line: string): RegExpMatchArray | null {
  return line.match(/^(\d+)\.(?!\d)\s*(.*)$/);
}
export function choice(line: string): RegExpMatchArray | null {
  return line.match(/^([A-Fa-f])(?:\.\)?|\))\s*(.*)$/);
}
export function answer(line: string): RegExpMatchArray | null {
  return line.match(/^(?:Correct )?Answer:\s*(.*)$/i);
}
export function explanation(line: string): RegExpMatchArray | null {
  return line.match(/^(?:Explanation|Solution):\s*(.*)$/i);
}
export function requireNext(ordinal: number, previous: number, section: string): void {
  if (ordinal !== previous + 1)
    throw new Error(
      `Unexplained number gap in ${section}: expected ${previous + 1}, observed ${ordinal}`,
    );
}
export function assertAccounting(
  document: SourceDocument,
  records: SourceRecord[],
  counts: Record<string, number>,
): void {
  // Full extracted reference documents are checked independently of small synthetic fixtures.
  const expectedPages: Record<string, number> = { short: 6, comprehensive: 153, notes: 19 };
  const registered = sourceRegistry.find((source) => source.sourceId === document.sourceId);
  if (
    document.sha256 !== registered?.sha256 &&
    document.pageCount !== expectedPages[document.sourceId]
  )
    return;
  if (document.sha256 !== registered?.sha256)
    throw new Error(`Unregistered source checksum: ${document.sourceId}`);
  if (
    document.pageCount !== expectedPages[document.sourceId] ||
    document.pages.length !== document.pageCount
  )
    throw new Error(`Source count mismatch ${document.sourceId}: incomplete registered document`);
  for (const [section, count] of Object.entries(counts)) {
    const observed = records.filter((record) => record.section === section).length;
    if (observed !== count)
      throw new Error(
        `Source count mismatch ${document.sourceId}:${section}: expected ${count}, observed ${observed}`,
      );
  }
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (records.length !== total)
    throw new Error(
      `Source count mismatch ${document.sourceId}: expected ${total}, observed ${records.length}`,
    );
}
