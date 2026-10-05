import type { ConfigModels } from './schemas';

export const defaults: ConfigModels = {
  app_info: {
    appName: 'PNPE Exam Reviewer',
    latestVersion: '0.1.0',
    minimumSupportedVersion: '0.1.0',
    maintenanceMode: false,
    maintenanceMessage: '',
    supportEmail: '',
    privacyPolicyUrl: '',
    termsUrl: '',
  },
  data: {
    announcements: [],
    studyTips: [],
    faq: [],
    reviewerInstructions: [],
    examInformation: [],
  },
  config: {
    mockExam: {
      durationMinutes: 180,
      questionCount: 150,
      passingPercentage: 75,
      shuffleQuestions: true,
      shuffleAnswers: true,
      distribution: {
        generalInformation: 35,
        communicationSkills: 40,
        quantitativeReasoning: 25,
        criticalThinking: 50,
      },
    },
    reviewer: { shuffleQuestions: true },
    features: { bookmarks: true, progress: true, examHistory: true },
  },
};
