/**
 * User data synchronization endpoint
 * Handles uploading local data and downloading cloud data
 */

import {
  type Env,
  authenticateRequest,
  createErrorResponse,
  createSuccessResponse,
  handleCorsOptions,
} from './_shared/auth';

interface PagesContext {
  request: Request;
  env: Env;
}

interface SyncPayload {
  userId: string;
  performanceRecords?: any[];
  srsItems?: any[];
  savedQuestions?: any[];
}

interface SyncResponse {
  success: boolean;
  message?: string;
  data?: {
    performanceRecords: any[];
    srsItems: any[];
    savedQuestions: any[];
  };
}

export async function onRequestOptions(): Promise<Response> {
  return handleCorsOptions();
}

/**
 * GET: Fetch user's data from the cloud
 */
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  try {
    const authContext = await authenticateRequest(request, env);

    if (!authContext) {
      return createErrorResponse('Unauthorized', 401);
    }

    const { userId } = authContext;

    // Note: In Cloudflare Workers/Pages Functions, we can't use Prisma directly
    // due to connection pooling issues. This is a placeholder.
    // In production, you'd use Prisma Data Proxy or D1

    const response: SyncResponse = {
      success: true,
      message: 'Data retrieved successfully',
      data: {
        performanceRecords: [],
        srsItems: [],
        savedQuestions: [],
      },
    };

    return createSuccessResponse(response);
  } catch (error) {
    console.error('Sync GET error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

/**
 * POST: Upload/merge local data to the cloud
 */
export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  try {
    const authContext = await authenticateRequest(request, env);

    if (!authContext) {
      return createErrorResponse('Unauthorized', 401);
    }

    const { userId } = authContext;

    const payload: SyncPayload = await request.json();

    // Validate payload
    if (payload.userId !== userId) {
      return createErrorResponse('User ID mismatch', 403);
    }

    // Note: Database operations would go here
    // For now, return success with placeholder logic

    const response: SyncResponse = {
      success: true,
      message: 'Data synced successfully',
      data: {
        performanceRecords: payload.performanceRecords || [],
        srsItems: payload.srsItems || [],
        savedQuestions: payload.savedQuestions || [],
      },
    };

    return createSuccessResponse(response);
  } catch (error) {
    console.error('Sync POST error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
