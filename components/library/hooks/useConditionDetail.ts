/**
 * useConditionDetail - Fetches full MedicalContent with relations for SmartConditionView
 *
 * GET /api/content/condition/{conditionId} returns full content including:
 * DrugConditionLink, FindingConditionLink, LabConditionLink, ImagingConditionLink,
 * ECGConditionLink, TreatmentConditionLink, other_MedicalContent
 */

import { useState, useEffect, useCallback } from 'react';
import { normalizeMedicalContent } from '@/lib/utils/normalization';

export interface ConditionDetailData {
  id: string;
  conditionId: string;
  condition: string;
  system: string;
  subcategory?: string | null;
  parent_category?: string | null;
  overview?: string | null;
  etiology?: string | null;
  pathophysiology?: string | null;
  epidemiology?: string | null;
  symptoms?: string | null;
  physicalExam?: string | null;
  diagnostics?: string | null;
  treatment?: string | null;
  prognosis?: string | null;
  differentialDiagnosis?: string | null;
  riskFactors?: string | null;
  complications?: string | null;
  pance_yield?: number | null;
  synonyms?: unknown;
  buzzwords?: string[];
  classic_triad?: unknown;
  clinical_pearls?: unknown;
  differentials?: unknown;
  mnemonic?: string | null;
  relatedSystems?: string[];
  best_initial_test?: string | null;
  gold_standard_dx?: string | null;
  first_line_rx?: string | null;
  age_demographic?: unknown;
  gender_bias?: string | null;
  classic_patient?: string | null;
  disposition?: string | null;
  patient_education?: string | null;
  prevention?: string | null;
  content?: unknown;
  DrugConditionLink?: Array<{
    id: string;
    relationshipType: string;
    isFirstLine: boolean;
    Drug?: {
      id: string;
      genericName: string;
      brandName?: string | null;
      drugClass?: string | null;
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
  LabConditionLink?: Array<{
    id: string;
    relationshipType: string;
    expectedResult?: string | null;
    significance?: string | null;
    LabTest?: { id: string; name: string; displayName?: string | null; category: string };
  }>;
  ImagingConditionLink?: Array<{
    id: string;
    relationshipType: string;
    classicFindings?: string | null;
    expectedFindings?: string[];
    ImagingStudy?: {
      id: string;
      name: string;
      displayName?: string | null;
      modality?: string | null;
      bodyRegion?: string | null;
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

interface UseConditionDetailResult {
  data: ConditionDetailData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useConditionDetail(
  conditionId: string | null | undefined
): UseConditionDetailResult {
  const [data, setData] = useState<ConditionDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!conditionId) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/content/condition/${encodeURIComponent(conditionId)}`);
      const json = (await res.json()) as { data?: Record<string, unknown>; error?: string };

      if (!res.ok) {
        const errMsg =
          json?.error ??
          (json?.data?.error as string) ??
          `Failed to load condition (${res.status})`;
        setError(errMsg);
        setData(null);
        return;
      }

      const raw = json?.data ?? json;
      if (!raw || (typeof raw === 'object' && 'error' in raw)) {
        setError(
          raw && typeof raw === 'object' && 'error' in raw
            ? String((raw as { error: unknown }).error)
            : 'Condition not found'
        );
        setData(null);
        return;
      }

      const normalized = normalizeMedicalContent(
        raw as Record<string, unknown>
      ) as unknown as ConditionDetailData;
      setData(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch condition');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [conditionId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return { data, isLoading, error, refetch: fetchDetail };
}
