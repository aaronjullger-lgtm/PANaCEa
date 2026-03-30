/**
 * Content Service API
 * Handles loading and managing clinical content for the CMS
 */

import type { MedicalContent } from '../../types/admin-cms';
import { getApiEndpoint, API_ENDPOINTS } from '../utils/apiConfig';
import { logger } from '../logger';

/**
 * Load all medical content from the database
 * Returns empty array if database is not available
 */
export async function loadAllContent(): Promise<MedicalContent[]> {
  try {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
      // Browser: fetch from API endpoint
      const apiUrl = getApiEndpoint(API_ENDPOINTS.CONTENT_ALL);
      const response = await fetch(apiUrl);

      if (response.ok) {
        const data = (await response.json()) as Record<string, unknown>;
        return transformToMedicalContent(data);
      }
    } else {
      // Server: use Prisma directly
      const { prisma } = await import('../../lib/prisma');
      const records = await prisma.medicalContent.findMany({
        where: { status: 'published' },
      });

      return records.map((record) => ({
        id: record.id,
        conditionId: record.conditionId,
        condition: record.condition,
        system: record.system as MedicalContent['system'],
        subcategory: record.subcategory,
        status: record.status as MedicalContent['status'],
        version: record.version,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        createdBy: record.createdBy,
        updatedBy: record.updatedBy,
        overview: record.overview || undefined,
        etiologyPathophysiology:
          [record.etiology, record.pathophysiology].filter(Boolean).join('\n\n') || undefined,
        epidemiology: record.epidemiology || undefined,
        riskFactors: Array.isArray(record.riskFactors)
          ? record.riskFactors
          : typeof record.riskFactors === 'string'
            ? [record.riskFactors]
            : undefined,
        symptoms: Array.isArray(record.symptoms) ? record.symptoms : undefined,
        examFindings: Array.isArray(record.physicalExam) ? record.physicalExam : undefined,
        diagnostics: record.diagnostics as MedicalContent['diagnostics'],
        treatment: Array.isArray(record.treatment) ? (record.treatment as string[]) : undefined,
        complications: Array.isArray(record.complications) ? record.complications : undefined,
        prognosis: record.prognosis || undefined,
      }));
    }
  } catch (error) {
    logger.error('Error loading content from database', { error });
  }

  return [];
}

/** Shape of a raw condition record from the API response */
interface RawConditionRecord {
  name?: string;
  system?: string;
  subcategory?: string;
  overview?: string;
  etiology?: string;
  epidemiology?: string;
  riskFactors?: string[];
  symptoms?: string[];
  physicalExam?: string[];
  diagnostics?: unknown;
  treatment?: string[];
  complications?: string[];
  prognosis?: string;
}

/**
 * Transform raw data object to MedicalContent array
 */
function transformToMedicalContent(data: Record<string, unknown>): MedicalContent[] {
  const content: MedicalContent[] = [];

  for (const [conditionId, raw] of Object.entries(data)) {
    if (typeof raw === 'object' && raw !== null) {
      const condition = raw as RawConditionRecord;
      const item: MedicalContent = {
        id: conditionId,
        conditionId: conditionId,
        condition: condition.name || conditionId,
        system: (condition.system || 'GENERAL') as MedicalContent['system'],
        subcategory: condition.subcategory || 'General',
        status: 'published',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system',
        updatedBy: 'system',
        overview: condition.overview,
        etiologyPathophysiology: condition.etiology,
        epidemiology: condition.epidemiology,
        riskFactors: condition.riskFactors,
        symptoms: condition.symptoms,
        examFindings: condition.physicalExam,
        diagnostics: condition.diagnostics as MedicalContent['diagnostics'],
        treatment: condition.treatment,
        complications: condition.complications,
        prognosis: condition.prognosis,
      };
      content.push(item);
    }
  }

  return content;
}

/**
 * Get a single content item by ID
 */
export async function getContentById(id: string): Promise<MedicalContent | null> {
  const allContent = await loadAllContent();
  return allContent.find((item) => item.id === id) || null;
}

/**
 * Search content by query
 */
export async function searchContent(query: string): Promise<MedicalContent[]> {
  const allContent = await loadAllContent();
  const lowerQuery = query.toLowerCase();

  return allContent.filter(
    (item) =>
      item.condition.toLowerCase().includes(lowerQuery) ||
      item.conditionId.toLowerCase().includes(lowerQuery) ||
      item.subcategory.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Filter content by system
 */
export async function getContentBySystem(system: string): Promise<MedicalContent[]> {
  const allContent = await loadAllContent();
  return allContent.filter((item) => item.system === system);
}

/**
 * Get content statistics
 */
export async function getContentStats() {
  const allContent = await loadAllContent();

  const stats = {
    total: allContent.length,
    bySystem: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
  };

  allContent.forEach((item) => {
    // By system
    stats.bySystem[item.system] = (stats.bySystem[item.system] || 0) + 1;

    // By status
    stats.byStatus[item.status] = (stats.byStatus[item.status] || 0) + 1;
  });

  return stats;
}
