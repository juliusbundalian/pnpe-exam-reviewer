export type AppErrorCode = 'invalid-config';

export class AppError extends Error {
  readonly userMessage = 'Configuration is unavailable. Please try again later.';
  constructor(readonly code: AppErrorCode) {
    super('Configuration is unavailable. Please try again later.');
    this.name = 'AppError';
  }
}
