/**
 * Tests for lib/errors/types.ts
 *
 * Verifies error class hierarchy, type guards, and utility functions.
 */

import { describe, it, expect } from 'vitest';
import {
  AppError,
  NetworkError,
  ApiError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  TimeoutError,
  DatabaseError,
  ExternalServiceError,
  ConfigurationError,
  isAppError,
  isRetryableError,
  toAppError,
  getUserFriendlyMessage,
} from '@/lib/errors/types';

describe('AppError', () => {
  it('sets default properties correctly', () => {
    const err = new AppError('test error');
    expect(err.message).toBe('test error');
    expect(err.name).toBe('AppError');
    expect(err.category).toBe('unknown');
    expect(err.severity).toBe('error');
    expect(err.retryMetadata.retryable).toBe(false);
    expect(err.errorId).toMatch(/^err_\d+_[a-z0-9]+$/);
    expect(err.timestamp).toBeDefined();
  });

  it('accepts custom category and severity', () => {
    const err = new AppError('test', 'network', 'warning', true);
    expect(err.category).toBe('network');
    expect(err.severity).toBe('warning');
    expect(err.retryMetadata.retryable).toBe(true);
  });

  it('accepts context', () => {
    const err = new AppError('test', 'unknown', 'error', false, { key: 'value' });
    expect(err.context).toEqual({ key: 'value' });
  });

  it('is instanceof Error', () => {
    const err = new AppError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });
});

describe('NetworkError', () => {
  it('defaults to retryable with 2s delay', () => {
    const err = new NetworkError('connection lost');
    expect(err.category).toBe('network');
    expect(err.retryMetadata.retryable).toBe(true);
    expect(err.retryMetadata.retryAfterMs).toBe(2000);
    expect(err.retryMetadata.maxRetries).toBe(3);
  });

  it('sets error severity based on status code', () => {
    const err5xx = new NetworkError('server error', 500);
    expect(err5xx.severity).toBe('error');

    const err4xx = new NetworkError('client error', 400);
    expect(err4xx.severity).toBe('warning');

    const errNoStatus = new NetworkError('no status');
    expect(errNoStatus.severity).toBe('warning');
  });
});

describe('ApiError', () => {
  it('sets retryable for 429', () => {
    const err = new ApiError('rate limited', 429, '/api/test');
    expect(err.retryMetadata.retryable).toBe(true);
    expect(err.retryMetadata.retryAfterMs).toBe(60000);
    expect(err.severity).toBe('warning');
  });

  it('sets retryable for 5xx', () => {
    const err = new ApiError('server error', 500);
    expect(err.retryMetadata.retryable).toBe(true);
    expect(err.retryMetadata.retryAfterMs).toBe(3000);
    expect(err.severity).toBe('error');
  });

  it('sets retryable for 408 timeout', () => {
    const err = new ApiError('timeout', 408);
    expect(err.retryMetadata.retryable).toBe(true);
    expect(err.retryMetadata.retryAfterMs).toBe(1000);
  });

  it('not retryable for 4xx (non-429/408)', () => {
    const err = new ApiError('bad request', 400);
    expect(err.retryMetadata.retryable).toBe(false);
  });

  it('not retryable when no status code', () => {
    const err = new ApiError('unknown error');
    expect(err.retryMetadata.retryable).toBe(false);
  });
});

describe('ValidationError', () => {
  it('is not retryable', () => {
    const err = new ValidationError('invalid input', 'email', 'bad@test');
    expect(err.retryMetadata.retryable).toBe(false);
    expect(err.category).toBe('validation');
    expect(err.field).toBe('email');
    expect(err.value).toBe('bad@test');
  });
});

describe('AuthenticationError', () => {
  it('is not retryable', () => {
    const err = new AuthenticationError('session expired');
    expect(err.retryMetadata.retryable).toBe(false);
    expect(err.category).toBe('authentication');
  });
});

describe('AuthorizationError', () => {
  it('is not retryable', () => {
    const err = new AuthorizationError('access denied', '/admin');
    expect(err.retryMetadata.retryable).toBe(false);
    expect(err.category).toBe('authorization');
    expect(err.resource).toBe('/admin');
  });
});

describe('RateLimitError', () => {
  it('is retryable with default 60s', () => {
    const err = new RateLimitError('too many requests');
    expect(err.retryMetadata.retryable).toBe(true);
    expect(err.retryMetadata.retryAfterMs).toBe(60000);
  });

  it('uses custom retry time', () => {
    const err = new RateLimitError('too many', 30);
    expect(err.retryMetadata.retryAfterMs).toBe(30000);
  });
});

describe('TimeoutError', () => {
  it('is retryable with 1s delay', () => {
    const err = new TimeoutError('request timed out', 5000);
    expect(err.retryMetadata.retryable).toBe(true);
    expect(err.retryMetadata.retryAfterMs).toBe(1000);
    expect(err.timeoutMs).toBe(5000);
  });
});

