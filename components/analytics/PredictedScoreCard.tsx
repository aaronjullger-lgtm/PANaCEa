/**
 * Predicted Score Card Component
 * Sprint 7: Visual display of predicted PANCE score with confidence interval
 *
 * Shows the user's estimated exam score based on their practice performance,
 * with visual indicators for readiness level and actionable recommendations.
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Target,
  TrendingUp,
  TrendingDown,
  Calendar,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  ChevronRight,
  Sparkles,
  BarChart3,
  Clock,
} from 'lucide-react';
import type { IrtPredictedScore as PredictedScore } from '@/services/analytics';
import { ExplainabilityTooltip } from '@/components/ui/ExplainabilityTooltip';

// =============================================================================
// TYPES
// =============================================================================

export interface PredictedScoreCardProps {
  prediction: PredictedScore;
  percentile?: number;
  trend?: { direction: 'up' | 'down' | 'stable'; change: number };
  questionsAnswered: number;
  targetDate?: Date;
  onViewDetails?: () => void;
  isLoading?: boolean;
  compact?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const READINESS_CONFIG = {
  confident_pass: {
    icon: CheckCircle,
    color: 'text-[var(--color-data-pass)]',
    bgColor: 'bg-[var(--color-data-pass)] bg-opacity-10',
    borderColor: 'border-[var(--color-data-pass)] border-opacity-30',
    ringColor: 'ring-[var(--color-data-pass)] ring-opacity-40',
    label: 'Confident Pass',
    description: "You're well-prepared for the exam!",
  },
  likely_pass: {
    icon: Target,
    color: 'text-[var(--color-accent)]',
    bgColor: 'bg-[var(--color-accent)] bg-opacity-10',
    borderColor: 'border-[var(--color-accent)] border-opacity-30',
    ringColor: 'ring-[var(--color-accent)] ring-opacity-40',
    label: 'Likely Pass',
    description: 'On track - keep up the momentum!',
  },
  borderline: {
    icon: AlertTriangle,
    color: 'text-[var(--color-data-provisional)]',
    bgColor: 'bg-[var(--color-data-provisional)] bg-opacity-10',
    borderColor: 'border-[var(--color-data-provisional)] border-opacity-30',
    ringColor: 'ring-[var(--color-data-provisional)] ring-opacity-40',
    label: 'Borderline',
    description: 'More focused preparation needed.',
  },
  not_ready: {
    icon: XCircle,
    color: 'text-[var(--color-data-fail)]',
    bgColor: 'bg-[var(--color-data-fail)] bg-opacity-10',
    borderColor: 'border-[var(--color-data-fail)] border-opacity-30',
    ringColor: 'ring-[var(--color-data-fail)] ring-opacity-40',
    label: 'Not Ready',
    description: 'Significant improvement needed.',
  },
};

// Pass threshold line position (350 on 200-800 scale)
const PASS_THRESHOLD = 350;
const SCALE_MIN = 200;
const SCALE_MAX = 800;

// =============================================================================
// COMPONENT
// =============================================================================

export function PredictedScoreCard({
  prediction,
  percentile,
  trend,
  questionsAnswered,
  targetDate,
  onViewDetails,
  isLoading = false,
  compact = false,
}: PredictedScoreCardProps) {
  const readinessConfig = READINESS_CONFIG[prediction.readinessLevel];
  const ReadinessIcon = readinessConfig.icon;

  // Calculate score bar position (0-100%)
  const scorePosition = useMemo(() => {
    if (prediction.scaledScore === 0) return 0;
    return ((prediction.scaledScore - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
  }, [prediction.scaledScore]);

  // Calculate confidence interval positions
  const confidencePositions = useMemo(() => {
    if (prediction.confidenceInterval.lower === 0) return { lower: 0, upper: 0 };
    return {
      lower: ((prediction.confidenceInterval.lower - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100,
      upper: ((prediction.confidenceInterval.upper - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100,
    };
  }, [prediction.confidenceInterval]);

  // Pass threshold position
  const passPosition = ((PASS_THRESHOLD - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;

  // Loading skeleton
  if (isLoading) {
    return (
      <div
        className={`rounded-2xl border-2 p-6 bg-[var(--color-bg-secondary)] border-[var(--color-border)] ${compact ? 'p-4' : 'p-6'}`}
      >
        <div className="space-y-4 animate-pulse">
          <div className="h-6 w-32 bg-[var(--color-bg-tertiary)] rounded" />
          <div className="h-16 w-24 bg-[var(--color-bg-tertiary)] rounded" />
          <div className="h-4 bg-[var(--color-bg-tertiary)] rounded-full" />
          <div className="h-4 w-48 bg-[var(--color-bg-tertiary)] rounded" />
        </div>
      </div>
    );
  }

  // Insufficient data state
  if (prediction.scaledScore === 0) {
    return (
      <div className="rounded-2xl border-2 border-[var(--color-border)] p-6 bg-[var(--color-bg-secondary)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-[var(--color-bg-tertiary)]">
            <BarChart3 className="h-6 w-6 text-[var(--color-text-muted)]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              Predicted PANCE Score
              <ExplainabilityTooltip
                formula={`Based on your last ${questionsAnswered} questions, weighted by difficulty and time decay. Answer 100+ for a stable estimate.`}
              />
            </h3>
            <p className="text-sm text-[var(--color-text-muted)]">Insufficient data</p>
          </div>
        </div>

        <div className="text-center py-8">
          <p className="text-4xl font-bold text-[var(--color-text-muted)] mb-2">---</p>
          <p className="text-sm text-[var(--color-text-muted)] mb-4">
            Answer more questions to see your predicted score
          </p>

          {/* Progress to prediction */}
          <div className="max-w-xs mx-auto">
            <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1">
              <span>{questionsAnswered} answered</span>
              <span>100 needed</span>
            </div>
            <div className="h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--color-accent)] transition-all"
                style={{ width: `${Math.min(100, questionsAnswered)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {prediction.recommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <Info className="h-4 w-4 text-[var(--color-text-muted)] mt-0.5 flex-shrink-0" />
              <span className="text-[var(--color-text-muted)]">{rec}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ y: 20 }}
      animate={{ y: 0 }}
      className={`
        rounded-2xl border-2 ${readinessConfig.borderColor}
        ${readinessConfig.bgColor}
        ${compact ? 'p-4' : 'p-6'}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-3 rounded-xl ${readinessConfig.bgColor} ring-2 ${readinessConfig.ringColor}`}
          >
            <ReadinessIcon className={`h-6 w-6 ${readinessConfig.color}`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              Predicted PANCE Score
              <ExplainabilityTooltip
                formula={`Based on your last ${questionsAnswered} questions, weighted by difficulty and time decay.`}
              />
            </h3>
            <p className={`text-sm ${readinessConfig.color}`}>{readinessConfig.label}</p>
          </div>
        </div>

        {/* Trend indicator */}
        {trend && (
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${
              trend.direction === 'up'
                ? 'bg-[var(--color-data-pass)] bg-opacity-10 text-[var(--color-data-pass)]'
                : trend.direction === 'down'
                  ? 'bg-[var(--color-data-fail)] bg-opacity-10 text-[var(--color-data-fail)]'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'
            }`}
          >
            {trend.direction === 'up' && <TrendingUp className="h-4 w-4" />}
            {trend.direction === 'down' && <TrendingDown className="h-4 w-4" />}
            <span>
              {trend.change > 0 ? '+' : ''}
              {trend.change}
            </span>
          </div>
        )}
      </div>

      {/* Main Score Display */}
      <div className="flex items-end gap-4 mb-6">
        <div>
          <motion.p
            key={prediction.scaledScore}
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="text-5xl font-bold text-[var(--color-text-primary)]"
          >
            {prediction.scaledScore}
          </motion.p>
          <p className="text-sm text-[var(--color-text-muted)]">
            {prediction.confidenceInterval.lower} - {prediction.confidenceInterval.upper} (95% CI)
          </p>
        </div>

        <div className="flex-grow">
          <div className="flex items-center gap-4">
            {/* Pass Likelihood Gauge */}
            <div className="text-center">
              <div
                className={`
                relative w-16 h-16 rounded-full border-4
                ${
                  prediction.passLikelihood >= 75
                    ? 'border-[var(--color-data-pass)] border-opacity-60'
                    : prediction.passLikelihood >= 50
                      ? 'border-[var(--color-data-provisional)] border-opacity-60'
                      : 'border-[var(--color-data-fail)] border-opacity-60'
                }
              `}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-[var(--color-text-primary)]">
                    {prediction.passLikelihood}%
                  </span>
                </div>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Pass Likelihood</p>
            </div>

            {/* Percentile (if available) */}
            {percentile !== undefined && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full border-4 border-[var(--color-border)] flex items-center justify-center">
                  <span className="text-xl font-bold text-[var(--color-text-primary)]">
                    {percentile}th
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Percentile</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Score Visualization Bar */}
      {!compact && (
        <div className="mb-6">
          <div className="relative h-3 bg-[var(--color-bg-tertiary)] rounded-full overflow-visible">
            {/* Confidence interval range */}
            <div
              className="absolute h-full bg-[var(--color-border)] rounded-full"
              style={{
                left: `${confidencePositions.lower}%`,
                width: `${confidencePositions.upper - confidencePositions.lower}%`,
              }}
            />

            {/* Pass threshold line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-[var(--color-border)]"
              style={{ left: `${passPosition}%` }}
            >
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="text-xs text-[var(--color-text-muted)]">
                  Pass: {PASS_THRESHOLD}
                </span>
              </div>
            </div>

            {/* Current score indicator */}
            <motion.div
              initial={{ left: '0%' }}
              animate={{ left: `${scorePosition}%` }}
              transition={{ type: 'spring', damping: 20 }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
            >
              <div
                className={`
                w-5 h-5 rounded-full border-3 border-[var(--color-bg-primary)] shadow-lg
                ${prediction.scaledScore >= PASS_THRESHOLD ? 'bg-[var(--color-data-pass)]' : 'bg-[var(--color-data-fail)]'}
              `}
              />
            </motion.div>
          </div>

          {/* Scale labels */}
          <div className="flex justify-between mt-2 text-xs text-[var(--color-text-muted)]">
            <span>{SCALE_MIN}</span>
            <span>{SCALE_MAX}</span>
          </div>
        </div>
      )}

      {/* Projected Pass Date (if not ready) */}
      {prediction.projectedDate && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--color-bg-secondary)]/70 mb-4">
          <Calendar className="h-5 w-5 text-[var(--color-text-muted)]" />
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              Estimated Ready Date
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {prediction.projectedDate.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
      )}

      {/* Strengths & Weaknesses */}
      {!compact && (prediction.strengths.length > 0 || prediction.weaknesses.length > 0) && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          {prediction.strengths.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Strengths
              </p>
              <div className="space-y-1">
                {prediction.strengths.slice(0, 3).map((s, i) => (
                  <div key={i} className="text-sm text-[var(--color-text-secondary)] capitalize">
                    {s.replace(/_/g, ' ')}
                  </div>
                ))}
              </div>
            </div>
          )}

          {prediction.weaknesses.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Focus Areas
              </p>
              <div className="space-y-1">
                {prediction.weaknesses.slice(0, 3).map((w, i) => (
                  <div key={i} className="text-sm text-[var(--color-text-muted)] capitalize">
                    {w.replace(/_/g, ' ')}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {!compact && prediction.recommendations.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">Recommendations</p>
          {prediction.recommendations.slice(0, 3).map((rec, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)] mt-0.5 flex-shrink-0" />
              <span className="text-[var(--color-text-secondary)]">{rec}</span>
            </div>
          ))}
        </div>
      )}

      {/* View Details Button */}
      {onViewDetails && (
        <button
          onClick={onViewDetails}
          className="w-full py-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
        >
          View Full Analytics →
        </button>
      )}

      {/* Footer Stats */}
      <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)]/70 text-xs text-[var(--color-text-muted)]">
        <div className="flex items-center gap-1">
          <BarChart3 className="h-3 w-3" />
          <span>{questionsAnswered} questions analyzed</span>
        </div>
        {targetDate && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Exam: {targetDate.toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default PredictedScoreCard;
