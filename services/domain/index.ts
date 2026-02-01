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

// REMOVED: examService - has runtime prisma import, server-only
// import * as examServiceModule from './examService'; // IMPORT DISABLED: server-only
import * as panceDistributionServiceModule from './panceDistributionService';

// export const examService = examServiceModule; // SERVER-ONLY: use API
export const panceDistribution = panceDistributionServiceModule;

// Re-export commonly used functions from panceDistributionService
export {
  getSessionSummary,
  calculateDistributionDrift,
  resetSessionDistribution,
  recordQuestion,
  normalizeSystemCode,
  PANCE_SYSTEM_PERCENTAGES,
} from './panceDistributionService';

// REMOVED: Re-export exam utilities - server-only
// export * from './examService'; // EXPORT DISABLED: server-only

// ============================================================================
// CLINICAL REFERENCE DATA
// ============================================================================

import { drugService as drugServiceObj } from './drugService';
import { labService as labServiceObj } from './labService';
import * as labCaseServiceModule from './labCaseService';
// NOTE: clinicalPearlService is SERVER-ONLY (uses lib/prisma) - import directly in server code
import { buzzwordService as buzzwordServiceObj } from './buzzwordService';
import { firstLineService as firstLineServiceObj } from './firstLineService';
import { guidelineService as guidelineServiceObj } from './guidelineService';
import * as referenceDataServiceModule from './referenceDataService';
import * as dailyTriadServiceModule from './dailyTriadService';
import * as confusionServiceModule from './confusionService';

export const drugService = drugServiceObj;
export const labService = labServiceObj;
export const labCaseService = labCaseServiceModule;
export const buzzwordService = buzzwordServiceObj;
export const firstLineService = firstLineServiceObj;
export const guidelineService = guidelineServiceObj;
export const referenceData = referenceDataServiceModule;
export const dailyTriadService = dailyTriadServiceModule;
export const confusionService = confusionServiceModule;

// Named exports from lab case service
export {
  fetchLabCases,
  getCachedDiagnoses,
} from './labCaseService';

// Named exports from daily triad service
export {
  fetchDailyTriad,
  markTriadReviewed,
  type DailyTriad,
} from './dailyTriadService';

// Named exports from confusion service
export {
  fetchUserConfusions,
  fetchConfusionPairs,
  fetchConditionComparison,
  generateComparison,
  getSeverityColor,
  getSeverityBgColor,
  formatFieldValue,
  groupFieldsByCategory,
  getCategoryLabel,
  type UserConfusionPairSummary,
  type ConfusionPair,
  type ComparisonField,
  type DeepConditionData,
} from './confusionService';

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

// Named export for direct singleton access
export { anatomyModelService } from './anatomyModelService';

// ============================================================================
// OSCE & PATIENT ENCOUNTERS
// ============================================================================

import * as osceServiceModule from './osceService';
import * as osceScoringEngineModule from './osceScoringEngine';
import * as patientEncounterGeneratorModule from './patientEncounterGenerator';
import * as patientPersonalityEngineModule from './patientPersonalityEngine';
// REMOVED: scenarioService - imports Prisma Edge client, server-only
// import * as scenarioServiceModule from './scenarioService'; // IMPORT DISABLED: server-only

export const osceService = osceServiceModule;
export const osceScoring = osceScoringEngineModule;
export const patientEncounter = patientEncounterGeneratorModule;
export const patientPersonality = patientPersonalityEngineModule;
// export const scenarioService = scenarioServiceModule; // SERVER-ONLY: use API

// Named exports from OSCE service
export {
  getRandomEncounterCase,
  startOSCESession,
  saveOSCEChat,
  completeOSCESession,
  saveChatMessage,
  getSessionHistory,
  clearSession,
  calculateEncounterScore,
} from './osceService';

// Named exports from OSCE scoring engine
export {
  OSCEScoringEngine,
  createScoringEngine,
  getCriticalActionsForCondition,
} from './osceScoringEngine';

// Named exports from patient encounter generator
export {
  generatePatientCase,
  generatePatientEncounterFromCondition,
  getFreshPatientEncounter,
} from './patientEncounterGenerator';

