/**
 * Key Differences Comparison Table
 *
 * Dynamically displays contrastive learning points between highly confused conditions
 * (e.g., Crohn's vs UC). Uses smart-suggest for confused conditions, then compare API.
 * Stormy Slate theme, mobile-responsive.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { GitCompare } from 'lucide-react';
import { ClinicalSkeleton } from '@/components/loading';
import { getApiEndpoint } from '@/lib/utils/apiConfig';
import { CONFUSION_PAIRS } from '@/lib/metacognition';

interface ConditionData {
  id: string;
  conditionId?: string;
  condition: string;
  [key: string]: unknown;
}

interface ComparisonField {
  key: string;
  label: string;
  category: string;
  isLinkedEntity?: boolean;
}

interface CompareApiResponse {
  conditions: ConditionData[];
  comparisonFields: ComparisonField[];
}

interface SmartSuggestion {
  conditionId: string;
  conditionName: string;
  context: { type: string };
}

interface KeyDifferencesTableProps {
  conditionId: string;
  conditionName: string;
  getToken?: () => Promise<string | null>;
}

function formatValue(val: unknown): string {
  if (val == null) return '—';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    if (val.length === 0) return '—';
    return val
      .map((v) =>
        typeof v === 'object' && v !== null && 'name' in v
          ? (v as { name: string }).name
          : typeof v === 'object'
            ? JSON.stringify(v)
            : String(v)
      )
      .join(', ');
  }
  if (typeof val === 'object') {
    const arr = (val as unknown[]).map((v) =>
      typeof v === 'object' && v !== null && 'name' in v
        ? (v as { name: string }).name
        : String(v)
    );
    return arr.length > 0 ? arr.join(', ') : '—';
  }
  return String(val);
}

function findStaticPair(conditionName: string): (typeof CONFUSION_PAIRS)[0] | null {
  const lower = conditionName.toLowerCase();
  for (const pair of CONFUSION_PAIRS) {
    if (
      pair.condition1.toLowerCase().includes(lower) ||
      pair.condition2.toLowerCase().includes(lower) ||
      lower.includes(pair.condition1.toLowerCase()) ||
      lower.includes(pair.condition2.toLowerCase())
    ) {
      return pair;
    }
  }
  return null;
}

export function KeyDifferencesTable({
  conditionId,
  conditionName,
  getToken,
}: KeyDifferencesTableProps) {
  const [data, setData] = useState<CompareApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staticPair, setStaticPair] = useState<(typeof CONFUSION_PAIRS)[0] | null>(null);

  const fetchComparison = useCallback(async () => {
    if (!conditionId) return;
    setLoading(true);
    setError(null);
    setData(null);
    setStaticPair(findStaticPair(conditionName));

    try {
      const token = getToken ? await getToken() : null;
      const baseUrl = getApiEndpoint('');

      // Resolve conditionId (slug) to MedicalContent.id via content/condition/details
      let medicalContentId = conditionId;
      try {
        const detailsRes = await fetch(
          getApiEndpoint(`/api/content/condition/${encodeURIComponent(conditionId)}/details`),
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (detailsRes.ok) {
          const json = (await detailsRes.json()) as { data?: { id?: string } };
          if (json?.data?.id) medicalContentId = json.data.id;
        }
      } catch {
        // Fallback to conditionId (may work if it's already an id)
      }

      // 1. Get confused conditions from smart-suggest
      const suggestRes = await fetch(
        `${baseUrl}/api/ddx/smart-suggest?conditionId=${encodeURIComponent(medicalContentId)}&limit=3`
      );
      const suggestData = (await suggestRes.json()) as {
        data?: { suggestions?: SmartSuggestion[] };
      };
      const suggestions = suggestData?.data?.suggestions ?? [];

      const topSuggestion = suggestions.find(
        (s) => s.context?.type === 'confusion' || s.context?.type === 'similar'
      );
      if (!topSuggestion) {
        setLoading(false);
        return;
      }

      const ids = [medicalContentId, topSuggestion.conditionId].filter(Boolean);
      if (ids.length < 2) {
        setLoading(false);
        return;
      }

      const compareRes = await fetch(
        `${baseUrl}/api/ddx/compare?ids=${ids.map(encodeURIComponent).join(',')}`
      );
      if (!compareRes.ok) {
        setError('Failed to load comparison');
        setLoading(false);
        return;
      }

      const compareData = (await compareRes.json()) as { data?: CompareApiResponse };
      setData(compareData?.data ?? null);
    } catch {
      setError('Failed to load key differences');
    } finally {
      setLoading(false);
    }
  }, [conditionId, conditionName, getToken]);

  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  if (loading) {
    return (
      <section className="mb-8" aria-label="Key differences">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0" />
          Key Differences
        </h2>
        <ClinicalSkeleton variant="default" lines={6} className="rounded-xl" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="mb-8" aria-label="Key differences">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0" />
          Key Differences
        </h2>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">{error}</p>
        </div>
      </section>
    );
  }

  if (!data || data.conditions.length < 2) {
    if (staticPair) {
      const other =
        staticPair.condition1.toLowerCase().includes(conditionName.toLowerCase())
          ? staticPair.condition2
          : staticPair.condition1;
      return (
        <section className="mb-8" aria-label="Key differences">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0" />
            Key Differences: {conditionName} vs {other}
          </h2>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden">
            <div className="p-4 space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                  Distinguishing Feature
                </h3>
                <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                  {staticPair.distinguishingFeature}
                </p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                  Clinical Pearl
                </h3>
                <p className="text-sm text-[var(--color-text-primary)] leading-relaxed italic">
                  {staticPair.clinicalPearl}
                </p>
              </div>
            </div>
          </div>
        </section>
      );
    }
    return (
      <section className="mb-8" aria-label="Key differences">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0" />
          Key Differences
        </h2>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            No highly confused conditions found. Review differentials in the content above.
          </p>
        </div>
      </section>
    );
  }

  const condA = data.conditions[0];
  const condB = data.conditions[1];
  if (!condA || !condB) {
    return (
      <section className="mb-8" aria-label="Key differences">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0" />
          Key Differences
        </h2>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            No highly confused conditions found. Review differentials in the content above.
          </p>
        </div>
      </section>
    );
  }

  const nameA = (condA.condition ?? condA.conditionId ?? 'Condition A') as string;
  const nameB = (condB.condition ?? condB.conditionId ?? 'Condition B') as string;

  const fields = (data.comparisonFields ?? []).filter(
    (f) => !f.isLinkedEntity || (condA[f.key] != null || condB[f.key] != null)
  );

  return (
    <section className="mb-8" aria-label="Key differences">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
        <GitCompare className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0" />
        Key Differences: {nameA} vs {nameB}
      </h2>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden">
        <div className="overflow-x-auto" style={{ minWidth: 0 }}>
          <table className="w-full min-w-[600px] border-collapse border-[var(--color-border)]">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide p-4 bg-[var(--color-bg-tertiary)] border-[var(--color-border)]">
                  Attribute
                </th>
                <th className="text-left text-xs font-semibold text-[var(--color-text-primary)] p-4 bg-[var(--color-bg-tertiary)] border-[var(--color-border)]">
                  {nameA}
                </th>
                <th className="text-left text-xs font-semibold text-[var(--color-text-primary)] p-4 bg-[var(--color-bg-tertiary)] border-[var(--color-border)]">
                  {nameB}
                </th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => {
                const valA = condA[field.key];
                const valB = condB[field.key];
                const strA = formatValue(valA);
                const strB = formatValue(valB);
                if (strA === '—' && strB === '—') return null;
                return (
                  <tr
                    key={field.key}
                    className="border-b border-[var(--color-border)] last:border-b-0"
                  >
                    <td className="text-xs font-medium text-[var(--color-text-muted)] p-4 align-top">
                      {field.label}
                    </td>
                    <td className="text-sm text-[var(--color-text-primary)] p-4 align-top">
                      {strA}
                    </td>
                    <td className="text-sm text-[var(--color-text-primary)] p-4 align-top">
                      {strB}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
