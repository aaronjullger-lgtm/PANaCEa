/**
 * Verified Question Generator
 *
 * PHASE 4: NEURO-SYMBOLIC INTEGRITY - Milestone 1 Integration
 *
 * This module wraps the Gemini question generation with Chain of Verification (CoVe)
 * to prevent hallucinations in AI-generated medical questions.
 *
 * Pattern: Draft → Cross-Examine → Verify → Finalize
 *
 * @module lib/verified-question-generator
 */

import type { Question, SessionSettings, SystemCode } from '../types';
import {
  runCoVePipeline,
  quickVerify,
  type CoVeResult,
  type VerificationContext,
  type CoVeConfig,
} from './cove-verification';
import { callGeminiText, fetchNewQuestion } from '@/services/ai/geminiService';
import { logger } from "@/lib/simple-logger";
// Note: Gemini response sanitization (strip ```json / ```) and JSON parse error handling
// live in geminiService.fetchNewQuestion so fallback generation works when the main API returns 500.
import { GEMINI_FLASH_MODEL } from "@/config/topic-map";

// ============================================================================
// Logger Scope
// ============================================================================

const LOG_SCOPE = 'VerifiedQuestionGen';

// ============================================================================
// Types
// ============================================================================

export interface VerifiedQuestionResult {
  /** The generated question */
  question: Question;

  /** Full CoVe verification result (if full verification was run) */
  verification?: CoVeResult;

  /** Quick verification result (if quick mode was used) */
  quickVerification?: {
    passed: boolean;
    confidence: number;
    criticalIssues: string[];
  };

  /** Whether the question passed verification */
  verified: boolean;

  /** Verification mode used */
  verificationMode: 'full' | 'quick' | 'none';

  /** Time taken for verification (ms) */
  verificationTimeMs: number;

  /** Number of generation attempts (if retries occurred) */
  attempts: number;
}

export interface VerifiedQuestionOptions {
  /** Session settings for question generation */
  settings: SessionSettings;

  /** User's growth areas */
  growthAreas: string[];

  /** Verification mode: 'full' for complete CoVe, 'quick' for lightweight check */
  verificationMode?: 'full' | 'quick' | 'none';

  /** Maximum generation attempts before giving up */
  maxAttempts?: number;

  /** Custom CoVe configuration */
  coveConfig?: Partial<CoVeConfig>;

