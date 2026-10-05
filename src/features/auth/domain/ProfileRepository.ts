export type Profile = { displayName: string };
export const PROFILE_DISPLAY_NAME_MAX_LENGTH = 100;
export interface ProfileRepository {
  get(uid: string): Promise<Profile | null>;
  save(uid: string, profile: Profile): Promise<void>;
}
