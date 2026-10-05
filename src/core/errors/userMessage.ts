import { AppError } from './AppError';

const authCodes = new Set([
  'network',
  'rate-limited',
  'invalid-credentials',
  'weak-password',
  'account-disabled',
  'authentication-unavailable',
  'profile-unavailable',
  'invalid-profile',
]);
export function toFriendlyAuthMessage(error: unknown): string {
  return error instanceof AppError && authCodes.has(error.code)
    ? new AppError(error.code).userMessage
    : 'Something went wrong. Please try again.';
}
