/**
 * Question history service - Database "Time Travel" for temporal queries
 * Allows querying: "Show me exactly what Question #5 looked like on Jan 1st, 2024"
 * Vital for disputes if a student claims an answer was wrong back then
 */

import { v4 as uuidv4 } from 'uuid';

interface QuestionSnapshot {
  questionId: string;
  version: number;
  questionData: any;
  changedBy?: string;
  changeReason?: string;
  validFrom: Date;
  validTo?: Date;
}

interface VersionHistory {
  questionId: string;
  versions: QuestionSnapshot[];
  currentVersion: QuestionSnapshot;
}

/**
 * Save a new version of a question
 */
export async function saveQuestionVersion(
  questionId: string,
  questionData: any,
  changedBy?: string,
  changeReason?: string
): Promise<number> {
  try {
    if (!process.env.DATABASE_URL) {
      console.log('[QuestionHistory] Database not configured');
      return 1;
    }

    const { prisma } = await import('../prisma');

    // Get latest version number
    const latestVersion = await prisma.questionHistory.findFirst({
      where: { questionId },
      orderBy: { version: 'desc' },
    });

    const newVersion = latestVersion ? latestVersion.version + 1 : 1;

    // Close the previous version if it exists
    if (latestVersion && !latestVersion.validTo) {
      await prisma.questionHistory.update({
        where: { id: latestVersion.id },
        data: { validTo: new Date() },
      });
    }

    // Create new version
    await prisma.questionHistory.create({
      data: {
        id: uuidv4(),
        questionId,
        version: newVersion,
        questionData,
        changedBy: changedBy || null,
        changeReason: changeReason || null,
        validFrom: new Date(),
      },
    });

    console.log(`[QuestionHistory] Saved version ${newVersion} of question ${questionId}`);
    return newVersion;
  } catch (error) {
    console.error('[QuestionHistory] Error saving question version:', error);
    throw error;
  }
}

/**
 * Get a question as it appeared at a specific point in time
 */
export async function getQuestionAtTime(
  questionId: string,
  timestamp: Date
): Promise<QuestionSnapshot | null> {
  try {
    if (!process.env.DATABASE_URL) {
      console.log('[QuestionHistory] Database not configured');
      return null;
    }

    const { prisma } = await import('../prisma');

    // Find the version that was valid at the given time
    const version = await prisma.questionHistory.findFirst({
      where: {
        questionId,
        validFrom: { lte: timestamp },
        OR: [
          { validTo: null }, // Current version
          { validTo: { gt: timestamp } }, // Version that hadn't ended yet
        ],
      },
      orderBy: { validFrom: 'desc' },
    });

    if (!version) {
      console.log(
        `[QuestionHistory] No version found for question ${questionId} at ${timestamp.toISOString()}`
      );
      return null;
    }

    return {
      questionId: version.questionId,
      version: version.version,
      questionData: version.questionData,
      changedBy: version.changedBy || undefined,
      changeReason: version.changeReason || undefined,
      validFrom: version.validFrom,
      validTo: version.validTo || undefined,
    };
  } catch (error) {
    console.error('[QuestionHistory] Error getting question at time:', error);
    return null;
  }
}

/**
 * Get all versions of a question
 */
export async function getQuestionHistory(questionId: string): Promise<VersionHistory | null> {
  try {
    if (!process.env.DATABASE_URL) {
      console.log('[QuestionHistory] Database not configured');
      return null;
    }

    const { prisma } = await import('../prisma');

    const versions = await prisma.questionHistory.findMany({
      where: { questionId },
      orderBy: { version: 'asc' },
    });

    if (versions.length === 0) {
      return null;
    }

    const snapshots: QuestionSnapshot[] = versions.map((v) => ({
      questionId: v.questionId,
      version: v.version,
      questionData: v.questionData,
      changedBy: v.changedBy || undefined,
      changeReason: v.changeReason || undefined,
      validFrom: v.validFrom,
      validTo: v.validTo || undefined,
    }));

    const current = snapshots[snapshots.length - 1]!;

    return {
      questionId,
      versions: snapshots,
      currentVersion: current,
    };
  } catch (error) {
    console.error('[QuestionHistory] Error getting question history:', error);
    return null;
  }
}

/**
 * Compare two versions of a question
 */
export async function compareQuestionVersions(
  questionId: string,
  version1: number,
  version2: number
): Promise<{
  version1Data: any;
  version2Data: any;
  differences: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
} | null> {
  try {
    if (!process.env.DATABASE_URL) {
      console.log('[QuestionHistory] Database not configured');
      return null;
    }

    const { prisma } = await import('../prisma');

    const [v1, v2] = await Promise.all([
      prisma.questionHistory.findFirst({
        where: { questionId, version: version1 },
      }),
      prisma.questionHistory.findFirst({
        where: { questionId, version: version2 },
      }),
    ]);

    if (!v1 || !v2) {
      return null;
    }

    const differences = findDifferences(v1.questionData, v2.questionData);

    return {
      version1Data: v1.questionData,
      version2Data: v2.questionData,
      differences,
    };
  } catch (error) {
    console.error('[QuestionHistory] Error comparing versions:', error);
    return null;
  }
}

