/**
 * FatigueAlertBanner - Displays fatigue risk level with recommendations.
 * 
 * Part of Phase 6.3: Dashboard UI for Dynamic Study Path Optimizer.
 * 
 * Uses semantic design tokens and follows the Stormy Slate aesthetic.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, AlertOctagon, X, Lightbulb } from 'lucide-react';

export type FatigueRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

interface FatigueAlertBannerProps {
  /** Risk level from study plan metadata */
  riskLevel: FatigueRiskLevel;
  /** Optional callback when banner is dismissed */
  onDismiss?: () => void;
  /** Compact mode (for smaller spaces) */
  compact?: boolean;
}

const RISK_CONFIG = {
  LOW: {
    icon: AlertCircle,
    color: 'var(--color-data-pass)',
    bgColor: 'rgba(71, 85, 105, 0.1)', // slate-600 with low opacity
    title: 'Low Fatigue Risk',
    message: 'Your study plan is well‑balanced with minimal fatigue risk.',
    recommendations: [
      'Continue at this pace.',
      'Take regular breaks every 45‑60 minutes.',
      'Stay hydrated and maintain good posture.'
    ]
  },
  MEDIUM: {
    icon: AlertTriangle,
    color: 'var(--color-data-provisional)',
    bgColor: 'rgba(148, 163, 184, 0.15)', // slate-400 with low opacity
    title: 'Medium Fatigue Risk',
    message: 'Your plan includes moderate intensity; monitor your energy levels.',
    recommendations: [
      'Consider splitting longer sessions into two shorter ones.',
      'Schedule lighter topics after high‑intensity sessions.',
      'Use the Pomodoro technique (25 min work, 5 min break).'
    ]
  },
  HIGH: {
    icon: AlertOctagon,
    color: 'var(--color-data-fail)',
    bgColor: 'rgba(30, 41, 59, 0.2)', // slate-800 with low opacity
    title: 'High Fatigue Risk',
    message: 'Your plan is intensive and may lead to burnout if not managed.',
    recommendations: [
      'Review the plan alternatives for a lighter schedule.',
      'Ensure adequate sleep (7‑9 hours) and nutrition.',
      'Incorporate active recovery (walking, stretching) between sessions.',
      'Consider adjusting daily minutes limit in settings.'
    ]
  }
} as const;

export const FatigueAlertBanner: React.FC<FatigueAlertBannerProps> = ({
  riskLevel,
  onDismiss,
  compact = false
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const config = RISK_CONFIG[riskLevel];
  const Icon = config.icon;

  if (isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  if (compact) {
    return (
      <motion.div
        initial={{ y: -10 }}
        animate={{ y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border"
        style={{
          borderColor: config.color,
          backgroundColor: config.bgColor
        }}
      >
        <Icon className="w-4 h-4 flex-shrink-0" style={{ color: config.color }} />
        <span className="text-xs text-[var(--color-text-secondary)]">
          {config.title}
        </span>
        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="ml-auto p-0.5 rounded hover:bg-[var(--color-bg-secondary)] transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-3 h-3 text-[var(--color-text-muted)]" />
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="rounded-xl border overflow-hidden"
      style={{
        borderColor: config.color,
        backgroundColor: config.bgColor
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Icon className="w-5 h-5 flex-shrink-0" style={{ color: config.color }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {config.title}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {config.message}
          </p>
        </div>
        <button
          onClick={toggleExpanded}
          className="p-1 rounded hover:bg-[var(--color-bg-secondary)] transition-colors"
          aria-label={isExpanded ? 'Collapse recommendations' : 'Expand recommendations'}
        >
          {isExpanded ? (
            <Lightbulb className="w-4 h-4 text-[var(--color-text-muted)]" />
          ) : (
            <Lightbulb className="w-4 h-4 text-[var(--color-text-muted)]" />
          )}
        </button>
        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="p-1 rounded hover:bg-[var(--color-bg-secondary)] transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-[var(--color-text-muted)]" />
          </button>
        )}
      </div>

      {/* Recommendations (expandable) */}
      {isExpanded && (
        <motion.div
          initial={false}
          animate={{}}
          exit={{ opacity: 0 }}
          className="px-4 py-3 border-t border-[var(--color-border)]/50 bg-[var(--color-bg-primary)]/30"
        >
          <div className="flex items-start gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-[var(--color-text-muted)] mt-0.5 flex-shrink-0" />
            <p className="text-xs font-medium text-[var(--color-text-primary)]">
              Recommendations to manage fatigue:
            </p>
          </div>
          <ul className="space-y-1.5 pl-6">
            {config.recommendations.map((rec, idx) => (
              <li key={idx} className="text-xs text-[var(--color-text-secondary)] list-disc">
                {rec}
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </motion.div>
  );
};

export default FatigueAlertBanner;