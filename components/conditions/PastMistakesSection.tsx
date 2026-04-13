/**
 * Past Mistakes Section
 *
 * Displays previous questions the user got wrong for this condition,
 * with their wrong answer next to the correct rationale.
 * Loads from GET /api/conditions/:conditionId/past-mistakes.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { ClinicalSkeleton } from '@/components/loading';
import { getApiEndpoint } from '@/lib/utils/apiConfig';

interface PastMistakeItem {
  questionId: string;
  questionStub: string;
  userAnswer: string;
  correctRationale: string;
  createdAt: string;
}

interface PastMistakesSectionProps {
  conditionId: string;
  getToken: () => Promise<string | null>;
}

export function PastMistakesSection({ conditionId, getToken }: PastMistakesSectionProps) {
  const [items, setItems] = useState<PastMistakeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchPastMistakes = useCallback(async () => {
    if (!conditionId) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setItems([]);
        return;
      }
      const url = getApiEndpoint(
        `/api/conditions/${encodeURIComponent(conditionId)}/past-mistakes?limit=10`
      );
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = (await res.json()) as { data?: { items?: PastMistakeItem[] } };
        setItems(json.data?.items ?? []);
      } else {
        setItems([]);
        const err = await res.json().catch(() => ({}));
        setError((err as { error?: string }).error ?? 'Failed to load past mistakes');
      }
    } catch {
      setItems([]);
      setError('Failed to load past mistakes');
    } finally {
      setLoading(false);
    }
  }, [conditionId, getToken]);

  useEffect(() => {
    fetchPastMistakes();
  }, [fetchPastMistakes]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <section className="mb-8" aria-label="Past mistakes">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0" />
          Past Mistakes
        </h2>
        <div className="space-y-4">
          <ClinicalSkeleton variant="default" lines={4} className="rounded-xl" />
          <ClinicalSkeleton variant="default" lines={3} className="rounded-xl" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mb-8" aria-label="Past mistakes">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0" />
          Past Mistakes
        </h2>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">{error}</p>
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="mb-8" aria-label="Past mistakes">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0" />
          Past Mistakes
        </h2>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            No past mistakes for this condition yet. Keep practicing to track your weak spots.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8" aria-label="Past mistakes">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0" />
        Past Mistakes
      </h2>
      <div className="space-y-4">
        {items.map((item) => {
          const isExpanded = expanded.has(item.questionId);
          const rationaleLong = item.correctRationale.length > 200;
          return (
            <div
              key={item.questionId}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden"
            >
              <div className="p-4 space-y-3">
                <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                  {item.questionStub}
                </p>
                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                      Your answer
                    </span>
                    <p className="text-sm font-medium text-[var(--color-data-fail)] bg-[var(--color-bg-tertiary)]/50 rounded-lg px-3 py-2 mt-1 border border-[var(--color-border)]/30">
                      {item.userAnswer}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                      Correct rationale
                    </span>
                    <div className="mt-1">
                      {rationaleLong && !isExpanded ? (
                        <>
                          <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                            {item.correctRationale.slice(0, 200)}...
                          </p>
                          <button
                            type="button"
                            onClick={() => toggleExpand(item.questionId)}
                            aria-expanded={isExpanded}
                            className="flex items-center gap-1 mt-2 text-sm font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors min-h-[44px] min-w-[44px]"
                          >
                            <ChevronDown className="w-4 h-4" />
                            Show more
                          </button>
                        </>
                      ) : rationaleLong && isExpanded ? (
                        <>
                          <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                            {item.correctRationale}
                          </p>
                          <button
                            type="button"
                            onClick={() => toggleExpand(item.questionId)}
                            aria-expanded={isExpanded}
                            className="flex items-center gap-1 mt-2 text-sm font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors min-h-[44px] min-w-[44px]"
                          >
                            <ChevronUp className="w-4 h-4" />
                            Show less
                          </button>
                        </>
                      ) : (
                        <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                          {item.correctRationale}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
