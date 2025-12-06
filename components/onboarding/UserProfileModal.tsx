/**
 * User Profile Modal Component
 * First sign-in onboarding flow to collect user information
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GraduationCap, 
  Calendar, 
  School, 
  CheckCircle,
  ChevronRight,
  X
} from 'lucide-react';
import { RotationSelector } from './RotationSelector';
import type { UserProfile, YearInProgram, ClinicalRotation } from '@/types';
import { YEAR_IN_PROGRAM_OPTIONS } from '@/types';

interface UserProfileModalProps {
  isOpen: boolean;
  onComplete: (profile: UserProfile) => void;
  onSkip?: () => void;
  canSkip?: boolean;
}

export function UserProfileModal({ 
  isOpen, 
  onComplete, 
  onSkip,
  canSkip = true 
}: UserProfileModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [school, setSchool] = useState('');
  const [graduationDate, setGraduationDate] = useState('');
  const [yearInProgram, setYearInProgram] = useState<YearInProgram | undefined>();
  const [currentRotation, setCurrentRotation] = useState<ClinicalRotation | undefined>();

  const handleContinue = () => {
    if (step === 1) {
      setStep(2);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    const profile: UserProfile = {
      school: school || undefined,
      graduationDate: graduationDate || undefined,
      yearInProgram,
      currentRotation,
      hasCompletedOnboarding: true,
    };
    onComplete(profile);
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      // If no skip handler, just complete with empty profile
      handleComplete();
    }
  };

  if (!isOpen) return null;

  const canProceedStep1 = school.trim() || yearInProgram;
  const showRotationSelector = yearInProgram === 'Clinical Year';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[var(--color-bg-tertiary)] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[var(--color-accent)]/20 rounded-full">
                <GraduationCap className="w-6 h-6 text-[var(--color-accent)]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                  Welcome to PANaCEa!
                </h2>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Step {step} of 2
                </p>
              </div>
            </div>
            {canSkip && (
              <button
                onClick={handleSkip}
                className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                aria-label="Skip onboarding"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div className="px-6 pt-4">
            <div className="h-2 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(step / 2) * 100}%` }}
                transition={{ duration: 0.3 }}
                className="h-full bg-[var(--color-accent)]"
              />
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <p className="text-[var(--color-text-muted)] mb-6">
                    Help us personalize your learning experience by sharing a bit about your background.
                  </p>
                </div>

                {/* School */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                    <School className="w-4 h-4" />
                    PA School/Program
                  </label>
                  <input
                    type="text"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    placeholder="e.g., Duke University, Stanford PA Program"
                    className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg 
                      text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]
                      focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent
                      transition-all"
                  />
                </div>

                {/* Graduation Date */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                    <Calendar className="w-4 h-4" />
                    Expected/Actual Graduation Date
                  </label>
                  <input
                    type="date"
                    value={graduationDate}
                    onChange={(e) => setGraduationDate(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg 
                      text-[var(--color-text-primary)]
                      focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent
                      transition-all"
                  />
                </div>

                {/* Year in Program */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                    <GraduationCap className="w-4 h-4" />
                    Where are you in your PA journey?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {YEAR_IN_PROGRAM_OPTIONS.map((year) => (
                      <button
                        key={year}
                        onClick={() => setYearInProgram(year)}
                        type="button"
                        className={`
                          p-3 rounded-lg border-2 transition-all text-left
                          ${yearInProgram === year
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                            : 'border-[var(--color-border)] hover:border-[var(--color-border-hover)] bg-[var(--color-bg-secondary)]'
                          }
                        `}
                      >
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">
                          {year}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <p className="text-[var(--color-text-muted)] mb-6">
                    {showRotationSelector 
                      ? "What clinical rotation are you currently on? This helps us tailor questions to your immediate learning needs."
                      : "Just one more thing! You're almost ready to start your personalized learning journey."
                    }
                  </p>
                </div>

                {showRotationSelector && (
                  <RotationSelector
                    value={currentRotation}
                    onChange={setCurrentRotation}
                    label="Current Clinical Rotation"
                  />
                )}

                {!showRotationSelector && (
                  <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 text-center">
                    <div className="flex justify-center mb-4">
                      <div className="p-3 bg-green-500/20 rounded-full">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">
                      You're All Set!
                    </h3>
                    <p className="text-[var(--color-text-muted)] text-sm">
                      We've customized PANaCEa based on your profile. You can update these settings anytime.
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-[var(--color-bg-tertiary)] border-t border-[var(--color-border)] px-6 py-4">
            <div className="flex gap-3">
              {step === 2 && (
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 border border-[var(--color-border)] text-[var(--color-text-muted)] 
                    rounded-lg hover:text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)] 
                    transition-colors"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleContinue}
                disabled={step === 1 && !canProceedStep1}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg 
                  font-medium transition-all
                  ${(step === 1 && !canProceedStep1)
                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]'
                  }
                `}
              >
                {step === 1 ? 'Continue' : 'Get Started'}
                {step === 1 ? <ChevronRight className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
              </button>
            </div>
            {canSkip && (
              <button
                onClick={handleSkip}
                className="w-full mt-3 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                Skip for now
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default UserProfileModal;
