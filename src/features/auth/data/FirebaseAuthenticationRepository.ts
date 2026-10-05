import type {
  AuthState,
  AuthUser,
  AuthenticationRepository,
} from '../domain/AuthenticationRepository';
import { AppError } from '../../../core/errors/AppError';
import { mapAuthError, sdkErrorCode } from './mapAuthError';
export interface AuthenticationSdk {
  onAuthStateChanged(
    listener: (user: unknown) => void,
    onError: (error: unknown) => void,
  ): () => void;
  signInWithEmailAndPassword(email: string, password: string): Promise<{ user: unknown }>;
  createUserWithEmailAndPassword(email: string, password: string): Promise<{ user: unknown }>;
  sendPasswordResetEmail(email: string): Promise<void>;
  signOut(): Promise<void>;
}
export class FirebaseAuthenticationRepository implements AuthenticationRepository {
  constructor(private readonly sdk: AuthenticationSdk) {}
  observe(listener: (state: AuthState) => void): () => void {
    let previousUid: string | null = null;
    let active = true;
    listener({ status: 'resolving' });
    const recovery = () => {
      if (active) listener({ status: 'recoveryRequired', previousUid });
    };
    let unsubscribe: () => void;
    try {
      unsubscribe = this.sdk.onAuthStateChanged((value) => {
        if (!active) return;
        if (value === null) {
          previousUid = null;
          listener({ status: 'guest' });
          return;
        }
        let user: AuthUser;
        try {
          user = parseUser(value);
        } catch {
          recovery();
          return;
        }
        previousUid = user.uid;
        listener({ status: 'authenticated', user });
      }, recovery);
    } catch {
      recovery();
      unsubscribe = () => {};
    }
    return () => {
      active = false;
      unsubscribe();
    };
  }
  async signIn(email: string, password: string): Promise<AuthUser> {
    try {
      return parseUser((await this.sdk.signInWithEmailAndPassword(email, password)).user);
    } catch (error) {
      throw mapAuthError(error);
    }
  }
  async register(email: string, password: string): Promise<AuthUser> {
    try {
      return parseUser((await this.sdk.createUserWithEmailAndPassword(email, password)).user);
    } catch (error) {
      throw mapAuthError(error);
    }
  }
  async requestPasswordReset(email: string): Promise<void> {
    try {
      await this.sdk.sendPasswordResetEmail(email);
    } catch (error) {
      if (sdkErrorCode(error) !== 'auth/user-not-found') throw mapAuthError(error);
    }
  }
  async signOut(): Promise<void> {
    try {
      await this.sdk.signOut();
    } catch (error) {
      throw mapAuthError(error);
    }
  }
}
function parseUser(value: unknown): AuthUser {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('uid' in value) ||
    typeof value.uid !== 'string' ||
    !value.uid ||
    !('email' in value) ||
    !(value.email === null || typeof value.email === 'string') ||
    !('displayName' in value) ||
    !(value.displayName === null || typeof value.displayName === 'string')
  )
    throw new AppError('authentication-unavailable');
  return { uid: value.uid, email: value.email, displayName: value.displayName };
}
