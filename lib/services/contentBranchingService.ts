/**
 * Content branching service - Git-like version control for medical content
 * Allows admins to work on guideline updates without affecting live content
 */

import { v4 as uuidv4 } from 'uuid';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { logger } from '../logger';

const LOG_SCOPE = 'ContentBranching';

interface BranchCreateOptions {
  name: string;
  description?: string;
  baseBranch?: string;
  createdBy: string;
}

interface BranchChange {
  contentId: string;
  conditionId: string;
  changeType: 'create' | 'update' | 'delete';
  contentData: any;
  previousData?: any;
  createdBy: string;
}

interface MergeResult {
  success: boolean;
  conflicts?: Array<{
    contentId: string;
    reason: string;
  }>;
  mergedCount?: number;
  message?: string;
}

/**
 * Create a new content branch
 */
export async function createBranch(options: BranchCreateOptions): Promise<string> {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('Database not configured');
    }


    // Validate branch name
    if (!/^[a-zA-Z0-9_-]+$/.test(options.name)) {
      throw new Error('Branch name can only contain letters, numbers, hyphens, and underscores');
    }

    // Check if branch already exists
    const existing = await prisma.contentBranch.findUnique({
      where: { name: options.name },
    });

    if (existing) {
      throw new Error(`Branch "${options.name}" already exists`);
    }

    // Validate base branch if specified
    if (options.baseBranch) {
      const baseBranchExists = await prisma.contentBranch.findUnique({
        where: { name: options.baseBranch },
      });

      if (!baseBranchExists) {
        throw new Error(`Base branch "${options.baseBranch}" does not exist`);
      }
    }

    // Create branch
    const branch = await prisma.contentBranch.create({
      data: {
        id: uuidv4(),
        name: options.name,
        description: options.description || null,
        baseBranch: options.baseBranch || 'main',
        createdBy: options.createdBy,
      },
    });

    logger.info(`[${LOG_SCOPE}] Created branch: ${options.name}`);
    return branch.id;
  } catch (error) {
    logger.error(`[${LOG_SCOPE}] Error creating branch:`, { error });
    throw error;
  }
}

/**
 * Add a change to a branch
 */
export async function addChangeToBranch(branchName: string, change: BranchChange): Promise<string> {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('Database not configured');
    }


    // Find branch
    const branch = await prisma.contentBranch.findUnique({
      where: { name: branchName },
    });

    if (!branch) {
      throw new Error(`Branch "${branchName}" not found`);
    }

    if (branch.status !== 'active') {
      throw new Error(`Branch "${branchName}" is ${branch.status} and cannot accept changes`);
    }

    // Add change
    const branchChange = await prisma.branchChange.create({
      data: {
        id: uuidv4(),
        branchId: branch.id,
        contentId: change.contentId,
        conditionId: change.conditionId,
        changeType: change.changeType,
        contentData: change.contentData,
        previousData: change.previousData || null,
        createdBy: change.createdBy,
      },
    });

    // Update branch statistics
    await prisma.contentBranch.update({
      where: { id: branch.id },
      data: {
        changeCount: { increment: 1 },
      },
    });

    logger.info(`[${LOG_SCOPE}] Added ${change.changeType} change to branch ${branchName}`);
    return branchChange.id;
  } catch (error) {
    logger.error(`[${LOG_SCOPE}] Error adding change to branch:`, { error });
    throw error;
  }
}

/**
 * Get all changes in a branch
 */
