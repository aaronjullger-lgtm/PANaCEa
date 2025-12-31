/**
 * Reference Data Service - Frontend API Client
 * 
 * Provides access to all reference tables for study features:
 * - Anatomy Structures
 * - Procedures  
 * - History Components (HPI elements)
 * - Differential Diagnoses
 * - Physiology Concepts
 * - Physical Exam Findings
 * - Lab Tests
 * - ECG Patterns
 * - Practice Guidelines
 * - Vital Sign Ranges
 */

import { useAuth } from '@clerk/clerk-react';

// ============================================
// TYPES
// ============================================

export interface AnatomyStructure {
  id: string;
  name: string;
  system: string;
  region?: string;
  type?: string;
  description?: string;
  function?: string;
  innervation?: string;
  bloodSupply?: string;
  clinicalSignificance?: string;
  commonPathology?: string[];
  examFindings?: string[];
  clinicalPearls?: string[];
  mnemonics?: string[];
  isHighYield?: boolean;
  panceYield?: number;
  conditions?: { id: string; name: string }[];
}

export interface Procedure {
  id: string;
  name: string;
  category?: string;
  system?: string;
  description?: string;
  indication?: string;
  contraindications?: string[];
  equipment?: string[];
  steps?: string[];
  complications?: string[];
  pearlsAndPitfalls?: string[];
  documentation?: string;
  cptCode?: string;
  isHighYield?: boolean;
  panceYield?: number;
  conditions?: { id: string; name: string }[];
}

export interface HistoryComponent {
  id: string;
  name: string;
  type: string;
  description?: string;
  examples?: string[];
  clinicalRelevance?: string;
  followUpQuestions?: string[];
  redFlags?: string[];
  mnemonics?: string[];
  isHighYield?: boolean;
  panceYield?: number;
}

export interface DifferentialDiagnosis {
  id: string;
  name: string;
  presentingComplaint: string;
  category?: string;
  description?: string;
  diagnoses?: string[];
  mustNotMiss?: string[];
  common?: string[];
  lessCommon?: string[];
  keyDistinguishingFeatures?: Record<string, string[]>;
  workup?: string[];
  clinicalPearls?: string[];
  isHighYield?: boolean;
  panceYield?: number;
}

export interface PhysiologyConcept {
  id: string;
  name: string;
  category?: string;
  description?: string;
  mechanism?: string;
  clinicalRelevance?: string;
  keyPoints?: string[];
  mnemonics?: string[];
  isHighYield?: boolean;
  panceYield?: number;
}

export interface PhysicalExamFinding {
  id: string;
  name: string;
  system?: string;
  description?: string;
  technique?: string;
  interpretation?: string[];
  associatedConditions?: string[];
  sensitivity?: number;
  specificity?: number;
  isHighYield?: boolean;
  panceYield?: number;
}

export interface LabTest {
  id: string;
  name: string;
  abbreviation?: string;
  category?: string;
  normalRange?: string;
  units?: string;
  interpretation?: Record<string, string>;
  clinicalSignificance?: string;
  specimenType?: string;
  isHighYield?: boolean;
  panceYield?: number;
}

export interface ECGPattern {
  id: string;
  name: string;
  category?: string;
  description?: string;
  features?: string[];
  causes?: string[];
  clinicalSignificance?: string;
  management?: string;
  isHighYield?: boolean;
  panceYield?: number;
}

export interface VitalSignRange {
  id: string;
  name: string;
  ageGroup?: string;
  normalRange: string;
  units?: string;
  clinicalNotes?: string;
}

export interface PracticeGuideline {
  id: string;
  name: string;
  category?: string;
  source?: string;
  summary?: string;
  recommendations?: string[];
  lastUpdated?: Date;
}

// ============================================
// API HELPER
// ============================================

async function fetchWithAuth<T>(
  url: string,
  getToken: () => Promise<string | null>
): Promise<T> {
  const token = await getToken();
  
  const response = await fetch(url, {
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || 'Request failed');
  }

  const data = await response.json();
  return data.data || data;
}

// ============================================
// SERVICE FACTORY
// ============================================

/**
 * Creates a reference data service with authentication
 * Use inside components with useAuth() from Clerk
 */
