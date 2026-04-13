/**
 * Tests for authentication utilities
 * Updated to match current auth.ts console output patterns.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyAuthToken, authenticateRequest, type Env } from './auth';

// Mock the @clerk/backend module
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
}));

import { verifyToken as mockVerifyToken } from '@clerk/backend';

/**
 * Helper function to create base64url encoded JWT token for testing
 */
function createMockJWT(payload: any): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const encodeBase64Url = (obj: any): string => {
    const str = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i] ?? 0);
    }
    const base64 = btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };
  return `${encodeBase64Url(header)}.${encodeBase64Url(payload)}.mock_signature`;
}

describe('Authentication Diagnostics', () => {
  let consoleErrorSpy: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('verifyAuthToken - Request Inspection', () => {
    const validSecretKey = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';

    it('should return null when Authorization header is missing', async () => {
      const result = await verifyAuthToken(null, validSecretKey);
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith('[AUTH] Authorization header is missing');
    });

    it('should return null when Authorization header format is invalid', async () => {
      const result = await verifyAuthToken('InvalidFormat token123', validSecretKey);
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH] Authorization header format is invalid'),
        expect.any(String)
      );
    });

    it('should return null when Bearer prefix is lowercase', async () => {
      const result = await verifyAuthToken('bearer token123', validSecretKey);
      expect(result).toBeNull();
    });
  });

  describe('verifyAuthToken - Token Verification', () => {
    const validSecretKey = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';

    it('should return userId on successful verification', async () => {
      const mockToken = createMockJWT({
        sub: 'user_123',
        iss: 'https://clerk.test.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });

      (mockVerifyToken as any).mockResolvedValue({ sub: 'user_123' });
      const result = await verifyAuthToken(`Bearer ${mockToken}`, validSecretKey);

      expect(result).toBe('user_123');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[AUTH] Token verification successful for user:',
        'user_123'
      );
      expect(mockVerifyToken).toHaveBeenCalledWith(
        mockToken,
        expect.objectContaining({ secretKey: validSecretKey, clockSkewInMs: 5000 })
      );
    });

    it('should return null for expired tokens', async () => {
      const mockToken = createMockJWT({
        sub: 'user_123',
        exp: Math.floor(Date.now() / 1000) - 3600,
        iat: Math.floor(Date.now() / 1000) - 7200,
      });

      (mockVerifyToken as any).mockRejectedValue(new Error('Token expired'));
      const result = await verifyAuthToken(`Bearer ${mockToken}`, validSecretKey);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH] Token is expired'),
        expect.any(String)
      );
    });

    it('should pass clockSkewInMs to verifyToken for clock skew tolerance', async () => {
      const mockToken = createMockJWT({
        sub: 'user_456',
        exp: Math.floor(Date.now() / 1000) - 3,
        iat: Math.floor(Date.now() / 1000) - 3603,
      });

      (mockVerifyToken as any).mockResolvedValue({ sub: 'user_456' });
      const result = await verifyAuthToken(`Bearer ${mockToken}`, validSecretKey);

      expect(result).toBe('user_456');
      expect(mockVerifyToken).toHaveBeenCalledWith(
        mockToken,
        expect.objectContaining({ clockSkewInMs: 5000 })
      );
    });

    it('should log root cause for signature verification failure', async () => {
      const mockToken = createMockJWT({ sub: 'user_123', exp: Math.floor(Date.now() / 1000) + 3600 });
      (mockVerifyToken as any).mockRejectedValue(new Error('Signature verification failed'));

      const result = await verifyAuthToken(`Bearer ${mockToken}`, validSecretKey);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[AUTH] Root Cause: Signature Verification Failed (possible mismatched secret key)'
      );
    });

    it('should log root cause for invalid issuer', async () => {
      const mockToken = createMockJWT({ sub: 'user_123', iss: 'https://wrong.com', exp: Math.floor(Date.now() / 1000) + 3600 });
      (mockVerifyToken as any).mockRejectedValue(new Error('Invalid issuer'));

      const result = await verifyAuthToken(`Bearer ${mockToken}`, validSecretKey);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith('[AUTH] Root Cause: Invalid Issuer');
    });
  });

  describe('authenticateRequest - Environment Verification', () => {
    it('should return null when CLERK_SECRET_KEY is not configured', async () => {
      const env: Env = {};
      const request = new Request('https://example.com', {
        headers: { Authorization: 'Bearer token123' },
      });

      const result = await authenticateRequest(request, env);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[AUTH] CLERK_SECRET_KEY is not configured in environment'
      );
    });

    it('should return null when secret key has invalid format (public key)', async () => {
      const env: Env = { CLERK_SECRET_KEY: 'pk_test_1234567890' };
      const request = new Request('https://example.com', {
        headers: { Authorization: 'Bearer token123' },
      });

      const result = await authenticateRequest(request, env);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH] CLERK_SECRET_KEY has invalid format'),
        'pk_t***'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[AUTH] Note: Public keys (pk_*) cannot be used as secret keys'
      );
    });

    it('should return AuthContext on successful authentication', async () => {
      const env: Env = { CLERK_SECRET_KEY: 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz' };
      const mockToken = createMockJWT({
        sub: 'user_123',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });
      const request = new Request('https://example.com', {
        headers: { Authorization: `Bearer ${mockToken}` },
      });

      (mockVerifyToken as any).mockResolvedValue({ sub: 'user_123' });
      const result = await authenticateRequest(request, env);

      expect(result).toEqual({ userId: 'user_123', clerkId: 'user_123' });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[AUTH] Authentication successful for user:',
        'user_123'
      );
    });

    it('should log failure when authentication fails', async () => {
      const env: Env = { CLERK_SECRET_KEY: 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz' };
      const request = new Request('https://example.com', {
        headers: { Authorization: 'Bearer invalid_token' },
      });

      (mockVerifyToken as any).mockRejectedValue(new Error('Invalid token'));
      const result = await authenticateRequest(request, env);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[AUTH] Authentication failed - no valid user ID extracted'
      );
    });
  });
});
