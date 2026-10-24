export interface IdentitySource {
  /** Fresh safe generated ID, at most 128 ASCII characters. */
  nextId(): string;
}
