export interface SourceIssue {
  code: string;
  blocking: boolean;
  message: string;
}
export interface SourceChoice {
  label: string;
  text: string;
}
export interface SourceRecord {
  sourceKey: string;
  sourceId: string;
  section: string;
  ordinal: number;
  pageStart: number;
  pageEnd: number;
  rawPrompt: string | null;
  rawChoices: SourceChoice[] | null;
  rawAnswer: string | null;
  rawExplanation: string | null;
  stimulus: { id: string; text: string } | null;
  issues: SourceIssue[];
  evidence: { checksum: string; locator: string; links: string[]; imageLocations: string[] };
}
