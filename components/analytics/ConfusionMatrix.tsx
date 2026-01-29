import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { AlertTriangle, ArrowRightLeft, Loader2, Sparkles } from 'lucide-react';
import {
  fetchUserConfusions,
  generateComparison,
  type UserConfusionPairSummary,
} from '@/services/domain';

interface ConfusionMatrixProps {
  limit?: number;
  onCompare?: (conditionIds: string[]) => void;
}

export const ConfusionMatrix: React.FC<ConfusionMatrixProps> = ({ limit = 10, onCompare }) => {
  const { getToken, isSignedIn } = useAuth();
  const [pairs, setPairs] = useState<UserConfusionPairSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefetchingId, setPrefetchingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = await getToken();
        if (!token) throw new Error('Auth token missing');
        const data = await fetchUserConfusions(token, { limit });
        setPairs(data.pairs);
      } catch (err: any) {
        setError(err?.message || 'Failed to load confusion pairs');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [getToken, isSignedIn, limit]);

  const rankedPairs = useMemo(
    () => [...pairs].sort((a, b) => b.count - a.count).slice(0, limit),
    [pairs, limit]
  );

  const handleCompare = async (pair: UserConfusionPairSummary) => {
    const ids = [pair.correctConditionId, pair.selectedConditionId].filter(Boolean) as string[];
    if (ids.length < 2) return;

    try {
      setPrefetchingId(pair.id);
      const token = await getToken();
      await generateComparison(ids, token || undefined);
      onCompare?.(ids);
    } catch (err) {
      console.error('Failed to generate comparison', err);
    } finally {
      setPrefetchingId(null);
    }
  };

  if (!isSignedIn) return null;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-[var(--color-warning)]" />
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            Top Confusion Pairs
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Most common wrong selections you make
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading confusion data...
        </div>
      )}

      {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}

      {!isLoading && !error && rankedPairs.length === 0 && (
        <p className="text-xs text-[var(--color-text-muted)]">
          No confusion patterns detected yet.
        </p>
      )}

      {!isLoading && rankedPairs.length > 0 && (
        <div className="space-y-2">
          {rankedPairs.map((pair) => (
            <div
              key={pair.id}
              className="flex items-center gap-3 rounded-lg border border-[var(--color-border)]/70 bg-[var(--color-bg-secondary)]/50 px-3 py-2"
            >
              <div className="flex flex-1 items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-[var(--color-text-muted)]" />
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {pair.correctCondition}{' '}
                    <span className="text-[10px] text-[var(--color-success)] ml-1">correct</span>
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    confused for{' '}
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {pair.selectedCondition}
                    </span>
                  </p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    {pair.count}x •{' '}
                    {pair.lastOccurred
                      ? new Date(pair.lastOccurred).toLocaleDateString()
                      : 'recent'}
                  </p>
                </div>
              </div>
              {pair.correctConditionId && pair.selectedConditionId && (
                <button
                  onClick={() => handleCompare(pair)}
                  className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-[var(--color-text-inverse)] shadow-sm transition hover:opacity-90"
                  disabled={prefetchingId === pair.id}
                >
                  {prefetchingId === pair.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  Compare
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConfusionMatrix;
