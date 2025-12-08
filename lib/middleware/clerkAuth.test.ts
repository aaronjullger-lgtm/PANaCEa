/**
 * Tests for Clerk Authentication Middleware
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { requireAuth, AuthenticatedRequest } from './clerkAuth';

// Mock @clerk/backend
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
}));

describe('requireAuth middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
  });

  it('should return 401 when Authorization header is missing', async () => {
    await requireAuth(
      mockRequest as AuthenticatedRequest,
      mockResponse as Response,
      mockNext
    );

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Authorization header is required',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization header format is invalid', async () => {
    mockRequest.headers = {
      authorization: 'InvalidFormat',
    };

    await requireAuth(
      mockRequest as AuthenticatedRequest,
      mockResponse as Response,
      mockNext
    );

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Invalid authorization header format. Expected: Bearer <token>',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when token verification fails', async () => {
    const { verifyToken } = await import('@clerk/backend');
    vi.mocked(verifyToken).mockRejectedValueOnce(new Error('Invalid token'));

    mockRequest.headers = {
      authorization: 'Bearer invalid_token',
    };

    await requireAuth(
      mockRequest as AuthenticatedRequest,
      mockResponse as Response,
      mockNext
    );

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Authentication failed',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should attach auth context and call next() when token is valid', async () => {
    const { verifyToken } = await import('@clerk/backend');
    vi.mocked(verifyToken).mockResolvedValueOnce({
      sub: 'user_123',
      sid: 'session_456',
    } as any);

    mockRequest.headers = {
      authorization: 'Bearer valid_token',
    };

    process.env.CLERK_SECRET_KEY = 'sk_test_mock_key';

    await requireAuth(
      mockRequest as AuthenticatedRequest,
      mockResponse as Response,
      mockNext
    );

    expect(mockRequest.auth).toEqual({
      userId: 'user_123',
      sessionId: 'session_456',
    });
    expect(mockNext).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should provide specific error message for expired tokens', async () => {
    const { verifyToken } = await import('@clerk/backend');
    vi.mocked(verifyToken).mockRejectedValueOnce(new Error('Token expired'));

    mockRequest.headers = {
      authorization: 'Bearer expired_token',
    };

    await requireAuth(
      mockRequest as AuthenticatedRequest,
      mockResponse as Response,
      mockNext
    );

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Token has expired. Please sign in again.',
    });
  });
});
