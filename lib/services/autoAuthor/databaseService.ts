/**
 * Auto-Author Database Service
 * 
 * Handles database operations for auto-generated content:
 * - Detecting conditions missing content
 * - Saving generated content to Condition table
 * - Updating existing conditions
 */

import { PrismaClient } from "@prisma/client";
import type { GeneratedConditionContent, AutoAuthorStats } from "./types";

const prisma = new PrismaClient();

export interface MissingContentCondition {
  id: string;
  name: string;
  system: string;
  displayName?: string | null;
  content: any;
}

/**
 * Find all conditions that are missing core content fields
 */
export async function findConditionsMissingContent(
  client: PrismaClient = prisma
): Promise<MissingContentCondition[]> {
  const allConditions = await client.condition.findMany({
    select: {
      id: true,
      name: true,
      system: true,
      displayName: true,
      content: true,
    },
  });

  // Filter conditions that are missing essential fields
  const missing = allConditions.filter((condition) => {
    const content = condition.content as any;
    
    // No content at all
    if (!content || typeof content !== "object") {
      return true;
    }
    
    // Missing overview, symptoms, or diagnosis
    if (!content.overview || !content.symptoms || !content.diagnosis) {
      return true;
    }
    
    // Symptoms is empty array
    if (Array.isArray(content.symptoms) && content.symptoms.length === 0) {
      return true;
    }
    
    return false;
  });

  return missing;
}

/**
 * Save generated content to a condition in the database
 * Merges with existing content (preserves fields not generated)
 */
export async function saveGeneratedContent(
  conditionId: string,
  generatedContent: GeneratedConditionContent,
  client: PrismaClient = prisma
): Promise<boolean> {
  try {
    const existing = await client.condition.findUnique({
      where: { id: conditionId },
      select: { content: true },
    });

    if (!existing) {
      console.error(`   ❌ Condition ${conditionId} not found in database`);
      return false;
    }

    // Merge with existing content (preserve fields we didn't generate)
    const existingContent = (existing.content as any) || {};
    const mergedContent = {
      ...existingContent,
      overview: generatedContent.overview,
      symptoms: generatedContent.symptoms,
      riskFactors: generatedContent.riskFactors,
      diagnosis: generatedContent.diagnosis,
      treatment: generatedContent.treatment,
      clinicalPearls: generatedContent.clinicalPearls,
      // Extended fields (only if present in generated content)
      ...(generatedContent.etiologyPathophysiology && {
        etiologyPathophysiology: generatedContent.etiologyPathophysiology,
      }),
      ...(generatedContent.epidemiology && {
        epidemiology: generatedContent.epidemiology,
      }),
      ...(generatedContent.examFindings && generatedContent.examFindings.length > 0 && {
        examFindings: generatedContent.examFindings,
      }),
      ...(generatedContent.complications && generatedContent.complications.length > 0 && {
        complications: generatedContent.complications,
      }),
      ...(generatedContent.prognosis && {
        prognosis: generatedContent.prognosis,
      }),
      ...(generatedContent.differentialDiagnosis && generatedContent.differentialDiagnosis.length > 0 && {
        differentialDiagnosis: generatedContent.differentialDiagnosis,
      }),
    };

    await client.condition.update({
      where: { id: conditionId },
      data: { content: mergedContent },
    });

    return true;
  } catch (error: any) {
    console.error(`   ❌ Failed to save content for ${conditionId}:`, error.message);
    return false;
  }
}

/**
 * Get count of conditions by content status
 */
export async function getContentStats(
  client: PrismaClient = prisma
): Promise<{
  total: number;
  withContent: number;
  missingContent: number;
}> {
  const allConditions = await client.condition.findMany({
    select: { content: true },
  });

  const total = allConditions.length;
  const withContent = allConditions.filter((c) => {
    const content = c.content as any;
    return content && content.overview && content.symptoms && content.diagnosis;
  }).length;

  return {
    total,
    withContent,
    missingContent: total - withContent,
  };
}

/**
 * Close Prisma connection
 */
export async function closeAutoAuthorDb(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Format summary for auto-author run
 */
export function formatAutoAuthorSummary(stats: AutoAuthorStats): string {
  const successRate = stats.total > 0 
    ? ((stats.generated / stats.total) * 100).toFixed(1)
    : "0.0";
    
  return `Generated ${stats.generated}/${stats.total} conditions (${successRate}% success, ${stats.failed} failed, ${stats.skipped} skipped)`;
}