// Named exports from patient personality engine
export {
  generatePatientPersonality,
  selectNonVerbalCue,
  initializeRapportMeter,
  updateRapport,
  analyzeQuestionType,
  generateInformationRules,
  shouldRevealInformation,
  initializeEmotionalState,
  updateEmotionalState,
  buildEnhancedPatientPrompt,
  processEnhancedInteraction,
  type EnhancedChatResult,
} from './patientPersonalityEngine';

// ============================================================================
// MEDIA & RESOURCES
// ============================================================================

// REMOVED: mediaStorageService - has runtime prisma import, server-only
// import * as mediaStorageServiceModule from './mediaStorageService'; // IMPORT DISABLED: server-only
// export const mediaStorage = mediaStorageServiceModule; // SERVER-ONLY: use API

// REMOVED: mediaApprovalService - has runtime prisma import, server-only
// import * as mediaApprovalServiceModule from './mediaApprovalService'; // IMPORT DISABLED: server-only
// export const mediaApproval = mediaApprovalServiceModule; // SERVER-ONLY: use API

// REMOVED: imageQualityService - imports 'sharp' which is Node.js-only
// import * as imageQualityServiceModule from './imageQualityService'; // IMPORT DISABLED: server-only (uses sharp)
// export const imageQuality = imageQualityServiceModule; // SERVER-ONLY: use API

// REMOVED: educationalResourceService - has runtime prisma import, server-only
// import * as educationalResourceServiceModule from './educationalResourceService'; // IMPORT DISABLED: server-only
// export const educationalResources = educationalResourceServiceModule; // SERVER-ONLY: use API

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

// Named exports from medical spanish service
export {
  translateToSpanish,
  type SpanishMode,
} from './medicalSpanishService';

// ============================================================================
// TYPE EXPORTS (StudySessionPlan already exported above from adaptiveFSRSService)
// ============================================================================

// ============================================================================
// USAGE GUIDE
// ============================================================================
/**
 * DOMAIN SERVICE ORGANIZATION:
 *
 * SPACED REPETITION:
 * - adaptiveFSRSService.ts � FSRS v6 algorithm implementation
 *
 * EXAM SIMULATION:
 * - examService.ts � PANCE exam simulation and scoring
 * - panceDistributionService.ts � Blueprint-aligned question distribution
 *
 * CLINICAL REFERENCE:
 * - drugService.ts � Medication database and interactions
 * - labService.ts � Laboratory test reference
 * - labCaseService.ts � Clinical laboratory scenarios
 * - clinicalPearlService.ts � High-yield clinical facts
 * - buzzwordService.ts � Pathognomonic findings
 * - firstLineService.ts � First-line treatment recommendations
 * - guidelineService.ts � Clinical practice guidelines
 * - referenceDataService.ts � General reference data
 *
 * DIFFERENTIAL DIAGNOSIS:
 * - ddxService.ts � Differential diagnosis generation
 * - riskAssessmentEngine.ts � Clinical risk stratification
 *
 * KNOWLEDGE STRUCTURES:
 * - anatomyModelService.ts � 3D anatomy models and interactions
 * - knowledgeGraphService.ts � Medical concept relationships
 * - conceptDependencyService.ts � Learning path dependencies
 *
 * OSCE & ENCOUNTERS:
 * - osceService.ts � OSCE station management
 * - osceScoringEngine.ts � OSCE performance scoring
 * - patientEncounterGenerator.ts � Realistic patient scenarios
 * - patientPersonalityEngine.ts � Patient persona simulation
 * - scenarioService.ts � Clinical scenario orchestration
 *
 * MEDIA & RESOURCES:
 * - mediaStorageService.ts � Image/video storage and retrieval
 * - mediaApprovalService.ts � Content moderation workflow
 * - imageQualityService.ts � Image quality assessment
 * - educationalResourceService.ts � External learning materials
 *
 * SPECIALIZED:
 * - medicalSpanishService.ts � Spanish language mode
 * - clinicalBrowserService.ts � Clinical reference browser
 * - smartPauseService.ts � Intelligent study break recommendations
 * - studyGroupService.ts � Collaborative learning features
 *
 * This barrel intentionally limits exports to client-safe services.
 */
