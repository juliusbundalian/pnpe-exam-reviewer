import type { CategoryId } from '../../content/domain/taxonomy';

export interface HomePresentationModel {
  readonly mockExam: { readonly questionCount: number; readonly durationMinutes: number };
}

// Local presentation defaults until the validated ConfigRepository is composed in Task 8.
export const initialHomePresentationModel: HomePresentationModel = {
  mockExam: { questionCount: 150, durationMinutes: 180 },
};
export const coverageSummaries: Record<CategoryId, string> = {
  generalInformation: 'Constitution, public service & more',
  communicationSkills: 'Vocabulary, reading & grammar',
  quantitativeReasoning: 'Concepts, problems & data',
  criticalThinking: 'Logic, patterns & deduction',
};
