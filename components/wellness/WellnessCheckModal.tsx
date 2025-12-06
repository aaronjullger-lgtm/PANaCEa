/**
 * Wellness Check Modal
 * Shows gentle reminders to take breaks and includes breathing exercises
 * Phase 13: Requirement 54
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Coffee, Wind } from 'lucide-react';

interface WellnessCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: 'rapid_questions' | 'late_night' | 'manual';
}

type BreathingPhase = 'inhale' | 'hold' | 'exhale' | 'idle';

export const WellnessCheckModal: React.FC<WellnessCheckModalProps> = ({
  isOpen,
  onClose,
  reason
}) => {
  const [isBreathing, setIsBreathing] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState<BreathingPhase>('idle');
  const [countdown, setCountdown] = useState(0);

  const reasonMessages = {
    rapid_questions: "You've been answering questions rapidly. Great focus!",
    late_night: "You're studying late into the night. Remember to rest!",
    manual: "Time for a wellness check!"
  };

  // 4-7-8 Breathing Technique Timer
  useEffect(() => {
    if (!isBreathing) {
      setBreathingPhase('idle');
      return;
    }

    const breathingCycle = async () => {
      // Inhale for 4 seconds
      setBreathingPhase('inhale');
      setCountdown(4);
      await runCountdown(4);

      // Hold for 7 seconds
      setBreathingPhase('hold');
      setCountdown(7);
      await runCountdown(7);

      // Exhale for 8 seconds
      setBreathingPhase('exhale');
      setCountdown(8);
      await runCountdown(8);

      // Brief pause before next cycle
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Continue if still breathing
      if (isBreathing) {
        breathingCycle();
      }
    };

    breathingCycle();
  }, [isBreathing]);

  const runCountdown = (seconds: number): Promise<void> => {
    return new Promise(resolve => {
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
      case 'inhale': return 'from-blue-400 to-blue-600';
      case 'hold': return 'from-purple-400 to-purple-600';
      case 'exhale': return 'from-green-400 to-green-600';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  const getBreathingScale = () => {
    switch (breathingPhase) {
      case 'inhale': return 1.4;
      case 'hold': return 1.4;
      case 'exhale': return 0.8;
      default: return 1;
    }
  };

  const getBreathingInstruction = () => {
    switch (breathingPhase) {
      case 'inhale': return 'Breathe in slowly...';
      case 'hold': return 'Hold your breath...';
      case 'exhale': return 'Breathe out slowly...';
      default: return 'Ready to begin?';
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={handleDismiss}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 20 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8"
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
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Wellness Check
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              {reasonMessages[reason]}
            </p>
          </div>

          {/* Wellness Tips */}
          <div className="space-y-4 mb-6">
            <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Coffee className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Take a moment to drink water or grab a healthy snack
              </p>
            </div>
            <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Wind className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Try the 4-7-8 breathing technique to reset your focus
              </p>
            </div>
          </div>

          {/* Breathing Exercise */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
              4-7-8 Breathing Timer
            </h3>
            
            {/* Breathing Circle */}
            <div className="flex items-center justify-center mb-4">
              <motion.div
                animate={{ scale: getBreathingScale() }}
                transition={{ duration: breathingPhase === 'hold' ? 0.5 : 
                  breathingPhase === 'inhale' ? 4 : breathingPhase === 'exhale' ? 8 : 0 }}
                className={`w-32 h-32 rounded-full bg-gradient-to-br ${getBreathingColor()} 
                  flex items-center justify-center shadow-lg`}
              >
                <span className="text-4xl font-bold text-white">
                  {breathingPhase !== 'idle' ? countdown : '•'}
                </span>
              </motion.div>
            </div>

            {/* Instructions */}
            <p className="text-center text-gray-700 dark:text-gray-300 mb-4 min-h-[1.5rem]">
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
                  className="flex-1 bg-gradient-to-r from-gray-500 to-gray-600 text-white 
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
            className="w-full py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 
              rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            I'm Ready to Continue
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default WellnessCheckModal;
