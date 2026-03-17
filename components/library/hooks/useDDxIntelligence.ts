/**
 * useDDxIntelligence - Hook for intelligent DDx features
 *
 * Provides:
 * - Smart suggestions based on FSRS mastery
 * - Confusion pattern detection
 * - Diagnostic workup algorithms
 * - Related condition fetching
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';

// Types
export interface SmartSuggestion {
  conditionId: string;
  conditionName: string;
  system: string;
  reason: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  context: {
    type: 'weakness' | 'confusion' | 'similar' | 'complication' | 'mastery_gap';
    details: string;
    actionable: string;
  };
  relatedConditionId?: string;
  panceYield?: number;
  masteryLevel?: string;
}

export interface WorkupStep {
  order: number;
  action: 'test' | 'exam' | 'history' | 'decision';
  name: string;
  description?: string;
  branches?: Array<{
    result: string;
    nextSteps?: WorkupStep[];
    diagnosis?: string;
    urgency?: 'emergent' | 'urgent' | 'routine';
  }>;
  cost?: 'low' | 'medium' | 'high';
}

export interface WorkupData {
  complaint: string;
  category?: string;
  isEmergency: boolean;
  differentials: {
    all: string[];
    mustNotMiss: string[];
    mostCommon: string[];
    mostDangerous: string[];
  };
  workupAlgorithm: WorkupStep[];
  redFlags: string[];
  keyQuestions: string[];
  keyExamFindings: string[];
  scoringSystems: Array<{
    name: string;
    category: string;
    whenToUse?: string;
  }>;
  clinicalPearls: string[];
}

export interface RelatedCondition {
  id: string;
  name: string;
  displayName?: string;
  system: string;
  subcategory?: string;
  relationshipType: string;
  source: string;
}

export interface DDxIntelligenceState {
  suggestions: SmartSuggestion[];
  workup: WorkupData | null;
  relatedConditions: RelatedCondition[];
  isLoading: boolean;
  error: string | null;
  studyRecommendation: string | null;
  summary: {
    criticalCount: number;
    confusionBasedCount: number;
    masteryGapCount: number;
  } | null;
}

interface UseDDxIntelligenceOptions {
  /** Auto-fetch on mount */
  autoFetch?: boolean;
  /** Include workup algorithm */
  includeWorkup?: boolean;
  /** Maximum suggestions */
  limit?: number;
}

const API_BASE = '/api/ddx';

