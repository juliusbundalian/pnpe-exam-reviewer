import type { Profile, ProfileRepository } from '../domain/ProfileRepository';
import { validateProfile } from './profileSchema';
import { AppError } from '../../../core/errors/AppError';
import { sdkErrorCode } from './mapAuthError';
export interface ProfileSdk {
  get(uid: string): Promise<unknown>;
  save(uid: string, profile: Profile): Promise<void>;
}
export class FirebaseProfileRepository implements ProfileRepository {
  constructor(private readonly sdk: ProfileSdk) {}
  async get(uid: string): Promise<Profile | null> {
    validateUid(uid);
    try {
      const data = await this.sdk.get(uid);
      return data === null ? null : validateProfile(data);
    } catch (error) {
      throw mapProfileError(error);
    }
  }
  async save(uid: string, profile: Profile): Promise<void> {
    validateUid(uid);
    const validated = validateProfile(profile);
    try {
      await this.sdk.save(uid, validated);
    } catch (error) {
      throw mapProfileError(error);
    }
  }
}
function validateUid(uid: string): void {
  if (
    !uid ||
    uid.length > 128 ||
    uid.includes('/') ||
    uid === '.' ||
    uid === '..' ||
    /^__.*__$/.test(uid)
  )
    throw new AppError('invalid-profile');
}
function mapProfileError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const code = sdkErrorCode(error);
  return new AppError(
    code === 'firestore/unavailable' || code === 'firestore/network-request-failed'
      ? 'network'
      : 'profile-unavailable',
  );
}
export interface ProfileSnapshot {
  exists(): boolean;
  data(): unknown;
}
export interface ProfileTransaction<Reference> {
  get(reference: Reference): Promise<ProfileSnapshot>;
  update(reference: Reference, fields: { displayName: string; updatedAt: unknown }): void;
  set(
    reference: Reference,
    fields: { displayName: string; updatedAt: unknown; createdAt: unknown },
  ): void;
}
export interface ProfileModularSdk<Reference> {
  doc(collection: 'users', uid: string): Reference;
  getDoc(reference: Reference): Promise<ProfileSnapshot>;
  runTransaction(
    action: (transaction: ProfileTransaction<Reference>) => Promise<void>,
  ): Promise<void>;
  serverTimestamp(): unknown;
}
export function createProfileSdk<Reference>(sdk: ProfileModularSdk<Reference>): ProfileSdk {
  return {
    get: async (uid) => {
      const snapshot = await sdk.getDoc(sdk.doc('users', uid));
      return snapshot.exists() ? snapshot.data() : null;
    },
    save: async (uid, profile) => {
      const reference = sdk.doc('users', uid);
      await sdk.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(reference);
        const fields = { displayName: profile.displayName, updatedAt: sdk.serverTimestamp() };
        if (snapshot.exists()) transaction.update(reference, fields);
        else transaction.set(reference, { ...fields, createdAt: sdk.serverTimestamp() });
      });
    },
  };
}
