/**
 * useSmartCondition – Smart Data Layer for SmartConditionView
 *
 * Fetches summary on mount (fast), details on demand via fetchDetails().
 * Use with GET /api/content/condition/:conditionId/summary and .../details.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

export interface ConfusedWithItem {
  id: string;
  conditionId: string;
  condition: string;
}

export interface ConditionSummary {
  id: string;
  condition: string;
  conditionId: string;
  system: string;
  pance_yield: number | null;
  buzzwords: string[];
  synonyms: unknown;
  classic_triad: unknown;
  clinical_pearls: unknown;
  mnemonic: string | null;
  confusedWith: ConfusedWithItem[];
}

export interface ConditionDetails {
  id: string;
  conditionId: string;
  condition: string;
  system: string;
  subcategory: string | null;
  parent_category: string | null;
  symptoms: string | null;
  physicalExam: string | null;
  treatment: string | null;
  diagnostics: string | null;
  overview: string | null;
  pathophysiology: string | null;
  etiology: string | null;
  epidemiology: string | null;
  prognosis: string | null;
  differentialDiagnosis: string | null;
  riskFactors: string | null;
  complications: string | null;
  best_initial_test: string | null;
  gold_standard_dx: string | null;
  first_line_rx: string | null;
  disposition: string | null;
  patient_education: string | null;
  prevention: string | null;
  age_demographic: unknown;
  gender_bias: string | null;
  classic_patient: string | null;
  differentials: unknown;
  LabConditionLink: Array<{
    id: string;
    relationshipType: string;
    expectedResult?: string | null;
    significance?: string | null;
    LabTest?: { id: string; name: string; displayName?: string | null; category: string };
  }>;
  ImagingConditionLink: Array<{
    id: string;
    relationshipType: string;
    classicFindings?: string | null;
    ImagingStudy?: {
      id: string;
      name: string;
      displayName?: string | null;
      modality: string;
      bodyRegion: string | null;
    };
  }>;
  DrugConditionLink: Array<{
    id: string;
    relationshipType: string;
    isFirstLine: boolean;
    Drug?: {
      id: string;
      genericName: string;
      brandName?: string | null;
      drugClass: string[];
    };
  }>;
  FindingConditionLink?: Array<{
    id: string;
    relationshipType: string;
    clinicalContext?: string | null;
    PhysicalExamFinding?: {
      id: string;
      name: string;
      displayName?: string | null;
      category: string;
      system?: string | null;
    };
  }>;
  ECGConditionLink?: Array<{
    id: string;
    relationshipType: string;
    findingDescription?: string | null;
    ECGPattern?: { id: string; name: string; displayName?: string | null; category: string };
  }>;
  TreatmentConditionLink?: Array<{
    id: string;
    relationshipType: string;
    isFirstLine: boolean;
    notes?: string | null;
    Treatment?: { id: string; name: string; displayName?: string | null; category: string };
  }>;
  other_MedicalContent?: Array<{
    id: string;
    conditionId: string;
    condition: string;
    system: string;
  }>;
}

export interface UseSmartConditionResult {
  summary: ConditionSummary | null;
  details: ConditionDetails | null;
  isLoadingSummary: boolean;
  isLoadingDetails: boolean;
  errorSummary: string | null;
  errorDetails: string | null;
  fetchDetails: () => Promise<void>;
  refetchSummary: () => Promise<void>;
}

export function useSmartCondition(conditionId: string | null | undefined): UseSmartConditionResult {
  const { getToken } = useAuth();
  const [summary, setSummary] = useState<ConditionSummary | null>(null);
  const [details, setDetails] = useState<ConditionDetails | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [errorSummary, setErrorSummary] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!conditionId) {
      setSummary(null);
      setIsLoadingSummary(false);
      setErrorSummary(null);
      return;
    }
    setIsLoadingSummary(true);
    setErrorSummary(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/content/condition/${encodeURIComponent(conditionId)}/summary`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
      });
      const json = (await res.json()) as { data?: Record<string, unknown>; error?: string };
      if (!res.ok) {
        const safeMsg = res.status === 404
          ? 'Condition information not found.'
          : res.status === 401
            ? 'Your session has expired. Please sign in again.'
            : 'Unable to load condition summary. Please try again.';
        setErrorSummary(safeMsg);
        setSummary(null);
        return;
      }
      const data = json?.data ?? json;
      if (data && typeof data === 'object' && 'error' in data) {
        setErrorSummary('Unable to load condition summary. Please try again.');
        setSummary(null);
        return;
      }
      setSummary(data as unknown as ConditionSummary);
    } catch (err) {
      void err;
      setErrorSummary('Unable to load condition summary. Please try again.');
      setSummary(null);
    } finally {
      setIsLoadingSummary(false);
    }
  }, [conditionId, getToken]);

  const fetchDetails = useCallback(async () => {
    if (!conditionId) return;
    setIsLoadingDetails(true);
    setErrorDetails(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/content/condition/${encodeURIComponent(conditionId)}/details`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
      });
      const json = (await res.json()) as { data?: Record<string, unknown>; error?: string };
      if (!res.ok) {
        const safeMsg = res.status === 404
          ? 'Condition details not found.'
          : res.status === 401
            ? 'Your session has expired. Please sign in again.'
            : 'Unable to load full condition details. Please try again.';
        setErrorDetails(safeMsg);
        setDetails(null);
        return;
      }
      const data = json?.data ?? json;
      if (data && typeof data === 'object' && 'error' in data) {
        setErrorDetails('Unable to load full condition details. Please try again.');
        setDetails(null);
        return;
      }
      setDetails(data as unknown as ConditionDetails);
    } catch (err) {
      void err;
      setErrorDetails('Unable to load full condition details. Please try again.');
      setDetails(null);
    } finally {
      setIsLoadingDetails(false);
    }
  }, [conditionId, getToken]);

  useEffect(() => {
    fetchSummary();
    setDetails(null);
    setErrorDetails(null);
  }, [fetchSummary]);

  return {
    summary,
    details,
    isLoadingSummary,
    isLoadingDetails,
    errorSummary,
    errorDetails,
    fetchDetails,
    refetchSummary: fetchSummary,
  };
}
