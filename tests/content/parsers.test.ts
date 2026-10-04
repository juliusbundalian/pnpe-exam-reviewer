import { parseShort } from '../../tools/questions/parsers/short';
import { parseLarge } from '../../tools/questions/parsers/large';
import { parseNotes } from '../../tools/questions/parsers/notes';
import { documentFixture } from './fixtures/source-records';

test('short retains cross-page choices and explanation with heading boundaries', () => {
  const records = parseShort(
    documentFixture('short', [
      'VERBAL REASONING\n1. Which is NOT correct?\nA. One\nB. Two\nAnswer: A. One\nExplanation: First',
      'line.\nQUANTITATIVE REASONING\n2. (a + b) / c\nA. 1\nB. 2\nAnswer: B. 2',
    ]),
  );
  expect(records).toHaveLength(2);
  expect(records[0]?.rawExplanation).toBe('First\nline.');
  expect(records[0]?.pageEnd).toBe(2);
  expect(records[1]?.sourceKey).toBe('short:QUANTITATIVE REASONING:2');
});

test('large shares complete sentence groups and does not restart on repeated headers', () => {
  const records = parseLarge(
    documentFixture('comprehensive', [
      'VI - Paragraph Organization\na.) First.\nb.) Second.\nc.) Third.\nd.) Fourth.\ne.) Fifth.\n1. Which should be the first sentence?\nCorrect Answer: A. Letter A',
      'VI - Paragraph Organization\n2. Which should be the second sentence? Answer: Letter B',
    ]),
  );
  expect(records).toHaveLength(2);
  expect(records[0]?.stimulus?.text).toContain('e.) Fifth.');
  expect(records[1]?.stimulus).toEqual(records[0]?.stimulus);
  expect(records[1]?.rawChoices).toHaveLength(5);
});

test('large retains numbered grammar marks and never turns them into question boundaries', () => {
  const records = parseLarge(
    documentFixture('comprehensive', [
      'VII - Correct Usage\n1.\nOne of the suspect (1) in the killing (2) was arrested (3) yesterday (4). No error (5).\nAnswer: suspect (1) - should be suspects',
    ]),
  );
  expect(records).toHaveLength(1);
  expect(records[0]?.rawPrompt).toContain('suspect (1)');
  expect(records[0]?.rawChoices?.map((choice) => choice.label)).toEqual(['1', '2', '3', '4', '5']);
  expect(records[0]?.issues.some((issue) => issue.code === 'marked-target-review')).toBe(true);
});

test('notes preserve disputed answer and correction separately without distractors', () => {
  const [record] = parseNotes(
    documentFixture('notes', [
      'Philippine Constitution\n1. How many?\nAnswer: 8\nCorrection: Actually 6.\nCurrent Events\n1. Current officer?\nAnswer: Somebody',
    ]),
  );
  expect(record?.rawAnswer).toBe('8');
  expect(record?.rawExplanation).toBe('Correction: Actually 6.');
  expect(record?.rawChoices).toBeNull();
  expect(record?.issues.some((issue) => issue.code === 'answer-only')).toBe(true);
});

test('unexplained number gaps reject source segmentation', () => {
  expect(() =>
    parseNotes(
      documentFixture('notes', [
        'Philippine History\n1. First?\nAnswer: First\n3. Third?\nAnswer: Third',
      ]),
    ),
  ).toThrow(/number gap/i);
});

