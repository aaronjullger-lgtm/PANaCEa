/**
 * StudyPANaCEa Services - Unified Entry Point
 *
 * This module provides organized access to all services in the application.
 * Services are grouped by concern for easier discovery and maintainability.
 *
 * ## Import Patterns
 *
 * ### Recommended: Import from category
 * ```typescript
 * import { questionService, sessionService } from '@/services/core';
 * import { analyticsService, scorePredictorService } from '@/services/analytics';
 * import { geminiService } from '@/services/ai';
 * import { fsrsService, examService } from '@/services/domain';
 * ```
 *
 * ### Alternative: Import from main index
 * ```typescript
 * import { core, analytics, ai, domain } from '@/services';
 *
 * core.questionService.getQuestion(...);
 * analytics.scorePredictorService.predict(...);
 * ```
 *
 * ## Categories
 *
 * - **core**: Question management, sessions, drills, content
 * - **analytics**: Performance tracking, predictions, behavioral analysis
 * - **ai**: Gemini integration, content generation, AI tutoring
 * - **domain**: FSRS algorithm, exam simulation, reference data, media
 *
 * @module services
 */

// Re-export categories as namespaces for grouped access
import * as core from './core';
import * as analytics from './analytics';
import * as ai from './ai';
import * as domain from './domain';

export { core, analytics, ai, domain };

// Re-export commonly used items explicitly to avoid conflicts
// For full access, use the namespaced exports: services.analytics.predictScore()
export { predictScore, NCCPA_BLUEPRINT_WEIGHTS } from './analytics';

/**
 * SERVICE CONSOLIDATION SUMMARY
 *
 * Original: 77 services in flat structure
 * New: 4 organized categories
 *
 * CORE (services/core/):
 * - questionService: Primary question operations
 * - questionPoolService: Question pool management
 * - attemptService: Answer tracking
 * - sessionService: Session orchestration
 * - customSessionService: Custom study sessions
 * - drillService: Drill logic
 * - drillStatsService: Drill statistics
 * - conditionService: Medical conditions
 * - conditionContentService: Condition content loading
 *
 * ANALYTICS (services/analytics/):
 * - analyticsService: User analytics engine
 * - performanceService: Performance tracking
 * - predictionService: Performance predictions
 * - scorePredictorService: PANCE score estimation
 * - sessionAnalyticsService: Session-level analytics
 * - answerPatternService: Answer pattern analysis
 * - behavioralService: Behavioral confidence tracking
 * - momentumService: Session momentum
 * - deepAnalyticsStore: Deep analytics data store
 * - researchAnalytics: Research-backed analytics
 * - predictiveEngine: Predictive analytics
 * - masteryPredictor: Mastery velocity prediction
 *
 * AI (services/ai/):
 * - geminiService: Google Gemini AI interface
 * - contentPipeline: Automated content generation
 * - batchGenerator: Batch content generation
 * - intelligentQuestions: AI-driven question selection
 * - adaptiveEngine: Adaptive difficulty
 * - enhancedQuestions: AI-enriched explanations
 * - socraticService: Socratic hints/tutoring
 * - virtualPreceptor: Virtual preceptor AI
 * - virtualAttending: Virtual attending AI
 *
 * DOMAIN (services/domain/):
 * - fsrsService: FSRS v5 spaced repetition
 * - examService: Full exam simulation
 * - panceDistribution: NCCPA blueprint weighting
 * - referenceService: Reference data access
 * - labService: Lab value reference
 * - drugService: Drug reference
 * - guidelineService: Clinical guidelines
 * - scenarioService: Clinical scenarios
 * - osceService: OSCE simulations
 * - labCaseService: Lab case studies
 * - mediaService: Media storage
 * - mediaApproval: Media approval workflow
 * - imageQuality: Image quality assessment
 * - buzzwordService: Board exam buzzwords
 * - pearlService: Clinical pearls
 * - firstLineService: First-line treatments
 * - knowledgeGraph: Knowledge graph operations
 * - conceptDependency: Concept dependencies
 */
