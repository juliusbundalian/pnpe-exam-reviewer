import type { SourceDocument } from '../source-schema';
import type { SourceChoice, SourceRecord } from './types';
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

const sectionTitles: Record<string, string> = {
  I: 'GENERAL INFORMATION',
  II: 'VERBAL REASONING',
  III: 'CONNECTING IDEAS',
  IV: 'COMPLETING SENTENCES',
  V: 'READING COMPREHENSION',
  VI: 'PARAGRAPH ORGANIZATION',
  VII: 'CORRECT USAGE',
  VIII: 'CORRECT USAGE 2',
  IX: 'QUANTITATIVE REASONING',
  X: 'NUMBER SERIES',
  XI: 'WORD PROBLEM',
  XII: 'WORD ANALOGY',
  XIII: 'LOGICAL REASONING',
  XIV: 'WORD SEQUENCE',
  XV: 'ABSTRACT REASONING',
};
const counts = {
  I: 75,
  II: 40,
  III: 30,
  IV: 30,
  V: 12,
  VI: 80,
  VII: 50,
  VIII: 35,
  IX: 22,
  X: 15,
  XI: 15,
  XII: 20,
  XIII: 15,
  XIV: 28,
  XV: 10,
};
// Audited disputes are review seeds, not factual corrections or replacements.
const reviewSeeds: Record<string, number[]> = {
  I: [5, 12, 43, 46, 54, 69],
  II: [10, 25],
  III: [10, 23, 27, 29],
  IV: [1, 2, 27, 30],
  V: [2, 11, 12],
  VII: [24],
  VIII: [7, 18, 24, 32, 33, 34],
  IX: [6, 12, 18],
  X: [1, 2, 7, 8, 13],
  XI: [12, 14],
  XII: [15],
  XIII: [2],
  XIV: [3, 5, 10, 12, 17, 18, 21, 22, 23, 25, 28],
  XV: [5, 6, 7],
};

function header(line: string): string | null {
  const match = line.match(/^([IVX]+)\s*[-–]\s*(.+)$/);
  return match && sectionTitles[match[1]!] === match[2]!.toUpperCase() ? match[1]! : null;
}

function annotate(record: SourceRecord): void {
  if (reviewSeeds[record.section]?.includes(record.ordinal))
    record.issues.push(
      issue(
        'audited-source-defect',
        'Audit identified an unresolved source defect; inspect original evidence before revision',
      ),
    );
  if (record.section === 'I' && record.ordinal === 5)
    record.issues.push(issue('missing-stem', 'Printed stem consists only of underscores'));
  if (record.section === 'V' && record.ordinal >= 11) {
    record.stimulus = null;
    record.issues.push(issue('missing-passage', 'Dragon fruit passage is absent from the source'));
  }
  if (record.section === 'VIII' && [33, 34].includes(record.ordinal))
    record.issues.push(
      issue(
        'confirmed-duplicate',
        'Same five alternatives and key at VIII33/34; both source occurrences retained',
      ),
    );
  if (record.section === 'II')
    record.issues.push(
      issue(
        'marked-target-review',
        'Vocabulary target marking requires visual review; explanation cannot establish target',
      ),
    );
  if (record.section === 'VII') {
    const text = record.rawPrompt ?? '';
    record.rawChoices = [...text.matchAll(/([^()]*)\(([1-5])\)/g)].map((match) => ({
      label: match[2]!,
      text: match[1]!.trim(),
    }));
    record.issues.push(
      issue(
        'marked-target-review',
        'Numbered segment boundaries retained; underlined target spans require visual review',
      ),
    );
  }
}

