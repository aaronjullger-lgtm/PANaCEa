/**
 * Confusion Analysis Service
 *
 * Tracks which conditions users most frequently confuse with each other.
 * Supports the "Confusion Matrix" analytics feature that helps identify
 * knowledge gaps and similar-presentation conditions.
 *
 * @architecture Database-First: All confusion data stored in PostgreSQL
 * @integration Used by components/analytics/ConfusionMatrix.tsx
 */

import { getAuthHeaders } from '@/lib/utils';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface UserConfusionPairSummary {
  id: string;
  correctConditionId: string;
  selectedConditionId: string;
  correctCondition: string;
  selectedCondition: string;
  count: number;
  lastOccurred: Date | string;
}

export interface ConfusionPair {
  id: string;
  correctConditionId: string;
  selectedConditionId: string;
  correctCondition: string;
  selectedCondition: string;
  count: number;
  lastOccurred: Date | string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface ComparisonField {
  key: string;
  label: string;
  correct: string | string[];
  selected: string | string[];
  category?: string;
}

export interface DeepConditionData {
  id: string;
  name: string;
  system: string;
  subcategory?: string;
  buzzwords: string[];
  keyFindings: string[];
  diagnosticApproach: string[];
  treatment: string[];
  complications: string[];
  prognosis?: string;
  differentials?: string[];
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Fetch user's confusion pairs from the server
 * @param token - Authentication token
 * @param options - Query options (limit)
 */
export async function fetchUserConfusions(
  token: string,
  options: { limit: number }
): Promise<{ pairs: UserConfusionPairSummary[] }> {
  const headers = getAuthHeaders(token);
  const response = await fetch(`/api/user/confusion?limit=${options.limit}`, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch confusion pairs: ${response.statusText}`);
  }

  const data = await response.json();
  return { pairs: data.data?.pairs || [] };
}

/**
 * Generate comparison data between two confused conditions
 * @param ids - Array of two condition IDs [correctId, selectedId]
 * @param token - Optional authentication token
 */
export async function generateComparison(ids: string[], token?: string): Promise<any> {
  if (ids.length < 2) {
    throw new Error('Two condition IDs required for comparison');
  }

  const headers = token ? getAuthHeaders(token) : {};
  const response = await fetch(`/api/ddx/comparison?correctId=${ids[0]}&selectedId=${ids[1]}`, {
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to generate comparison: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data?.comparison;
}

/**
 * Fetch all confusion pairs (admin view)
 */
export async function fetchConfusionPairs(): Promise<ConfusionPair[]> {
  const response = await fetch('/api/analytics/confusion-pairs');

  if (!response.ok) {
    throw new Error(`Failed to fetch confusion pairs: ${response.statusText}`);
  }

  const data = await response.json();
  return data.pairs || [];
}

/**
 * Fetch detailed comparison between two conditions
 * @param correctId - ID of the correct condition
 * @param selectedId - ID of the incorrectly selected condition
 */
export async function fetchConditionComparison(
  correctId: string,
  selectedId: string
): Promise<{
  correct: DeepConditionData;
  selected: DeepConditionData;
  fields: ComparisonField[];
}> {
  const response = await fetch(
    `/api/analytics/condition-comparison?correct=${correctId}&selected=${selectedId}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch condition comparison: ${response.statusText}`);
  }

  return response.json();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get severity color for confusion count
 * @param count - Number of times this confusion occurred
 */
export function getSeverityColor(count: number): string {
  if (count >= 10) return 'text-status-danger';
  if (count >= 5) return 'text-status-warning';
  if (count >= 3) return 'text-status-info';
  return 'text-action-muted';
}

/**
 * Get severity background color for confusion count
 * @param count - Number of times this confusion occurred
 */
export function getSeverityBgColor(count: number): string {
  if (count >= 10) return 'bg-status-danger/10';
  if (count >= 5) return 'bg-status-warning/10';
  if (count >= 3) return 'bg-status-info/10';
  return 'bg-action-muted/5';
}

/**
 * Format field value for display in comparison view
 * @param value - Field value (string or array)
 */
export function formatFieldValue(value: string | string[]): string {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return value || '—';
}

/**
 * Group comparison fields by category
 * @param fields - Array of comparison fields
 */
export function groupFieldsByCategory(
  fields: ComparisonField[]
): Record<string, ComparisonField[]> {
  return fields.reduce(
    (acc, field) => {
      const category = field.category || 'General';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(field);
      return acc;
    },
    {} as Record<string, ComparisonField[]>
  );
}

/**
 * Get human-readable category label
 * @param category - Category key
 */
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    General: 'General Information',
    Clinical: 'Clinical Presentation',
    Diagnostics: 'Diagnostic Approach',
    Treatment: 'Treatment & Management',
    Complications: 'Complications & Prognosis',
  };
  return labels[category] || category;
}
