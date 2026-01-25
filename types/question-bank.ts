/**
 * Client-Safe Question Bank Types
 *
 * This file contains type definitions that can be safely imported by client-side code.
 * DO NOT import any server-only modules (Prisma, etc.) in this file.
 *
 * @module types/question-bank
 */

// ============================================================================
// First-Line Treatment Types (Client-Safe)
// ============================================================================

/**
 * Client-safe representation of FirstLineTreatment from Prisma.
 * Used by first-line drill hooks and components.
 */
export interface FirstLineTreatmentDTO {
  id: string;
  condition: string;
  treatment: string;
  category: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// ============================================================================
// Contrastive Drill Types (Client-Safe)
// ============================================================================

/**
 * Client-safe representation of ContrastiveSet from Prisma.
 */
export interface ContrastiveSetDTO {
  id: string;
  conditionIds: string[];
  symptom: string;
  distinguishers: Record<string, string[]> | null;
  highYield: boolean;
  difficulty: string | null;
  system: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/**
 * Client-safe representation of ContrastiveDrillAttempt from Prisma.
 */
export interface ContrastiveDrillAttemptDTO {
  id: string;
  userId: string;
  setId: string;
  correctAnswers: number;
  timeSpentMs: number | null;
  completedAt?: Date | string;
}

// ============================================================================
// Photo Drill Types (Client-Safe)
// ============================================================================

/**
 * Client-safe representation of MediaAsset from Prisma.
 */
export interface MediaAssetDTO {
  id: string;
  originalUrl: string | null;
  thumbnailUrl: string | null;
  type: string;
  usageType: string | null;
  modality: string | null;
  difficulty: string | null;
  isAnnotated: boolean;
  conditionId: string | null;
  medicalContentId: string | null;
  createdAt?: Date | string;
}

/**
 * Client-safe representation of Condition from Prisma.
 */
export interface ConditionDTO {
  id: string;
  name: string;
  system: string | null;
  description: string | null;
}

/**
 * Client-safe representation of MedicalContent from Prisma.
 */
export interface MedicalContentDTO {
  id: string;
  condition: string;
  system: string | null;
  symptoms: string | null;
  description: string | null;
}

// ============================================================================
// Question Types (Client-Safe)
// ============================================================================

/**
 * Data Transfer Object for questions fetched from the API.
 * This is the client-safe version of the QuestionDTO type.
 */
export interface QuestionDTO {
  id: string;
  vignette: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  system: string;
  difficulty: string;
  source: string;
  tags?: string[];
  // Extended properties that may be included from API
  condition?: string;
  conditionId?: string;
  subcategory?: string;
  panaceYield?: number;
}

/**
 * Parameters for fetching questions from the API.
 */
export interface GetQuestionsParams {
  system?: string;
  limit: number;
  difficulty?: string;
}

/**
 * Response from the questions API endpoint.
 */
export interface QuestionsAPIResponse {
  success: boolean;
  questions: QuestionDTO[];
  total?: number;
  source?: 'database' | 'ai_fallback';
}
