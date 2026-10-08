export type SqlValue = string | number | null;
export interface SqlDatabase {
  run(sql: string, params?: readonly SqlValue[]): Promise<{ changes: number }>;
  all(sql: string, params?: readonly SqlValue[]): Promise<readonly Record<string, unknown>[]>;
  /** Serialized transaction on one connection. A throwing commit guard rolls back. */
  exclusive<T>(work: (tx: SqlDatabase) => Promise<T>, beforeCommit?: () => void): Promise<T>;
  close(): Promise<void>;
}
export type SqlDriver = Pick<SqlDatabase, 'run' | 'all' | 'close'>;
