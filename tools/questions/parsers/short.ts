import type { SourceDocument } from '../source-schema';
import type { SourceRecord } from './types';
import {
  answer,
  append,
  assertAccounting,
  capture,
  choice,
  explanation,
  issue,
  lines,
  numbered,
  requireNext,
  startRecord,
  type Field,
} from './shared';
const sections = [
  'VERBAL REASONING',
  'QUANTITATIVE REASONING',
  'LOGICAL REASONING',
  'GENERAL INFORMATION',
];
export function parseShort(document: SourceDocument): SourceRecord[] {
  if (document.sourceId !== 'short') throw new Error('Wrong source for short adapter');
  const records: SourceRecord[] = [];
  let section = '';
  let current: SourceRecord | undefined;
  let field: Field = 'rawPrompt';
  let last = 0;
  for (const page of document.pages)
    for (const line of lines(page)) {
      if (!line) continue;
      if (/^I can also format this into/.test(line)) {
        current = undefined;
        continue;
      }
      if (sections.includes(line)) {
        section = line;
        current = undefined;
        continue;
      }
      const number = numbered(line);
      if (section && number) {
        const ordinal = Number(number[1]);
        requireNext(ordinal, last, section);
        last = ordinal;
        current = startRecord(document, section, ordinal, page.page, number[2] ?? '');
        records.push(current);
        field = 'rawPrompt';
        capture(current, page);
        continue;
      }
      if (!current) continue;
      capture(current, page);
      const option = choice(line);
      const key = answer(line);
      const detail = explanation(line);
      if (key) {
        current.rawAnswer = key[1] || null;
        field = 'rawAnswer';
      } else if (detail) {
        current.rawExplanation = detail[1] || null;
        field = 'rawExplanation';
      } else if (option && field !== 'rawExplanation') {
        (current.rawChoices ??= []).push({ label: option[1]!, text: option[2] ?? '' });
        field = 'choice';
      } else append(current, field, line);
    }
  for (const record of records)
    if ([19, 20].includes(record.ordinal))
      record.issues.push(
        issue(
          'audited-source-defect',
          'PNP terminology/control/appointment claim needs editorial legal verification',
        ),
      );
  assertAccounting(document, records, {
    'VERBAL REASONING': 5,
    'QUANTITATIVE REASONING': 5,
    'LOGICAL REASONING': 6,
    'GENERAL INFORMATION': 4,
  });
  return records;
}
