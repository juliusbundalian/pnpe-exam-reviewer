import type {
  AuthenticationRepository,
  AuthState,
  AuthUser,
} from '../domain/AuthenticationRepository';
import type { ProfileRepository } from '../domain/ProfileRepository';
import { PROFILE_DISPLAY_NAME_MAX_LENGTH } from '../domain/ProfileRepository';
import { AppError } from '../../../core/errors/AppError';
import { toFriendlyAuthMessage } from '../../../core/errors/userMessage';
export type RegistrationState = {
  status: 'idle' | 'registering' | 'savingProfile' | 'complete' | 'profileRecovery';
  user: AuthUser | null;
  displayName: string | null;
  message: string | null;
};
export class RegistrationController {
  private state: RegistrationState = {
    status: 'idle',
    user: null,
    displayName: null,
    message: null,
  };
  private listeners = new Set<() => void>();
  private authState: AuthState = { status: 'guest' };
  private generation = 0;
  private disposed = false;
  constructor(
    private auth: AuthenticationRepository,
    private profiles: ProfileRepository,
  ) {}
  getSnapshot = (): RegistrationState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(state: RegistrationState): void {
    if (this.disposed) return;
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  // The app-lifetime provider forwards every auth observation before rendering routes.
  synchronizeAuth(authState: AuthState): void {
    if (this.disposed) return;
    const identity = (state: AuthState) =>
      state.status === 'authenticated' ? state.user.uid : state.status;
    const acceptingRegistration =
      this.state.status === 'registering' &&
      this.authState.status === 'guest' &&
      authState.status === 'authenticated';
    const cancelledRegistration =
      this.state.status === 'registering' && authState.status === 'guest';
    if (
      cancelledRegistration ||
      (!acceptingRegistration && identity(authState) !== identity(this.authState))
    ) {
      this.generation++;
      this.update({ status: 'idle', user: null, displayName: null, message: null });
    }
    this.authState = authState;
  }
  register = async (email: string, password: string, displayName: string): Promise<void> => {
    if (this.disposed || this.state.status !== 'idle') return;
    if (!displayName.trim() || displayName.trim().length > PROFILE_DISPLAY_NAME_MAX_LENGTH)
      throw new AppError('invalid-profile');
    const generation = this.generation;
    this.update({
      status: 'registering',
      user: null,
      displayName: displayName.trim(),
      message: null,
    });
    let user: AuthUser;
    try {
      user = await this.auth.register(email, password);
    } catch (error: unknown) {
      if (!this.disposed && generation === this.generation)
        this.update({ status: 'idle', user: null, displayName: null, message: null });
      throw error;
    }
    if (this.disposed || generation !== this.generation) return;
    if (this.authState.status === 'authenticated' && this.authState.user.uid !== user.uid) {
      this.generation++;
      this.update({ status: 'idle', user: null, displayName: null, message: null });
      return;
    }
    this.authState = { status: 'authenticated', user };
    this.update({ status: 'savingProfile', user, displayName: displayName.trim(), message: null });
    await this.saveProfile(generation);
  };
  private async saveProfile(generation: number): Promise<void> {
    const { user, displayName } = this.state;
    if (
      !user ||
      !displayName ||
      this.authState.status !== 'authenticated' ||
      this.authState.user.uid !== user.uid
    )
      return;
    try {
      await this.profiles.save(user.uid, { displayName });
      if (!this.disposed && generation === this.generation)
        this.update({ status: 'complete', user, displayName, message: null });
    } catch (error: unknown) {
      if (!this.disposed && generation === this.generation)
        this.update({
          status: 'profileRecovery',
          user,
          displayName,
          message: toFriendlyAuthMessage(error),
        });
    }
  }
  retryProfile = async (): Promise<void> => {
    if (this.disposed || this.state.status !== 'profileRecovery') return;
    this.update({ ...this.state, status: 'savingProfile', message: null });
    await this.saveProfile(this.generation);
  };
  dispose(): void {
    this.disposed = true;
    this.generation++;
    this.listeners.clear();
    this.state = { status: 'idle', user: null, displayName: null, message: null };
  }
}
