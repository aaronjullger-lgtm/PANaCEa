/**
 * Session Insights Panel
 *
 * A collapsible panel that shows real-time behavioral analytics:
 * - Momentum indicator
 * - Behavioral confidence calibration
 * - Pacing analysis
 * - Smart recommendations
 *
 * This replaces manual confidence input with auto-inferred insights.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronDown, ChevronUp, BarChart3, Zap, Target } from 'lucide-react';
import { MomentumIndicator } from './MomentumIndicator';
import { BehavioralCalibration } from './BehavioralCalibration';
import { getSessionSummary } from '@/services/domain';

interface SessionInsightsPanelProps {
  /** Force refresh when question answered */
  refreshKey?: number;
  /** Whether panel starts expanded */
  defaultExpanded?: boolean;
}

export const SessionInsightsPanel: React.FC<SessionInsightsPanelProps> = ({
  refreshKey = 0,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [activeTab, setActiveTab] = useState<'momentum' | 'calibration' | 'distribution'>(
    'momentum'
  );

  // Get PANCE distribution summary
  const distributionSummary = getSessionSummary();

  const tabs = [
    { id: 'momentum' as const, label: 'Flow', icon: Zap },
    { id: 'calibration' as const, label: 'Patterns', icon: Brain },
    { id: 'distribution' as const, label: 'Coverage', icon: Target },
  ];

  return (
    <div className="bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--color-bg-secondary)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[var(--color-accent)]" />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            Session Insights
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isExpanded && (
            <span className="text-xs text-action-muted">
              {distributionSummary.totalQuestions} Qs
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-action-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-action-muted" />
          )}
        </div>
      </button>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-[var(--color-border)]">
              {/* Tabs */}
              <div className="flex gap-1 py-3 border-b border-[var(--color-border)]">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                        : 'text-action-muted hover:bg-[var(--color-bg-secondary)]'
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="pt-3">
                <AnimatePresence mode="wait">
                  {activeTab === 'momentum' && (
                    <motion.div
                      key="momentum"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                    >
                      <MomentumIndicator refreshKey={refreshKey} />
                    </motion.div>
                  )}

                  {activeTab === 'calibration' && (
                    <motion.div
                      key="calibration"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                    >
                      <BehavioralCalibration refreshKey={refreshKey} isExpanded={true} />
                    </motion.div>
                  )}

                  {activeTab === 'distribution' && (
                    <motion.div
                      key="distribution"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                    >
                      <DistributionPreview summary={distributionSummary} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Distribution preview component
const DistributionPreview: React.FC<{ summary: ReturnType<typeof getSessionSummary> }> = ({
  summary,
}) => {
  if (summary.totalQuestions === 0) {
    return (
      <div className="text-center py-4 text-sm text-action-muted">
        Answer questions to see PANCE distribution coverage
      </div>
    );
  }

  // Get top 4 systems by count using systemBreakdown
  const topSystems = summary.systemBreakdown.slice(0, 4);

  return (
    <div className="space-y-3">
      {/* Overall stats */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="px-2 py-2 bg-[var(--color-bg-secondary)] rounded-lg">
          <div className="text-lg font-bold text-[var(--color-text-primary)]">
            {summary.totalQuestions}
          </div>
          <div className="text-xs text-action-muted">Questions</div>
        </div>
        <div className="px-2 py-2 bg-[var(--color-accent)]/10 rounded-lg">
          <div className="text-lg font-bold text-[var(--color-accent)]">
            {summary.questionsPerMinute}/min
          </div>
          <div className="text-xs text-action-muted">Pace</div>
        </div>
      </div>

      {/* Top systems */}
      {topSystems.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-action-muted uppercase tracking-wider">
            System Coverage
          </div>
          {topSystems.map((sys) => (
            <div key={sys.system} className="flex items-center gap-2">
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[var(--color-text-secondary)] truncate">{sys.name}</span>
                  <span className="text-action-muted">
                    {sys.count} ({sys.percent}%)
                  </span>
                </div>
                <div className="h-1.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      Math.abs(sys.percent - sys.target) <= 5
                        ? 'bg-[var(--color-data-pass)]'
                        : Math.abs(sys.percent - sys.target) <= 10
                          ? 'bg-[var(--color-data-provisional)]'
                          : 'bg-[var(--color-data-fail)]'
                    }`}
                    style={{
                      width: `${Math.min(100, (sys.count / Math.max(1, summary.totalQuestions)) * 100 * 2)}%`,
                    }}
                  />
                </div>
                <div className="text-xs text-action-muted mt-0.5">Target: {sys.target}%</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Distribution score indicator */}
      <div
        className={`text-xs text-center py-2 rounded-lg ${
          summary.distributionScore >= 80
            ? 'bg-[var(--color-data-pass)]/10 text-[var(--color-data-pass)]'
            : summary.distributionScore >= 60
              ? 'bg-[var(--color-data-provisional)]/10 text-[var(--color-data-provisional)]'
              : 'bg-[var(--color-data-fail)]/10 text-[var(--color-data-fail)]'
        }`}
      >
        {summary.distributionScore >= 80
          ? '✓ PANCE-aligned distribution'
          : `Distribution score: ${summary.distributionScore}/100`}
      </div>
    </div>
  );
};

export default SessionInsightsPanel;
