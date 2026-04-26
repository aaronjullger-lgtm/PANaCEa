import { describe, it, expect } from 'vitest';
import {
  categorizeError,
  determineErrorSeverity,
  createAppError,
  formatErrorForToast,
  getUserFacingError,
  isUserRecoverable,
  getRecoverySuggestions,
  type ErrorCategory,
  type AppError,
} from './errorHandlingUtils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAppError(category: ErrorCategory, overrides: Partial<AppError> = {}): AppError {
  return {
    code: 'ERR_TEST',
    message: 'test error',
    userMessage: 'Something went wrong.',
    category,
    severity: 'low',
    recoverable: true,
    retryable: false,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ─── categorizeError ──────────────────────────────────────────────────────────

describe('categorizeError', () => {
  it('401 status → authentication', () => {
    expect(categorizeError({ status: 401 })).toBe('authentication');
  });

  it('403 status → authorization', () => {
    expect(categorizeError({ status: 403 })).toBe('authorization');
  });

  it('404 status → not_found', () => {
    expect(categorizeError({ status: 404 })).toBe('not_found');
  });

  it('409 status → conflict', () => {
    expect(categorizeError({ status: 409 })).toBe('conflict');
  });

  it('400 status → validation', () => {
    expect(categorizeError({ status: 400 })).toBe('validation');
  });

  it('422 status → validation', () => {
    expect(categorizeError({ status: 422 })).toBe('validation');
  });

  it('429 status → rate_limit', () => {
    expect(categorizeError({ status: 429 })).toBe('rate_limit');
  });

  it('500 status → server', () => {
    expect(categorizeError({ status: 500 })).toBe('server');
  });

  it('503 status → server', () => {
    expect(categorizeError({ status: 503 })).toBe('server');
  });

  it('Error with code ECONNREFUSED → network', () => {
    const err = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
    expect(categorizeError(err)).toBe('network');
  });

  it('Error with code ETIMEDOUT → timeout', () => {
    const err = Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' });
    expect(categorizeError(err)).toBe('timeout');
  });

  it('Error with code ERR_UNAUTHORIZED → authentication', () => {
    const err = Object.assign(new Error('unauthorized'), { code: 'ERR_UNAUTHORIZED' });
    expect(categorizeError(err)).toBe('authentication');
  });

  it('Error message containing "network" → network', () => {
    expect(categorizeError(new Error('Failed to fetch: network error'))).toBe('network');
  });

  it('Error message containing "timeout" → timeout', () => {
    expect(categorizeError(new Error('Request timeout occurred'))).toBe('timeout');
  });

  it('Error message containing "unauthorized" → authentication', () => {
    expect(categorizeError(new Error('Request unauthorized'))).toBe('authentication');
  });

  it('Error message containing "forbidden" → authorization', () => {
    expect(categorizeError(new Error('Forbidden access'))).toBe('authorization');
  });

  it('unknown error → unknown', () => {
    expect(categorizeError(new Error('Some random failure'))).toBe('unknown');
  });

  it('null → unknown', () => {
    expect(categorizeError(null)).toBe('unknown');
  });

  it('string → unknown', () => {
    expect(categorizeError('oops')).toBe('unknown');
  });
});

// ─── determineErrorSeverity ───────────────────────────────────────────────────

describe('determineErrorSeverity', () => {
  it('authentication → high', () => {
    expect(determineErrorSeverity('authentication')).toBe('high');
  });

  it('authorization → high', () => {
    expect(determineErrorSeverity('authorization')).toBe('high');
  });

  it('server → high', () => {
    expect(determineErrorSeverity('server')).toBe('high');
  });

  it('database → high', () => {
    expect(determineErrorSeverity('database')).toBe('high');
  });

  it('network → medium', () => {
    expect(determineErrorSeverity('network')).toBe('medium');
  });

  it('timeout → medium', () => {
    expect(determineErrorSeverity('timeout')).toBe('medium');
  });

  it('rate_limit → medium', () => {
    expect(determineErrorSeverity('rate_limit')).toBe('medium');
  });

  it('validation → low', () => {
    expect(determineErrorSeverity('validation')).toBe('low');
  });

  it('not_found → low', () => {
    expect(determineErrorSeverity('not_found')).toBe('low');
  });

  it('conflict → low', () => {
    expect(determineErrorSeverity('conflict')).toBe('low');
  });

  it('unknown → low', () => {
    expect(determineErrorSeverity('unknown')).toBe('low');
  });
});

// ─── createAppError ───────────────────────────────────────────────────────────

describe('createAppError', () => {
  it('returns all required fields', () => {
    const err = createAppError(new Error('test'));
    expect(err).toHaveProperty('code');
    expect(err).toHaveProperty('message');
    expect(err).toHaveProperty('userMessage');
    expect(err).toHaveProperty('category');
    expect(err).toHaveProperty('severity');
    expect(err).toHaveProperty('recoverable');
    expect(err).toHaveProperty('retryable');
    expect(err).toHaveProperty('timestamp');
  });

  it('uses error.message for message field', () => {
    const err = createAppError(new Error('specific message'));
    expect(err.message).toBe('specific message');
  });

  it('uses string directly as message', () => {
    const err = createAppError('plain string error');
    expect(err.message).toBe('plain string error');
  });

  it('uses error.code when present', () => {
    const e = Object.assign(new Error('enotfound'), { code: 'ENOTFOUND' });
    const err = createAppError(e);
    expect(err.code).toBe('ENOTFOUND');
  });

  it('defaults code to ERR_UNKNOWN for Error without code', () => {
    const err = createAppError(new Error('no code'));
    expect(err.code).toBe('ERR_UNKNOWN');
  });

  it('originalError is set for Error instances', () => {
    const orig = new Error('original');
    const err = createAppError(orig);
    expect(err.originalError).toBe(orig);
  });

  it('originalError is undefined for non-Error input', () => {
    const err = createAppError({ status: 404 });
    expect(err.originalError).toBeUndefined();
  });

  it('timestamp is a valid ISO string', () => {
    const err = createAppError(new Error('ts'));
    expect(() => new Date(err.timestamp)).not.toThrow();
  });

  it('authentication errors are not recoverable', () => {
    const err = createAppError({ status: 401 });
    expect(err.recoverable).toBe(false);
  });

  it('network errors are retryable', () => {
    const e = Object.assign(new Error('network'), { code: 'ECONNREFUSED' });
    const err = createAppError(e);
    expect(err.retryable).toBe(true);
  });

  it('validation errors are not retryable', () => {
    const err = createAppError({ status: 400 });
    expect(err.retryable).toBe(false);
  });

  it('context is passed through', () => {
    const ctx = { url: '/api/test', userId: '123' };
    const err = createAppError(new Error('ctx test'), ctx);
    expect(err.context).toEqual(ctx);
  });
});

// ─── formatErrorForToast ──────────────────────────────────────────────────────

describe('formatErrorForToast', () => {
  it('low severity → variant: info', () => {
    const result = formatErrorForToast(makeAppError('validation', { severity: 'low' }));
    expect(result.variant).toBe('info');
  });

  it('medium severity → variant: warning', () => {
    const result = formatErrorForToast(makeAppError('network', { severity: 'medium' }));
    expect(result.variant).toBe('warning');
  });

  it('high severity → variant: error', () => {
    const result = formatErrorForToast(makeAppError('server', { severity: 'high' }));
    expect(result.variant).toBe('error');
  });

  it('critical severity → variant: error', () => {
    const result = formatErrorForToast(makeAppError('server', { severity: 'critical' }));
    expect(result.variant).toBe('error');
  });

  it('has title and description', () => {
    const result = formatErrorForToast(makeAppError('network'));
    expect(typeof result.title).toBe('string');
    expect(typeof result.description).toBe('string');
  });

  it('retryable error has Try Again action', () => {
    const result = formatErrorForToast(makeAppError('network', { retryable: true }));
    expect(result.action).toBeDefined();
    expect(result.action!.label).toBe('Try Again');
  });

  it('non-retryable error has no action', () => {
    const result = formatErrorForToast(makeAppError('validation', { retryable: false }));
    expect(result.action).toBeUndefined();
  });
});

// ─── getUserFacingError ───────────────────────────────────────────────────────

describe('getUserFacingError', () => {
  it('gemini context always returns tutor unavailable copy', () => {
    for (const cat of ['network', 'server', 'validation'] as ErrorCategory[]) {
      const result = getUserFacingError(cat, 'gemini');
      expect(result.title).toBe('Tutor unavailable');
    }
  });

  it('gemini context has secondaryLabel "Go Home"', () => {
    const result = getUserFacingError('server', 'gemini');
    expect(result.secondaryLabel).toBe('Go Home');
  });

  it('drill context primaryAction is "Try Again"', () => {
    const result = getUserFacingError('network', 'drill');
    expect(result.primaryAction).toBe('Try Again');
  });

  it('drill context secondaryLabel is "Back to Command Center"', () => {
    const result = getUserFacingError('network', 'drill');
    expect(result.secondaryLabel).toBe('Back to Command Center');
  });

  it('default context network → "Go Home" secondary', () => {
    const result = getUserFacingError('network', 'default');
    expect(result.secondaryLabel).toBe('Go Home');
  });

  it('default context server → "Go Home" secondary', () => {
    const result = getUserFacingError('server', 'default');
    expect(result.secondaryLabel).toBe('Go Home');
  });

  it('default context validation → no secondary label', () => {
    const result = getUserFacingError('validation', 'default');
    expect(result.secondaryLabel).toBeUndefined();
  });

  it('authentication category has descriptive title', () => {
    const result = getUserFacingError('authentication');
    expect(result.title).toBeTruthy();
    expect(result.message).toBeTruthy();
  });

  it('all categories return title, message, primaryAction', () => {
    const categories: ErrorCategory[] = [
      'network', 'authentication', 'authorization', 'validation',
      'server', 'database', 'timeout', 'rate_limit', 'not_found', 'conflict', 'unknown',
    ];
    for (const cat of categories) {
      const result = getUserFacingError(cat);
      expect(result.title).toBeTruthy();
      expect(result.message).toBeTruthy();
      expect(result.primaryAction).toBe('Try Again');
    }
  });
});

// ─── isUserRecoverable ────────────────────────────────────────────────────────

describe('isUserRecoverable', () => {
  it('validation → true', () => {
    expect(isUserRecoverable(makeAppError('validation'))).toBe(true);
  });

  it('network → true', () => {
    expect(isUserRecoverable(makeAppError('network'))).toBe(true);
  });

  it('timeout → true', () => {
    expect(isUserRecoverable(makeAppError('timeout'))).toBe(true);
  });

  it('rate_limit → true', () => {
    expect(isUserRecoverable(makeAppError('rate_limit'))).toBe(true);
  });

  it('server → false', () => {
    expect(isUserRecoverable(makeAppError('server'))).toBe(false);
  });

  it('authentication → false', () => {
    expect(isUserRecoverable(makeAppError('authentication'))).toBe(false);
  });

  it('database → false', () => {
    expect(isUserRecoverable(makeAppError('database'))).toBe(false);
  });

  it('unknown → false', () => {
    expect(isUserRecoverable(makeAppError('unknown'))).toBe(false);
  });
});

// ─── getRecoverySuggestions ───────────────────────────────────────────────────

describe('getRecoverySuggestions', () => {
  it('returns a non-empty array for every category', () => {
    const categories: ErrorCategory[] = [
      'network', 'authentication', 'authorization', 'validation',
      'server', 'database', 'timeout', 'rate_limit', 'not_found', 'conflict', 'unknown',
    ];
    for (const cat of categories) {
      const suggestions = getRecoverySuggestions(makeAppError(cat));
      expect(suggestions.length).toBeGreaterThan(0);
    }
  });

  it('network suggestions mention internet connection', () => {
    const suggestions = getRecoverySuggestions(makeAppError('network'));
    const hasConnection = suggestions.some(s => s.toLowerCase().includes('internet') || s.toLowerCase().includes('connection'));
    expect(hasConnection).toBe(true);
  });

  it('rate_limit suggestions mention waiting', () => {
    const suggestions = getRecoverySuggestions(makeAppError('rate_limit'));
    const hasWait = suggestions.some(s => s.toLowerCase().includes('wait'));
    expect(hasWait).toBe(true);
  });

  it('authentication suggestions mention sign in', () => {
    const suggestions = getRecoverySuggestions(makeAppError('authentication'));
    const hasSignIn = suggestions.some(s => s.toLowerCase().includes('sign in'));
    expect(hasSignIn).toBe(true);
  });

  it('all suggestion strings are non-empty', () => {
    const suggestions = getRecoverySuggestions(makeAppError('unknown'));
    suggestions.forEach(s => expect(s.length).toBeGreaterThan(0));
  });
});
