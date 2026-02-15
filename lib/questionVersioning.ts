/**
 * Question Versioning Utility
 *
 * Sprint C - Step 8: Track question edit history and enable rollback
 *
 * Purpose: Every time a question is edited:
 * - Create a version snapshot
 * - Track what changed
 * - Enable rollback to previous versions
 * - Maintain audit trail
 *
 * Note: Requires QuestionVersion table (see questionVersioning.schema.ts)
 */

import { PrismaClient } from '@prisma/client';

export interface QuestionSnapshot {
  vignette?: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  system: string;
  difficulty: string;
  tags?: string[];
  conditionId?: string;
  [key: string]: any;
}

export interface VersionMetadata {
  version: number;
  changedFields: string[];
  changeReason?: string;
  changeSummary?: string;
  editedBy: string;
  editedByEmail?: string;
  distractorScore?: number;
  qualityScore?: number;
  createdAt: Date;
}

/**
 * Create a new version when a question is edited
 *
 * @param prisma - Prisma client instance
 * @param questionId - ID of the question being edited
 * @param questionType - Type of question ('pre_generated', 'question', 'staging')
 * @param previousData - Question data before edit
 * @param newData - Question data after edit
 * @param metadata - Version metadata (editor info, reason, scores)
 * @returns Created version record
 */
export async function createQuestionVersion(
  prisma: PrismaClient,
  questionId: string,
  questionType: string,
  previousData: QuestionSnapshot,
  newData: QuestionSnapshot,
  metadata: {
    editedBy: string;
    editedByEmail?: string;
    changeReason?: string;
    changeSummary?: string;
    distractorScore?: number;
    qualityScore?: number;
  }
): Promise<any> {
  try {
    // Determine what fields changed
    const changedFields: string[] = [];

    for (const key of Object.keys(newData)) {
      const oldValue = JSON.stringify(previousData[key]);
      const newValue = JSON.stringify(newData[key]);

      if (oldValue !== newValue) {
        changedFields.push(key);
      }
    }

    // Get current version number
    const existingVersions = await prisma.questionVersion.findMany({
      where: {
        questionId,
        questionType,
      },
      orderBy: { version: 'desc' },
      take: 1,
    });

    const firstExisting = existingVersions[0];
    const nextVersion = firstExisting != null ? firstExisting.version + 1 : 1;

    // Create version snapshot
    const version = await prisma.questionVersion.create({
      data: {
        questionId,
        questionType,
        version: nextVersion,
        questionData: previousData as any, // Snapshot of OLD data (before edit)
        changedFields,
        changeReason: metadata.changeReason,
        changeSummary: metadata.changeSummary,
        editedBy: metadata.editedBy,
        editedByEmail: metadata.editedByEmail,
        distractorScore: metadata.distractorScore,
        qualityScore: metadata.qualityScore,
      },
    });

    console.log(`[Versioning] Created version ${nextVersion} for question ${questionId}`);
    return version;
  } catch (error) {
    console.error('[Versioning] Failed to create version:', error);
    throw error;
  }
}

/**
 * Get all versions of a question
 *
 * @param prisma - Prisma client instance
 * @param questionId - Question ID
 * @param questionType - Question type
 * @returns Array of versions, newest first
 */
export async function getQuestionVersions(
  prisma: PrismaClient,
  questionId: string,
  questionType: string
): Promise<VersionMetadata[]> {
  try {
    const versions = await prisma.questionVersion.findMany({
      where: {
        questionId,
        questionType,
      },
      orderBy: { version: 'desc' },
      select: {
        version: true,
        changedFields: true,
        changeReason: true,
        changeSummary: true,
        editedBy: true,
        editedByEmail: true,
        distractorScore: true,
        qualityScore: true,
        createdAt: true,
      },
    });

    return versions.map(
      (v): VersionMetadata => ({
        version: v.version,
        changedFields: v.changedFields,
        changeReason: v.changeReason ?? undefined,
        changeSummary: v.changeSummary ?? undefined,
        editedBy: v.editedBy,
        editedByEmail: v.editedByEmail ?? undefined,
        distractorScore: v.distractorScore ?? undefined,
        qualityScore: v.qualityScore ?? undefined,
        createdAt: v.createdAt,
      })
    );
  } catch (error) {
    console.error('[Versioning] Failed to get versions:', error);
    return [];
  }
}

/**
 * Get a specific version of a question
 *
 * @param prisma - Prisma client instance
 * @param questionId - Question ID
 * @param questionType - Question type
 * @param version - Version number to retrieve
 * @returns Question snapshot at that version, or null if not found
 */
export async function getQuestionAtVersion(
  prisma: PrismaClient,
  questionId: string,
  questionType: string,
  version: number
): Promise<QuestionSnapshot | null> {
  try {
    const versionRecord = await prisma.questionVersion.findUnique({
      where: {
        questionId_questionType_version: {
          questionId,
          questionType,
          version,
        },
      },
      select: {
        questionData: true,
      },
    });

    if (!versionRecord) {
      return null;
    }

    return versionRecord.questionData as QuestionSnapshot;
  } catch (error) {
    console.error('[Versioning] Failed to get question at version:', error);
    return null;
  }
}

/**
 * Rollback a question to a previous version
 *
 * @param prisma - Prisma client instance
 * @param questionId - Question ID
 * @param questionType - Question type
 * @param targetVersion - Version to rollback to
 * @param rolledBackBy - User ID performing rollback
 * @returns Updated question data
 */
