/**
 * API: List medical content with filtering and pagination
 * GET /api/admin/content/list
 *
 * Query parameters:
 * - system: Filter by system code
 * - status: Filter by content status
 * - search: Search query
 * - page: Page number (default 1)
 * - perPage: Items per page (default 20)
 * - sortBy: Field to sort by
 * - sortOrder: asc or desc
 */

import {
  authenticateRequest,
  createErrorResponse,
  createSuccessResponse,
  handleCorsOptions,
  type Env,
} from '../../_shared/auth';
import { validateFunctionEnv, MissingEnvError } from '../../_shared/env-validation';
import { canViewCMS, type UserRole } from '../../_shared/rbac';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;

  try {
    validateFunctionEnv(env as Record<string, unknown>, ['DATABASE_URL', 'CLERK_SECRET_KEY']);
  } catch (e) {
    if (e instanceof MissingEnvError) return e.toResponse();
    throw e;
  }

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return handleCorsOptions(context);
  }

  // Authenticate user
  const authContext = await authenticateRequest(request, env);
  if (!authContext) {
    return createErrorResponse(request, 'Unauthorized', 401, undefined, env);
  }

  // Get user from database to check role
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: authContext.clerkId },
      select: { role: true },
    });

    if (!user || !canViewCMS(user.role as UserRole)) {
      return createErrorResponse(
        request,
        'Forbidden: Insufficient permissions',
        403,
        undefined,
        env
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const system = url.searchParams.get('system') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const search = url.searchParams.get('search') || undefined;
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const perPage = Math.min(parseInt(url.searchParams.get('perPage') || '20', 10), 100);
    const sortBy = url.searchParams.get('sortBy') || 'updatedAt';
    const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    // Build where clause
    const where: any = {};
    if (system) where.system = system;
    if (status) where.status = status;
    if (search) {
      // Note: For production with large datasets, consider adding a full-text search
      // index or using PostgreSQL's tsvector for better performance
      where.OR = [
        { condition: { contains: search, mode: 'insensitive' } },
        { conditionId: { contains: search, mode: 'insensitive' } },
        { subcategory: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await prisma.medicalContent.count({ where });

    // Get content with pagination
    const content = await prisma.medicalContent.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        conditionId: true,
        system: true,
        subcategory: true,
        condition: true,
        status: true,
        version: true,
        createdAt: true,
        createdBy: true,
        updatedAt: true,
        updatedBy: true,
        publishedAt: true,
        approvedAt: true,
      },
    });

    return createSuccessResponse(
      request,
      {
        content,
        pagination: {
          page,
          perPage,
          total,
          totalPages: Math.ceil(total / perPage),
        },
      },
      200,
      0,
      env
    );
  } catch (error: any) {
    console.error('Error listing content:', error);
    return createErrorResponse(request, 'Failed to list content', 500, undefined, env);
  } finally {
    await safePrismaDisconnect(prisma);
  }
}