export function useDDxIntelligence(
  conditionId: string | null,
  options: UseDDxIntelligenceOptions = {}
) {
  const { autoFetch = true, includeWorkup = false, limit = 10 } = options;
  const { getToken, isSignedIn } = useAuth();

  const [state, setState] = useState<DDxIntelligenceState>({
    suggestions: [],
    workup: null,
    relatedConditions: [],
    isLoading: false,
    error: null,
    studyRecommendation: null,
    summary: null,
  });

  // Fetch smart suggestions
  const fetchSuggestions = useCallback(async () => {
    if (!conditionId) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add auth token if available
      if (isSignedIn) {
        const token = await getToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(
        `${API_BASE}/smart-suggest?conditionId=${conditionId}&limit=${limit}`,
        { headers }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch suggestions');
      }

      const data = (await response.json()) as {
        suggestions?: unknown[];
        studyRecommendation?: unknown;
        summary?: unknown;
      };

      setState((prev) => ({
        ...prev,
        suggestions: (data.suggestions || []) as SmartSuggestion[],
        studyRecommendation: (data.studyRecommendation ?? null) as string | null,
        summary: (data.summary ?? null) as DDxIntelligenceState['summary'],
        isLoading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      }));
    }
  }, [conditionId, isSignedIn, getToken, limit]);

  // Fetch workup algorithm
  const fetchWorkup = useCallback(async () => {
    if (!conditionId) return;

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const response = await fetch(`${API_BASE}/workup?conditionId=${conditionId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch workup');
      }

      const data = (await response.json()) as {
        complaint?: string;
        category?: string;
        isEmergency?: boolean;
        differentials?: Record<string, unknown>;
        workupAlgorithm?: unknown[];
        redFlags?: unknown[];
        keyQuestions?: unknown[];
        keyExamFindings?: unknown[];
        scoringSystems?: unknown[];
        clinicalPearls?: unknown[];
      };

      setState((prev) => ({
        ...prev,
        workup: {
          complaint: data.complaint ?? '',
          category: data.category,
          isEmergency: data.isEmergency ?? false,
          differentials: (data.differentials ?? {}) as WorkupData['differentials'],
          workupAlgorithm: (data.workupAlgorithm ?? []) as WorkupStep[],
          redFlags: (data.redFlags ?? []) as string[],
          keyQuestions: (data.keyQuestions ?? []) as string[],
          keyExamFindings: (data.keyExamFindings ?? []) as string[],
          scoringSystems: (data.scoringSystems ?? []) as WorkupData['scoringSystems'],
          clinicalPearls: (data.clinicalPearls ?? []) as string[],
        },
        isLoading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      }));
    }
  }, [conditionId]);

  // Fetch related conditions
  const fetchRelated = useCallback(async () => {
    if (!conditionId) return;

    try {
      const response = await fetch(`${API_BASE}/related?conditionId=${conditionId}&limit=10`);

      if (!response.ok) {
        throw new Error('Failed to fetch related conditions');
      }

      const data = (await response.json()) as { relatedConditions?: RelatedCondition[] };

      setState((prev) => ({
        ...prev,
        relatedConditions: data.relatedConditions || [],
      }));
    } catch (error) {
      console.error('Error fetching related conditions:', error);
    }
  }, [conditionId]);

  // Auto-fetch on conditionId change
  useEffect(() => {
    if (autoFetch && conditionId) {
      fetchSuggestions();
      fetchRelated();
      if (includeWorkup) {
        fetchWorkup();
      }
    }
  }, [conditionId, autoFetch, includeWorkup, fetchSuggestions, fetchRelated, fetchWorkup]);

  // Computed values
  const criticalSuggestions = useMemo(
    () => state.suggestions.filter((s) => s.priority === 'critical'),
    [state.suggestions]
  );

  const confusionSuggestions = useMemo(
    () => state.suggestions.filter((s) => s.context.type === 'confusion'),
    [state.suggestions]
  );

  const masteryGapSuggestions = useMemo(
    () => state.suggestions.filter((s) => s.context.type === 'mastery_gap'),
    [state.suggestions]
  );

  const hasCriticalConfusions = useMemo(
    () => criticalSuggestions.some((s) => s.context.type === 'confusion'),
    [criticalSuggestions]
  );

  // Get priority color for a suggestion
  const getPriorityColor = useCallback((priority: SmartSuggestion['priority']) => {
    switch (priority) {
      case 'critical':
        return 'text-data-fail bg-data-fail/10';
      case 'high':
        return 'text-data-provisional bg-data-provisional/10';
      case 'medium':
        return 'text-[var(--color-category-practice)] bg-[color-mix(in_srgb,var(--color-category-practice)_10%,transparent)]';
      case 'low':
        return 'text-[var(--color-text-muted)] bg-[color-mix(in_srgb,var(--color-text-[var(--color-text-muted)])_10%,transparent)]';
    }
  }, []);

  // Get context type icon name
  const getContextIcon = useCallback((type: SmartSuggestion['context']['type']) => {
    switch (type) {
      case 'confusion':
        return 'AlertTriangle';
      case 'similar':
        return 'GitCompare';
      case 'complication':
        return 'ArrowRight';
      case 'mastery_gap':
        return 'TrendingDown';
      case 'weakness':
        return 'Target';
      default:
        return 'Info';
    }
  }, []);

  return {
    // State
    ...state,

    // Computed
    criticalSuggestions,
    confusionSuggestions,
    masteryGapSuggestions,
    hasCriticalConfusions,

    // Actions
    fetchSuggestions,
    fetchWorkup,
    fetchRelated,
    refresh: () => {
      fetchSuggestions();
      fetchRelated();
      if (includeWorkup) fetchWorkup();
    },

    // Utilities
    getPriorityColor,
    getContextIcon,
  };
}

export default useDDxIntelligence;
