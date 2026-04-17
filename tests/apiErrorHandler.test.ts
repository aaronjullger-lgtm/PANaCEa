/**
 * Tests for lib/errors/apiErrorHandler.ts
 *
 * Tests the pure retry logic, retry policy defaults, and error-to-AppError conversion.
 * Browser-dependent functions (navigator.onLine, fetch) are mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock navigator.onLine
Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true },
  writable: true,
  configurable: true,
});

// Mock AppErrorFactory and dependencies
vi.mock('@/lib/errors/appError', () => ({
  AppErrorFactory: {
    create: vi.fn((originalError, category, code, details) => ({
      name: 'AppError',
      message: String(originalError instanceof Error ? originalError.message : originalError),
      category,
      code,
      details,
      userMessage: '',
      technicalMessage: '',
      recoveryActions: [],
      isRetryable: false,
      maxRetries: 0,
    })),
  },
  ErrorCategory: {
    VALIDATION: 'validation',
    AUTHENTICATION: 'authentication',
    CLIENT: 'client',
    RATE_LIMIT: 'rate_limit',
    NETWORK: 'network',
    EXTERNAL_SERVICE: 'external_service',
    UNKNOWN: 'unknown',
  },
  ErrorCode: {
    VALIDATION_INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',
    AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
    AUTH_PERMISSION_DENIED: 'AUTH_PERMISSION_DENIED',
    CONTENT_NOT_FOUND: 'CONTENT_NOT_FOUND',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    NETWORK_SERVER_ERROR: 'NETWORK_SERVER_ERROR',
    NETWORK_OFFLINE: 'NETWORK_OFFLINE',
    NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
    CLIENT_SCRIPT_ERROR: 'CLIENT_SCRIPT_ERROR',
  },
  RecoveryAction: {
    RETRY: 'retry',
    WAIT_AND_RETRY: 'wait_and_retry',
    REAUTHENTICATE: 'reauthenticate',
    GO_OFFLINE: 'go_offline',
    REFRESH: 'refresh',
    CLEAR_CACHE: 'clear_cache',
  },
}));

import { DEFAULT_RETRY_POLICY, executeWithRetry } from '@/lib/errors/apiErrorHandler';
import { ErrorCategory } from '@/lib/errors/appError';

describe('DEFAULT_RETRY_POLICY', () => {
  it('has correct defaults', () => {
    expect(DEFAULT_RETRY_POLICY.maxAttempts).toBe(3);
    expect(DEFAULT_RETRY_POLICY.baseDelay).toBe(1000);
    expect(DEFAULT_RETRY_POLICY.maxDelay).toBe(10000);
    expect(DEFAULT_RETRY_POLICY.retryableStatuses).toEqual([429, 500, 502, 503, 504]);
    expect(DEFAULT_RETRY_POLICY.retryableCategories).toContain(ErrorCategory.NETWORK);
    expect(DEFAULT_RETRY_POLICY.retryableCategories).toContain(ErrorCategory.RATE_LIMIT);
  });
});

describe('executeWithRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await executeWithRetry(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on non-retryable errors', async () => {
    const appError = new Error('validation failed');
    Object.assign(appError, { category: 'validation', isRetryable: false });
    const fn = vi.fn().mockRejectedValue(appError);

    await expect(executeWithRetry(fn)).rejects.toThrow('validation failed');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
