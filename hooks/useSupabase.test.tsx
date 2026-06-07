/**
 * Tests for Supabase client configuration
 */

import { describe, it, expect, vi } from 'vitest';
import { createSupabaseClientWithTokenGetter, validateSupabaseConfig } from '../lib/supabaseClient';

// Mock @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn((url, key, config) => ({
    from: vi.fn(() => ({
      select: vi.fn(),
    })),
    _config: config, // Store for testing
  })),
}));

describe('createSupabaseClientWithTokenGetter', () => {
  it('should create a Supabase client with custom fetch', () => {
    const mockGetToken = vi.fn().mockResolvedValue('test-token');

    const client = createSupabaseClientWithTokenGetter(mockGetToken);

    expect(client).toBeDefined();
    expect(client.from).toBeDefined();
    expect((client as any)._config).toBeDefined();
    expect((client as any)._config.global.fetch).toBeDefined();
  });

  it('should configure auth settings correctly', () => {
    const mockGetToken = vi.fn();

    const client = createSupabaseClientWithTokenGetter(mockGetToken);
    const config = (client as any)._config;

    expect(config.auth.persistSession).toBe(false);
    expect(config.auth.autoRefreshToken).toBe(false);
    expect(config.auth.detectSessionInUrl).toBe(false);
  });
});

describe('validateSupabaseConfig', () => {
  it('should validate configuration', () => {
    const originalEnv = (globalThis as any).__TEST_VITE_ENV__;

    // Test with missing URL
    (globalThis as any).__TEST_VITE_ENV__ = {
      ...((import.meta as any).env || {}),
    };
    delete (globalThis as any).__TEST_VITE_ENV__.VITE_SUPABASE_URL;

    const result = validateSupabaseConfig();
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Supabase URL');

    // Restore
    (globalThis as any).__TEST_VITE_ENV__ = originalEnv;
  });
});