export function createReferenceService(getToken: () => Promise<string | null>) {
  return {
    // ========================================
    // ANATOMY
    // ========================================
    anatomy: {
      getAll: (system?: string) => 
        fetchWithAuth<AnatomyStructure[]>(
          `/api/reference/anatomy${system ? `?system=${encodeURIComponent(system)}` : ''}`,
          getToken
        ),
      
      getById: (id: string) =>
        fetchWithAuth<AnatomyStructure>(`/api/reference/anatomy/${id}`, getToken),
      
      search: (query: string) =>
        fetchWithAuth<AnatomyStructure[]>(
          `/api/reference/anatomy?query=${encodeURIComponent(query)}`,
          getToken
        )
    },

    // ========================================
    // PROCEDURES
    // ========================================
    procedures: {
      getAll: (filters?: { category?: string; system?: string }) => {
        const params = new URLSearchParams();
        if (filters?.category) params.set('category', filters.category);
        if (filters?.system) params.set('system', filters.system);
        const queryStr = params.toString();
        return fetchWithAuth<Procedure[]>(
          `/api/reference/procedures${queryStr ? `?${queryStr}` : ''}`,
          getToken
        );
      },
      
      getById: (id: string) =>
        fetchWithAuth<Procedure>(`/api/reference/procedures/${id}`, getToken),
      
      search: (query: string) =>
        fetchWithAuth<Procedure[]>(
          `/api/reference/procedures?query=${encodeURIComponent(query)}`,
          getToken
        )
    },

    // ========================================
    // HISTORY COMPONENTS
    // ========================================
    historyComponents: {
      getAll: (type?: string) =>
        fetchWithAuth<HistoryComponent[]>(
          `/api/reference/history-components${type ? `?type=${encodeURIComponent(type)}` : ''}`,
          getToken
        ),
      
      getById: (id: string) =>
        fetchWithAuth<HistoryComponent>(`/api/reference/history-components/${id}`, getToken),
      
      search: (query: string) =>
        fetchWithAuth<HistoryComponent[]>(
          `/api/reference/history-components?query=${encodeURIComponent(query)}`,
          getToken
        )
    },

    // ========================================
    // DIFFERENTIAL DIAGNOSIS
    // ========================================
    differentials: {
      getAll: (category?: string) =>
        fetchWithAuth<DifferentialDiagnosis[]>(
          `/api/reference/differentials${category ? `?category=${encodeURIComponent(category)}` : ''}`,
          getToken
        ),
      
      getById: (id: string) =>
        fetchWithAuth<DifferentialDiagnosis>(`/api/reference/differentials/${id}`, getToken),
      
      getByComplaint: (complaint: string) =>
        fetchWithAuth<DifferentialDiagnosis[]>(
          `/api/reference/differentials?presentingComplaint=${encodeURIComponent(complaint)}`,
          getToken
        ),
      
      search: (query: string) =>
        fetchWithAuth<DifferentialDiagnosis[]>(
          `/api/reference/differentials?query=${encodeURIComponent(query)}`,
          getToken
        )
    },

    // ========================================
    // PHYSIOLOGY
    // ========================================
    physiology: {
      getAll: (category?: string) =>
        fetchWithAuth<PhysiologyConcept[]>(
          `/api/reference/physiology${category ? `?category=${encodeURIComponent(category)}` : ''}`,
          getToken
        ),
      
      search: (query: string) =>
        fetchWithAuth<PhysiologyConcept[]>(
          `/api/reference/physiology?query=${encodeURIComponent(query)}`,
          getToken
        )
    },

    // ========================================
    // PHYSICAL EXAM FINDINGS
    // ========================================
    findings: {
      getAll: (system?: string) =>
        fetchWithAuth<PhysicalExamFinding[]>(
          `/api/reference/findings${system ? `?system=${encodeURIComponent(system)}` : ''}`,
          getToken
        ),
      
      search: (query: string) =>
        fetchWithAuth<PhysicalExamFinding[]>(
          `/api/reference/findings?query=${encodeURIComponent(query)}`,
          getToken
        )
    },

    // ========================================
    // LAB TESTS
    // ========================================
    labs: {
      getAll: (category?: string) =>
        fetchWithAuth<LabTest[]>(
          `/api/reference/labs${category ? `?category=${encodeURIComponent(category)}` : ''}`,
          getToken
        ),
      
      search: (query: string) =>
        fetchWithAuth<LabTest[]>(
          `/api/reference/labs?query=${encodeURIComponent(query)}`,
          getToken
        )
    },

    // ========================================
    // ECG PATTERNS
    // ========================================
    ecg: {
      getAll: (category?: string) =>
        fetchWithAuth<ECGPattern[]>(
          `/api/reference/ecg${category ? `?category=${encodeURIComponent(category)}` : ''}`,
          getToken
        )
    },

    // ========================================
    // GUIDELINES
    // ========================================
    guidelines: {
      getAll: (category?: string) =>
        fetchWithAuth<PracticeGuideline[]>(
          `/api/reference/guidelines${category ? `?category=${encodeURIComponent(category)}` : ''}`,
          getToken
        )
    },

    // ========================================
    // VITALS
    // ========================================
    vitals: {
      getAll: () =>
        fetchWithAuth<VitalSignRange[]>('/api/reference/vitals', getToken)
    }
  };
}

// ============================================
// REACT HOOK
// ============================================

/**
 * React hook to access reference data service
 * Automatically handles authentication
 * 
 * @example
 * const refService = useReferenceService();
 * const anatomy = await refService.anatomy.getAll('CV');
 */
export function useReferenceService() {
  const { getToken } = useAuth();
  return createReferenceService(getToken);
}

// ============================================
// STANDALONE SERVICE (for non-React contexts)
// ============================================

/**
 * Standalone service without auth for public data or server-side use
 * Note: Most endpoints require auth - use for development/testing only
 */
export const referenceServicePublic = createReferenceService(async () => null);
