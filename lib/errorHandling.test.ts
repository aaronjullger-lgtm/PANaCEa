// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/errorHandling.ts
 *
 * Tested:
 *   Error classes: AppError, ValidationError, UnauthorizedError,
 *                  ForbiddenError, NotFoundError, ConflictError
 *   Pure utilities:
 *     getErrorMessage(error)        — extracts message from unknown error
 *     isOperationalError(error)     — classifies error as operational vs programming
 */

import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  getErrorMessage,
  isOperationalError,
} from './errorHandling';

// ─── AppError ─────────────────────────────────────────────────────────────────

describe('AppError', () => {
  it('is an instance of Error', () => {
    expect(new AppError('test')).toBeInstanceOf(Error);
  });

  it('stores message and defaults statusCode=500', () => {
    const err = new AppError('Something went wrong');
    expect(err.message).toBe('Something went wrong');
    expect(err.statusCode).toBe(500);
  });

  it('stores custom statusCode', () => {
    const err = new AppError('Not found', 404);
    expect(err.statusCode).toBe(404);
  });

  it('stores optional code and details', () => {
    const err = new AppError('Fail', 400, 'MY_CODE', { field: 'email' });
    expect(err.code).toBe('MY_CODE');
    expect(err.details).toEqual({ field: 'email' });
  });

  it('name is "AppError"', () => {
    expect(new AppError('x').name).toBe('AppError');
  });
});

// ─── Derived error classes ────────────────────────────────────────────────────

describe('ValidationError', () => {
  it('statusCode is 400', () => {
    expect(new ValidationError('Invalid').statusCode).toBe(400);
  });

  it('code is "VALIDATION_ERROR"', () => {
    expect(new ValidationError('Invalid').code).toBe('VALIDATION_ERROR');
  });

  it('name is "ValidationError"', () => {
    expect(new ValidationError('x').name).toBe('ValidationError');
  });
});

describe('UnauthorizedError', () => {
  it('statusCode is 401', () => {
    expect(new UnauthorizedError().statusCode).toBe(401);
  });

  it('default message is "Unauthorized"', () => {
    expect(new UnauthorizedError().message).toBe('Unauthorized');
  });

  it('accepts custom message', () => {
    expect(new UnauthorizedError('Login required').message).toBe('Login required');
  });
});

describe('ForbiddenError', () => {
  it('statusCode is 403', () => {
    expect(new ForbiddenError().statusCode).toBe(403);
  });

  it('default message is "Forbidden"', () => {
    expect(new ForbiddenError().message).toBe('Forbidden');
  });
});

describe('NotFoundError', () => {
  it('statusCode is 404', () => {
    expect(new NotFoundError().statusCode).toBe(404);
  });

  it('includes resource name in message', () => {
    expect(new NotFoundError('User').message).toContain('User');
    expect(new NotFoundError('User').message).toContain('not found');
  });

  it('default resource name is "Resource"', () => {
    expect(new NotFoundError().message).toContain('Resource');
  });
});

describe('ConflictError', () => {
  it('statusCode is 409', () => {
    expect(new ConflictError('Already exists').statusCode).toBe(409);
  });

  it('stores message', () => {
    expect(new ConflictError('Duplicate key').message).toBe('Duplicate key');
  });
});

// ─── getErrorMessage ──────────────────────────────────────────────────────────

describe('getErrorMessage', () => {
  it('extracts message from Error instance', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns string as-is', () => {
    expect(getErrorMessage('plain string error')).toBe('plain string error');
  });

  it('returns fallback for null', () => {
    expect(getErrorMessage(null)).toBe('Unknown error occurred');
  });

  it('returns fallback for undefined', () => {
    expect(getErrorMessage(undefined)).toBe('Unknown error occurred');
  });

  it('returns fallback for numeric error', () => {
    expect(getErrorMessage(42)).toBe('Unknown error occurred');
  });

  it('returns fallback for plain object', () => {
    expect(getErrorMessage({ code: 'ERR_500' })).toBe('Unknown error occurred');
  });

  it('extracts message from AppError (subclass of Error)', () => {
    expect(getErrorMessage(new AppError('app error'))).toBe('app error');
  });
});

// ─── isOperationalError ───────────────────────────────────────────────────────

describe('isOperationalError', () => {
  it('returns true for AppError', () => {
    expect(isOperationalError(new AppError('x'))).toBe(true);
  });

  it('returns true for ValidationError (subclass of AppError)', () => {
    expect(isOperationalError(new ValidationError('x'))).toBe(true);
  });

  it('returns true for NotFoundError', () => {
    expect(isOperationalError(new NotFoundError('x'))).toBe(true);
  });

  it('returns false for generic Error (not AppError)', () => {
    expect(isOperationalError(new Error('generic'))).toBe(false);
  });

  it('returns false for string', () => {
    expect(isOperationalError('error string')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isOperationalError(null)).toBe(false);
  });

  it('returns true for Error with Prisma name prefix', () => {
    const prismaError = new Error('connection failed');
    prismaError.name = 'PrismaClientKnownRequestError';
    expect(isOperationalError(prismaError)).toBe(true);
  });

  it('returns true for Error with "fetch" in message (network error)', () => {
    const networkErr = new Error('fetch failed: timeout');
    expect(isOperationalError(networkErr)).toBe(true);
  });

  it('returns true for Error with "network" in message', () => {
    const networkErr = new Error('network unreachable');
    expect(isOperationalError(networkErr)).toBe(true);
  });
});