export function parseLarge(document: SourceDocument): SourceRecord[] {
  if (document.sourceId !== 'comprehensive')
    throw new Error('Wrong source for comprehensive adapter');
  const records: SourceRecord[] = [];
  const last: Record<string, number> = {};
  let section = '';
  let current: SourceRecord | undefined;
  let field: Field = 'rawPrompt';
  let instructions: string[] = [];
  let readingInstructions = false;
  let passage: string[] | null = null;
  let passageId = '';
  let readingPassage = false;
  let sentences: SourceChoice[] = [];
  let readingSentences = false;
  let group = 0;
  for (const page of document.pages) {
    // XV starts in raster evidence. The eight visually observed boundaries are handled below.
    if (document.pageCount === 153 && page.page >= 149) {
      if (page.page === 149) {
        for (const line of lines(page)) {
          if (!line) continue;
          const num = numbered(line);
          if (num && Number(num[1]) === 28) {
            requireNext(28, last.XIV ?? 0, 'XIV');
            last.XIV = 28;
            current = startRecord(document, 'XIV', 28, page.page, num[2] ?? '');
            records.push(current);
            field = 'rawPrompt';
          } else if (current) {
            capture(current, page);
            const key = answer(line);
            const detail = explanation(line);
            const option = choice(line);
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
        }
        current = undefined;
      }
      section = 'XV';
      if (page.page === 149 || page.page === 150) continue;
    }
    for (const rawLine of lines(page).flatMap((line) => line.split(/\s{2,}(?=\d+\.[A-Z])/))) {
      const parts =
        answer(rawLine) || explanation(rawLine) || (current && field === 'rawExplanation')
          ? [rawLine]
          : rawLine.split(/(?<=[\s.])(?=[a-f]\.\)\s)/).map((part) => part.trim());
      for (const line of parts) {
        if (!line) continue;
        const title = header(line);
        // The opening mixed-case contents list is not a section boundary.
        if (title && (line === line.toUpperCase() || document.pageCount !== 153 || page.page > 1)) {
          if (title !== section) {
            section = title;
            current = undefined;
            instructions = [];
            passage = null;
            sentences = [];
          }
          readingInstructions = false;
          readingSentences = false;
          continue;
        }
        if (!section) continue;
        if (/^(?:Instructions:|Determine the most logical sequence)/i.test(line)) {
          current = undefined;
          instructions = [line.replace(/^Instructions:\s*/i, '')];
          readingInstructions = true;
          continue;
        }
        if (section === 'V' && /^Passage \d/.test(line)) {
          current = undefined;
          passage = [line];
          passageId = `${document.sourceId}:V:${line}`;
          readingPassage = true;
          readingInstructions = false;
          continue;
        }
        const option = choice(line);
        if (section === 'VI' && option && (option[1]?.toLowerCase() === 'a' || readingSentences)) {
          if (option[1]?.toLowerCase() === 'a') {
            sentences = [];
            group++;
            current = undefined;
          }
          sentences.push({ label: option[1]!, text: option[2] ?? '' });
          readingSentences = true;
          readingInstructions = false;
          continue;
        }
        const num =
          numbered(line) ??
          (section === 'X'
            ? line.match(/^(\d+)\s+(100 \+ 9X,.*)$/)
            : section === 'XIII'
              ? line.match(/^(\d+)\s+(Wild animals.*)$/)
              : null);
        if (num && current && /^\d{4}\.$/.test(line)) {
          capture(current, page);
          append(current, field, line);
          continue;
        }
        if (num && current && field === 'rawExplanation' && /^[\d/]+\s*=/.test(num[2] ?? '')) {
          capture(current, page);
          append(current, field, line);
          continue;
        }
        if (num) {
          const ordinal = Number(num[1]);
          // Raster-only XV occurrences 1–5 and 7–9 are real observed gaps, not omitted text items.
          if (section !== 'XV') requireNext(ordinal, last[section] ?? 0, section);
          else if (![6, 9, 10].includes(ordinal))
            throw new Error(`Unexpected XV text boundary ${ordinal}`);
          last[section] = ordinal;
          if (section === 'XV' && ordinal === 9) {
            current = undefined;
            continue;
          }
          let prompt = num[2] ?? '';
          const inline = prompt.match(/^(.*?)\s+Answer:\s*(.*)$/);
          const inlineChoice = prompt.match(/^(.*?)\s+([a-f])\.\)\s*(.*)$/);
          if (inlineChoice) prompt = inlineChoice[1]!;
          if (inline) prompt = inline[1]!;
          current = startRecord(document, section, ordinal, page.page, prompt);
          if (inlineChoice)
            current.rawChoices = [{ label: inlineChoice[2]!, text: inlineChoice[3]! }];
          if (section === 'VIII' && !prompt) current.rawPrompt = instructions.join('\n') || null;
          if (inline) current.rawAnswer = inline[2] || null;
          if (section === 'V' && passage)
            current.stimulus = { id: passageId, text: passage.join('\n') };
          if (section === 'VI') {
            current.stimulus = {
              id: `${document.sourceId}:VI:group-${group}`,
              text: sentences.map((sentence) => `${sentence.label}.) ${sentence.text}`).join('\n'),
            };
            current.rawChoices = sentences.map((sentence) => ({ ...sentence }));
          }
          records.push(current);
          capture(current, page);
          field = inline ? 'rawAnswer' : inlineChoice ? 'choice' : 'rawPrompt';
          readingPassage = false;
          readingSentences = false;
          readingInstructions = false;
          continue;
        }
        if (readingPassage && passage) {
          passage.push(line);
          continue;
        }
        if (readingSentences) {
          const sentence = sentences.at(-1);
          if (sentence) sentence.text += `\n${line}`;
          continue;
        }
        if (readingInstructions) {
          instructions.push(line);
          continue;
        }
        if (!current) continue;
        if (/^Final Sequence:/i.test(line)) {
          current = undefined;
          continue;
        }
        capture(current, page);
        const key = answer(line);
        const detail = explanation(line);
        if (key) {
          current.rawAnswer = key[1] || null;
          field = 'rawAnswer';
        } else if (detail) {
          current.rawExplanation = detail[1] || null;
          field = 'rawExplanation';
        } else if (option && field !== 'rawExplanation') {
          for (const part of line.split(/\s+(?=[a-f]\.\)\s)/)) {
            const match = choice(part)!;
            (current.rawChoices ??= []).push({ label: match[1]!, text: match[2] ?? '' });
          }
          field = 'choice';
        } else append(current, field, line);
      }
    }
  }
  if (document.pageCount === 153) {
    // This mapping is visual boundary evidence from the immutable source, never inferred from the expected total.
    const observed = [
      [1, 149, 341],
      [2, 150, 345],
      [3, 150, 346],
      [4, 151, 349],
      [5, 151, 350],
      [7, 152, 353],
      [8, 152, 354],
      [9, 152, 355],
    ];
    for (const [ordinal, pageNumber, xref] of observed) {
      const page = document.pages[pageNumber! - 1]!;
      const placement = page.imagePlacements?.find((placement) => placement.xref === xref);
      if (!placement || !page.imageRefs.includes(placement.imageRef))
        throw new Error(`Missing observed image evidence XV:${ordinal} p${pageNumber} xref${xref}`);
      const record = startRecord(document, 'XV', ordinal!, pageNumber!, '');
      record.evidence.imageLocations = [
        `${record.evidence.locator}&xref=${xref}&bbox=${placement.bbox.join(',')}&image=${placement.imageRef}`,
      ];
      record.issues.push(
        issue(
          'image-only',
          'Observed numbered question and key are raster-only; transcription not approved',
        ),
        issue(
          'image-answer-leakage',
          'Source image exposes bold/underlined answer; never publish this asset',
        ),
      );
      records.push(record);
    }
    const tenth = records.find((record) => record.section === 'XV' && record.ordinal === 10);
    const page = document.pages[152]!;
    if (tenth) {
      tenth.evidence.imageLocations =
        page.imagePlacements?.map(
          (placement) =>
            `${tenth.evidence.locator}&xref=${placement.xref}&bbox=${placement.bbox.join(',')}&image=${placement.imageRef}`,
        ) ?? [];
      tenth.issues.push(
        issue('asset-review', 'Diagram requires reviewed accessible asset before publication'),
      );
    }
  }
  records.sort(
    (a, b) =>
      Object.keys(counts).indexOf(a.section) - Object.keys(counts).indexOf(b.section) ||
      a.ordinal - b.ordinal,
  );
  for (const record of records) annotate(record);
  assertAccounting(document, records, counts);
  return records;
}
