/**
 * DDx Service - Client-side service for differential diagnosis features
 *
 * Provides:
 * - Fetching related differentials
 * - Deep condition comparison
 * - User confusion patterns
 * - Smart suggestions
 */

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
  correctConditionId?: string | null;
  selectedConditionId?: string | null;
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
  systemSummary: Record<
    string,
    {
      count: number;
      pairs: Array<{ real: string; mistaken: string; count: number }>;
    }
  >;
  recommendations: string[];
}

export interface UserConfusionPairSummary {
  id: string;
  count: number;
  correctConditionId: string | null;
  selectedConditionId: string | null;
  correctCondition: string;
  selectedCondition: string;
  correctSystem?: string | null;
  selectedSystem?: string | null;
  lastOccurred?: string | null;
}

export interface UserConfusionsResponse {
  success?: boolean;
  pairs: UserConfusionPairSummary[];
  total: number;
}

export interface ComparisonResult {
  features: string[];
  distinguishers: string[];
  generatedAt: string;
  source: 'gemini' | 'fallback';
}

// API Base URL
const API_BASE = '/api/ddx';
const USER_API_BASE = '/api/user';

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
export async function fetchConditionComparison(conditionIds: string[]): Promise<CompareResponse> {
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
      Authorization: `Bearer ${token}`,
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
 * Track a confusion pair for the current user (POST /api/user/confusion)
 */
export async function trackConfusionPair(
  token: string,
  body: { correctConditionId: string; selectedConditionId: string }
) {
  const response = await fetch(`${USER_API_BASE}/confusion`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Failed to track confusion pair: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch top confusion pairs for the current user (GET /api/user/confusions)
 */
export async function fetchUserConfusions(
  token: string,
  options: { limit?: number } = {}
): Promise<UserConfusionsResponse> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', options.limit.toString());

  const response = await fetch(`${USER_API_BASE}/confusions?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load confusion pairs: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Generate or fetch a cached comparison table for given conditions
 */
export async function generateComparison(
  conditionIds: string[],
  token?: string,
  signal?: AbortSignal
): Promise<ComparisonResult> {
  if (conditionIds.length < 2) {
    throw new Error('At least two condition IDs are required');
  }

  const params = new URLSearchParams();
  params.set('conditions', conditionIds.join(','));

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}/comparison?${params.toString()}`, {
    headers,
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to generate comparison: ${response.statusText}`);
  }

  const data = await response.json();
  return data.comparison as ComparisonResult;
}

/**
 * Get severity color for confusion pairs
 */
export function getSeverityColor(severity: 'high' | 'medium' | 'low'): string {
  switch (severity) {
    case 'high':
      return 'text-data-fail';
    case 'medium':
      return 'text-data-provisional';
    case 'low':
      return 'text-data-pass';
  }
}

/**
 * Get severity background color
 */
export function getSeverityBgColor(severity: 'high' | 'medium' | 'low'): string {
  switch (severity) {
    case 'high':
      return 'bg-data-fail/10 border-data-fail/30';
    case 'medium':
      return 'bg-data-provisional/10 border-data-provisional/30';
    case 'low':
      return 'bg-data-pass/10 border-data-pass/30';
  }
}

/**
 * Format a comparison field value for display
 */
export function formatFieldValue(value: unknown): string {
  if (value == null) return '-';
  if (Array.isArray(value)) {
    return value.filter((v) => v != null).join(', ') || '-';
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
export function groupFieldsByCategory(
  fields: ComparisonField[]
): Record<string, ComparisonField[]> {
  return fields.reduce(
    (acc, field) => {
      if (!acc[field.category]) {
        acc[field.category] = [];
      }
      acc[field.category].push(field);
      return acc;
    },
    {} as Record<string, ComparisonField[]>
  );
}

export default {
  fetchRelatedConditions,
  fetchConditionComparison,
  fetchConfusionPairs,
  fetchUserConfusions,
  trackConfusionPair,
  generateComparison,
  getSeverityColor,
  getSeverityBgColor,
  formatFieldValue,
  valuesAreDifferent,
  getCategoryLabel,
  groupFieldsByCategory,
};
