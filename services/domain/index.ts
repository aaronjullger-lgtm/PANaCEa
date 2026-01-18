/**
 * Domain Services - Unified Exports
 *
 * Consolidates domain-specific services for medical education.
 *
 * @example
 * import { fsrsService, examService, referenceService } from '@/services/domain';
 */

// ============================================================================
// SPACED REPETITION - FSRS Implementation
// ============================================================================

import * as adaptiveFSRSServiceModule from '../adaptiveFSRSService';

export const fsrsService = adaptiveFSRSServiceModule;

// Re-export commonly used functions from adaptiveFSRSService
export {
  getAdaptiveFSRS,
  generateAdaptiveStudyPlan,
  type StudySessionPlan,
} from '../adaptiveFSRSService';

// ============================================================================
// EXAM SIMULATION
// ============================================================================

import * as examServiceModule from '../examService';
import * as panceDistributionServiceModule from '../panceDistributionService';

export const examService = examServiceModule;
export const panceDistribution = panceDistributionServiceModule;

// Re-export commonly used functions from panceDistributionService
export {
  getSessionSummary,
  calculateDistributionDrift,
  resetSessionDistribution,
  recordQuestion,
  PANCE_SYSTEM_PERCENTAGES,
} from '../panceDistributionService';

// Re-export exam utilities/types so consumers don't import directly
export * from '../examService';

// Spanish mode types (type-only to avoid extra bundling)
export type { SpanishMode } from '../medicalSpanishService';

// This barrel intentionally limits exports to client-safe services.
