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

import * as adaptiveFSRSServiceModule from './adaptiveFSRSService';

export const fsrsService = adaptiveFSRSServiceModule;

// Re-export commonly used functions from adaptiveFSRSService
export {
  getAdaptiveFSRS,
  generateAdaptiveStudyPlan,
  type StudySessionPlan,
} from './adaptiveFSRSService';

// ============================================================================
// EXAM SIMULATION & DISTRIBUTION
// ============================================================================

import * as examServiceModule from './examService';
import * as panceDistributionServiceModule from './panceDistributionService';

export const examService = examServiceModule;
export const panceDistribution = panceDistributionServiceModule;

// Re-export commonly used functions from panceDistributionService
export {
  getSessionSummary,
  calculateDistributionDrift,
  resetSessionDistribution,
  recordQuestion,
  PANCE_SYSTEM_PERCENTAGES,
} from './panceDistributionService';

// Re-export exam utilities/types so consumers don't import directly
export * from './examService';

// ============================================================================
// CLINICAL REFERENCE DATA
// ============================================================================

import * as drugServiceModule from './drugService';
import * as labServiceModule from './labService';
import * as labCaseServiceModule from './labCaseService';
import * as clinicalPearlServiceModule from './clinicalPearlService';
import * as buzzwordServiceModule from './buzzwordService';
import * as firstLineServiceModule from './firstLineService';
import * as guidelineServiceModule from './guidelineService';
import * as referenceDataServiceModule from './referenceDataService';

export const drugService = drugServiceModule;
export const labService = labServiceModule;
export const labCaseService = labCaseServiceModule;
export const clinicalPearlService = clinicalPearlServiceModule;
export const buzzwordService = buzzwordServiceModule;
export const firstLineService = firstLineServiceModule;
export const guidelineService = guidelineServiceModule;
export const referenceData = referenceDataServiceModule;

// ============================================================================
// DIFFERENTIAL DIAGNOSIS & RISK ASSESSMENT
// ============================================================================

import * as ddxServiceModule from './ddxService';
import * as riskAssessmentEngineModule from './riskAssessmentEngine';

export const ddxService = ddxServiceModule;
export const riskAssessment = riskAssessmentEngineModule;

// ============================================================================
// ANATOMY & KNOWLEDGE STRUCTURES
// ============================================================================

import * as anatomyModelServiceModule from './anatomyModelService';
import * as knowledgeGraphServiceModule from './knowledgeGraphService';
import * as conceptDependencyServiceModule from './conceptDependencyService';

export const anatomyModel = anatomyModelServiceModule;
export const knowledgeGraph = knowledgeGraphServiceModule;
export const conceptDependency = conceptDependencyServiceModule;

// ============================================================================
// OSCE & PATIENT ENCOUNTERS
// ============================================================================

import * as osceServiceModule from './osceService';
import * as osceScoringEngineModule from './osceScoringEngine';
import * as patientEncounterGeneratorModule from './patientEncounterGenerator';
import * as patientPersonalityEngineModule from './patientPersonalityEngine';
import * as scenarioServiceModule from './scenarioService';

export const osceService = osceServiceModule;
export const osceScoring = osceScoringEngineModule;
export const patientEncounter = patientEncounterGeneratorModule;
export const patientPersonality = patientPersonalityEngineModule;
export const scenarioService = scenarioServiceModule;

// ============================================================================
// MEDIA & RESOURCES
// ============================================================================

import * as mediaStorageServiceModule from './mediaStorageService';
import * as mediaApprovalServiceModule from './mediaApprovalService';
import * as imageQualityServiceModule from './imageQualityService';
import * as educationalResourceServiceModule from './educationalResourceService';

export const mediaStorage = mediaStorageServiceModule;
export const mediaApproval = mediaApprovalServiceModule;
export const imageQuality = imageQualityServiceModule;
export const educationalResources = educationalResourceServiceModule;

// ============================================================================
// SPECIALIZED FEATURES
// ============================================================================

import * as medicalSpanishServiceModule from './medicalSpanishService';
import * as clinicalBrowserServiceModule from './clinicalBrowserService';
import * as smartPauseServiceModule from './smartPauseService';
import * as studyGroupServiceModule from './studyGroupService';

export const medicalSpanish = medicalSpanishServiceModule;
export const clinicalBrowser = clinicalBrowserServiceModule;
export const smartPause = smartPauseServiceModule;
export const studyGroup = studyGroupServiceModule;

// Spanish mode types (type-only to avoid extra bundling)
export type { SpanishMode } from './medicalSpanishService';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Export common types for consumer convenience
export type {
  StudySessionPlan,
} from './adaptiveFSRSService';

export type {
  SpanishMode,
} from './medicalSpanishService';

// ============================================================================
// USAGE GUIDE
// ============================================================================
/**
 * DOMAIN SERVICE ORGANIZATION:
 *
 * SPACED REPETITION:
 * - adaptiveFSRSService.ts ’ FSRS v6 algorithm implementation
 *
 * EXAM SIMULATION:
 * - examService.ts ’ PANCE exam simulation and scoring
 * - panceDistributionService.ts ’ Blueprint-aligned question distribution
 *
 * CLINICAL REFERENCE:
 * - drugService.ts ’ Medication database and interactions
 * - labService.ts ’ Laboratory test reference
 * - labCaseService.ts ’ Clinical laboratory scenarios
 * - clinicalPearlService.ts ’ High-yield clinical facts
 * - buzzwordService.ts ’ Pathognomonic findings
 * - firstLineService.ts ’ First-line treatment recommendations
 * - guidelineService.ts ’ Clinical practice guidelines
 * - referenceDataService.ts ’ General reference data
 *
 * DIFFERENTIAL DIAGNOSIS:
 * - ddxService.ts ’ Differential diagnosis generation
 * - riskAssessmentEngine.ts ’ Clinical risk stratification
 *
 * KNOWLEDGE STRUCTURES:
 * - anatomyModelService.ts ’ 3D anatomy models and interactions
 * - knowledgeGraphService.ts ’ Medical concept relationships
 * - conceptDependencyService.ts ’ Learning path dependencies
 *
 * OSCE & ENCOUNTERS:
 * - osceService.ts ’ OSCE station management
 * - osceScoringEngine.ts ’ OSCE performance scoring
 * - patientEncounterGenerator.ts ’ Realistic patient scenarios
 * - patientPersonalityEngine.ts ’ Patient persona simulation
 * - scenarioService.ts ’ Clinical scenario orchestration
 *
 * MEDIA & RESOURCES:
 * - mediaStorageService.ts ’ Image/video storage and retrieval
 * - mediaApprovalService.ts ’ Content moderation workflow
 * - imageQualityService.ts ’ Image quality assessment
 * - educationalResourceService.ts ’ External learning materials
 *
 * SPECIALIZED:
 * - medicalSpanishService.ts ’ Spanish language mode
 * - clinicalBrowserService.ts ’ Clinical reference browser
 * - smartPauseService.ts ’ Intelligent study break recommendations
 * - studyGroupService.ts ’ Collaborative learning features
 *
 * This barrel intentionally limits exports to client-safe services.
 */
