import { describe, expect, it } from 'vitest';
import {
  ErrorCode,
  ERROR_CATALOG,
  getCatalogEntry,
  codeFromStatus,
  isKnownErrorCode,
} from '../error-catalog';

describe('error-catalog', () => {
  describe('ErrorCode enum', () => {
    it('contains all documented codes', () => {
      // Auth
      expect(ErrorCode.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(ErrorCode.TOKEN_EXPIRED).toBe('TOKEN_EXPIRED');
      expect(ErrorCode.TOKEN_INVALID).toBe('TOKEN_INVALID');
      expect(ErrorCode.FORBIDDEN).toBe('FORBIDDEN');
      expect(ErrorCode.ADMIN_REQUIRED).toBe('ADMIN_REQUIRED');
      // Validation
      expect(ErrorCode.VALIDATION_FAILED).toBe('VALIDATION_FAILED');
      expect(ErrorCode.INVALID_JSON).toBe('INVALID_JSON');
      // Resource
      expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND');
      expect(ErrorCode.CONFLICT).toBe('CONFLICT');
      // Rate
      expect(ErrorCode.RATE_LIMITED).toBe('RATE_LIMITED');
      expect(ErrorCode.AI_QUOTA_EXCEEDED).toBe('AI_QUOTA_EXCEEDED');
      // Server
      expect(ErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
      expect(ErrorCode.GEMINI_ERROR).toBe('GEMINI_ERROR');
      expect(ErrorCode.TIMEOUT).toBe('TIMEOUT');
    });
  });

  describe('ERROR_CATALOG', () => {
    it('has an entry for every code', () => {
      for (const code of Object.values(ErrorCode)) {
        const entry = ERROR_CATALOG[code];
        expect(entry, `missing catalog entry for ${code}`).toBeDefined();
        expect(entry.status).toBeGreaterThanOrEqual(400);
        expect(entry.defaultMessage.length).toBeGreaterThan(0);
        expect(typeof entry.capture).toBe('boolean');
      }
    });

    it('maps auth errors to 4xx without Sentry capture', () => {
      expect(ERROR_CATALOG[ErrorCode.UNAUTHORIZED].status).toBe(401);
      expect(ERROR_CATALOG[ErrorCode.UNAUTHORIZED].capture).toBe(false);
      expect(ERROR_CATALOG[ErrorCode.FORBIDDEN].status).toBe(403);
      expect(ERROR_CATALOG[ErrorCode.FORBIDDEN].capture).toBe(false);
    });

    it('maps server errors to 5xx with Sentry capture', () => {
      expect(ERROR_CATALOG[ErrorCode.INTERNAL_ERROR].status).toBe(500);
      expect(ERROR_CATALOG[ErrorCode.INTERNAL_ERROR].capture).toBe(true);
      expect(ERROR_CATALOG[ErrorCode.GEMINI_ERROR].status).toBe(502);
      expect(ERROR_CATALOG[ErrorCode.GEMINI_ERROR].capture).toBe(true);
      expect(ERROR_CATALOG[ErrorCode.TIMEOUT].status).toBe(504);
    });

    it('maps rate-limiting errors to 429', () => {
      expect(ERROR_CATALOG[ErrorCode.RATE_LIMITED].status).toBe(429);
      expect(ERROR_CATALOG[ErrorCode.AI_QUOTA_EXCEEDED].status).toBe(429);
      expect(ERROR_CATALOG[ErrorCode.AI_QUOTA_EXCEEDED].capture).toBe(true);
    });
  });

  describe('getCatalogEntry', () => {
    it('returns the entry for a known code', () => {
      expect(getCatalogEntry(ErrorCode.NOT_FOUND).status).toBe(404);
    });

    it('falls back to the generic ERROR entry for unknown codes', () => {
      const entry = getCatalogEntry('DEFINITELY_NOT_A_REAL_CODE');
      expect(entry.status).toBe(500);
      expect(entry.defaultMessage.length).toBeGreaterThan(0);
    });
  });

  describe('codeFromStatus', () => {
    it('maps common statuses to their canonical codes', () => {
      expect(codeFromStatus(400)).toBe(ErrorCode.VALIDATION_FAILED);
      expect(codeFromStatus(401)).toBe(ErrorCode.UNAUTHORIZED);
      expect(codeFromStatus(403)).toBe(ErrorCode.FORBIDDEN);
      expect(codeFromStatus(404)).toBe(ErrorCode.NOT_FOUND);
      expect(codeFromStatus(409)).toBe(ErrorCode.CONFLICT);
      expect(codeFromStatus(410)).toBe(ErrorCode.GONE);
      expect(codeFromStatus(413)).toBe(ErrorCode.PAYLOAD_TOO_LARGE);
      expect(codeFromStatus(415)).toBe(ErrorCode.UNSUPPORTED_MEDIA_TYPE);
      expect(codeFromStatus(429)).toBe(ErrorCode.RATE_LIMITED);
      expect(codeFromStatus(502)).toBe(ErrorCode.UPSTREAM_ERROR);
      expect(codeFromStatus(503)).toBe(ErrorCode.SERVICE_UNAVAILABLE);
      expect(codeFromStatus(504)).toBe(ErrorCode.TIMEOUT);
    });

    it('defaults unknown 5xx to INTERNAL_ERROR', () => {
      expect(codeFromStatus(599)).toBe(ErrorCode.INTERNAL_ERROR);
    });

    it('defaults 2xx/3xx to generic ERROR', () => {
      expect(codeFromStatus(200)).toBe(ErrorCode.ERROR);
      expect(codeFromStatus(302)).toBe(ErrorCode.ERROR);
    });
  });

  describe('isKnownErrorCode', () => {
    it('recognises catalog codes', () => {
      expect(isKnownErrorCode('UNAUTHORIZED')).toBe(true);
      expect(isKnownErrorCode(ErrorCode.TIMEOUT)).toBe(true);
    });

    it('rejects unknown strings and non-strings', () => {
      expect(isKnownErrorCode('nope')).toBe(false);
      expect(isKnownErrorCode(undefined)).toBe(false);
      expect(isKnownErrorCode(401)).toBe(false);
      expect(isKnownErrorCode(null)).toBe(false);
    });
  });
});
