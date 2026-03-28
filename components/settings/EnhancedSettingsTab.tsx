/**
 * EnhancedSettingsTab - Improved Settings Tab Component
 *
 * Reorganized settings with:
 * 1. Career Stage selection prominently displayed
 * 2. Better grouped sections
 * 3. Context-aware options based on PANCE/PANRE selection
 * 4. Account info and sync status (moved from AccountFooter)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser, useClerk } from '@clerk/clerk-react';
import {
  User,
  GraduationCap,
  School,
  Calendar,
  Sun,
  Moon,
  Stethoscope,
  BookOpen,
  Palette,
  Check,
  ChevronDown,
  ChevronUp,
  Briefcase,
  Target,
  Award,
  AlertCircle,
  Lightbulb,
  Cloud,
  CheckCircle,
  XCircle,
  LogOut,
  Mail,
  Flame,
} from 'lucide-react';
import type { UserProfile, YearInProgram, ClinicalRotation } from '@/types';
import { YEAR_IN_PROGRAM_OPTIONS } from '@/types';
import {
  loadUserProfile,
  updateUserProfile,
  getUserContext,
  setUserContext,
  type CareerStage,
} from '@/services/analytics';
import { useUserProfile } from '@/hooks/useUserProfile';
import { refreshUserContext } from '@/hooks/useUserContext';
import { usePreferences } from '@/hooks/usePreferences';
import { StorageKeys } from '@/lib/storage/storageRegistry';
import { RotationSelector } from '@/components/onboarding/RotationSelector';
import { isEorRotation } from '@/config/rotation-systems';
import { ANALYTICS_PALETTES, type AnalyticsPalette } from '@/components/modals/SettingsStatsModal';
import FSRSOptimizer from './FSRSOptimizer';
import WorkloadProjector from './WorkloadProjector';
import DataExport from './DataExport';

interface EnhancedSettingsTabProps {
  theme: 'light' | 'dark';
  onToggleTheme?: () => void;
  analyticsPalette: AnalyticsPalette;
  onSetAnalyticsPalette: (palette: AnalyticsPalette) => void;
  // Sync status props (passed from parent)
  isSyncing?: boolean;
  lastSyncTime?: number | null;
  syncError?: string | null;
}

// Career stage options (Step 1: Role)
const CAREER_STAGE_OPTIONS: {
  value: CareerStage;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    value: 'student',
    label: 'PA Student',
    description: 'Preparing for PANCE certification exam',
    icon: BookOpen,
  },
  {
    value: 'practicing',
    label: 'Practicing PA',
    description: 'Certified PA preparing for PANRE/PANRE-LA',
    icon: Stethoscope,
  },
];

// Phase options (Step 2: If Student) — Didactic = Curriculum Mode, Clinical = Rotation Mode
const PHASE_OPTIONS: { value: YearInProgram; label: string; sublabel: string }[] = [
  {
    value: 'Didactic Year 1',
    label: 'Didactic Year (Classroom)',
    sublabel: 'Curriculum Mode — lock Main Session to your current modules',
  },
  {
    value: 'Clinical Year',
    label: 'Clinical Year (Rotations)',
    sublabel: 'Rotation Mode — focus on current rotation + background PANCE prep',
  },
];

const EnhancedSettingsTab: React.FC<EnhancedSettingsTabProps> = ({
  theme,
  onToggleTheme,
  analyticsPalette,
  onSetAnalyticsPalette,
  isSyncing,
  lastSyncTime,
  syncError,
}) => {
  // Clerk user & auth
  const { isSignedIn, user, isLoaded } = useUser();
  const { signOut } = useClerk();

  // API-backed profile when signed in
  const { profile: apiProfile, updateProfile: updateProfileApi } = useUserProfile();

  // Local profile state (merge API + localStorage)
  const [userProfile, setUserProfileState] = useState<UserProfile>(() => {
    return loadUserProfile() || { hasCompletedOnboarding: false };
  });

  // Sync from API when signed in and profile loads; persist to localStorage for question service (Clinical 60/40)
  useEffect(() => {
    if (isSignedIn && apiProfile) {
      const local = (loadUserProfile() || {}) as Partial<UserProfile>;
      const yearInProgram = (apiProfile.yearInProgram as YearInProgram) ?? local.yearInProgram;
      const currentRotation =
        (apiProfile.currentRotation as ClinicalRotation) ?? local.currentRotation;
      setUserProfileState({
        hasCompletedOnboarding: apiProfile.hasCompletedOnboarding,
        school: apiProfile.school ?? local.school,
        graduationDate: apiProfile.graduationDate
          ? apiProfile.graduationDate.slice(0, 7)
          : local.graduationDate, // API returns ISO; month input needs YYYY-MM
        yearInProgram,
        currentRotation,
        eorTestDate: apiProfile.eorTestDate ?? local.eorTestDate,
        rotationStartDate: apiProfile.rotationStartDate ?? local.rotationStartDate,
        rotationEndDate: apiProfile.rotationEndDate ?? local.rotationEndDate,
        isCertifiedPA: local.isCertifiedPA,
      });
      if (yearInProgram != null) localStorage.setItem(StorageKeys.YEAR_IN_PROGRAM, yearInProgram);
      if (currentRotation != null)
        localStorage.setItem(StorageKeys.CURRENT_ROTATION, currentRotation);
    }
  }, [isSignedIn, apiProfile]);

  // Career stage state
  const [careerStage, setCareerStageState] = useState<CareerStage>(() => {
    return getUserContext().careerStage;
  });

  // Expanded sections
  const { preferences, updatePreference } = usePreferences();
  const streakGoalDays = preferences.streakGoalDays ?? 'all';

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['career-stage', 'profile'])
  );

  // Sync career stage with profile changes
  useEffect(() => {
    // When yearInProgram is 'Graduated', auto-set to practicing
    if (userProfile.yearInProgram === 'Graduated' && careerStage !== 'practicing') {
      handleCareerStageChange('practicing');
    }
  }, [userProfile.yearInProgram]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleCareerStageChange = (stage: CareerStage) => {
    setCareerStageState(stage);
    setUserContext({ careerStage: stage });

    // Notify all listeners to update their context immediately
    refreshUserContext();

    // Also update profile if changing to practicing and not already graduated
    if (stage === 'practicing' && userProfile.yearInProgram !== 'Graduated') {
      const localUpdated = updateUserProfile({
        yearInProgram: 'Graduated',
        isCertifiedPA: true,
      });
      setUserProfileState(localUpdated);
      if (isSignedIn) {
        updateProfileApi({ yearInProgram: 'Graduated' }).catch((err: unknown) => {
          console.warn('[Settings] API sync failed for graduation status; local state retained:', err);
        });
      }
    }
  };

  const handleUpdateProfile = useCallback(
    (updates: Partial<UserProfile>) => {
      const localUpdated = updateUserProfile(updates);
      setUserProfileState(localUpdated);

      // Persist yearInProgram and currentRotation to localStorage for question service (Clinical 60/40)
      if (updates.yearInProgram !== undefined) {
        if (updates.yearInProgram)
          localStorage.setItem(StorageKeys.YEAR_IN_PROGRAM, updates.yearInProgram);
        else localStorage.removeItem(StorageKeys.YEAR_IN_PROGRAM);
      }
      if (updates.currentRotation !== undefined) {
        if (updates.currentRotation)
          localStorage.setItem(StorageKeys.CURRENT_ROTATION, updates.currentRotation);
        else localStorage.removeItem(StorageKeys.CURRENT_ROTATION);
      }

      if (isSignedIn) {
        const apiUpdates: Parameters<typeof updateProfileApi>[0] = {};
        if (updates.school !== undefined) apiUpdates.school = updates.school || null;
        if (updates.graduationDate !== undefined)
          apiUpdates.graduationDate = updates.graduationDate
            ? `${updates.graduationDate}-01T00:00:00.000Z`
            : null;
        if (updates.yearInProgram !== undefined)
          apiUpdates.yearInProgram = updates.yearInProgram || null;
        if (updates.currentRotation !== undefined)
          apiUpdates.currentRotation = updates.currentRotation || null;
        // EOR/rotation dates persisted via API when signed in; server is source of truth
        if (updates.eorTestDate !== undefined)
          apiUpdates.eorTestDate = updates.eorTestDate ? `${updates.eorTestDate}T00:00:00.000Z` : null;
        if (updates.rotationStartDate !== undefined)
          apiUpdates.rotationStartDate = updates.rotationStartDate
            ? `${updates.rotationStartDate}T00:00:00.000Z`
            : null;
        if (updates.rotationEndDate !== undefined)
          apiUpdates.rotationEndDate = updates.rotationEndDate
            ? `${updates.rotationEndDate}T00:00:00.000Z`
            : null;
        if (updates.hasCompletedOnboarding !== undefined)
          apiUpdates.hasCompletedOnboarding = updates.hasCompletedOnboarding;

        if (Object.keys(apiUpdates).length > 0) {
          updateProfileApi(apiUpdates).catch((err: unknown) => {
            console.warn('[Settings] API sync failed for profile update; local state retained:', err);
          });
        }
      }
    },
    [isSignedIn, updateProfileApi]
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Career Stage Selection - Most Important */}
      <section className="bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)] rounded-xl border-2 border-[var(--color-border)] overflow-hidden">
        <button
          onClick={() => toggleSection('career-stage')}
          className="w-full p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)] flex items-center justify-center">
              <Target className="w-5 h-5 text-[var(--color-text-inverse)]" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-[var(--color-text-primary)]">Your Exam Focus</h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                {careerStage === 'student'
                  ? 'PANCE Preparation'
                  : careerStage === 'practicing'
                    ? 'PANRE-LA Maintenance'
                    : 'Select your exam path'}
              </p>
            </div>
          </div>
          {expandedSections.has('career-stage') ? (
            <ChevronUp className="w-5 h-5 text-[var(--color-text-muted)]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[var(--color-text-muted)]" />
          )}
        </button>

        <AnimatePresence>
          {expandedSections.has('career-stage') && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-4 pt-0 space-y-3">
                <p className="text-sm text-[var(--color-text-muted)]">
                  This determines which content and features are shown to you:
                </p>

                <div className="space-y-2">
                  {CAREER_STAGE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = careerStage === option.value;

                    return (
                      <button
                        key={option.value}
                        onClick={() => handleCareerStageChange(option.value)}
                        className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                          isSelected
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                            : 'border-[var(--color-border)] hover:border-[var(--color-accent)] bg-[var(--color-bg-primary)]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              isSelected
                                ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[var(--color-text-primary)]">
                                {option.label}
                              </span>
                              {isSelected && (
                                <Check className="w-4 h-4 text-[var(--color-accent)]" />
                              )}
                            </div>
                            <p className="text-sm text-[var(--color-text-muted)]">
                              {option.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {careerStage === 'unknown' && (
                  <div className="flex items-start gap-2 p-3 bg-[var(--color-data-provisional)]/10 border border-[var(--color-data-provisional)]/30 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-[var(--color-data-provisional)] mt-0.5" />
                    <p className="text-xs text-[var(--color-data-provisional)]">
                      Please select your exam focus to unlock all relevant features
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Streak & Rest (Weekend Mode) — don't gamify burnout */}
      <section className="bg-[var(--color-bg-secondary)] rounded-xl border-2 border-[var(--color-border)] overflow-hidden">
        <button
          onClick={() => toggleSection('streak-rest')}
          className="w-full p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-data-provisional/20 flex items-center justify-center">
              <Flame className="w-5 h-5 text-data-provisional" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-[var(--color-text-primary)]">Streak & Rest</h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                {streakGoalDays === 'weekdays'
                  ? 'Weekdays only — weekends don’t break your streak'
                  : 'Every day counts toward your streak'}
              </p>
            </div>
          </div>
          {expandedSections.has('streak-rest') ? (
            <ChevronUp className="w-5 h-5 text-[var(--color-text-muted)]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[var(--color-text-muted)]" />
          )}
        </button>
        <AnimatePresence>
          {expandedSections.has('streak-rest') && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-4 pt-0 space-y-3">
                <p className="text-sm text-[var(--color-text-muted)]">
                  Choose when your streak is required. Weekdays only means Saturday and Sunday won’t
                  break your streak — rest days matter.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => updatePreference('streakGoalDays', 'all')}
                    className={`flex-1 py-2.5 px-4 rounded-xl font-medium transition-colors ${
                      streakGoalDays === 'all'
                        ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                        : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]/80'
                    }`}
                  >
                    Every day
                  </button>
                  <button
                    onClick={() => updatePreference('streakGoalDays', 'weekdays')}
                    className={`flex-1 py-2.5 px-4 rounded-xl font-medium transition-colors ${
                      streakGoalDays === 'weekdays'
                        ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                        : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]/80'
                    }`}
                  >
                    Weekdays only
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Profile Information */}
      <section className="bg-[var(--color-bg-secondary)] rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection('profile')}
          className="w-full p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-[var(--color-accent)]" />
            <div className="text-left">
              <h3 className="font-medium text-[var(--color-text-primary)]">Profile Details</h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                {userProfile.school || 'School not set'} •{' '}
                {userProfile.yearInProgram || 'Year not set'}
              </p>
            </div>
          </div>
          {expandedSections.has('profile') ? (
            <ChevronUp className="w-5 h-5 text-[var(--color-text-muted)]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[var(--color-text-muted)]" />
          )}
        </button>

        <AnimatePresence>
          {expandedSections.has('profile') && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-4 pt-0 space-y-4">
                {/* School */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                    <School className="w-4 h-4" />
                    PA Program
                  </label>
                  <input
                    type="text"
                    value={userProfile.school || ''}
                    onChange={(e) => handleUpdateProfile({ school: e.target.value })}
                    placeholder="e.g., Duke University PA Program"
                    className="w-full px-4 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg 
                      text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]
                      focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent
                      transition-all text-sm"
                  />
                </div>

                {/* Year in Program - Only for students */}
                {careerStage === 'student' && (
                  <div>
                    <label
                      htmlFor="settings-year-in-program"
                      className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)] mb-2"
                    >
                      <GraduationCap className="w-4 h-4" />
                      Training year
                    </label>
                    <div className="relative">
                      <select
                        id="settings-year-in-program"
                        value={userProfile.yearInProgram || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value && YEAR_IN_PROGRAM_OPTIONS.includes(value as YearInProgram)) {
                            handleUpdateProfile({ yearInProgram: value as YearInProgram });
                          }
                        }}
                        aria-label="Training year"
                        className="w-full px-4 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg 
                          text-[var(--color-text-primary)] appearance-none
                          focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent
                          transition-all text-sm"
                      >
                        <option value="">Select year...</option>
                        {YEAR_IN_PROGRAM_OPTIONS.filter((y) => y !== 'Graduated').map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
                    </div>
                  </div>
                )}

                {/* Graduation Date */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                    <Calendar className="w-4 h-4" />
                    {careerStage === 'student' ? 'Expected Graduation' : 'Graduation Date'}
                  </label>
                  <input
                    id="settings-graduation-month"
                    type="text"
                    inputMode="numeric"
                    pattern="\\d{4}-\\d{2}"
                    value={userProfile.graduationDate || ''}
                    onChange={(e) => handleUpdateProfile({ graduationDate: e.target.value })}
                    aria-label={
                      careerStage === 'student' ? 'Expected graduation month' : 'Graduation month'
                    }
                    placeholder="YYYY-MM"
                    title="Enter month as YYYY-MM"
                    className="w-full px-4 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg 
                      text-[var(--color-text-primary)]
                      focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent
                      transition-all text-sm"
                  />
                </div>

                {/* Rotation Selector - Only for Clinical Year students */}
                {careerStage === 'student' && userProfile.yearInProgram === 'Clinical Year' && (
                  <div className="space-y-4">
                    <RotationSelector
                      value={userProfile.currentRotation}
                      onChange={(rotation: ClinicalRotation) =>
                        handleUpdateProfile({ currentRotation: rotation })
                      }
                      label="Current Clinical Rotation"
                    />
                    {/* EOR Test Date - when on an EOR rotation, set date to show EOR Readiness on dashboard */}
                    {userProfile.currentRotation && isEorRotation(userProfile.currentRotation) && (
                        <div>
                          <label
                            htmlFor="settings-eor-test-date"
                            className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2"
                          >
                            EOR Test Date
                          </label>
                          <input
                            id="settings-eor-test-date"
                            type="date"
                            value={
                              userProfile.eorTestDate
                                ? userProfile.eorTestDate.includes('T')
                                  ? userProfile.eorTestDate.split('T')[0]
                                  : userProfile.eorTestDate
                                : ''
                            }
                            onChange={(e) =>
                              handleUpdateProfile({ eorTestDate: e.target.value || undefined })
                            }
                            aria-label="EOR test date"
                            className="w-full px-4 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm"
                          />
                          <p className="text-xs text-[var(--color-text-muted)] mt-1">
                            Dashboard will show &quot;EOR Readiness&quot; until this date.
                          </p>
                        </div>
                      )}
                  </div>
                )}

                {/* Specialty for practicing PAs */}
                {careerStage === 'practicing' && (
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                      <Briefcase className="w-4 h-4" />
                      Current Specialty
                    </label>
                    <input
                      type="text"
                      value={userProfile.specialty || ''}
                      onChange={(e) => handleUpdateProfile({ specialty: e.target.value })}
                      placeholder="e.g., Emergency Medicine, Cardiology"
                      className="w-full px-4 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg 
                        text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]
                        focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent
                        transition-all text-sm"
                    />
                  </div>
                )}

                {/* Certification Status - Only for practicing PAs */}
                {careerStage === 'practicing' && (
                  <div className="p-3 bg-[var(--color-data-pass)]/10 border border-[var(--color-data-pass)]/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-[var(--color-data-pass)]" />
                      <div>
                        <p className="font-medium text-[var(--color-data-pass)]">PA-C Certified</p>
                        <p className="text-xs text-[var(--color-data-pass)]">
                          PANRE-LA Simulator and recertification content enabled
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Appearance */}
      <section className="bg-[var(--color-bg-secondary)] rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection('appearance')}
          className="w-full p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Palette className="w-5 h-5 text-[var(--color-accent)]" />
            <div className="text-left">
              <h3 className="font-medium text-[var(--color-text-primary)]">Appearance</h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                {theme === 'dark' ? 'Dark' : 'Light'} theme •{' '}
                {ANALYTICS_PALETTES.find((p) => p.id === analyticsPalette)?.label || 'Default'}{' '}
                palette
              </p>
            </div>
          </div>
          {expandedSections.has('appearance') ? (
            <ChevronUp className="w-5 h-5 text-[var(--color-text-muted)]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[var(--color-text-muted)]" />
          )}
        </button>

        <AnimatePresence>
          {expandedSections.has('appearance') && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-4 pt-0 space-y-4">
                {/* Theme Toggle */}
                {onToggleTheme && (
                  <div className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg">
                    <div className="flex items-center gap-3">
                      {theme === 'dark' ? (
                        <Moon className="w-5 h-5 text-[var(--color-accent)]" />
                      ) : (
                        <Sun className="w-5 h-5 text-[var(--color-data-provisional)]" />
                      )}
                      <div>
                        <div className="font-medium text-[var(--color-text-primary)]">
                          {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          Easier on the eyes
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={onToggleTheme}
                      className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-btn-primary-text)] rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
                    >
                      Switch
                    </button>
                  </div>
                )}

                {/* Analytics Palette */}
                <div>
                  <h4 className="font-medium text-[var(--color-text-primary)] mb-2">
                    Analytics Color Palette
                  </h4>
                  <p className="text-xs text-[var(--color-text-muted)] mb-3">
                    Color scheme for charts and visualizations
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    {ANALYTICS_PALETTES.map((palette) => (
                      <button
                        key={palette.id}
                        onClick={() => onSetAnalyticsPalette(palette.id)}
                        className={`p-3 rounded-lg border-2 transition-all text-left ${
                          analyticsPalette === palette.id
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                            : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50 bg-[var(--color-bg-primary)]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm text-[var(--color-text-primary)]">
                            {palette.label}
                          </span>
                          {analyticsPalette === palette.id && (
                            <Check className="w-4 h-4 text-[var(--color-accent)]" />
                          )}
                        </div>
                        <div className="flex gap-1">
                          {Object.values(palette.colors)
                            .slice(0, 5)
                            .map((color) => (
                              <motion.div
                                key={color}
                                className="w-4 h-4 rounded border border-[var(--color-border)]"
                                initial={false}
                                animate={{ backgroundColor: color }}
                              />
                            ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Account & Sync Status Section */}
      {isLoaded && isSignedIn && (
        <section className="bg-[var(--color-bg-secondary)] rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection('account')}
            className="w-full p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-[var(--color-accent)] flex items-center justify-center text-white font-bold ring-2 ring-white/30 dark:ring-white/20">
                {user?.firstName?.charAt(0) ||
                  user?.emailAddresses[0]?.emailAddress?.charAt(0).toUpperCase() ||
                  'S'}
              </div>
              <div className="text-left">
                <h3 className="font-medium text-[var(--color-text-primary)]">
                  {user?.fullName || user?.firstName || 'Account'}
                </h3>
                <p className="text-sm text-[var(--color-text-muted)]">Account & Cloud Sync</p>
              </div>
            </div>
            {expandedSections.has('account') ? (
              <ChevronUp className="w-5 h-5 text-[var(--color-text-muted)]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[var(--color-text-muted)]" />
            )}
          </button>

          <AnimatePresence>
            {expandedSections.has('account') && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="p-4 pt-0 space-y-4">
                  {/* Email */}
                  <div className="flex items-center gap-3 p-3 bg-[var(--color-bg-primary)] rounded-lg">
                    <Mail className="w-5 h-5 text-[var(--color-text-muted)]" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-[var(--color-text-muted)]">Email</div>
                      <div
                        className="text-sm text-[var(--color-text-primary)] truncate"
                        title={user?.emailAddresses[0]?.emailAddress || 'No email'}
                      >
                        {user?.emailAddresses[0]?.emailAddress || 'No email'}
                      </div>
                    </div>
                  </div>

                  {/* Sync Status */}
                  <div className="flex items-center gap-3 p-3 bg-[var(--color-bg-primary)] rounded-lg">
                    {isSyncing ? (
                      <Cloud className="w-5 h-5 text-[var(--color-accent)] animate-pulse" />
                    ) : syncError ? (
                      <XCircle className="w-5 h-5 text-[var(--color-data-fail)]" />
                    ) : lastSyncTime ? (
                      <CheckCircle className="w-5 h-5 text-[var(--color-data-pass)]" />
                    ) : (
                      <Cloud className="w-5 h-5 text-[var(--color-text-muted)]" />
                    )}
                    <div className="flex-1">
                      <div className="text-xs text-[var(--color-text-muted)]">Cloud Sync</div>
                      <div
                        className={`text-sm ${
                          isSyncing
                            ? 'text-[var(--color-accent)]'
                            : syncError
                              ? 'text-[var(--color-data-fail)]'
                              : lastSyncTime
                                ? 'text-[var(--color-data-pass)]'
                                : 'text-[var(--color-text-primary)]'
                        }`}
                      >
                        {isSyncing
                          ? 'Syncing...'
                          : syncError
                            ? 'Sync Error'
                            : lastSyncTime
                              ? 'Synced'
                              : 'Local Only'}
                      </div>
                    </div>
                  </div>

                  {/* Sign Out Button */}
                  <button
                    onClick={() => signOut()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-data-fail)]/10 hover:bg-[var(--color-data-fail)]/20 border border-[var(--color-data-fail)]/30 rounded-lg text-[var(--color-data-fail)] font-medium transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* FSRS Optimizer Section */}
      <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
        <FSRSOptimizer />
      </div>

      {/* Workload Projector Section */}
      <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
        <WorkloadProjector />
      </div>

      {/* Data Export Section */}
      <DataExport />

      {/* Info Tip */}
      <div className="p-4 bg-[var(--color-accent)]/10 rounded-lg border border-[var(--color-accent)]/30">
        <p className="text-sm text-[var(--color-accent)] flex items-start gap-2">
          <Lightbulb className="w-4 h-4 text-[var(--color-data-provisional)] flex-shrink-0 mt-0.5" />
          <span>
            <strong>Tip:</strong> Your settings are saved automatically and sync across devices when
            logged in.
          </span>
        </p>
      </div>
    </div>
  );
};

export default EnhancedSettingsTab;