describe('DatabaseError', () => {
  it('is retryable with 2s delay', () => {
    const err = new DatabaseError('connection failed', 'SELECT');
    expect(err.retryMetadata.retryable).toBe(true);
    expect(err.retryMetadata.retryAfterMs).toBe(2000);
    expect(err.operation).toBe('SELECT');
  });
});

describe('ExternalServiceError', () => {
  it('is retryable', () => {
    const err = new ExternalServiceError('gemini failed', 'gemini', 500);
    expect(err.retryMetadata.retryable).toBe(true);
    expect(err.service).toBe('gemini');
    expect(err.severity).toBe('error');
  });

  it('uses 60s retry for 429', () => {
    const err = new ExternalServiceError('rate limited', 'openai', 429);
    expect(err.retryMetadata.retryAfterMs).toBe(60000);
  });
});

describe('ConfigurationError', () => {
  it('is not retryable', () => {
    const err = new ConfigurationError('missing API key', 'GEMINI_API_KEY');
    expect(err.retryMetadata.retryable).toBe(false);
    expect(err.configKey).toBe('GEMINI_API_KEY');
  });
});

describe('isAppError', () => {
  it('returns true for AppError instances', () => {
    expect(isAppError(new AppError('test'))).toBe(true);
    expect(isAppError(new NetworkError('test'))).toBe(true);
    expect(isAppError(new ApiError('test'))).toBe(true);
  });

  it('returns false for plain Error', () => {
    expect(isAppError(new Error('test'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isAppError('string')).toBe(false);
    expect(isAppError(42)).toBe(false);
    expect(isAppError(null)).toBe(false);
  });
});

describe('isRetryableError', () => {
  it('returns true for retryable AppErrors', () => {
    expect(isRetryableError(new NetworkError('test'))).toBe(true);
    expect(isRetryableError(new RateLimitError('test'))).toBe(true);
    expect(isRetryableError(new TimeoutError('test', 1000))).toBe(true);
  });

  it('returns false for non-retryable AppErrors', () => {
    expect(isRetryableError(new ValidationError('test'))).toBe(false);
    expect(isRetryableError(new AuthenticationError('test'))).toBe(false);
  });

  it('returns false for non-AppErrors', () => {
    expect(isRetryableError(new Error('test'))).toBe(false);
    expect(isRetryableError('error')).toBe(false);
  });
});

describe('toAppError', () => {
  it('returns same instance if already AppError', () => {
    const err = new AppError('test', 'network');
    expect(toAppError(err)).toBe(err);
  });

  it('wraps plain Error', () => {
    const err = toAppError(new Error('something'));
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe('something');
    expect(err.context?.originalName).toBe('Error');
  });

  it('wraps string', () => {
    const err = toAppError('just a string');
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe('just a string');
  });

  it('wraps null/undefined', () => {
    const err = toAppError(null);
    expect(err.message).toBe('null');
  });
});

describe('getUserFriendlyMessage', () => {
  it('returns category-specific messages', () => {
    expect(getUserFriendlyMessage(new NetworkError('test'))).toContain('Network');
    expect(getUserFriendlyMessage(new RateLimitError('test'))).toContain('Too many');
    expect(getUserFriendlyMessage(new TimeoutError('test', 1000))).toContain('timed out');
    expect(getUserFriendlyMessage(new AuthenticationError('test'))).toContain('sign in');
    expect(getUserFriendlyMessage(new AuthorizationError('test'))).toContain('permission');
  });

  it('returns validation error message directly', () => {
    const err = new ValidationError('Email format is invalid');
    expect(getUserFriendlyMessage(err)).toBe('Email format is invalid');
  });

  it('returns generic message for unknown categories', () => {
    const err = new AppError('something', 'configuration');
    expect(getUserFriendlyMessage(err)).toContain('unexpected error');
  });

  it('returns generic message for non-AppError', () => {
    expect(getUserFriendlyMessage(new Error('test'))).toContain('unexpected error');
    expect(getUserFriendlyMessage('string')).toContain('unexpected error');
  });
});

describe('Error hierarchy', () => {
  it('all error types extend AppError', () => {
    const errors = [
      new NetworkError('n'),
      new ApiError('a'),
      new ValidationError('v'),
      new AuthenticationError('au'),
      new AuthorizationError('az'),
      new RateLimitError('r'),
      new TimeoutError('t', 1000),
      new DatabaseError('d'),
      new ExternalServiceError('e', 'svc'),
      new ConfigurationError('c'),
    ];

    for (const err of errors) {
      expect(err).toBeInstanceOf(AppError);
      expect(err).toBeInstanceOf(Error);
    }
  });
});