export async function getBranchChanges(branchName: string): Promise<BranchChange[]> {
  try {
    if (!process.env.DATABASE_URL) {
      return [];
    }


    type BranchWithChanges = Prisma.ContentBranchGetPayload<{
      include: { BranchChange: true };
    }>;

    const branch = (await prisma.contentBranch.findUnique({
      where: { name: branchName },
      include: {
        BranchChange: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })) as BranchWithChanges | null;

    if (!branch) {
      throw new Error(`Branch "${branchName}" not found`);
    }

    return branch.BranchChange.map((c) => ({
      contentId: c.contentId,
      conditionId: c.conditionId,
      changeType: c.changeType as 'create' | 'update' | 'delete',
      contentData: c.contentData,
      previousData: c.previousData || undefined,
      createdBy: c.createdBy,
    }));
  } catch (error) {
    logger.error(`[${LOG_SCOPE}] Error getting branch changes:`, { error });
    throw error;
  }
}

/**
 * Merge a branch into its base branch (or main)
 */
export async function mergeBranch(
  branchName: string,
  mergedBy: string,
  targetBranch: string = 'main'
): Promise<MergeResult> {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('Database not configured');
    }


    // Find source branch
    const branch = await prisma.contentBranch.findUnique({
      where: { name: branchName },
      include: {
        BranchChange: true,
      },
    });

    if (!branch) {
      throw new Error(`Branch "${branchName}" not found`);
    }

    if (branch.status !== 'active') {
      throw new Error(`Branch "${branchName}" is ${branch.status} and cannot be merged`);
    }

    // Check for conflicts
    const conflicts: Array<{ contentId: string; reason: string }> = [];

    // For each change, check if the target content has been modified since branch creation
    for (const change of branch.BranchChange) {
      const existingContent = await prisma.medicalContent.findUnique({
        where: { id: change.contentId },
      });

      if (change.changeType === 'update' && existingContent) {
        // Check if content was modified after branch creation
        if (existingContent.updatedAt > branch.createdAt) {
          conflicts.push({
            contentId: change.contentId,
            reason: 'Content has been modified since branch creation',
          });
        }
      } else if (change.changeType === 'create' && existingContent) {
        conflicts.push({
          contentId: change.contentId,
          reason: 'Content already exists in target branch',
        });
      } else if (change.changeType === 'delete' && !existingContent) {
        conflicts.push({
          contentId: change.contentId,
          reason: 'Content has already been deleted',
        });
      }
    }

    // If there are conflicts, return them without merging
    if (conflicts.length > 0) {
      return {
        success: false,
        conflicts,
        message: `Found ${conflicts.length} conflict(s). Resolve conflicts before merging.`,
      };
    }

    // Apply changes
    let mergedCount = 0;

    for (const change of branch.BranchChange) {
      try {
        if (change.changeType === 'create') {
          await prisma.medicalContent.create({
            data: {
              ...(change.contentData as any),
              createdBy: mergedBy,
              updatedBy: mergedBy,
            },
          });
          mergedCount++;
        } else if (change.changeType === 'update') {
          await prisma.medicalContent.update({
            where: { id: change.contentId },
            data: {
              ...(change.contentData as any),
              updatedBy: mergedBy,
            },
          });
          mergedCount++;
        } else if (change.changeType === 'delete') {
          await prisma.medicalContent.update({
            where: { id: change.contentId },
            data: {
              status: 'archived',
              updatedBy: mergedBy,
            },
          });
          mergedCount++;
        }
      } catch (error) {
        logger.error(`[${LOG_SCOPE}] Error applying change ${change.contentId}:`, { error });
        // Continue with other changes
      }
    }

    // Mark branch as merged
    await prisma.contentBranch.update({
      where: { id: branch.id },
      data: {
        status: 'merged',
        mergedAt: new Date(),
        mergedBy,
      },
    });

    logger.info(`[${LOG_SCOPE}] Merged branch ${branchName} - ${mergedCount} changes applied`);

    return {
      success: true,
      mergedCount,
      message: `Successfully merged ${mergedCount} change(s) from ${branchName} to ${targetBranch}`,
    };
  } catch (error) {
    logger.error(`[${LOG_SCOPE}] Error merging branch:`, { error });
    throw error;
  }
}

/**
 * List all branches
 */
export async function listBranches(includeArchived: boolean = false): Promise<any[]> {
  try {
    if (!process.env.DATABASE_URL) {
      return [];
    }


    const branches = (await prisma.contentBranch.findMany({
      where: includeArchived ? {} : { status: { not: 'archived' } },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { BranchChange: true },
        },
      },
    })) as Array<any & { _count: { BranchChange: number } }>;

    return branches.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      baseBranch: b.baseBranch,
      status: b.status,
      changeCount: b._count.BranchChange,
      createdBy: b.createdBy,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      mergedAt: b.mergedAt,
    }));
  } catch (error) {
    logger.error(`[${LOG_SCOPE}] Error listing branches:`, { error });
    return [];
  }
}

/**
 * Delete a branch (only if not merged)
 */
export async function deleteBranch(branchName: string): Promise<void> {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('Database not configured');
    }


    const branch = await prisma.contentBranch.findUnique({
      where: { name: branchName },
    });

    if (!branch) {
      throw new Error(`Branch "${branchName}" not found`);
    }

    if (branch.status === 'merged') {
      throw new Error('Cannot delete a merged branch. Archive it instead.');
    }

    // Delete all changes
    await prisma.branchChange.deleteMany({
      where: { branchId: branch.id },
    });

    // Delete branch
    await prisma.contentBranch.delete({
      where: { id: branch.id },
    });

    logger.info(`[${LOG_SCOPE}] Deleted branch ${branchName}`);
  } catch (error) {
    logger.error(`[${LOG_SCOPE}] Error deleting branch:`, { error });
    throw error;
  }
}

/**
 * Compare branch with its base to see what has changed
 */
export async function compareBranches(
  branchName: string,
  targetBranch: string = 'main'
): Promise<{
  added: string[];
  modified: string[];
  deleted: string[];
  total: number;
}> {
  try {
    if (!process.env.DATABASE_URL) {
      return { added: [], modified: [], deleted: [], total: 0 };
    }

    const changes = await getBranchChanges(branchName);

    const added = changes.filter((c) => c.changeType === 'create').map((c) => c.conditionId);
    const modified = changes.filter((c) => c.changeType === 'update').map((c) => c.conditionId);
    const deleted = changes.filter((c) => c.changeType === 'delete').map((c) => c.conditionId);

    return {
      added,
      modified,
      deleted,
      total: changes.length,
    };
  } catch (error) {
    logger.error(`[${LOG_SCOPE}] Error comparing branches:`, { error });
    return { added: [], modified: [], deleted: [], total: 0 };
  }
}
