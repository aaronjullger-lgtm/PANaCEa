/**
 * FSRS Memory Decay Visualization
 *
 * Shows memory decay curves to users, visualizing:
 * - Stability/Difficulty metrics
 * - "You will forget this" predictive alerts
 * - Optimal review time recommendations
 *
 * @see docs/CRITICAL_FIXES_SPRINT_TRACKER.md - Sprint E
 */

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { PrimaryButton } from '../ui/PrimaryButton';
import {
  retrievability as fsrsRetrievability,
  daysUntilRetrievability,
} from '@/lib/fsrs-retrievability';
import {
  Brain,
  Clock,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Info,
  ChevronRight,
} from 'lucide-react';

interface FSRSCardData {
  id: string;
  conditionName: string;
  stability: number; // Days until 90% retention
  difficulty: number; // 1-10 scale
  lastReview: Date;
  nextReview: Date;
  retrievability: number; // Current retention probability 0-1
  state: 'new' | 'learning' | 'review' | 'relearning';
}

interface FSRSDecayVisualizationProps {
  cards: FSRSCardData[];
  isLoading?: boolean;
  onReviewNow?: (cardId: string) => void;
}

/**
 * Forgetting curve calculation (FSRS v6).
 *
 * Previously this used the wrong formula `R(t) = (1 + t/S)^(-1)`, which
 * under/overstated retention at every point and disagreed with the scheduler
 * actually grading the student. Now delegates to the shared `fsrsRetrievability`
 * helper that sources FACTOR/DECAY from lib/fsrs.ts defaultParameters
 * (ts-fsrs v6 defaults: w[19]=0.1597, w[20]=2.2700), matching retention.ts,
 * RetentionForecastCard, and the actual scheduler.
 *
 * Argument order preserved for minimal diff at call sites.
 */
const calculateRetrievability = (stability: number, daysSinceReview: number): number =>
  fsrsRetrievability(daysSinceReview, stability);

// Get urgency level based on retrievability
const getUrgencyLevel = (retrievability: number): 'safe' | 'warning' | 'critical' => {
  if (retrievability >= 0.85) return 'safe';
  if (retrievability >= 0.7) return 'warning';
  return 'critical';
};

// Format time until forgotten
const formatTimeUntilForgotten = (days: number): string => {
  if (days < 1) {
    const hours = Math.round(days * 24);
    return hours <= 1 ? '< 1 hour' : `${hours} hours`;
  }
  if (days < 7) return `${Math.round(days)} days`;
  if (days < 30) return `${Math.round(days / 7)} weeks`;
  return `${Math.round(days / 30)} months`;
};

// Memory Decay Curve SVG
const DecayCurve: React.FC<{
  stability: number;
  daysSinceReview: number;
  width?: number;
  height?: number;
}> = ({ stability, daysSinceReview, width = 200, height = 60 }) => {
  const points = useMemo(() => {
    const pts: string[] = [];
    const maxDays = stability * 3; // Show 3x stability

    for (let i = 0; i <= 50; i++) {
      const day = (i / 50) * maxDays;
      const r = calculateRetrievability(stability, day);
      const x = (i / 50) * width;
      const y = height - r * height;
      pts.push(`${x},${y}`);
    }
    return pts.join(' ');
  }, [stability, width, height]);

  // Current position marker
  const maxDays = stability * 3;
  const currentX = Math.min(1, daysSinceReview / maxDays) * width;
  const currentR = calculateRetrievability(stability, daysSinceReview);
  const currentY = height - currentR * height;
  const currentColor =
    currentR >= 0.7
      ? 'var(--color-data-pass)'
      : currentR >= 0.5
        ? 'var(--color-data-provisional)'
        : 'var(--color-data-fail)';

  // Threshold line at 70%
  const thresholdY = height - 0.7 * height;

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Background grid */}
      <line
        x1="0"
        y1={thresholdY}
        x2={width}
        y2={thresholdY}
        stroke="var(--color-border)"
        strokeWidth="1"
        strokeDasharray="4,4"
      />

      {/* Decay curve */}
      <polyline
        points={points}
        fill="none"
        stroke="url(#retention-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Gradient definition */}
      <defs>
        <linearGradient id="retention-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--color-data-pass)" />
          <stop offset="50%" stopColor="var(--color-data-provisional)" />
          <stop offset="100%" stopColor="var(--color-data-fail)" />
        </linearGradient>
      </defs>

      {/* Current position marker */}
      <circle
        cx={currentX}
        cy={currentY}
        r="5"
        fill={currentColor}
        stroke="var(--color-bg-primary)"
        strokeWidth="2"
      />

      {/* Labels */}
      <text x="0" y={height + 12} fontSize="8" fill="var(--color-text-muted)">
        Now
      </text>
      <text x={width - 20} y={height + 12} fontSize="8" fill="var(--color-text-muted)">
        {Math.round(maxDays)}d
      </text>
      <text x={width + 4} y={thresholdY + 3} fontSize="8" fill="var(--color-text-muted)">
        70%
      </text>
    </svg>
  );
};

