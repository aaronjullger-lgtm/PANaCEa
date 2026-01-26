/**
 * Answer Feedback Animation
 *
 * Provides professional, smooth feedback animations when answering questions.
 * Subtle visual cues that don't interrupt the learning flow.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, TrendingUp } from 'lucide-react';

interface AnswerFeedbackProps {
  isCorrect: boolean | null;
  streak?: number;
  showFeedback: boolean;
  onAnimationComplete?: () => void;
}

// Subtle ring pulse for correct answers
const SuccessRing: React.FC = () => (
  <motion.div
    initial={{ scale: 0.8, opacity: 0.6 }}
    animate={{ scale: 2, opacity: 0 }}
    transition={{ duration: 0.4, ease: 'easeOut' }}
    className="absolute inset-0 rounded-full border-2 border-emerald-400"
  />
);

// Streak indicator - subtle toast-style notification
const StreakIndicator: React.FC<{ streak: number }> = ({ streak }) => {
  if (streak < 3) return null;

  const getStreakStyle = () => {
    if (streak >= 10)
      return {
        bg: 'bg-gradient-to-r from-amber-500 to-orange-500',
        text: 'Excellent streak!',
        glow: 'shadow-amber-500/25',
      };
    if (streak >= 7)
      return {
        bg: 'bg-gradient-to-r from-orange-400 to-amber-400',
        text: 'Great momentum!',
        glow: 'shadow-orange-400/25',
      };
    if (streak >= 5)
      return {
        bg: 'bg-gradient-to-r from-emerald-400 to-teal-400',
        text: 'Nice streak!',
        glow: 'shadow-emerald-400/25',
      };
    return {
      bg: 'bg-gradient-to-r from-blue-400 to-cyan-400',
      text: 'Keep going!',
      glow: 'shadow-blue-400/25',
    };
  };

  const style = getStreakStyle();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -5, scale: 0.98 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${style.bg} shadow-lg ${style.glow}`}
    >
      <TrendingUp className="w-3.5 h-3.5 text-white" />
      <span className="text-xs font-semibold text-white tracking-wide">
        {streak} {style.text}
      </span>
    </motion.div>
  );
};

export const AnswerFeedback: React.FC<AnswerFeedbackProps> = ({
  isCorrect,
  streak = 0,
  showFeedback,
  onAnimationComplete,
}) => {
  useEffect(() => {
    if (showFeedback && onAnimationComplete) {
      // Reduced from 600ms to 400ms for snappier feel
      const timer = setTimeout(onAnimationComplete, 400);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [showFeedback, onAnimationComplete]);

  if (!showFeedback || isCorrect === null) return null;

  return (
    <AnimatePresence mode="wait">
      {showFeedback && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          {/* Main feedback indicator */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 400,
              duration: 0.2,
            }}
            className="relative"
          >
            {isCorrect ? (
              <div className="relative">
                {/* Success ring animation */}
                <SuccessRing />

                {/* Main check icon */}
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 0.3, times: [0, 0.5, 1] }}
                  className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30"
                >
                  <motion.div
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.2, delay: 0.1 }}
                  >
                    <Check className="w-8 h-8 text-white" strokeWidth={3} />
                  </motion.div>
                </motion.div>
              </div>
            ) : (
              /* Incorrect - subtle shake */
              <motion.div
                animate={{ x: [-3, 3, -3, 3, 0] }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30"
              >
                <X className="w-8 h-8 text-white" strokeWidth={3} />
              </motion.div>
            )}
          </motion.div>

          {/* Streak indicator - positioned below */}
          {isCorrect && streak >= 3 && (
            <motion.div
              className="absolute"
              style={{ top: 'calc(50% + 50px)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
            >
              <StreakIndicator streak={streak} />
            </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
};

// Hook for managing answer feedback state
export function useAnswerFeedback() {
  const [feedbackState, setFeedbackState] = useState<{
    isCorrect: boolean | null;
    showFeedback: boolean;
    streak: number;
  }>({
    isCorrect: null,
    showFeedback: false,
    streak: 0,
  });

  const triggerCorrect = useCallback((currentStreak: number = 0) => {
    setFeedbackState({ isCorrect: true, showFeedback: true, streak: currentStreak });
    // Auto-hide after animation
    setTimeout(() => {
      setFeedbackState((prev) => ({ ...prev, showFeedback: false }));
    }, 800);
  }, []);

  const triggerIncorrect = useCallback(() => {
    setFeedbackState({ isCorrect: false, showFeedback: true, streak: 0 });
    // Auto-hide after animation
    setTimeout(() => {
      setFeedbackState((prev) => ({ ...prev, showFeedback: false }));
    }, 600);
  }, []);

  const hideFeedback = useCallback(() => {
    setFeedbackState((prev) => ({ ...prev, showFeedback: false }));
  }, []);

  return {
    ...feedbackState,
    triggerCorrect,
    triggerIncorrect,
    hideFeedback,
  };
}

export default AnswerFeedback;
