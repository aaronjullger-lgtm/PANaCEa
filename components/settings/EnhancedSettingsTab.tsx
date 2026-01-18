/**
 * EnhancedSettingsTab - Improved Settings Tab Component
 *
 * Reorganized settings with:
 * 1. Career Stage selection prominently displayed
 * 2. Better grouped sections
 * 3. Context-aware options based on PANCE/PANRE selection
 * 4. Account info and sync status (moved from AccountFooter)
 */

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import type { UserProfile, YearInProgram, ClinicalRotation } from '@/types';
import { YEAR_IN_PROGRAM_OPTIONS } from '@/types';
import { loadUserProfile, updateUserProfile } from '@/services/userProfileService';
import { getUserContext, setUserContext, CareerStage } from '@/services/userContextService';
import { refreshUserContext } from '@/hooks/useUserContext';
import { RotationSelector } from '../onboarding/RotationSelector';
import { ANALYTICS_PALETTES, type AnalyticsPalette } from '../SettingsStatsModal';

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

// Career stage options with descriptions
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

  // User profile state
  const [userProfile, setUserProfileState] = useState<UserProfile>(() => {
    return loadUserProfile() || { hasCompletedOnboarding: false };
  });

  // Career stage state
  const [careerStage, setCareerStageState] = useState<CareerStage>(() => {
    return getUserContext().careerStage;
  });

  // Expanded sections
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
      const updated = updateUserProfile({
        yearInProgram: 'Graduated',
        isCertifiedPA: true,
      });
      setUserProfileState(updated);
    }
  };

  const handleUpdateProfile = (updates: Partial<UserProfile>) => {
    const updated = updateUserProfile(updates);
    setUserProfileState(updated);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Career Stage Selection - Most Important */}
      <section className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border-2 border-blue-200 dark:border-blue-700 overflow-hidden">
        <button
          onClick={() => toggleSection('career-stage')}
          className="w-full p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
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
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-[var(--color-border)] hover:border-blue-300 bg-[var(--color-bg-primary)]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              isSelected
                                ? 'bg-blue-500 text-white'
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
                              {isSelected && <Check className="w-4 h-4 text-blue-500" />}
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
                  <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      Please select your exam focus to unlock all relevant features
                    </p>
                  </div>
                )}
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
                    <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                      <GraduationCap className="w-4 h-4" />
                      Where are you in your PA journey?
                    </label>
                    <select
                      value={userProfile.yearInProgram || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value && YEAR_IN_PROGRAM_OPTIONS.includes(value as YearInProgram)) {
                          handleUpdateProfile({ yearInProgram: value as YearInProgram });
                        }
                      }}
                      className="w-full px-4 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg 
                        text-[var(--color-text-primary)]
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
                  </div>
                )}

                {/* Graduation Date */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                    <Calendar className="w-4 h-4" />
                    {careerStage === 'student' ? 'Expected Graduation' : 'Graduation Date'}
                  </label>
                  <input
                    type="month"
                    value={userProfile.graduationDate || ''}
                    onChange={(e) => handleUpdateProfile({ graduationDate: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg 
                      text-[var(--color-text-primary)]
                      focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent
                      transition-all text-sm"
                  />
                </div>

                {/* Rotation Selector - Only for Clinical Year students */}
                {careerStage === 'student' && userProfile.yearInProgram === 'Clinical Year' && (
                  <div>
                    <RotationSelector
                      value={userProfile.currentRotation}
                      onChange={(rotation: ClinicalRotation) =>
                        handleUpdateProfile({ currentRotation: rotation })
                      }
                      label="Current Clinical Rotation"
                    />
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
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium text-green-800 dark:text-green-300">
                          PA-C Certified
                        </p>
                        <p className="text-xs text-green-700 dark:text-green-400">
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
                        <Moon className="w-5 h-5 text-indigo-400" />
                      ) : (
                        <Sun className="w-5 h-5 text-amber-500" />
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
                      className="px-4 py-2 bg-[var(--color-accent)] text-white dark:text-slate-900 rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
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
                            .map((color, i) => (
                              <div
                                key={i}
                                className="w-4 h-4 rounded border border-[var(--color-border)]"
                                style={{ backgroundColor: color }}
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
              <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--color-accent)] flex items-center justify-center text-white font-bold ring-2 ring-white/30 dark:ring-white/20">
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
                      <div className="text-sm text-[var(--color-text-primary)] truncate">
                        {user?.emailAddresses[0]?.emailAddress || 'No email'}
                      </div>
                    </div>
                  </div>

                  {/* Sync Status */}
                  <div className="flex items-center gap-3 p-3 bg-[var(--color-bg-primary)] rounded-lg">
                    {isSyncing ? (
                      <Cloud className="w-5 h-5 text-blue-500 animate-pulse" />
                    ) : syncError ? (
                      <XCircle className="w-5 h-5 text-red-500" />
                    ) : lastSyncTime ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <Cloud className="w-5 h-5 text-[var(--color-text-muted)]" />
                    )}
                    <div className="flex-1">
                      <div className="text-xs text-[var(--color-text-muted)]">Cloud Sync</div>
                      <div
                        className={`text-sm ${
                          isSyncing
                            ? 'text-blue-600 dark:text-blue-400'
                            : syncError
                              ? 'text-red-600 dark:text-red-400'
                              : lastSyncTime
                                ? 'text-green-600 dark:text-green-400'
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
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-600 dark:text-red-400 font-medium transition-colors"
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

      {/* Info Tip */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
        <p className="text-sm text-blue-900 dark:text-blue-200 flex items-start gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
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
