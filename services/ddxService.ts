/**
 * DDx Service - Client-side service for differential diagnosis features
 * 
 * Provides:
 * - Fetching related differentials
 * - Deep condition comparison
 * - User confusion patterns
 * - Smart suggestions
 */

import { useAuth } from '@clerk/clerk-react';

// Types
export interface RelatedCondition {
  id: string;
  name: string;
  displayName?: string;
  system: string;
  subcategory?: string;
  relationshipType: string;
  clinicalContext?: string;
  source: 'direct_relation' | 'bidirectional_relation' | 'system_match';
}

export interface DifferentialContext {
  presentingComplaint: string;
  mustNotMiss: string[];
  mostDangerous: string[];
  redFlags: string[];
  keyExamFindings: string[];
  distinguishingFeatures?: any;
}

export interface RelatedConditionsResponse {
  condition: {
    id: string;
    name: string;
    system: string;
  };
  relatedConditions: RelatedCondition[];
  differentialContext: DifferentialContext | null;
  totalFound: number;
}

export interface LinkedLab {
  name: string;
  expectedResult?: string;
  significance?: string;
  isHighYield: boolean;
}

export interface LinkedImaging {
  name: string;
  modality: string;
  expectedFindings?: string[];
  classicFindings?: string;
}

export interface LinkedFinding {
  name: string;
  system: string;
  clinicalSignificance?: string;
  sensitivity?: number;
  specificity?: number;
}

export interface LinkedDrug {
  genericName: string;
  brandName?: string;
  isFirstLine: boolean;
  mechanismOfAction?: string;
}

export interface DeepConditionData {
  id: string;
  conditionId: string;
  condition: string;
  system: string;
  subcategory: string;
  
  // Clinical data
  classic_patient?: string;
  symptoms?: string;
  buzzwords?: string[];
  pathophysiology?: string;
  etiology?: string;
  riskFactors?: string;
  physicalExam?: string;
  
  // Diagnosis
  gold_standard_dx?: string;
  best_initial_test?: string;
  diagnostics?: string;
  
  // Treatment
  first_line_rx?: string;
  treatment?: string;
  rx_mechanism?: string;
  
  // Demographics
  age_demographic?: any;
  gender_bias?: string;
  
  // PANCE
  pance_yield?: number;
  mnemonic?: string;
  clinical_pearls?: any;
  
  // Linked entities
  linkedLabs?: LinkedLab[];
  linkedImaging?: LinkedImaging[];
  linkedFindings?: LinkedFinding[];
  linkedDrugs?: LinkedDrug[];
  linkedScoringSystem?: Array<{ name: string; category: string; whenToUse?: string }>;
}

export interface ComparisonField {
  key: string;
  label: string;
  category: string;
  isLinkedEntity?: boolean;
}

export interface CompareResponse {
  conditions: DeepConditionData[];
  discriminatingFeatures: string[];
  uniqueEntities: Array<{
    conditionId: string;
    uniqueLabs: LinkedLab[];
    uniqueImaging: LinkedImaging[];
  }>;
  comparisonFields: ComparisonField[];
}

export interface ConfusionPair {
  id: string;
  realCondition: string;
  mistakenFor: string;
  count: number;
  lastOccurrence: string;
  realConditionData?: {
    id: string;
    name: string;
    system: string;
  };
  mistakenConditionData?: {
    id: string;
    name: string;
    system: string;
  };
  distinguishingFeatures?: string;
  keyDifferences?: {
    goldStandardDx?: { real: string | null; mistaken: string | null };
    bestInitialTest?: { real: string | null; mistaken: string | null };
    firstLineRx?: { real: string | null; mistaken: string | null };
    classicPatient?: { real: string | null; mistaken: string | null };
  };
  severity: 'high' | 'medium' | 'low';
}

export interface ConfusionPairsResponse {
  userId: string;
  confusionPairs: ConfusionPair[];
  totalPairs: number;
  confusionScore: number;
  systemSummary: Record<string, {
    count: number;
    pairs: Array<{ real: string; mistaken: string; count: number }>;
  }>;
  recommendations: string[];
}

// API Base URL
const API_BASE = '/api/ddx';

/**
 * Fetch related differential diagnoses for a condition
 */
export async function fetchRelatedConditions(
  conditionId?: string,
  conditionName?: string,
  limit: number = 10
): Promise<RelatedConditionsResponse> {
  const params = new URLSearchParams();
  if (conditionId) params.set('conditionId', conditionId);
  if (conditionName) params.set('conditionName', conditionName);
  params.set('limit', limit.toString());

  const response = await fetch(`${API_BASE}/related?${params}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch related conditions: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch deep comparison data for multiple conditions
 */
export async function fetchConditionComparison(
  conditionIds: string[]
): Promise<CompareResponse> {
  if (conditionIds.length < 2) {
    throw new Error('At least 2 condition IDs required for comparison');
  }
  
  const response = await fetch(`${API_BASE}/compare?ids=${conditionIds.join(',')}`);
  
  if (!response.ok) {
    throw new Error(`Failed to compare conditions: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch user's confusion patterns (requires authentication)
 */
export async function fetchConfusionPairs(
  token: string,
  options: {
    limit?: number;
    minCount?: number;
    conditionId?: string;
  } = {}
): Promise<ConfusionPairsResponse> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', options.limit.toString());
  if (options.minCount) params.set('minCount', options.minCount.toString());
  if (options.conditionId) params.set('conditionId', options.conditionId);

  const response = await fetch(`${API_BASE}/confusion-pairs?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication required');
    }
    throw new Error(`Failed to fetch confusion pairs: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get severity color for confusion pairs
 */
export function getSeverityColor(severity: 'high' | 'medium' | 'low'): string {
  switch (severity) {
    case 'high': return 'text-red-500';
    case 'medium': return 'text-amber-500';
    case 'low': return 'text-green-500';
  }
}

/**
 * Get severity background color
 */
export function getSeverityBgColor(severity: 'high' | 'medium' | 'low'): string {
  switch (severity) {
    case 'high': return 'bg-red-500/10 border-red-500/30';
    case 'medium': return 'bg-amber-500/10 border-amber-500/30';
    case 'low': return 'bg-green-500/10 border-green-500/30';
  }
}

/**
 * Format a comparison field value for display
 */
export function formatFieldValue(value: unknown): string {
  if (value == null) return '-';
  if (Array.isArray(value)) {
    return value.filter(v => v != null).join(', ') || '-';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Check if two values are different (for highlighting)
 */
export function valuesAreDifferent(val1: unknown, val2: unknown): boolean {
  const str1 = formatFieldValue(val1);
  const str2 = formatFieldValue(val2);
  return str1 !== str2 && str1 !== '-' && str2 !== '-';
}

/**
 * Get display-friendly category label
 */
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    presentation: 'Presentation',
    demographics: 'Demographics',
    pathophysiology: 'Pathophysiology',
    diagnosis: 'Diagnosis',
    treatment: 'Treatment',
    prognosis: 'Prognosis',
  };
  return labels[category] || category;
}

/**
 * Group comparison fields by category
 */
export function groupFieldsByCategory(fields: ComparisonField[]): Record<string, ComparisonField[]> {
  return fields.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, ComparisonField[]>);
}

export default {
  fetchRelatedConditions,
  fetchConditionComparison,
  fetchConfusionPairs,
  getSeverityColor,
  getSeverityBgColor,
  formatFieldValue,
  valuesAreDifferent,
  getCategoryLabel,
  groupFieldsByCategory,
};
