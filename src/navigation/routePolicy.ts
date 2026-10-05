import type { AuthUser } from '../features/auth/domain/AuthenticationRepository';
import {
  requiresOwner,
  type PendingIntent,
  type ProtectedAction,
  type SafeOrigin,
} from '../features/auth/application/intents';

export type IntentResolution =
  { type: 'resume'; action: ProtectedAction } | { type: 'return'; origin: SafeOrigin };

/** Pure closed destinations; the app composition layer owns actual route mapping. */
export function resolveIntent(
  intent: PendingIntent,
  user: AuthUser,
  now: number,
): IntentResolution {
  if (intent.expiresAtMs <= now) return { type: 'return', origin: intent.origin };
  if (requiresOwner(intent.action) && intent.action.requiredOwnerUid !== user.uid) {
    return { type: 'return', origin: { type: 'home' } };
  }
  return { type: 'resume', action: intent.action };
}
