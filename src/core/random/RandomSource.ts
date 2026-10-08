export interface RandomSource {
  /** Each call supplies an independent uniform value in [0, 1). */
  next(): number;
}