test('decimal working in an explanation is not a question boundary', () => {
  const records = parseShort(
    documentFixture('short', [
      'QUANTITATIVE REASONING\n1. Percent?\nA. 75%\nB. 50%\nAnswer: A. 75%\nExplanation:\n0.75 × 100 = 75%',
    ]),
  );
  expect(records[0]?.rawExplanation).toBe('0.75 × 100 = 75%');
});
test('short conversational footer does not enter the explanation', () => {
  const [record] = parseShort(
    documentFixture('short', [
      'GENERAL INFORMATION\n1. PNP?\nA. Police\nB. Patrol\nAnswer: A. Police\nExplanation: Police.\nI can also format this into a cleaner reviewer version without the\nanswers/explanations, so you can use it as an actual practice test.',
    ]),
  );
  expect(record?.rawExplanation).toBe('Police.');
});
test('a wrapped explanation ending in a year is retained', () => {
  const [record] = parseLarge(
    documentFixture('comprehensive', [
      'I - GENERAL INFORMATION\n1. Who?\nA. Roman\nB. Other\nCorrect Answer: A. Roman\nExplanation: Beginning in\n2016.',
    ]),
  );
  expect(record?.rawExplanation).toBe('Beginning in\n2016.');
});
test('a wrapped answer ending in a year is retained', () => {
  const [record] = parseLarge(
    documentFixture('comprehensive', [
      'VIII - CORRECT USAGE 2\nInstructions: Choose a sentence.\n1.\na.) Film of 2016.\nb.) Other.\nCorrect Answer: A. Film of\n2016.\nExplanation: Clear.',
    ]),
  );
  expect(record?.rawAnswer).toBe('A. Film of\n2016.');
});
test('number series accepts the observed missing-period boundary and inline first alternative', () => {
  const records = parseLarge(
    documentFixture('comprehensive', [
      'X - Number Series\n1 100 + 9X, 110X, ______\na.) 100\nb.) 200\nCorrect Answer: B.) 200\n2. 60, 6600, ______ a.) 666660\nb.) 6666600000\nCorrect Answer: B.) 6666600000',
    ]),
  );
  expect(records).toHaveLength(2);
  expect(records[1]?.rawPrompt).toBe('60, 6600, ______');
  expect(records[1]?.rawChoices?.map((choice) => choice.text)).toEqual(['666660', '6666600000']);
});
test('numbered solution equations do not restart question numbering', () => {
  const [record] = parseLarge(
    documentFixture('comprehensive', [
      'XI - Word Problem\n1. Money?\na.) ₱180,000\nb.) Other\nCorrect Answer: a.) ₱180,000\nSolution: Two ways.\n1. 1/3 = ₱60,000\n2. 1/12 = ₱15,000',
    ]),
  );
  expect(record?.rawExplanation).toContain('2. 1/12 = ₱15,000');
});
test('logical reasoning accepts missing period and alternatives sharing a line', () => {
  const [record] = parseLarge(
    documentFixture('comprehensive', [
      'XIII - Logical Reasoning\n1 Wild animals are dangerous.\na.) Dogs are dangerous. b.) Dogs are not dangerous.\nc.) Cannot conclude.\nCorrect Answer: c.) Cannot conclude.',
    ]),
  );
  expect(record?.rawPrompt).toBe('Wild animals are dangerous.');
  expect(record?.rawChoices).toHaveLength(3);
});
test('grammar question starts can adjoin answer lines through zero-width layout separators', () => {
  const records = parseLarge(
    documentFixture('comprehensive', [
      'VII - Correct Usage\n1.\u200bThe benefits (1) spills (2). No error (5).\nAnswer: spills (2) - should be spill    2.\u200bPeople get hooks (1). No error (5).\nAnswer: hooks (1) - should be hooked',
    ]),
  );
  expect(records).toHaveLength(2);
  expect(records[0]?.rawAnswer).toBe('spills (2) - should be spill');
});
test('paragraph sentence labels embedded after punctuation remain separate alternatives', () => {
  const [record] = parseLarge(
    documentFixture('comprehensive', [
      'VI - Paragraph Organization\na.) First.\nb.) Second.c.) Third.\nd.) Fourth. e.) Fifth.\n1. Which should be first? Answer: Letter C',
    ]),
  );
  expect(record?.rawChoices?.map((choice) => choice.text)).toEqual([
    'First.',
    'Second.',
    'Third.',
    'Fourth.',
    'Fifth.',
  ]);
});
test('sentence alternatives accept the observed a) label', () => {
  const [record] = parseLarge(
    documentFixture('comprehensive', [
      'VIII - Correct Usage 2\nInstructions: Select sentence.\n1.\na) According to a review.\nb.) Other.\nCorrect Answer: A. According to a review.',
    ]),
  );
  expect(record?.rawChoices?.map((choice) => choice.label)).toEqual(['a', 'b']);
});
test('explanatory letter references retain original line structure', () => {
  const [record] = parseLarge(
    documentFixture('comprehensive', [
      'XV - Abstract Reasoning\n6. Which?\na.) One\nb.) Two\nCorrect Answer: a.) One\nSolution: Relation.\nTherefore, a.) belongs to the group.',
    ]),
  );
  expect(record?.rawExplanation).toBe('Relation.\nTherefore, a.) belongs to the group.');
});
