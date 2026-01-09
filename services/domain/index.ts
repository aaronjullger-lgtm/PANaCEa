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

// ============================================================================
// EXAM SIMULATION
// ============================================================================

import * as examServiceModule from '../examService';
import * as panceDistributionServiceModule from '../panceDistributionService';

export const examService = examServiceModule;
export const panceDistribution = panceDistributionServiceModule;

// ============================================================================
// REFERENCE DATA - Labs, Drugs, Guidelines
// ============================================================================

import * as referenceDataServiceModule from '../referenceDataService';
import * as labServiceModule from '../labService';
import * as drugServiceModule from '../drugService';
import * as guidelineServiceModule from '../guidelineService';

export const referenceService = referenceDataServiceModule;
export const labService = labServiceModule;
export const drugService = drugServiceModule;
export const guidelineService = guidelineServiceModule;

// ============================================================================
// CLINICAL SCENARIOS
// ============================================================================

import * as scenarioServiceModule from '../scenarioService';
import * as osceServiceModule from '../osceService';
import * as labCaseServiceModule from '../labCaseService';

export const scenarioService = scenarioServiceModule;
export const osceService = osceServiceModule;
export const labCaseService = labCaseServiceModule;

// ============================================================================
// MEDIA & IMAGES
// ============================================================================

import * as mediaStorageServiceModule from '../mediaStorageService';
import * as mediaApprovalServiceModule from '../mediaApprovalService';
import * as imageQualityServiceModule from '../imageQualityService';

export const mediaService = mediaStorageServiceModule;
export const mediaApproval = mediaApprovalServiceModule;
export const imageQuality = imageQualityServiceModule;

// ============================================================================
// SPECIALTY CONTENT
// ============================================================================

import * as buzzwordServiceModule from '../buzzwordService';
import * as clinicalPearlServiceModule from '../clinicalPearlService';
import * as firstLineServiceModule from '../firstLineService';

export const buzzwordService = buzzwordServiceModule;
export const pearlService = clinicalPearlServiceModule;
export const firstLineService = firstLineServiceModule;

// ============================================================================
// KNOWLEDGE GRAPH
// ============================================================================

import * as knowledgeGraphServiceModule from '../knowledgeGraphService';
import * as conceptDependencyServiceModule from '../conceptDependencyService';

export const knowledgeGraph = knowledgeGraphServiceModule;
export const conceptDependency = conceptDependencyServiceModule;

// ============================================================================
// DEPRECATION GUIDE
// ============================================================================
/**
 * DOMAIN SERVICE ORGANIZATION:
 * 
 * This module organizes domain-specific medical education services:
 * 
 * LEARNING ALGORITHMS:
 * - fsrsService: FSRS v5 spaced repetition (primary)
 * - adaptiveFSRSService.ts: Same service, adaptive extensions
 * 
 * EXAM PREP:
 * - examService: Full exam simulation mode
 * - panceDistribution: NCCPA blueprint weighting
 * 
 * REFERENCE:
 * - referenceService: Unified reference data access
 * - Individual services (lab, drug, guideline) for specialized queries
 */