// Individual Card Component
const CardDecayCard: React.FC<{
  card: FSRSCardData;
  onReviewNow?: () => void;
}> = ({ card, onReviewNow }) => {
  const prefersReducedMotion = useReducedMotion();
  const daysSinceReview =
    (Date.now() - new Date(card.lastReview).getTime()) / (1000 * 60 * 60 * 24);
  const currentRetrievability = calculateRetrievability(card.stability, daysSinceReview);
  const urgency = getUrgencyLevel(currentRetrievability);

  // Days until 70% retention (FSRS v6 inverse). The previous inline formula
  // `S * (0.7^-1 - 1)` assumed the wrong `(1+t/S)^-1` curve; replaced with the
  // shared inverse that matches the FSRS v6 retrievability helper.
  const daysUntilForgotten = daysUntilRetrievability(card.stability, 0.7) - daysSinceReview;

  const urgencyColors = {
    safe: 'border-[var(--color-data-pass)]/30 bg-[var(--color-data-pass)]/10',
    warning: 'border-[var(--color-data-provisional)]/30 bg-[var(--color-data-provisional)]/10',
    critical: 'border-[var(--color-data-fail)]/30 bg-[var(--color-data-fail)]/10',
  };

  const urgencyText = {
    safe: {
      icon: CheckCircle,
      color: 'text-[var(--color-data-pass)]',
      label: 'Memory Stable',
    },
    warning: { icon: Clock, color: 'text-[var(--color-data-provisional)]', label: 'Review Soon' },
    critical: {
      icon: AlertTriangle,
      color: 'text-[var(--color-data-fail)]',
      label: 'Forgetting!',
    },
  };

  const UrgencyIcon = urgencyText[urgency].icon;

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-xl border ${urgencyColors[urgency]} transition-all`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-[var(--color-text-primary)] truncate">
            {card.conditionName}
          </h4>
          <div className="flex items-center gap-1 mt-1">
            <UrgencyIcon className={`w-4 h-4 ${urgencyText[urgency].color}`} />
            <span className={`text-xs font-medium ${urgencyText[urgency].color}`}>
              {urgencyText[urgency].label}
            </span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">
            {Math.round(currentRetrievability * 100)}%
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">retention</div>
        </div>
      </div>

      {/* Decay Curve */}
      <div className="mb-3">
        <DecayCurve stability={card.stability} daysSinceReview={daysSinceReview} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        <div className="p-2 bg-[var(--color-bg-secondary)]/60 rounded-lg">
          <div className="text-sm font-bold text-[var(--color-text-primary)]">
            {card.stability.toFixed(1)}d
          </div>
          <div className="text-[10px] text-[var(--color-text-muted)]">Stability</div>
        </div>
        <div className="p-2 bg-[var(--color-bg-secondary)]/60 rounded-lg">
          <div className="text-sm font-bold text-[var(--color-text-primary)]">
            {card.difficulty.toFixed(1)}
          </div>
          <div className="text-[10px] text-[var(--color-text-muted)]">Difficulty</div>
        </div>
        <div className="p-2 bg-[var(--color-bg-secondary)]/60 rounded-lg">
          <div
            className={`text-sm font-bold ${
              daysUntilForgotten > 3
                ? 'text-[var(--color-data-pass)]'
                : daysUntilForgotten > 1
                  ? 'text-[var(--color-data-provisional)]'
                  : 'text-[var(--color-data-fail)]'
            }`}
          >
            {daysUntilForgotten > 0 ? formatTimeUntilForgotten(daysUntilForgotten) : 'Now!'}
          </div>
          <div className="text-[10px] text-[var(--color-text-muted)]">Until Forgotten</div>
        </div>
      </div>

      {/* Review Button */}
      {urgency !== 'safe' && onReviewNow && (
        <PrimaryButton
          onClick={onReviewNow}
          variant={urgency === 'critical' ? 'danger' : 'warning'}
          size="sm"
          className="w-full"
          iconRight={<ChevronRight className="w-4 h-4" />}
        >
          Review Now
        </PrimaryButton>
      )}
    </motion.div>
  );
};

// Predictive Alert Component
const PredictiveAlert: React.FC<{
  criticalCount: number;
  warningCount: number;
  nextCriticalIn?: string;
}> = ({ criticalCount, warningCount, nextCriticalIn }) => {
  if (criticalCount === 0 && warningCount === 0) {
    return (
      <div className="p-4 rounded-xl bg-[var(--color-data-pass)]/10 border border-[var(--color-data-pass)]/30">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-[var(--color-data-pass)]" />
          <div>
            <h3 className="font-semibold text-[var(--color-text-primary)]">
              Memory Looking Good!
            </h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              All your cards are stable.{' '}
              {nextCriticalIn && `Next review needed in ${nextCriticalIn}.`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-[var(--color-data-provisional)]/10 border border-[var(--color-data-provisional)]/30">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-6 h-6 text-[var(--color-data-provisional)]" />
        <div>
          <h3 className="font-semibold text-[var(--color-text-primary)]">Memory Decay Alert</h3>
          <p className="text-sm text-[var(--color-text-muted)]">
            {criticalCount > 0 && (
              <span className="text-[var(--color-data-fail)] font-medium">
                {criticalCount} card{criticalCount > 1 ? 's' : ''} critically fading!{' '}
              </span>
            )}
            {warningCount > 0 && (
              <span className="text-[var(--color-data-provisional)]">
                {warningCount} card{warningCount > 1 ? 's need' : ' needs'} review soon.
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

// Main Component
export const FSRSDecayVisualization: React.FC<FSRSDecayVisualizationProps> = ({
  cards,
  isLoading = false,
  onReviewNow,
}) => {
  const [showAll, setShowAll] = useState(false);

  // Categorize cards by urgency
  const { criticalCards, warningCards, safeCards } = useMemo(() => {
    const critical: FSRSCardData[] = [];
    const warning: FSRSCardData[] = [];
    const safe: FSRSCardData[] = [];

    cards.forEach((card) => {
      const daysSinceReview =
        (Date.now() - new Date(card.lastReview).getTime()) / (1000 * 60 * 60 * 24);
      const r = calculateRetrievability(card.stability, daysSinceReview);
      const urgency = getUrgencyLevel(r);

      if (urgency === 'critical') critical.push(card);
      else if (urgency === 'warning') warning.push(card);
      else safe.push(card);
    });

    // Sort by urgency within each category
    const sortByRetrievability = (a: FSRSCardData, b: FSRSCardData) => {
      const aR = calculateRetrievability(
        a.stability,
        (Date.now() - new Date(a.lastReview).getTime()) / (1000 * 60 * 60 * 24)
      );
      const bR = calculateRetrievability(
        b.stability,
        (Date.now() - new Date(b.lastReview).getTime()) / (1000 * 60 * 60 * 24)
      );
      return aR - bR;
    };

    return {
      criticalCards: critical.sort(sortByRetrievability),
      warningCards: warning.sort(sortByRetrievability),
      safeCards: safe.sort(sortByRetrievability),
    };
  }, [cards]);

  const displayCards = showAll
    ? [...criticalCards, ...warningCards, ...safeCards]
    : [...criticalCards, ...warningCards].slice(0, 6);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-16 bg-[var(--color-bg-secondary)] rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-[var(--color-bg-secondary)] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="p-8 text-center rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
        <Brain className="w-12 h-12 mx-auto text-[var(--color-text-muted)] mb-3" />
        <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">No FSRS Data Yet</h3>
        <p className="text-sm text-[var(--color-text-muted)]">
          Complete some reviews to see your memory decay curves!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-[var(--color-accent)]" />
          <h3 className="font-semibold text-[var(--color-text-primary)]">Memory Decay Curves</h3>
        </div>
        <button aria-label="Learn more about memory decay curves" className="p-2 hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors group">
          <Info className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]" />
        </button>
      </div>

      {/* Predictive Alert */}
      {(() => {
        const firstSafeCard = safeCards[0];
        const nextCriticalIn = firstSafeCard
          ? formatTimeUntilForgotten(
              daysUntilRetrievability(firstSafeCard.stability, 0.7) -
                (Date.now() - new Date(firstSafeCard.lastReview).getTime()) / (1000 * 60 * 60 * 24)
            )
          : undefined;
        return (
          <PredictiveAlert
            criticalCount={criticalCards.length}
            warningCount={warningCards.length}
            nextCriticalIn={nextCriticalIn}
          />
        );
      })()}

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {displayCards.map((card) => (
            <CardDecayCard
              key={card.id}
              card={card}
              onReviewNow={onReviewNow ? () => onReviewNow(card.id) : undefined}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Show More/Less */}
      {cards.length > 6 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full py-2 text-sm text-[var(--color-accent)] hover:underline"
        >
          {showAll ? 'Show fewer cards' : `Show all ${cards.length} cards`}
        </button>
      )}

      {/* Explanation */}
      <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg text-xs text-[var(--color-text-muted)]">
        <strong>Understanding Memory Decay:</strong>
        <p className="mt-1">
          The curve shows how your memory fades over time. Review before dropping below 70% to
          maintain strong recall. Higher stability = slower forgetting.
        </p>
      </div>
    </div>
  );
};

export default FSRSDecayVisualization;
