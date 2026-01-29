/**
 * ConfusionPairAlert - Shows user's personal confusion patterns
 *
 * Displays a warning when viewing a condition the user frequently confuses,
 * with distinguishing features from the database.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, ArrowLeftRight, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import {
  fetchUserConfusions,
  type UserConfusionPairSummary,
  getSeverityColor,
  getSeverityBgColor,
  generateComparison,
} from '@/services/domain';

interface ConfusionPairAlertProps {
  /** Current condition being viewed */
  conditionId?: string;
  conditionName?: string;
  /** Called when user wants to compare conditions */
  onCompare?: (conditionId1: string, conditionId2: string) => void;
  /** Compact mode (inline banner) */
  compact?: boolean;
}

export const ConfusionPairAlert: React.FC<ConfusionPairAlertProps> = ({
  conditionId,
  conditionName,
  onCompare,
  compact = false,
}) => {
  const { getToken, isSignedIn } = useAuth();
  const [confusionData, setConfusionData] = useState<UserConfusionPairSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [prefetchedKeys, setPrefetchedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isSignedIn || (!conditionId && !conditionName)) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const token = await getToken();
        if (!token) return;

        const data = await fetchUserConfusions(token, { limit: 10 });

        // Filter to only include pairs involving the current condition
        const relevantPairs = data.pairs.filter(
          (p) =>
            p.correctConditionId === conditionId ||
            p.selectedConditionId === conditionId ||
            p.correctCondition.toLowerCase().includes(conditionName?.toLowerCase() || '') ||
            p.selectedCondition.toLowerCase().includes(conditionName?.toLowerCase() || '')
        );

        setConfusionData(relevantPairs);
      } catch (error) {
        console.error('Failed to fetch confusion pairs:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    setIsDismissed(false);
  }, [conditionId, conditionName, isSignedIn, getToken]);

  useEffect(() => {
    if (!isSignedIn) return;
    const topPair = confusionData[0];
    if (!topPair || topPair.count <= 3) return;

    const correctId = topPair.correctConditionId;
    const selectedId = topPair.selectedConditionId;
    if (!correctId || !selectedId) return;

    const key = `${correctId}-${selectedId}`;
    if (prefetchedKeys.has(key)) return;

    const prefetch = async () => {
      try {
        const token = await getToken();
        await generateComparison([correctId, selectedId], token || undefined);
        setPrefetchedKeys((prev) => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });
      } catch (error) {
        console.warn('Failed to prefetch comparison for confusion pair', error);
      }
    };

    prefetch();
  }, [confusionData, getToken, isSignedIn, prefetchedKeys]);

  if (!isSignedIn || confusionData.length === 0 || isDismissed || isLoading) {
    return null;
  }

  const topPair = confusionData[0];
  // Guard against undefined - TypeScript doesn't narrow from length checks
  if (!topPair) return null;

  const severityColor = getSeverityColor(topPair.count);
  const severityBg = getSeverityBgColor(topPair.count);

  // Extract IDs safely for use in callbacks
  const correctConditionId = topPair.correctConditionId;
  const selectedConditionId = topPair.selectedConditionId;

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${severityBg}`}
      >
        <AlertTriangle className={`w-4 h-4 ${severityColor} flex-shrink-0`} />
        <span className="text-xs text-[var(--color-text-secondary)]">
          You've confused this with <strong>{topPair.selectedCondition}</strong> {topPair.count}x
        </span>
        {onCompare && correctConditionId && selectedConditionId && (
          <button
            onClick={() => onCompare(correctConditionId, selectedConditionId)}
            className="ml-auto text-xs text-[var(--color-accent)] hover:underline"
          >
            Compare
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className={`rounded-xl border overflow-hidden ${severityBg}`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3">
          <AlertTriangle className={`w-5 h-5 ${severityColor} flex-shrink-0`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              Frequent Confusion Pattern Detected
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              You've confused these conditions {topPair.count} times
            </p>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
            )}
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 rounded hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <X className="w-4 h-4 text-[var(--color-text-muted)]" />
          </button>
        </div>

        {/* Confusion Pair Display */}
        <div className="px-4 py-3 border-t border-[var(--color-border)]/50 bg-[var(--color-bg-primary)]/30">
          <div className="flex items-center justify-center gap-4">
            <div className="text-center flex-1">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {topPair.correctCondition}
              </p>
              <p className="text-[10px] text-[var(--color-data-pass)] uppercase tracking-wide mt-0.5">
                Correct
              </p>
            </div>

            <ArrowLeftRight className="w-6 h-6 text-[var(--color-text-muted)]" />

            <div className="text-center flex-1">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {topPair.selectedCondition}
              </p>
              <p className="text-[10px] text-[var(--color-data-fail)] uppercase tracking-wide mt-0.5">
                Confused For
              </p>
            </div>
          </div>
        </div>

        {/* Expanded: Last Occurred Info */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-[var(--color-border)]/50"
            >
              <div className="px-4 py-3 space-y-3">
                <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]/50">
                  <p className="text-xs font-semibold text-[var(--color-accent)] mb-1">
                    Last Occurred
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {new Date(topPair.lastOccurred).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Actions */}
        {onCompare && correctConditionId && selectedConditionId && (
          <div className="px-4 py-3 border-t border-[var(--color-border)]/50 flex gap-2">
            <button
              onClick={() => onCompare(correctConditionId, selectedConditionId)}
              className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Compare Side-by-Side
            </button>
          </div>
        )}

        {/* Other confusion pairs (if more than one) */}
        {confusionData.length > 1 && (
          <div className="px-4 py-2 border-t border-[var(--color-border)]/50 bg-[var(--color-bg-secondary)]/20">
            <p className="text-[10px] text-[var(--color-text-muted)]">
              +{confusionData.length - 1} more confusion patterns detected
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default ConfusionPairAlert;
