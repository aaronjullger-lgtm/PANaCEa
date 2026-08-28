/**
 * Idempotency store — prevents duplicate side effects on retry.
 */

export interface IdempotencyRecord {
  key: string;
  result: unknown;
  createdAt: string;
}

export interface IdempotencyStore {
  get(key: string): Promise<IdempotencyRecord | null>;
  set(key: string, result: unknown): Promise<void>;
  has(key: string): Promise<boolean>;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();

  async get(key: string): Promise<IdempotencyRecord | null> {
    return this.records.get(key) ?? null;
  }

  async set(key: string, result: unknown): Promise<void> {
    this.records.set(key, {
      key,
      result,
      createdAt: new Date().toISOString(),
    });
  }

  async has(key: string): Promise<boolean> {
    return this.records.has(key);
  }
}

/**
 * Execute fn once per idempotency key; return cached result on duplicate.
 */
export async function withIdempotency<T>(
  store: IdempotencyStore,
  key: string,
  fn: () => Promise<T>
): Promise<{ value: T; duplicate: boolean }> {
  const existing = await store.get(key);
  if (existing) {
    return { value: existing.result as T, duplicate: true };
  }

  const value = await fn();
  await store.set(key, value);
  return { value, duplicate: false };
}