export async function rollbackQuestion(
  prisma: PrismaClient,
  questionId: string,
  questionType: string,
  targetVersion: number,
  rolledBackBy: string
): Promise<QuestionSnapshot | null> {
  try {
    // Get the target version data
    const targetData = await getQuestionAtVersion(prisma, questionId, questionType, targetVersion);

    if (!targetData) {
      throw new Error(`Version ${targetVersion} not found`);
    }

    // Get current data (for creating rollback version)
    let currentData: QuestionSnapshot | null = null;

    if (questionType === 'pre_generated') {
      const current = await prisma.preGeneratedQuestion.findUnique({
        where: { id: questionId },
        select: { questionData: true, system: true, difficulty: true, conditionId: true },
      });
      if (current) {
        const data = current.questionData as any;
        currentData = {
          ...data,
          system: current.system,
          difficulty: current.difficulty,
          conditionId: current.conditionId || undefined,
        };
      }
    } else if (questionType === 'question') {
      const current = await prisma.question.findUnique({
        where: { id: questionId },
      });
      if (current) {
        currentData = {
          vignette: current.vignette || undefined,
          question: current.question,
          options: current.options as string[],
          correctAnswer: current.correctAnswer,
          explanation: current.explanation,
          system: current.system,
          difficulty: current.difficulty || 'medium',
          tags: current.tags as string[],
        };
      }
    }

    // Create version of current state (before rollback)
    if (currentData) {
      await createQuestionVersion(prisma, questionId, questionType, currentData, targetData, {
        editedBy: rolledBackBy,
        changeReason: 'rollback',
        changeSummary: `Rolled back to version ${targetVersion}`,
      });
    }

    // Apply rollback
    if (questionType === 'pre_generated') {
      await prisma.preGeneratedQuestion.update({
        where: { id: questionId },
        data: {
          questionData: targetData as any,
          system: targetData.system,
          difficulty: targetData.difficulty,
          conditionId: targetData.conditionId,
        },
      });
    } else if (questionType === 'question') {
      await prisma.question.update({
        where: { id: questionId },
        data: {
          vignette: targetData.vignette,
          question: targetData.question,
          options: targetData.options,
          correctAnswer: targetData.correctAnswer,
          explanation: targetData.explanation,
          system: targetData.system,
          difficulty: targetData.difficulty,
          tags: targetData.tags,
        },
      });
    }

    console.log(`[Versioning] Rolled back question ${questionId} to version ${targetVersion}`);
    return targetData;
  } catch (error) {
    console.error('[Versioning] Failed to rollback question:', error);
    return null;
  }
}

/**
 * Compare two versions of a question
 *
 * @param prisma - Prisma client instance
 * @param questionId - Question ID
 * @param questionType - Question type
 * @param version1 - First version number
 * @param version2 - Second version number
 * @returns Diff showing changes between versions
 */
export async function compareVersions(
  prisma: PrismaClient,
  questionId: string,
  questionType: string,
  version1: number,
  version2: number
): Promise<{
  version1Data: QuestionSnapshot | null;
  version2Data: QuestionSnapshot | null;
  changes: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
}> {
  try {
    const v1Data = await getQuestionAtVersion(prisma, questionId, questionType, version1);
    const v2Data = await getQuestionAtVersion(prisma, questionId, questionType, version2);

    const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

    if (v1Data && v2Data) {
      const allKeys = new Set([...Object.keys(v1Data), ...Object.keys(v2Data)]);

      for (const key of allKeys) {
        const oldValue = v1Data[key];
        const newValue = v2Data[key];

        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          changes.push({
            field: key,
            oldValue,
            newValue,
          });
        }
      }
    }

    return {
      version1Data: v1Data,
      version2Data: v2Data,
      changes,
    };
  } catch (error) {
    console.error('[Versioning] Failed to compare versions:', error);
    return {
      version1Data: null,
      version2Data: null,
      changes: [],
    };
  }
}

/**
 * Get version history summary (for UI display)
 *
 * @param prisma - Prisma client instance
 * @param questionId - Question ID
 * @param questionType - Question type
 * @returns Formatted version history
 */
export async function getVersionHistorySummary(
  prisma: PrismaClient,
  questionId: string,
  questionType: string
): Promise<string> {
  try {
    const versions = await getQuestionVersions(prisma, questionId, questionType);

    if (versions.length === 0) {
      return 'No version history available';
    }

    const lines = [`📜 Version History for ${questionId}`, '─'.repeat(70)];

    for (const v of versions) {
      lines.push('');
      lines.push(`Version ${v.version} - ${v.createdAt.toLocaleString()}`);
      lines.push(`  Edited by: ${v.editedByEmail || v.editedBy}`);

      if (v.changeSummary) {
        lines.push(`  Summary: ${v.changeSummary}`);
      }

      if (v.changedFields.length > 0) {
        lines.push(`  Changed fields: ${v.changedFields.join(', ')}`);
      }

      if (v.distractorScore !== null && v.distractorScore !== undefined) {
        lines.push(`  Distractor score: ${v.distractorScore}/100`);
      }

      if (v.qualityScore !== null && v.qualityScore !== undefined) {
        lines.push(`  Quality score: ${v.qualityScore}/100`);
      }
    }

    lines.push('');
    lines.push('─'.repeat(70));

    return lines.join('\n');
  } catch (error) {
    console.error('[Versioning] Failed to get version history summary:', error);
    return 'Error loading version history';
  }
}
