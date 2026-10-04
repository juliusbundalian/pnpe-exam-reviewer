export type CategoryDefinition = {
  readonly id: string;
  readonly label: string;
  readonly subcategories: readonly { readonly id: string; readonly label: string }[];
};

export const taxonomy = [
  {
    id: 'generalInformation',
    label: 'General Information',
    subcategories: [
      { id: 'constitutionAndLaws', label: 'Philippine Constitution and Relevant Laws' },
      { id: 'pnpHistory', label: 'PNP History' },
      { id: 'criminalJusticeSystem', label: 'Criminal Justice System' },
      { id: 'currentEvents', label: 'Current Events' },
      { id: 'publicServiceConduct', label: 'Norms of Conduct in Public Service' },
    ],
  },
  {
    id: 'communicationSkills',
    label: 'Communication Skills',
    subcategories: [
      { id: 'vocabulary', label: 'Vocabulary' },
      { id: 'readingComprehension', label: 'Reading Comprehension' },
      { id: 'grammar', label: 'Grammar' },
    ],
  },
  {
    id: 'quantitativeReasoning',
    label: 'Quantitative Reasoning',
    subcategories: [
      { id: 'basicConcepts', label: 'Basic Concepts' },
      { id: 'problemSolving', label: 'Problem Solving' },
      { id: 'dataInterpretation', label: 'Data Interpretation' },
    ],
  },
  {
    id: 'criticalThinking',
    label: 'Critical Thinking',
    subcategories: [
      { id: 'logicalReasoning', label: 'Logical Reasoning' },
      { id: 'patternAnalysis', label: 'Pattern Analysis' },
      { id: 'deduction', label: 'Deduction' },
      { id: 'wordAnalogy', label: 'Word Analogy' },
    ],
  },
] as const satisfies readonly CategoryDefinition[];

export type CategoryId = (typeof taxonomy)[number]['id'];
export type SubcategoryId = (typeof taxonomy)[number]['subcategories'][number]['id'];

export function isTaxonomyPair(category: string, subcategory: string): boolean {
  return taxonomy.some(
    (item) => item.id === category && item.subcategories.some((child) => child.id === subcategory),
  );
}
