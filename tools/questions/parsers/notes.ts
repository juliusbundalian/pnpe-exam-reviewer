import type { SourceDocument } from '../source-schema';
import type { SourceRecord } from './types';
import {
  answer,
  append,
  assertAccounting,
  capture,
  explanation,
  issue,
  lines,
  numbered,
  requireNext,
  startRecord,
  type Field,
} from './shared';
const counts = {
  'Philippine Constitution': 26,
  'Philippine History': 50,
  'PNP Law and History': 30,
  'Criminal Justice System': 49,
  'Current Events': 35,
};
export function parseNotes(document: SourceDocument): SourceRecord[] {
  if (document.sourceId !== 'notes') throw new Error('Wrong source for notes adapter');
  const records: SourceRecord[] = [];
  const last: Record<string, number> = {};
  let section = '';
  let current: SourceRecord | undefined;
  let field: Field = 'rawPrompt';
  for (const page of document.pages)
    for (const line of lines(page)) {
      if (!line) continue;
      if (line in counts) {
        if (section !== line) current = undefined;
        section = line;
        continue;
      }
      const number = numbered(line);
      if (section && number) {
        const ordinal = Number(number[1]);
        requireNext(ordinal, last[section] ?? 0, section);
        last[section] = ordinal;
        current = startRecord(document, section, ordinal, page.page, number[2] ?? '');
        current.issues.push(
          issue(
            'answer-only',
            'No supplied distractors; authored conversion requires editorial approval',
          ),
        );
        if (section === 'Current Events')
          current.issues.push(
            issue(
              'missing-time-context',
              'No reviewed as-of date, expiry or verification provenance',
            ),
          );
        if (section === 'Philippine History')
          current.issues.push(
            issue('unmapped-taxonomy', 'General Philippine history is not PNP History'),
          );
        records.push(current);
        field = 'rawPrompt';
        capture(current, page);
        continue;
      }
      if (!current) continue;
      capture(current, page);
      const key = answer(line);
      const detail = explanation(line);
      if (key) {
        if (current.rawAnswer !== null)
          throw new Error(`Duplicate Answer boundary: ${current.sourceKey}`);
        current.rawAnswer = key[1] || null;
        field = 'rawAnswer';
      } else if (detail || /^(?:⚠|Note:|Correction:)/u.test(line)) {
        append(current, 'rawExplanation', line);
        field = 'rawExplanation';
        current.issues.push(
          issue(
            'source-annotation-review',
            'Source correction/caution is unverified; original answer retained',
          ),
        );
      } else append(current, field, line);
    }
  for (const record of records)
    if (!record.rawAnswer) throw new Error(`Missing Answer boundary: ${record.sourceKey}`);
  assertAccounting(document, records, counts);
  return records;
}
