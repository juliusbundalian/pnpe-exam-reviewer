export type AuthUser = { uid: string; email: string | null; displayName: string | null };
export type AuthState =
  | { status: 'resolving' | 'guest' }
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'recoveryRequired'; previousUid: string | null };
export interface AuthenticationRepository {
  observe(listener: (state: AuthState) => void): () => void;
  signIn(email: string, password: string): Promise<AuthUser>;
  register(email: string, password: string): Promise<AuthUser>;
  requestPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;
}
