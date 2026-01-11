/**
 * AI Services - Unified Exports
 * 
 * Consolidates all AI/ML and content generation services.
 * 
 * @example
 * import { geminiService, contentGenerator } from '@/services/ai';
 */

// ============================================================================
// GEMINI AI SERVICE - Primary AI interface
// ============================================================================

import * as geminiServiceModule from '../geminiService';

export const geminiService = geminiServiceModule;

// Re-export commonly used functions from geminiService
export {
  generateAlternateRationale,
} from '../geminiService';

// ============================================================================
// CONTENT GENERATION PIPELINE
// ============================================================================

import * as automatedContentPipelineModule from '../automatedContentPipeline';
import * as batchGeneratorServiceModule from '../batchGeneratorService';

export const contentPipeline = automatedContentPipelineModule;
export const batchGenerator = batchGeneratorServiceModule;

// ============================================================================
// INTELLIGENT QUESTION SERVICES
// ============================================================================

import * as intelligentQuestionServiceModule from '../intelligentQuestionService';
import * as adaptiveQuestionEngineModule from '../adaptiveQuestionEngine';
import * as enhancedQuestionServiceModule from '../enhancedQuestionService';

// Note: These services overlap with core/questionService
// Use for AI-specific question generation only
export const intelligentQuestions = intelligentQuestionServiceModule;
export const adaptiveEngine = adaptiveQuestionEngineModule;
export const enhancedQuestions = enhancedQuestionServiceModule;

// Re-export commonly used functions
export { 
  getIntelligentQuestions,
  enhanceSessionSettings,
  type IntelligentQuestionResult,
} from '../intelligentQuestionService';

// ============================================================================
// AI TUTORING SERVICES
// ============================================================================

import * as socraticHintServiceModule from '../socraticHintService';
import * as virtualPreceptorServiceModule from '../virtualPreceptorService';
import * as virtualAttendingServiceModule from '../virtualAttendingService';

export const socraticService = socraticHintServiceModule;
export const virtualPreceptor = virtualPreceptorServiceModule;
export const virtualAttending = virtualAttendingServiceModule;

// ============================================================================
// DEPRECATION GUIDE
// ============================================================================
/**
 * AI SERVICE CONSOLIDATION:
 * 
 * QUESTION GENERATION (prefer core/questionService for most cases):
 * - intelligentQuestionService.ts → Use for adaptive learning paths
 * - adaptiveQuestionEngine.ts → Use for difficulty adjustment
 * - enhancedQuestionService.ts → Use for AI-enriched explanations
 * 
 * For standard question operations, import from services/core instead.
 * These AI services are for specialized AI-driven features.
 */
