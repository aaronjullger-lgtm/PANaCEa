/**
 * Content Branch Merge API Endpoint
 *
 * Purpose: Merge a content branch into target branch (admin only)
 * Sprint: Security Hardening Sprint 1.3
 *
 * Security: adminEndpoint() with rate limiting and validation
 */

import { z } from 'zod';
import { adminEndpoint } from '../../_shared/middleware';
import { handleCorsOptions } from '../../_shared/auth';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { mergeBranch } from '../../_shared/content-branching';
import { logger } from '../../_shared/secureLogger';

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const BranchMergeSchema = z.object({
  mergedBy: z.string().min(1, 'mergedBy is required').max(100),
  targetBranch: z.string().min(1).max(100).optional(),
});

type BranchMergeInput = z.infer<typeof BranchMergeSchema>;

// ============================================================================
// CORS HANDLER
// ============================================================================

export const onRequestOptions = handleCorsOptions;

// ============================================================================
// POST HANDLER - Merge Branch (Admin Only)
// ============================================================================

export const onRequestPost = adminEndpoint(BranchMergeSchema, async (context) => {
  const { env, params, validated, auth } = context;
  const { branchName } = params;

  // Early return if no database configured
  if (!env.DATABASE_URL) {
    return {
      status: 503,
      error: 'Database not configured',
    };
  }

  const prisma = createEdgePrismaClient(env);

  try {
    const { mergedBy, targetBranch } = validated as BranchMergeInput;

    // Audit log: Admin action
    logger.info('Admin branch merge initiated', {
      adminUserId: auth.userId,
      branchName,
      mergedBy,
      targetBranch: targetBranch || 'main',
    });

    const result = await mergeBranch(prisma, branchName as string, mergedBy, targetBranch);

    // Audit log: Success
    if (result.success) {
      logger.info('Branch merge completed successfully', {
        adminUserId: auth.userId,
        branchName,
        targetBranch: targetBranch || 'main',
        mergedRecords: result.mergedCount || 0,
      });
    }

    return {
      status: result.success ? 200 : 400,
      data: result,
    };
  } catch (error) {
    logger.error('Failed to merge branch', {
      error: error instanceof Error ? error.message : String(error),
      adminUserId: auth.userId,
      branchName,
    });

    return {
      status: 500,
      error: error instanceof Error ? error.message : 'Failed to merge branch',
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
