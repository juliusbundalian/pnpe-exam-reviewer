import { AppError } from '../../../core/errors/AppError';
import { PROFILE_DISPLAY_NAME_MAX_LENGTH, type Profile } from '../domain/ProfileRepository';

/** Persisted fields permitted by security rules; adapter owns timestamp writes. */
export const PROFILE_DOCUMENT_FIELDS = ['displayName', 'createdAt', 'updatedAt'] as const;
/** Normalize profile input and project persisted data to the domain allowlist. */
export function validateProfile(value: unknown): Profile {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('displayName' in value) ||
    typeof value.displayName !== 'string'
  )
    throw new AppError('invalid-profile');
  const displayName = value.displayName.trim();
  if (!displayName || displayName.length > PROFILE_DISPLAY_NAME_MAX_LENGTH)
    throw new AppError('invalid-profile');
  return { displayName };
}
