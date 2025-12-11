/**
 * Content Service API
 * Handles loading and managing clinical content for the CMS
 */

import type { MedicalContent } from '../../types/admin-cms';

/**
 * Load all medical content from the database
 * Returns empty array if database is not available
 */
export async function loadAllContent(): Promise<MedicalContent[]> {
  try {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
      // Browser: fetch from API endpoint
      const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/content/all`);
      
      if (response.ok) {
        const data = await response.json();
        return transformToMedicalContent(data);
      }
    } else {
      // Server: use Prisma directly
      const { prisma } = await import('../../lib/prisma');
      const records = await prisma.medicalContent.findMany({
        where: { status: 'published' },
      });
      
      return records.map(record => ({
        id: record.id,
        conditionId: record.conditionId,
        condition: record.condition,
        system: record.system,
        category: 'condition',
        subcategory: record.subcategory,
        status: record.status as any,
        version: record.version,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        createdBy: record.createdBy,
        lastModifiedBy: record.updatedBy,
        content: record.content as any
      }));
    }
  } catch (error) {
    console.error('Error loading content from database:', error);
  }
  
  return [];
}

/**
 * Transform raw data object to MedicalContent array
 */
function transformToMedicalContent(data: Record<string, any>): MedicalContent[] {
  const content: MedicalContent[] = [];
  
  for (const [conditionId, condition] of Object.entries(data)) {
    if (typeof condition === 'object' && condition !== null) {
      const item: MedicalContent = {
        id: conditionId,
        conditionId: conditionId,
        condition: (condition as any).name || conditionId,
        system: (condition as any).system || 'GENERAL',
        category: 'condition',
        subcategory: (condition as any).subcategory || 'General',
        status: 'published',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        lastModifiedBy: 'system',
        content: condition as any
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
  return allContent.find(item => item.id === id) || null;
}

/**
 * Search content by query
 */
export async function searchContent(query: string): Promise<MedicalContent[]> {
  const allContent = await loadAllContent();
  const lowerQuery = query.toLowerCase();
  
  return allContent.filter(item =>
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
  return allContent.filter(item => item.system === system);
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
    byCategory: {} as Record<string, number>
  };
  
  allContent.forEach(item => {
    // By system
    stats.bySystem[item.system] = (stats.bySystem[item.system] || 0) + 1;
    
    // By status
    stats.byStatus[item.status] = (stats.byStatus[item.status] || 0) + 1;
    
    // By category
    stats.byCategory[item.category] = (stats.byCategory[item.category] || 0) + 1;
  });
  
  return stats;
}
