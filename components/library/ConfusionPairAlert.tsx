/**
 * ConfusionPairAlert - Shows user's personal confusion patterns
 * 
 * Displays a warning when viewing a condition the user frequently confuses,
 * with distinguishing features from the database.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, ArrowLeftRight, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { fetchConfusionPairs, type ConfusionPair, getSeverityColor, getSeverityBgColor } from '@/services/ddxService';

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
  const [confusionData, setConfusionData] = useState<ConfusionPair[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (!isSignedIn || (!conditionId && !conditionName)) return;
    
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const token = await getToken();
        if (!token) return;
        
        const data = await fetchConfusionPairs(token, {
          conditionId,
          limit: 5,
          minCount: 2,
        });
        
        // Filter to only include pairs involving the current condition
        const relevantPairs = data.confusionPairs.filter(
          p => p.realConditionData?.id === conditionId ||
               p.mistakenConditionData?.id === conditionId ||
               p.realCondition.toLowerCase().includes(conditionName?.toLowerCase() || '') ||
               p.mistakenFor.toLowerCase().includes(conditionName?.toLowerCase() || '')
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

  if (!isSignedIn || confusionData.length === 0 || isDismissed || isLoading) {
    return null;
  }

  const topPair = confusionData[0];
  const severityColor = getSeverityColor(topPair.severity);
  const severityBg = getSeverityBgColor(topPair.severity);

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
          You've confused this with <strong>{topPair.mistakenFor}</strong> {topPair.count}x
        </span>
        {onCompare && topPair.mistakenConditionData && (
          <button
            onClick={() => onCompare(topPair.realConditionData!.id, topPair.mistakenConditionData!.id)}
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
                {topPair.realCondition}
              </p>
              <p className="text-[10px] text-green-500 uppercase tracking-wide mt-0.5">
                Correct
              </p>
            </div>
            
            <ArrowLeftRight className="w-6 h-6 text-[var(--color-text-muted)]" />
            
            <div className="text-center flex-1">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {topPair.mistakenFor}
              </p>
              <p className="text-[10px] text-red-500 uppercase tracking-wide mt-0.5">
                Confused For
              </p>
            </div>
          </div>
        </div>

        {/* Expanded: Key Differences */}
        <AnimatePresence>
          {isExpanded && topPair.keyDifferences && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-[var(--color-border)]/50"
            >
              <div className="px-4 py-3 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                  <Lightbulb className="w-3 h-3" />
                  Key Differences
                </div>
                
                {/* Classic Patient */}
                {topPair.keyDifferences.classicPatient?.real !== topPair.keyDifferences.classicPatient?.mistaken && (
                  <DifferenceRow
                    label="Classic Patient"
                    valueA={topPair.keyDifferences.classicPatient?.real}
                    valueB={topPair.keyDifferences.classicPatient?.mistaken}
                    labelA={topPair.realCondition}
                    labelB={topPair.mistakenFor}
                  />
                )}
                
                {/* Gold Standard Dx */}
                {topPair.keyDifferences.goldStandardDx?.real !== topPair.keyDifferences.goldStandardDx?.mistaken && (
                  <DifferenceRow
                    label="Gold Standard Dx"
                    valueA={topPair.keyDifferences.goldStandardDx?.real}
                    valueB={topPair.keyDifferences.goldStandardDx?.mistaken}
                    labelA={topPair.realCondition}
                    labelB={topPair.mistakenFor}
                  />
                )}
                
                {/* First Line Rx */}
                {topPair.keyDifferences.firstLineRx?.real !== topPair.keyDifferences.firstLineRx?.mistaken && (
                  <DifferenceRow
                    label="First-Line Rx"
                    valueA={topPair.keyDifferences.firstLineRx?.real}
                    valueB={topPair.keyDifferences.firstLineRx?.mistaken}
                    labelA={topPair.realCondition}
                    labelB={topPair.mistakenFor}
                  />
                )}

                {/* Distinguishing Features */}
                {topPair.distinguishingFeatures && (
                  <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]/50">
                    <p className="text-xs font-semibold text-[var(--color-accent)] mb-1">
                      Clinical Pearl
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {topPair.distinguishingFeatures}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Actions */}
        {onCompare && topPair.realConditionData && topPair.mistakenConditionData && (
          <div className="px-4 py-3 border-t border-[var(--color-border)]/50 flex gap-2">
            <button
              onClick={() => onCompare(topPair.realConditionData!.id, topPair.mistakenConditionData!.id)}
              className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
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

/**
 * Helper component to show side-by-side differences
 */
const DifferenceRow: React.FC<{
  label: string;
  valueA: string | null | undefined;
  valueB: string | null | undefined;
  labelA: string;
  labelB: string;
}> = ({ label, valueA, valueB, labelA, labelB }) => {
  if (!valueA && !valueB) return null;
  
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
        {label}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 rounded bg-green-500/5 border border-green-500/20">
          <p className="text-[9px] text-green-500 font-semibold mb-0.5">{labelA}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">{valueA || '-'}</p>
        </div>
        <div className="p-2 rounded bg-red-500/5 border border-red-500/20">
          <p className="text-[9px] text-red-500 font-semibold mb-0.5">{labelB}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">{valueB || '-'}</p>
        </div>
      </div>
    </div>
  );
};

export default ConfusionPairAlert;
