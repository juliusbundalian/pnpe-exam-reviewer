import { AppError, type AppErrorCode } from '../../../core/errors/AppError';
export function sdkErrorCode(error: unknown): string | null {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : null;
}
const codes: Readonly<Record<string, AppErrorCode>> = {
  'auth/network-request-failed': 'network',
  'auth/too-many-requests': 'rate-limited',
  'auth/invalid-credential': 'invalid-credentials',
  'auth/wrong-password': 'invalid-credentials',
  'auth/user-not-found': 'invalid-credentials',
  'auth/invalid-email': 'invalid-credentials',
  'auth/weak-password': 'weak-password',
  'auth/user-disabled': 'account-disabled',
};
export function mapAuthError(error: unknown): AppError {
  return new AppError(codes[sdkErrorCode(error) ?? ''] ?? 'authentication-unavailable');
}
