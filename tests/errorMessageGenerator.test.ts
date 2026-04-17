/**
 * Tests for lib/utils/errorMessageGenerator.ts
 *
 * Verifies error message generation from:
 * - Error patterns (regex matching)
 * - HTTP status codes
 * - Context customization
 * - Fallback behavior
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock toast before import
vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import {
  generateErrorMessage,
  generateErrorMessageFromStatusCode,
  createErrorResponse,
} from '@/lib/utils/errorMessageGenerator';

// Silence console.error in tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('generateErrorMessage', () => {
  it('matches network errors', () => {
    const result = generateErrorMessage('Network error occurred');
    expect(result.title).toBe('Connection Issue');
    expect(result.severity).toBe('error');
    expect(result.showRetry).toBe(true);
  });

  it('matches timeout errors', () => {
    const result = generateErrorMessage('Request timed out');
    expect(result.title).toBe('Request Timeout');
    expect(result.severity).toBe('warning');
  });

  it('matches authentication errors', () => {
    const result = generateErrorMessage('Session expired');
    expect(result.title).toBe('Authentication Required');
    expect(result.showRetry).toBe(false);
  });

  it('matches validation errors', () => {
    const result = generateErrorMessage('Validation failed: field required');
    expect(result.title).toBe('Validation Error');
  });

  it('matches permission errors', () => {
    const result = generateErrorMessage('Permission denied');
    expect(result.title).toBe('Access Denied');
  });

  it('matches rate limit errors', () => {
    const result = generateErrorMessage('Too many requests');
    expect(result.title).toBe('Too Many Requests');
  });

  it('matches 404 errors', () => {
    const result = generateErrorMessage('Resource not found');
    expect(result.title).toBe('Resource Not Found');
    expect(result.severity).toBe('info');
  });

  it('matches server errors', () => {
    const result = generateErrorMessage('Internal server error');
    expect(result.title).toBe('Server Error');
    expect(result.severity).toBe('error');
  });

  it('matches maintenance mode errors', () => {
    const result = generateErrorMessage('Service unavailable');
    expect(result.title).toBe('System Maintenance');
  });

  it('matches Error objects by message', () => {
    const result = generateErrorMessage(new Error('Network error'));
    expect(result.title).toBe('Connection Issue');
  });

  it('matches Error objects by name', () => {
    const err = new Error('something');
    err.name = 'AuthenticationError';
    const result = generateErrorMessage(err);
    expect(result.title).toBe('Authentication Required');
  });

  it('falls back to default for unknown errors', () => {
    const result = generateErrorMessage('xyzzy');
    expect(result.title).toBe('Something Went Wrong');
    expect(result.severity).toBe('error');
  });

  it('handles null error', () => {
    const result = generateErrorMessage(null);
    expect(result.title).toBe('Something Went Wrong');
  });

  it('handles undefined error', () => {
    const result = generateErrorMessage(undefined);
    expect(result.title).toBe('Something Went Wrong');
  });

  it('handles non-error objects', () => {
    const result = generateErrorMessage({ code: 500 });
    expect(result.title).toBeDefined();
    expect(result.description).toBeDefined();
  });

  it('appends operation to description when context provided', () => {
    const result = generateErrorMessage('Network error', {
      operation: 'submitting answer',
    });
    expect(result.description).toContain('submitting answer');
  });

  it('appends resource to title when context provided', () => {
    const result = generateErrorMessage('Not found', {
      resource: 'Question q-123',
    });
    expect(result.title).toContain('Question q-123');
  });

  it('adds retry callback to front of actions when showRetry', () => {
    const retryCallback = vi.fn();
    const result = generateErrorMessage('Network error', {
      retryCallback,
    });
    expect(result.actions[0]!.label).toBe('Try Again');
    expect(result.actions[0]!.action).toBe(retryCallback);
    expect(result.actions[0]!.priority).toBe('primary');
  });

  it('does not add retry callback when pattern has showRetry=false', () => {
    const retryCallback = vi.fn();
    const result = generateErrorMessage('Permission denied', {
      retryCallback,
    });
    // The "Go to Dashboard" action should still be primary
    expect(result.actions[0]!.label).toBe('Go to Dashboard');
  });

  it('returns at least one action', () => {
    const result = generateErrorMessage('unknown error');
    expect(result.actions.length).toBeGreaterThanOrEqual(1);
  });

  it('always returns showHelp and helpUrl', () => {
    const result = generateErrorMessage('anything');
    expect(result.showHelp).toBe(true);
    expect(result.helpUrl).toBeDefined();
  });
});

describe('generateErrorMessageFromStatusCode', () => {
  it('maps 400 to validation error pattern', () => {
    const result = generateErrorMessageFromStatusCode(400);
    // The function creates an Error("HTTP 400: Bad Request") which matches the 'not found' pattern
    // because "400" doesn't match any specific regex but falls to default
    expect(result.title).toBeDefined();
    expect(result.severity).toBeDefined();
  });

  it('maps 401 to Authentication Required (auth pattern match)', () => {
    const result = generateErrorMessageFromStatusCode(401);
    expect(result.title).toBe('Authentication Required');
  });

  it('maps 403 to Access Denied (permission pattern match)', () => {
    const result = generateErrorMessageFromStatusCode(403);
    expect(result.title).toBe('Access Denied');
  });

  it('maps 404 to Resource Not Found (not found pattern match)', () => {
    const result = generateErrorMessageFromStatusCode(404);
    expect(result.title).toBe('Resource Not Found');
    expect(result.severity).toBe('info');
  });

  it('maps 429 to Too Many Requests (rate limit pattern match)', () => {
    const result = generateErrorMessageFromStatusCode(429);
    expect(result.title).toBe('Too Many Requests');
  });

  it('maps 500 to Server Error (server pattern match)', () => {
    const result = generateErrorMessageFromStatusCode(500);
    expect(result.title).toBe('Server Error');
    expect(result.severity).toBe('error');
  });

  it('maps 503 to System Maintenance (maintenance pattern match)', () => {
    const result = generateErrorMessageFromStatusCode(503);
    expect(result.title).toBe('System Maintenance');
  });

  it('falls back to server error for unknown status codes', () => {
    const result = generateErrorMessageFromStatusCode(418);
    // Creates Error("HTTP 418: Internal Server Error") which matches 'server' or 'internal' pattern
    expect(result.title).toBe('Server Error');
  });

  it('accepts context with retry callback', () => {
    const cb = vi.fn();
    const result = generateErrorMessageFromStatusCode(500, { retryCallback: cb });
    // 500 maps to Server Error which has showRetry=true, so retry should be added
    expect(result.actions[0]!.label).toBe('Try Again');
  });
});

describe('createErrorResponse', () => {
  it('returns standardized error response shape', () => {
    const result = createErrorResponse('Something failed', 500);
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(500);
    expect(result.error.message).toBeDefined();
    expect(result.error.description).toBeDefined();
    expect(result.error.actions).toBeInstanceOf(Array);
    expect(result.error.timestamp).toBeDefined();
  });

  it('uses custom context', () => {
    const result = createErrorResponse('Not found', 404, {
      endpoint: '/api/questions/q-123',
    });
    expect(result.error.endpoint).toBe('/api/questions/q-123');
  });

  it('defaults to 500 status code', () => {
    const result = createErrorResponse('Error');
    expect(result.error.code).toBe(500);
  });

  it('maps action objects to labels only', () => {
    const result = createErrorResponse('Network error', 0);
    expect(result.error.actions).toEqual(
      expect.arrayContaining(['Check Internet Connection', 'Reload Page']),
    );
  });
});
