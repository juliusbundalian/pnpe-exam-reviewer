import type { Href } from 'expo-router';
import {
  safeOriginSchema,
  type SafeOrigin,
  type ProtectedAction,
} from '../features/auth/application/intents';
export function originDestination(origin: SafeOrigin): Href {
  switch (origin.type) {
    case 'home':
      return '/';
    case 'mockOverview':
      return '/mock-exam';
    case 'privacyPolicy':
      return '/privacy';
    case 'reviewerOverview':
      return origin.categoryId
        ? origin.subcategoryId
          ? `/review/${origin.categoryId}/${origin.subcategoryId}`
          : `/review/${origin.categoryId}`
        : '/review';
    default:
      return `/${origin.type}`;
  }
}
export function actionDestination(action: ProtectedAction): Href {
  switch (action.type) {
    case 'startMockExam':
      return '/mock-exam?stage=preflight';
    case 'resumeReviewer':
      return `/review?stage=session&sessionId=${action.sessionId}`;
    case 'openBookmark':
      return `/bookmarks?questionId=${action.questionId}`;
    case 'startReviewer':
      return `${originDestination({ type: 'reviewerOverview', categoryId: action.categoryId, ...(action.subcategoryId ? { subcategoryId: action.subcategoryId } : {}) })}?stage=availability` as Href;
    case 'openProgress':
      return '/progress';
    case 'openProfile':
      return '/profile';
    case 'openHistory':
    case 'openAttempt':
      return '/exam-history';
    case 'openBookmarks':
    case 'setBookmark':
      return '/bookmarks';
  }
}
export function publicOrigin(path: string): SafeOrigin | null {
  const simple: Record<string, SafeOrigin> = {
    '/': { type: 'home' },
    '/review': { type: 'reviewerOverview' },
    '/mock-exam': { type: 'mockOverview' },
    '/menu': { type: 'menu' },
    '/appearance': { type: 'appearance' },
    '/about': { type: 'about' },
    '/privacy': { type: 'privacyPolicy' },
    '/terms': { type: 'terms' },
  };
  if (simple[path]) return simple[path];
  const segments = path.split('/').filter(Boolean);
  if (segments[0] !== 'review' || segments.length > 3) return null;
  const parsed = safeOriginSchema.safeParse({
    type: 'reviewerOverview',
    categoryId: segments[1],
    ...(segments[2] ? { subcategoryId: segments[2] } : {}),
  });
  return parsed.success ? parsed.data : null;
}
