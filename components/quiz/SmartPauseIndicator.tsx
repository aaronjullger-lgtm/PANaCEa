/**
 * Smart Pause Indicator
 *
 * Subtle, non-intrusive component that shows when a break might help.
 * Displays encouragement messages and break suggestions based on
 * automatically detected fatigue/struggle patterns.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coffee, Sparkles, Heart, X } from 'lucide-react';
import {
  analyzePauseNeed,
  recordPauseTaken,
  getQuickEncouragement,
  type PauseRecommendation,
} from '@/services/session';

interface SmartPauseIndicatorProps {
  refreshKey?: number;
}

export const SmartPauseIndicator: React.FC<SmartPauseIndicatorProps> = ({ refreshKey }) => {
  const [showBanner, setShowBanner] = useState(false);
  const [pauseAnalysis, setPauseAnalysis] = useState<{
    recommendation: PauseRecommendation;
    message: string;
    encouragement: string;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const analysis = analyzePauseNeed();

    if (analysis.recommendation !== 'none' && !dismissed) {
      setPauseAnalysis(analysis);
      setShowBanner(true);
    } else {
      setShowBanner(false);
    }
  }, [refreshKey, dismissed]);

  const handleDismiss = () => {
    setDismissed(true);
    setShowBanner(false);
    recordPauseTaken();
  };

  if (!showBanner || !pauseAnalysis) return null;

  const getBannerStyle = () => {
    switch (pauseAnalysis.recommendation) {
      case 'recommended':
        return 'bg-[var(--color-data-provisional)]/10 border-[var(--color-data-provisional)]/30';
      case 'suggested':
        return 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30';
      case 'soft':
        return 'bg-[var(--color-bg-secondary)] border-[var(--color-border)]';
      default:
        return '';
    }
  };

  const getIcon = () => {
    switch (pauseAnalysis.recommendation) {
      case 'recommended':
        return <Coffee className="w-5 h-5 text-[var(--color-data-provisional)]" />;
      case 'suggested':
        return <Sparkles className="w-5 h-5 text-[var(--color-accent)]" />;
      case 'soft':
        return <Heart className="w-5 h-5 text-[var(--color-data-fail)]" />;
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -10 }}
        animate={{ y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`rounded-xl border p-3 mb-4 ${getBannerStyle()}`}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {pauseAnalysis.message}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">{pauseAnalysis.encouragement}</p>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-[var(--color-bg-tertiary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            title="Dismiss"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-[var(--color-text-muted)]" aria-hidden="true" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Quick Encouragement Toast
 * Shows brief positive messages after good performance
 */
interface EncouragementToastProps {
  refreshKey?: number;
}

export const EncouragementToast: React.FC<EncouragementToastProps> = ({ refreshKey }) => {
  const [message, setMessage] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const encouragement = getQuickEncouragement();
    if (encouragement) {
      setMessage(encouragement);
      setShowToast(true);

      // Auto-hide after 2 seconds
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [refreshKey]);

  return (
    <AnimatePresence>
      {showToast && message && (
        <motion.div
          initial={{ scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-40"
        >
          <div className="px-4 py-2 rounded-full bg-[var(--color-data-pass)] text-white text-sm font-medium shadow-lg">
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SmartPauseIndicator;
