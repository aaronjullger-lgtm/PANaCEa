/**
 * Wellness Check Modal
 * Shows gentle reminders to take breaks and includes breathing exercises
 * Phase 13: Requirement 54
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Coffee, Wind } from 'lucide-react';
import { useFocusTrap, useKeyboardNavigation } from '@/lib/utils/accessibilityUtils';

interface WellnessCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: 'rapid_questions' | 'late_night' | 'manual';
}

type BreathingPhase = 'inhale' | 'hold' | 'exhale' | 'idle';

export const WellnessCheckModal: React.FC<WellnessCheckModalProps> = ({
  isOpen,
  onClose,
  reason,
}) => {
  const [isBreathing, setIsBreathing] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState<BreathingPhase>('idle');
  const [countdown, setCountdown] = useState(0);
  const breathingActiveRef = React.useRef(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(modalRef as React.RefObject<HTMLElement>, isOpen);
  useKeyboardNavigation(onClose);

  const reasonMessages = {
    rapid_questions: "You've been answering questions rapidly. Great focus!",
    late_night: "You're studying late into the night. Remember to rest!",
    manual: 'Time for a wellness check!',
  };

  // 4-7-8 Breathing Technique Timer
  useEffect(() => {
    if (!isBreathing) {
      breathingActiveRef.current = false;
      setBreathingPhase('idle');
      return;
    }

    breathingActiveRef.current = true;

    const breathingCycle = async () => {
      if (!breathingActiveRef.current) return;

      // Inhale for 4 seconds
      setBreathingPhase('inhale');
      setCountdown(4);
      await runCountdown(4);

      if (!breathingActiveRef.current) return;

      // Hold for 7 seconds
      setBreathingPhase('hold');
      setCountdown(7);
      await runCountdown(7);

      if (!breathingActiveRef.current) return;

      // Exhale for 8 seconds
      setBreathingPhase('exhale');
      setCountdown(8);
      await runCountdown(8);

      if (!breathingActiveRef.current) return;

      // Brief pause before next cycle
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Continue if still breathing
      if (breathingActiveRef.current) {
        breathingCycle();
      }
    };

    breathingCycle();

    return () => {
      breathingActiveRef.current = false;
    };
  }, [isBreathing]);

  const runCountdown = (seconds: number): Promise<void> => {
    return new Promise((resolve) => {
      let remaining = seconds;
      const interval = setInterval(() => {
        remaining--;
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
          resolve();
        }
      }, 1000);
    });
  };

  const handleStartBreathing = () => {
    setIsBreathing(true);
  };

  const handleStopBreathing = () => {
    setIsBreathing(false);
    setBreathingPhase('idle');
  };

  const handleDismiss = () => {
    handleStopBreathing();
    onClose();
  };

  const getBreathingColor = () => {
    switch (breathingPhase) {
      case 'inhale':
        return 'from-blue-400 to-blue-600';
      case 'hold':
        return 'from-purple-400 to-purple-600';
      case 'exhale':
        return 'from-green-400 to-green-600';
      default:
        return 'from-slate-400 to-slate-600';
    }
  };

  const getBreathingScale = () => {
    switch (breathingPhase) {
      case 'inhale':
        return 1.4;
      case 'hold':
        return 1.4;
      case 'exhale':
        return 0.8;
      default:
        return 1;
    }
  };

  const getBreathingInstruction = () => {
    switch (breathingPhase) {
      case 'inhale':
        return 'Breathe in slowly...';
      case 'hold':
        return 'Hold your breath...';
      case 'exhale':
        return 'Breathe out slowly...';
      default:
        return 'Ready to begin?';
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
       
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={handleDismiss}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wellness-modal-title"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 20 }}
          ref={modalRef}
          className="bg-[var(--color-bg-primary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] max-w-md w-full p-8 border border-[var(--color-border)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="text-center mb-6">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full mb-4"
            >
              <Heart className="w-8 h-8 text-white" />
            </motion.div>
            <h2
              id="wellness-modal-title"
              className="text-2xl font-bold text-[var(--color-text-primary)] mb-2"
            >
              Wellness Check
            </h2>
            <p className="text-[var(--color-text-secondary)]">{reasonMessages[reason]}</p>
          </div>

          {/* Wellness Tips */}
          <div className="space-y-4 mb-6">
            <div className="flex items-start gap-3 p-3 bg-[color-mix(in_srgb,var(--color-category-practice)_20%,transparent)] rounded-lg">
              <Coffee className="w-5 h-5 text-[var(--color-category-practice)] mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[var(--color-text-secondary)]">
                Take a moment to drink water or grab a healthy snack
              </p>
            </div>
            <div className="flex items-start gap-3 p-3 bg-data-pass dark:bg-data-pass/20 rounded-lg">
              <Wind className="w-5 h-5 text-data-pass dark:text-data-pass mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[var(--color-text-secondary)]">
                Try the 4-7-8 breathing technique to reset your focus
              </p>
            </div>
          </div>

          {/* Breathing Exercise */}
          <div className="bg-gradient-to-br from-[var(--color-bg-tertiary)] to-[var(--color-bg-secondary)] rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 text-center">
              4-7-8 Breathing Timer
            </h3>

            {/* Breathing Circle */}
            <div className="flex items-center justify-center mb-4">
              <motion.div
                animate={{ scale: getBreathingScale() }}
                transition={{
                  duration:
                    breathingPhase === 'hold'
                      ? 0.5
                      : breathingPhase === 'inhale'
                        ? 4
                        : breathingPhase === 'exhale'
                          ? 8
                          : 0,
                }}
                className={`w-32 h-32 rounded-full bg-gradient-to-br ${getBreathingColor()} 
                  flex items-center justify-center shadow-lg`}
              >
                <span className="text-4xl font-bold text-white">
                  {breathingPhase !== 'idle' ? countdown : '•'}
                </span>
              </motion.div>
            </div>

            {/* Instructions */}
            <p className="text-center text-[var(--color-text-secondary)] mb-4 min-h-[1.5rem]">
              {getBreathingInstruction()}
            </p>

            {/* Breathing Controls */}
            <div className="flex gap-3">
              {!isBreathing ? (
                <button
                  onClick={handleStartBreathing}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white 
                    py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-200
                    hover:scale-105"
                >
                  Start Breathing Exercise
                </button>
              ) : (
                <button
                  onClick={handleStopBreathing}
                  className="flex-1 bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-hover)] text-[var(--color-text-inverse)] 
                    py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-200"
                >
                  Stop
                </button>
              )}
            </div>
          </div>

          {/* Dismiss Button */}
          <button
            onClick={handleDismiss}
            className="w-full py-3 bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] 
              rounded-lg font-semibold hover:bg-[var(--color-bg-secondary)] transition-colors"
            aria-label="Dismiss and continue studying"
          >
            I'm Ready to Continue
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default WellnessCheckModal;