/**
 * Find differences between two objects
 */
function findDifferences(
  obj1: any,
  obj2: any,
  path: string = ''
): Array<{ field: string; oldValue: any; newValue: any }> {
  const differences: Array<{ field: string; oldValue: any; newValue: any }> = [];

  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

  for (const key of allKeys) {
    const fullPath = path ? `${path}.${key}` : key;
    const val1 = obj1[key];
    const val2 = obj2[key];

    if (typeof val1 === 'object' && typeof val2 === 'object' && val1 !== null && val2 !== null) {
      // Recursively compare nested objects
      differences.push(...findDifferences(val1, val2, fullPath));
    } else if (val1 !== val2) {
      differences.push({
        field: fullPath,
        oldValue: val1,
        newValue: val2,
      });
    }
  }

  return differences;
}

/**
 * Revert a question to a previous version
 */
export async function revertQuestionToVersion(
  questionId: string,
  targetVersion: number,
  revertedBy: string,
  reason: string
): Promise<boolean> {
  try {
    if (!process.env.DATABASE_URL) {
      console.log('[QuestionHistory] Database not configured');
      return false;
    }

    const { prisma } = await import('../prisma');

    // Get the target version
    const targetVersionData = await prisma.questionHistory.findFirst({
      where: { questionId, version: targetVersion },
    });

    if (!targetVersionData) {
      throw new Error(`Version ${targetVersion} not found for question ${questionId}`);
    }

    // Save the reverted data as a new version
    await saveQuestionVersion(
      questionId,
      targetVersionData.questionData,
      revertedBy,
      `Reverted to version ${targetVersion}: ${reason}`
    );

    console.log(`[QuestionHistory] Reverted question ${questionId} to version ${targetVersion}`);
    return true;
  } catch (error) {
    console.error('[QuestionHistory] Error reverting question:', error);
    return false;
  }
}

/**
 * Get questions modified within a date range
 */
export async function getQuestionsModifiedInRange(
  startDate: Date,
  endDate: Date
): Promise<Array<{ questionId: string; versions: number }>> {
  try {
    if (!process.env.DATABASE_URL) {
      console.log('[QuestionHistory] Database not configured');
      return [];
    }

    const { prisma } = await import('../prisma');

    const versions = await prisma.questionHistory.findMany({
      where: {
        validFrom: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        questionId: true,
      },
    });

    // Group by questionId and count versions
    const grouped = versions.reduce(
      (acc, v) => {
        acc[v.questionId] = (acc[v.questionId] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(grouped).map(([questionId, versions]) => ({
      questionId,
      versions: versions as number,
    }));
  } catch (error) {
    console.error('[QuestionHistory] Error getting modified questions:', error);
    return [];
  }
}

/**
 * Get audit trail for a question (who changed what and when)
 */
export async function getQuestionAuditTrail(questionId: string): Promise<
  Array<{
    version: number;
    changedBy?: string;
    changeReason?: string;
    validFrom: Date;
    validTo?: Date;
    changeCount: number;
  }>
> {
  try {
    if (!process.env.DATABASE_URL) {
      console.log('[QuestionHistory] Database not configured');
      return [];
    }

    const history = await getQuestionHistory(questionId);

    if (!history) {
      return [];
    }

    const trail: Array<{
      version: number;
      changedBy?: string;
      changeReason?: string;
      validFrom: Date;
      validTo?: Date;
      changeCount: number;
    }> = [];

    for (let i = 0; i < history.versions.length; i++) {
      const current = history.versions[i];
      if (!current) continue;

      let changeCount = 0;

      // Compare with previous version to count changes
      if (i > 0) {
        const previous = history.versions[i - 1];
        if (previous) {
          const differences = findDifferences(previous.questionData, current.questionData);
          changeCount = differences.length;
        }
      }

      trail.push({
        version: current.version,
        changedBy: current.changedBy,
        changeReason: current.changeReason,
        validFrom: current.validFrom,
        validTo: current.validTo,
        changeCount,
      });
    }

    return trail;
  } catch (error) {
    console.error('[QuestionHistory] Error getting audit trail:', error);
    return [];
  }
}

/**
 * Prune old history (keep only last N versions)
 */
export async function pruneQuestionHistory(
  questionId: string,
  keepVersions: number = 10
): Promise<number> {
  try {
    if (!process.env.DATABASE_URL) {
      console.log('[QuestionHistory] Database not configured');
      return 0;
    }

    const { prisma } = await import('../prisma');

    const versions = await prisma.questionHistory.findMany({
      where: { questionId },
      orderBy: { version: 'desc' },
      skip: keepVersions,
    });

    if (versions.length === 0) {
      return 0;
    }

    const idsToDelete = versions.map((v) => v.id);

    const result = await prisma.questionHistory.deleteMany({
      where: {
        id: { in: idsToDelete },
      },
    });

    console.log(`[QuestionHistory] Pruned ${result.count} old versions of question ${questionId}`);
    return result.count;
  } catch (error) {
    console.error('[QuestionHistory] Error pruning history:', error);
    return 0;
  }
}
