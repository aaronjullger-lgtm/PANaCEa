/**
 * Medical Content Type Definitions
 * 
 * Shared types for medical content that are safe to import in both client and server code.
 * This file MUST NOT import any server-only dependencies like @prisma/client.
 */

/**
 * Condition data structure returned by conditionDataLoader
 */
export interface ConditionData {
  id: string;
  conditionId: string;
  system: string;
  subcategory?: string | null;
  condition: string;
  relatedSystems?: string[];
  content: any;
  status?: string;
  meta?: Record<string, any>;
}

/**
 * Medical content status enum
 */
export type ContentStatus = 'draft' | 'published' | 'archived';