  /** Callback for verification progress */
  onProgress?: (step: string, progress: number) => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Default maximum generation attempts */
const DEFAULT_MAX_ATTEMPTS = 3;

/** Verification confidence threshold for auto-accept */
const AUTO_ACCEPT_CONFIDENCE = 0.85;

// ============================================================================
// Main Function
// ============================================================================

/**
 * Generate a verified medical question using CoVe pipeline
 *
 * This function:
 * 1. Generates a question using Gemini
 * 2. Runs CoVe verification to check for hallucinations
 * 3. Retries generation if verification fails
 * 4. Returns the verified question with verification metadata
 *
 * @param options - Generation and verification options
 * @returns Verified question with CoVe results
 */
export async function fetchVerifiedQuestion(
  options: VerifiedQuestionOptions
): Promise<VerifiedQuestionResult> {
  const {
    settings,
    growthAreas,
    verificationMode = 'quick',
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    coveConfig,
    onProgress,
  } = options;

  let attempts = 0;
  let lastQuestion: Question | null = null;
  let lastVerification: CoVeResult | undefined;
  let lastQuickVerification:
    | { passed: boolean; confidence: number; criticalIssues: string[] }
    | undefined;

  const startTime = performance.now();

  while (attempts < maxAttempts) {
    attempts++;

    try {
      // Step 1: Generate question
      onProgress?.('Generating question...', (attempts - 1) * 33);

      const question = await fetchNewQuestion(settings, growthAreas);
      lastQuestion = question;

      // If verification is disabled, return immediately
      if (verificationMode === 'none') {
        return {
          question,
          verified: true,
          verificationMode: 'none',
          verificationTimeMs: performance.now() - startTime,
          attempts,
        };
      }

      // Step 2: Build verification context
      onProgress?.('Preparing verification context...', (attempts - 1) * 33 + 10);

      const context = await buildVerificationContext(question);

      // Step 3: Run verification
      onProgress?.('Verifying medical accuracy...', (attempts - 1) * 33 + 20);

      if (verificationMode === 'full') {
        // Full CoVe pipeline
        const verification = await runCoVePipeline(question, context, geminiApiWrapper, coveConfig);
        lastVerification = verification;

        if (verification.passed || verification.overallConfidence >= AUTO_ACCEPT_CONFIDENCE) {
          onProgress?.('Verification complete!', 100);

          return {
            question,
            verification,
            verified: verification.passed,
            verificationMode: 'full',
            verificationTimeMs: performance.now() - startTime,
            attempts,
          };
        }

        // Log why verification failed
        logger.warn(
          LOG_SCOPE,
          `Attempt ${attempts} failed verification: ${verification.recommendation} | ${verification.flags.map((f) => f.message).join('; ')}`
        );
      } else {
        // Quick verification
        const quickResult = await quickVerify(question, context, geminiApiWrapper);
        lastQuickVerification = quickResult;

        if (quickResult.passed || quickResult.confidence >= AUTO_ACCEPT_CONFIDENCE) {
          onProgress?.('Verification complete!', 100);

          return {
            question,
            quickVerification: quickResult,
            verified: quickResult.passed,
            verificationMode: 'quick',
            verificationTimeMs: performance.now() - startTime,
            attempts,
          };
        }

        logger.warn(
          LOG_SCOPE,
          `Attempt ${attempts} failed quick verification: ${quickResult.criticalIssues.join('; ')}`
        );
      }
    } catch (error) {
      logger.error(LOG_SCOPE, `Attempt ${attempts} error:`, error);
    }
  }

  // All attempts exhausted - return last question with verification results
  logger.warn(
    LOG_SCOPE,
    `Max attempts (${maxAttempts}) reached, returning best available question`
  );

  if (!lastQuestion) {
    throw new Error('Failed to generate a question after multiple attempts');
  }

  return {
    question: lastQuestion,
    verification: lastVerification,
    quickVerification: lastQuickVerification,
    verified: false,
    verificationMode,
    verificationTimeMs: performance.now() - startTime,
    attempts,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Wrapper around callGeminiText for CoVe functions
 */
async function geminiApiWrapper(prompt: string): Promise<string> {
  return callGeminiText(GEMINI_FLASH_MODEL, prompt, 0.3);
}

/**
 * Build verification context from question metadata
 */
async function buildVerificationContext(question: Question): Promise<VerificationContext> {
  const conditionName = question.condition || 'Unknown Condition';
  const system = (question.system || question.topic || 'OTHER') as SystemCode;

  // Try to load database content for the condition
  let databaseContent: VerificationContext['databaseContent'];

  try {
    const { fetchConditionContent, hasCompleteContent } =
      await import('../services/conditionContentService');
    const dbContent = await fetchConditionContent(conditionName);

    if (dbContent && hasCompleteContent(dbContent) && dbContent.content) {
      const c = dbContent.content;
      databaseContent = {
        overview: c.overview,
        pathophysiology: c.pathophysiology,
        symptoms: Array.isArray(c.symptoms) ? c.symptoms : c.symptoms ? [c.symptoms] : undefined,
        signs: Array.isArray(c.signs) ? c.signs : c.signs ? [c.signs] : undefined,
        diagnostics: Array.isArray(c.diagnostics)
          ? (c.diagnostics as string[])
          : c.diagnostics
            ? [String(c.diagnostics)]
            : undefined,
        treatment: Array.isArray(c.treatment)
          ? c.treatment
          : c.treatment
            ? [c.treatment]
            : undefined,
        differentialDiagnosis: Array.isArray(c.differentialDiagnosis)
          ? c.differentialDiagnosis
          : c.differentialDiagnosis
            ? [c.differentialDiagnosis]
            : undefined,
        complications: Array.isArray(c.complications)
          ? c.complications
          : c.complications
            ? [c.complications]
            : undefined,
        riskFactors: Array.isArray(c.riskFactors)
          ? c.riskFactors
          : c.riskFactors
            ? [c.riskFactors]
            : undefined,
        buzzwords: Array.isArray(c.buzzwords)
          ? c.buzzwords
          : c.buzzwords
            ? [c.buzzwords]
            : undefined,
        clinicalPearls: Array.isArray(c.clinicalPearls)
          ? c.clinicalPearls
          : c.clinicalPearls
            ? [String(c.clinicalPearls)]
            : undefined,
      };
    }
  } catch (error) {
    logger.warn(LOG_SCOPE, `Could not load database content for ${conditionName}:`, error);
  }

  return {
    conditionName,
    system,
    databaseContent,
  };
}

// ============================================================================
// Batch Verification
// ============================================================================

/**
 * Verify a batch of pre-generated questions
 * Useful for content review/QA workflows
 */
export async function verifyQuestionBatch(
  questions: Question[],
  options: {
    mode?: 'full' | 'quick';
    onProgress?: (index: number, total: number, result: CoVeResult | null) => void;
  } = {}
): Promise<Array<{ question: Question; result: CoVeResult | null; passed: boolean }>> {
  const { mode = 'quick', onProgress } = options;
  const results: Array<{ question: Question; result: CoVeResult | null; passed: boolean }> = [];

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];

    // Type guard: skip if question is undefined (shouldn't happen with valid array)
    if (!question) {
      logger.warn(LOG_SCOPE, `Skipping undefined question at index ${i}`);
      continue;
    }

    try {
      const context = await buildVerificationContext(question);

      if (mode === 'full') {
        const result = await runCoVePipeline(question, context, geminiApiWrapper);
        results.push({ question, result, passed: result.passed });
        onProgress?.(i + 1, questions.length, result);
      } else {
        const quickResult = await quickVerify(question, context, geminiApiWrapper);
        // Convert quick result to partial CoVeResult for consistency
        const partialResult: CoVeResult = {
          verificationId: `quick_${Date.now()}_${i}`,
          timestamp: new Date().toISOString(),
          passed: quickResult.passed,
          overallConfidence: quickResult.confidence,
          claimVerifications: [],
          answerVerification: {
            isCorrect: quickResult.passed,
            confidence: quickResult.confidence,
            reasoning: quickResult.criticalIssues.join('; ') || 'Passed quick verification',
          },
          distractorChecks: [],
          summary: {
            totalClaims: 0,
            verifiedClaims: 0,
            unverifiedClaims: 0,
            contradictedClaims: 0,
            verificationRate: quickResult.passed ? 1 : 0,
          },
          flags: quickResult.criticalIssues.map((issue) => ({
            severity: 'critical' as const,
            code: 'QUICK_VERIFY_ISSUE',
            message: issue,
          })),
          recommendation: quickResult.passed ? 'accept' : 'review',
        };
        results.push({ question, result: partialResult, passed: quickResult.passed });
        onProgress?.(i + 1, questions.length, partialResult);
      }
    } catch (error) {
      logger.error(LOG_SCOPE, `Error verifying question ${i}:`, error);
      results.push({ question, result: null, passed: false });
      onProgress?.(i + 1, questions.length, null);
    }
  }

  return results;
}

// ============================================================================
// Export
// ============================================================================

export default {
  fetchVerifiedQuestion,
  verifyQuestionBatch,
};
