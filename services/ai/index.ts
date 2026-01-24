/**
 * AI Services - Unified Exports
 *
 * Consolidates all AI/ML and content generation services.
 *
 * @example
 * import { geminiService, virtualPreceptor, contentGenerator } from '@/services/ai';
 */

// ============================================================================
// GEMINI AI SERVICE - Primary AI interface
// ============================================================================

import * as geminiServiceModule from './geminiService';

export const geminiService = geminiServiceModule;

// Re-export commonly used functions and types from geminiService
export {
  generateAlternateRationale,
  callGeminiText,
  callGeminiTextStreaming,
  createCancellableGeminiStream,
  type SOAPNote,
  type GradingResult,
  type ChatMessage,
  type StreamChunk,
} from './geminiService';

// ============================================================================
// INTELLIGENT QUESTION SERVICES
// ============================================================================

import * as intelligentQuestionServiceModule from './intelligentQuestionService';
import * as adaptiveQuestionEngineModule from './adaptiveQuestionEngine';
import * as enhancedQuestionServiceModule from './enhancedQuestionService';

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
} from './intelligentQuestionService';

// ============================================================================
// CONTENT GENERATION & ORCHESTRATION
// ============================================================================

import * as automatedContentPipelineModule from './automatedContentPipeline';
import * as batchGeneratorServiceModule from './batchGeneratorService';
import * as contextAwareOrchestratorModule from './contextAwareOrchestrator';
import * as studyGuideGeneratorModule from './StudyGuideGenerator';

export const contentPipeline = automatedContentPipelineModule;
export const batchGenerator = batchGeneratorServiceModule;
export const contextOrchestrator = contextAwareOrchestratorModule;
export const studyGuideGenerator = studyGuideGeneratorModule;

// ============================================================================
// AI TUTORING SERVICES
// ============================================================================

import * as socraticHintServiceModule from './socraticHintService';
import * as virtualPreceptorServiceModule from './virtualPreceptorService';
import * as virtualAttendingServiceModule from './virtualAttendingService';

export const socraticService = socraticHintServiceModule;
export const virtualPreceptor = virtualPreceptorServiceModule;
export const virtualAttending = virtualAttendingServiceModule;

// Re-export commonly used functions and types from virtualPreceptorService
export {
  generateDebrief,
  type PreceptorFeedback,
  type EncounterSessionSummary,
} from './virtualPreceptorService';

// Re-export attending persona types and functions
export {
  type AttendingPersona,
  type PersonaProfile,
  ATTENDING_PERSONAS,
  savePreferredPersona,
  loadPreferredPersona,
  getPersona,
  getAllPersonas,
} from './virtualAttendingService';

// ============================================================================
// SESSION OPTIMIZATION & SEARCH
// ============================================================================

import * as realTimeSessionOptimizerModule from './realTimeSessionOptimizer';
import * as semanticSearchServiceModule from './semanticSearchService';

export const sessionOptimizer = realTimeSessionOptimizerModule;
export const semanticSearch = semanticSearchServiceModule;

// ============================================================================
// PATIENT SIMULATION SERVICES
// ============================================================================

import * as patientSimulatorServiceModule from './patientSimulatorService';
import * as conditionServiceModule from './conditionService';

export const patientSimulator = patientSimulatorServiceModule;
export const conditionService = conditionServiceModule;

// Named exports from patient simulator service
export {
  chatWithPatientSimulator,
  evaluateDiagnosis,
  performPhysicalExam,
  orderDiagnosticTest,
  evaluateTreatmentPlan,
  generateAfterActionReport,
} from './patientSimulatorService';

// Named exports from condition service
export {
  getConditionsBySystem,
  getAllConditions,
} from './conditionService';

// Export CoachingService functions and types
export {
  analyzeAnswer,
  getSocraticHint,
  calculateUserMetrics,
  generateStudyPrescription,
  analyzeSearchHistory,
  type AnalyzeAnswerParams,
  type UserMetrics,
  type StudyRecommendation,
  type SearchHistoryEntry,
} from '../core/CoachingService';

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
 * CONTENT GENERATION:
 * - automatedContentPipeline.ts → Use for batch content generation
 * - batchGeneratorService.ts → Use for bulk question creation
 * - StudyGuideGenerator.ts → Use for personalized study materials
 *
 * AI TUTORING:
 * - socraticHintService.ts → Use for Socratic method hints
 * - virtualPreceptorService.ts → Use for clinical precepting
 * - virtualAttendingService.ts → Use for attending persona interactions
 *
 * ORCHESTRATION:
 * - contextAwareOrchestrator.ts → Use for multi-service AI coordination
 * - realTimeSessionOptimizer.ts → Use for live session adaptation
 * - semanticSearchService.ts → Use for intelligent content discovery
 *
 * For standard question operations, import from services/core instead.
 * These AI services are for specialized AI-driven features.
 */
