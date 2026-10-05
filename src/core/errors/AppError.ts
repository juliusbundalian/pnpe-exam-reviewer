const messages = {
  'invalid-config': 'Configuration is unavailable. Please try again later.',
  network: 'Please check your connection and try again.',
  'rate-limited': 'Too many attempts. Please try again later.',
  'invalid-credentials': 'Please check your email and password.',
  'weak-password': 'Please choose a stronger password.',
  'account-disabled': 'This account is disabled. Please contact support.',
  'authentication-unavailable': 'Authentication is unavailable. Please try again later.',
  'profile-unavailable': 'Your profile could not be saved or loaded. Please try again.',
  'invalid-profile': 'Please enter a valid display name of up to 100 characters.',
} as const;
export type AppErrorCode = keyof typeof messages;

export class AppError extends Error {
  readonly userMessage: string;
  constructor(readonly code: AppErrorCode) {
    super(messages[code]);
    this.userMessage = messages[code];
    this.name = 'AppError';
  }
}
