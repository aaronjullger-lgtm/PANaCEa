interface BranchCreateOptions {
  name: string;
  description?: string;
  baseBranch?: string;
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

export async function createBranch(prisma: any, options: BranchCreateOptions): Promise<string> {
  try {
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
        name: options.name,
        description: options.description || null,
        baseBranch: options.baseBranch || 'main',
        createdBy: options.createdBy,
      },
    });

    return branch.id;
  } catch (error) {
    console.error('[ContentBranching] Error creating branch:', error);
    throw error;
  }
}

export async function listBranches(prisma: any, includeArchived: boolean = false): Promise<any[]> {
  try {
    const branches = await prisma.contentBranch.findMany({
      where: includeArchived ? {} : { status: { not: 'archived' } },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { changes: true },
        },
      },
    });

    return branches.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      baseBranch: b.baseBranch,
      status: b.status,
      changeCount: b._count.changes,
      createdBy: b.createdBy,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      mergedAt: b.mergedAt,
    }));
  } catch (error) {
    console.error('[ContentBranching] Error listing branches:', error);
    return [];
  }
}

export async function mergeBranch(
  prisma: any,
  branchName: string,
  mergedBy: string,
  targetBranch: string = 'main'
): Promise<MergeResult> {
  try {
    // Find source branch
    const branch = await prisma.contentBranch.findUnique({
      where: { name: branchName },
      include: {
        changes: true,
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
    for (const change of branch.changes) {
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

    for (const change of branch.changes) {
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
              updatedAt: new Date(),
            },
          });
          mergedCount++;
        } else if (change.changeType === 'delete') {
          await prisma.medicalContent.update({
            where: { id: change.contentId },
            data: {
              status: 'archived',
              updatedBy: mergedBy,
              updatedAt: new Date(),
            },
          });
          mergedCount++;
        }
      } catch (error) {
        console.error(`[ContentBranching] Error applying change ${change.contentId}:`, error);
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

    return {
      success: true,
      mergedCount,
      message: `Successfully merged ${mergedCount} change(s) from ${branchName} to ${targetBranch}`,
    };
  } catch (error) {
    console.error('[ContentBranching] Error merging branch:', error);
    throw error;
  }
}
