/**
 * Tests for authentication utilities with enhanced diagnostics
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyAuthToken, authenticateRequest, type Env } from './auth';

// Mock the @clerk/backend module
vi.mock('@clerk/backend', () => ({
  createClerkClient: vi.fn(() => ({
    verifyToken: vi.fn(),
  })),
}));

import { createClerkClient } from '@clerk/backend';

/**
 * Helper function to create base64url encoded JWT token for testing
 * Base64url encoding replaces + with -, / with _, and removes padding =
 */
function createMockJWT(payload: any): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  
  // Encode to base64url (not standard base64)
  const encodeBase64Url = (obj: any): string => {
    const base64 = Buffer.from(JSON.stringify(obj)).toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };
  
  const headerEncoded = encodeBase64Url(header);
  const payloadEncoded = encodeBase64Url(payload);
  const signature = 'mock_signature';
  
  return `${headerEncoded}.${payloadEncoded}.${signature}`;
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

  describe('verifyAuthToken - Phase 3: Client-Side Request Inspection', () => {
    const validSecretKey = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';

    it('should log error when Authorization header is missing', async () => {
      const result = await verifyAuthToken(null, validSecretKey);
      
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[AUTH] Authorization header is missing'
      );
    });

    it('should log error when Authorization header format is invalid', async () => {
      const result = await verifyAuthToken('InvalidFormat token123', validSecretKey);
      
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH] Authorization header format is invalid'),
        expect.stringContaining('InvalidFormat')
      );
    });

    it('should log error when Bearer prefix is lowercase', async () => {
      const result = await verifyAuthToken('bearer token123', validSecretKey);
      
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH] Authorization header format is invalid'),
        expect.stringContaining('bearer')
      );
    });
  });

  describe('verifyAuthToken - Phase 2: Server-Side Log Analysis', () => {
    const validSecretKey = 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz';

    it('should decode and log JWT token claims', async () => {
      // Create a mock JWT token with valid structure using base64url encoding
      const mockToken = createMockJWT({
        sub: 'user_123',
        iss: 'https://clerk.test.com',
        exp: Math.floor(Date.now() / 1000) + 3600, // expires in 1 hour
        iat: Math.floor(Date.now() / 1000),
      });

      const mockVerifyToken = vi.fn().mockResolvedValue({ sub: 'user_123' });
      (createClerkClient as any).mockReturnValue({ verifyToken: mockVerifyToken });

      const result = await verifyAuthToken(`Bearer ${mockToken}`, validSecretKey);
      
      expect(result).toBe('user_123');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[AUTH] Token payload claims:',
        expect.objectContaining({
          exp: expect.any(String),
          iss: 'https://clerk.test.com',
          iat: expect.any(String),
        })
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[AUTH] Token verification successful for user:',
        'user_123'
      );
    });

    it('should detect and log expired tokens', async () => {
      const mockToken = createMockJWT({
        sub: 'user_123',
        iss: 'https://clerk.test.com',
        exp: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
        iat: Math.floor(Date.now() / 1000) - 7200,
      });

      const mockVerifyToken = vi.fn().mockRejectedValue(new Error('Token expired'));
      (createClerkClient as any).mockReturnValue({ verifyToken: mockVerifyToken });

      const result = await verifyAuthToken(`Bearer ${mockToken}`, validSecretKey);
      
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH] Token is expired'),
        expect.any(String)
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[AUTH] Root Cause: Token Expiration'
      );
    });

    it('should log detailed error for signature verification failure', async () => {
      const mockToken = createMockJWT({
        sub: 'user_123',
        iss: 'https://clerk.test.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });

      const mockVerifyToken = vi.fn().mockRejectedValue(new Error('Signature verification failed'));
      (createClerkClient as any).mockReturnValue({ verifyToken: mockVerifyToken });

      const result = await verifyAuthToken(`Bearer ${mockToken}`, validSecretKey);
      
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[AUTH] Token verification failed with detailed error:',
        expect.objectContaining({
          message: 'Signature verification failed',
          name: 'Error',
        })
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[AUTH] Root Cause: Signature Verification Failed (possible mismatched secret key)'
      );
    });

    it('should log detailed error for invalid issuer', async () => {
      const mockToken = createMockJWT({
        sub: 'user_123',
        iss: 'https://wrong-issuer.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });

      const mockVerifyToken = vi.fn().mockRejectedValue(new Error('Invalid issuer'));
      (createClerkClient as any).mockReturnValue({ verifyToken: mockVerifyToken });

      const result = await verifyAuthToken(`Bearer ${mockToken}`, validSecretKey);
      
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[AUTH] Root Cause: Invalid Issuer'
      );
    });

    it('should log detailed error for unknown errors', async () => {
      const mockToken = createMockJWT({
        sub: 'user_123',
        iss: 'https://clerk.test.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });

      const mockVerifyToken = vi.fn().mockRejectedValue(new Error('Some unexpected error'));
      (createClerkClient as any).mockReturnValue({ verifyToken: mockVerifyToken });

      const result = await verifyAuthToken(`Bearer ${mockToken}`, validSecretKey);
      
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[AUTH] Root Cause: Unknown - See error details above'
      );
    });
  });

  describe('authenticateRequest - Phase 1: Environment and Configuration Verification', () => {
    it('should log error when CLERK_SECRET_KEY is not configured', async () => {
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

    it('should log error when secret key has invalid format (public key)', async () => {
      const env: Env = {
        CLERK_SECRET_KEY: 'pk_test_1234567890', // Public key instead of secret key
      };
      const request = new Request('https://example.com', {
        headers: { Authorization: 'Bearer token123' },
      });

      const result = await authenticateRequest(request, env);
      
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH] CLERK_SECRET_KEY has invalid format'),
        expect.stringContaining('pk_test_')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[AUTH] Note: Public keys (pk_*) cannot be used as secret keys'
      );
    });

    it('should log error when secret key has invalid format (random string)', async () => {
      const env: Env = {
        CLERK_SECRET_KEY: 'invalid_key_format',
      };
      const request = new Request('https://example.com', {
        headers: { Authorization: 'Bearer token123' },
      });

      const result = await authenticateRequest(request, env);
      
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH] CLERK_SECRET_KEY has invalid format'),
        'invalid_'
      );
    });

    it('should log masked secret key for test environment', async () => {
      const env: Env = {
        CLERK_SECRET_KEY: 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz',
      };
      const request = new Request('https://example.com', {
        headers: { Authorization: 'Bearer token123' },
      });

      // Mock to fail auth so we only test the key logging
      const mockVerifyToken = vi.fn().mockResolvedValue({ sub: null });
      (createClerkClient as any).mockReturnValue({ verifyToken: mockVerifyToken });

      await authenticateRequest(request, env);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[AUTH] Secret key verified (masked):',
        'sk_te...vwxyz'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[AUTH] Secret key environment:',
        'test'
      );
    });

    it('should log masked secret key for live environment', async () => {
      const env: Env = {
        CLERK_SECRET_KEY: 'sk_live_TESTKEY_NOT_REAL_abcdefghij67890',
      };
      const request = new Request('https://example.com', {
        headers: { Authorization: 'Bearer token123' },
      });

      // Mock to fail auth so we only test the key logging
      const mockVerifyToken = vi.fn().mockResolvedValue({ sub: null });
      (createClerkClient as any).mockReturnValue({ verifyToken: mockVerifyToken });

      await authenticateRequest(request, env);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[AUTH] Secret key verified (masked):',
        'sk_li...67890'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[AUTH] Secret key environment:',
        'live'
      );
    });

    it('should log success message when authentication succeeds', async () => {
      const env: Env = {
        CLERK_SECRET_KEY: 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz',
      };
      const mockToken = createMockJWT({
        sub: 'user_123',
        iss: 'https://clerk.test.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });

      const request = new Request('https://example.com', {
        headers: { Authorization: `Bearer ${mockToken}` },
      });

      const mockVerifyToken = vi.fn().mockResolvedValue({ sub: 'user_123' });
      (createClerkClient as any).mockReturnValue({ verifyToken: mockVerifyToken });

      const result = await authenticateRequest(request, env);
      
      expect(result).toEqual({
        userId: 'user_123',
        clerkId: 'user_123',
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[AUTH] Authentication successful for user:',
        'user_123'
      );
    });

    it('should log error when authentication fails', async () => {
      const env: Env = {
        CLERK_SECRET_KEY: 'sk_test_1234567890abcdefghijklmnopqrstuvwxyz',
      };
      const request = new Request('https://example.com', {
        headers: { Authorization: 'Bearer invalid_token' },
      });

      const mockVerifyToken = vi.fn().mockRejectedValue(new Error('Invalid token'));
      (createClerkClient as any).mockReturnValue({ verifyToken: mockVerifyToken });

      const result = await authenticateRequest(request, env);
      
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[AUTH] Authentication failed - no valid user ID extracted'
      );
    });
  });
});
