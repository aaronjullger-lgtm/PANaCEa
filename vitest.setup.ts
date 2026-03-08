// Global test setup for Vitest.
// - Ensures browser-like APIs (localStorage) exist even in edge cases.
// - Sets up DATABASE_URL for Prisma client initialization in tests

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

// Ensure test env so hooks that branch on NODE_ENV use test paths (e.g. use-photo-drill fetchPhotoCases)
if (typeof process !== 'undefined') {
  process.env.NODE_ENV = 'test';
}

// Set DATABASE_URL for Prisma client initialization in tests
// This prevents "DATABASE_URL environment variable is not set!" errors
// Note: Tests should mock actual database operations
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
}

// Set Supabase configuration for test environment
// This prevents "supabaseUrl is required" errors when importing modules that use Supabase
// Note: Tests should mock actual Supabase operations
if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = 'https://test.supabase.co';
}
if (!process.env.SUPABASE_ANON_KEY) {
  process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.key';
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.service.key';
}

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

function ensureLocalStorage(): void {
  const candidate: any = (globalThis as any).localStorage;
  const looksValid =
    candidate &&
    typeof candidate.getItem === 'function' &&
    typeof candidate.setItem === 'function' &&
    typeof candidate.removeItem === 'function' &&
    typeof candidate.clear === 'function';

  // Some tests (or dependencies) may stub `localStorage` with an object that has the
  // right shape but doesn't actually persist values. Verify round-trip behavior.
  let roundTripOk = false;
  if (looksValid) {
    try {
      const probeKey = '__vitest_localStorage_probe__';
      candidate.setItem(probeKey, '1');
      roundTripOk = candidate.getItem(probeKey) === '1';
      candidate.removeItem(probeKey);
    } catch {
      roundTripOk = false;
    }
  }

  if (!looksValid || !roundTripOk) {
    (globalThis as any).localStorage = new MemoryStorage();
  }
}

ensureLocalStorage();

// Some test files (or their dependencies) replace `globalThis.localStorage` and don't restore it.
// Re-assert a working storage boundary between tests to prevent order-dependent failures.
beforeEach(() => {
  ensureLocalStorage();
  globalThis.localStorage.clear();
});

afterEach(() => {
  ensureLocalStorage();
  globalThis.localStorage.clear();
  cleanup();
});
