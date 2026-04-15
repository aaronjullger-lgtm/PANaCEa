/**
 * ContextWidget - Displays related context for a condition
 *
 * Types:
 * - 'pharm': Related pharmacology (drugs, treatment)
 * - 'physio': Related pathophysiology (mechanism, related conditions)
 */

import React, { useEffect, useState } from 'react';
import { Pill, Activity, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import ReactMarkdown from 'react-markdown';

interface ContextWidgetProps {
  conditionId: string;
  type: 'pharm' | 'physio';
}

export const ContextWidget: React.FC<ContextWidgetProps> = ({ conditionId, type }) => {
  const { getToken, isSignedIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchContext = async () => {
      if (!isSignedIn) {
        setError('Please sign in to view this content');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const token = await getToken();
        const response = await fetch(
          `/api/content/context-widgets?conditionId=${conditionId}&type=${type}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch context: ${response.status}`);
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Error fetching context widget:', err);
        setError(err instanceof Error ? err.message : 'Failed to load context');
      } finally {
        setLoading(false);
      }
    };

    if (conditionId) {
      fetchContext();
    }
  }, [conditionId, type, getToken, isSignedIn]);

  const icon = type === 'pharm' ? Pill : Activity;
  const Icon = icon;
  const title = type === 'pharm' ? 'Pharmacology' : 'Pathophysiology';
  const iconColor = type === 'pharm' ? 'var(--color-data-pass)' : 'var(--color-accent)';

  if (loading) {
    return (
      <div className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="w-5 h-5" style={{ color: iconColor }} />
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-muted)]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="w-5 h-5" style={{ color: iconColor }} />
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h3>
        </div>
        <div className="flex items-center gap-2 text-data-fail">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5" style={{ color: iconColor }} />
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h3>
      </div>

      <div className="space-y-4">
        {type === 'pharm' && data && (
          <>
            {/* Treatment */}
            {data.treatment && (
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                  Treatment Approach
                </h4>
                <div className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  {typeof data.treatment === 'string' ? (
                    <ReactMarkdown>{data.treatment}</ReactMarkdown>
                  ) : (
                    <pre className="text-xs">{JSON.stringify(data.treatment, null, 2)}</pre>
                  )}
                </div>
              </div>
            )}

            {/* Related Drugs */}
            {data.relatedDrugs && data.relatedDrugs.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                  Related Medications
                </h4>
                <div className="space-y-2">
                  {data.relatedDrugs.map((drug: any) => (
                    <div key={drug.id} className="bg-[var(--color-bg-secondary)] rounded-lg p-3">
                      <div className="font-medium text-sm text-[var(--color-text-primary)]">
                        {drug.name}
                      </div>
                      {drug.drugClass && (
                        <div className="text-xs text-[var(--color-text-muted)] mt-1">
                          {drug.drugClass}
                        </div>
                      )}
                      {drug.mechanism && (
                        <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                          {drug.mechanism}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!data.treatment && (!data.relatedDrugs || data.relatedDrugs.length === 0) && (
              <p className="text-sm text-[var(--color-text-muted)] italic">
                No pharmacology data available for this condition.
              </p>
            )}
          </>
        )}

        {type === 'physio' && data && (
          <>
            {/* Pathophysiology */}
            {data.pathophysiology && (
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                  Mechanism
                </h4>
                <div className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  <ReactMarkdown>{data.pathophysiology}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Related Conditions */}
            {data.relatedConditions && data.relatedConditions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                  Related Conditions
                </h4>
                <div className="space-y-2">
                  {data.relatedConditions.map((condition: any) => (
                    <div
                      key={condition.id}
                      className="bg-[var(--color-bg-secondary)] rounded-lg p-3 hover:bg-[var(--color-border)] transition-colors cursor-pointer"
                    >
                      <div className="font-medium text-sm text-[var(--color-text-primary)]">
                        {condition.condition}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!data.pathophysiology &&
              (!data.relatedConditions || data.relatedConditions.length === 0) && (
                <p className="text-sm text-[var(--color-text-muted)] italic">
                  No pathophysiology data available for this condition.
                </p>
              )}
          </>
        )}
      </div>
    </div>
  );
};
