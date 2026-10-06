import { useRouter } from 'expo-router';
import type { SafeOrigin } from '../features/auth/application/intents';
import { originDestination } from './destinations';

/** Visible return controls also work after replacement or a cold deep link. */
export function useSafeBack(fallback: SafeOrigin = { type: 'home' }): () => void {
  const router = useRouter();
  return () => {
    if (router.canGoBack()) router.back();
    else router.replace(originDestination(fallback));
  };
}
