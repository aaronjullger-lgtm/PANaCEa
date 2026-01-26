/**
 * API: GET/POST /api/branches
 *
 * List and create content branches for version control.
 * AUTHENTICATED endpoint - requires valid auth token.
 */

import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { listBranches, createBranch } from '../_shared/content-branching';
import { z } from 'zod';

// Schema for GET request (query params)
const ListBranchesSchema = z.object({
  includeArchived: z.enum(['true', 'false']).optional(),
});

// Schema for POST request (body)
const CreateBranchSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Branch name is required'),
    description: z.string().optional(),
    baseBranch: z.string().optional(),
    createdBy: z.string().min(1, 'Creator ID is required'),
  }),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  ListBranchesSchema,
  async ({ env, validated, auth }) => {
    const log = createEndpointLogger('/api/branches', auth.userId);

    if (!env.DATABASE_URL) {
      log.warn('Database not configured, returning empty branches');
      return { success: true, branches: [] };
    }

    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);
      const includeArchived = validated.includeArchived === 'true';

      log.info('Listing branches', { includeArchived });

      const branches = await listBranches(prisma, includeArchived);

      log.info('Branches listed successfully', { count: branches.length });

      return { success: true, branches };
    } catch (error) {
      log.error('Failed to list branches', error);
      return {
        status: 500,
        error: 'Failed to list branches',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

export const onRequestPost = authenticatedEndpoint(
  CreateBranchSchema,
  async ({ env, validated, auth }) => {
    const log = createEndpointLogger('/api/branches', auth.userId);

    if (!env.DATABASE_URL) {
      log.warn('Database not configured');
      return {
        status: 503,
        error: 'Database not configured',
      };
    }

    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);
      const { name, description, baseBranch, createdBy } = validated.body;

      log.info('Creating branch', { name, baseBranch, createdBy });

      const branchId = await createBranch(prisma, {
        name,
        description,
        baseBranch,
        createdBy,
      });

      log.info('Branch created successfully', { branchId, name });

      return { success: true, branchId };
    } catch (error) {
      log.error('Failed to create branch', error);
      return {
        status: 500,
        error: error instanceof Error ? error.message : 'Failed to create branch',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
