/**
 * SimulationPage - Core PANCE Simulation Dedicated Page
 *
 * Displays the adaptive quiz engine with focus options (All Topics / Growth Areas / Flagged)
 * Replaces the modal flow with a dedicated route at /simulation/core-pance
 * For Didactic users, passes enabled systems so Core PANCE only serves questions from current curriculum.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, Target, Flag, TrendingUp, Zap, Clock, Award } from 'lucide-react';
import type { SessionSettings, PerformanceRecord, Question, SystemCode } from '../types';
import { useUserContext } from '../hooks/useUserContext';
import { ABBREVIATION_TO_TOPIC_MAP } from "@/config/topic-map";

interface SimulationPageProps {
  onStartSession: (settings: SessionSettings) => void | Promise<void>;
  onBack: () => void;
  performanceData: PerformanceRecord[];
  flaggedQuestions: Question[];
  growthAreas: string[];
  examLabel?: string;
  initialFocus?: FocusOption;
}

type FocusOption = 'all' | 'growth' | 'flagged' | 'due';

export const SimulationPage: React.FC<SimulationPageProps> = ({
  onStartSession,
  onBack: _onBack,
  performanceData,
  flaggedQuestions,
  growthAreas,
  examLabel = 'PANCE',
  initialFocus = 'all',
}) => {
  const [selectedFocus, setSelectedFocus] = useState<FocusOption>(initialFocus);
  const { careerStage } = useUserContext();
  const [enabledSystems, setEnabledSystems] = useState<Set<SystemCode>>(() => {
    try {
      const saved = localStorage.getItem('panceai_enabled_systems');
      if (saved) return new Set(JSON.parse(saved) as SystemCode[]);
    } catch {
      /* ignore */
    }
    return new Set(Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[]);
  });

  useEffect(() => {
    const handler = () => {
      try {
        const saved = localStorage.getItem('panceai_enabled_systems');
        if (saved) setEnabledSystems(new Set(JSON.parse(saved) as SystemCode[]));
      } catch {
        /* ignore */
      }
    };
    globalThis.addEventListener('panceai_enabled_systems_changed', handler);
    return () => globalThis.removeEventListener('panceai_enabled_systems_changed', handler);
  }, []);

  // Calculate real stats from performance data
  const stats = useMemo(() => {
    const recent = performanceData.slice(-100);
    const correct = recent.filter((r) => r.isCorrect).length;
    const accuracy = recent.length > 0 ? Math.round((correct / recent.length) * 100) : 0;

    const today = new Date().toDateString();
    const todayQuestions = performanceData.filter(
      (r) => new Date(r.timestamp).toDateString() === today
    ).length;

    return {
      accuracy,
      todayQuestions,
      totalQuestions: performanceData.length,
      flaggedCount: flaggedQuestions.length,
      growthAreasCount: growthAreas.length,
    };
  }, [performanceData, flaggedQuestions, growthAreas]);

  const handleStart = () => {
    let focus: SessionSettings['focus'];
    switch (selectedFocus) {
      case 'growth':
        focus = 'growth';
        break;
      case 'flagged':
        focus = 'reviewFlagged';
        break;
      case 'due':
        focus = 'due';
        break;
      default:
        focus = 'all';
    }

    const allSystems = Object.keys(ABBREVIATION_TO_TOPIC_MAP).length;
    const isDidacticWithCurriculum =
      careerStage === 'student' && enabledSystems.size > 0 && enabledSystems.size < allSystems;

    const settings: SessionSettings = { focus };
    // Core PANCE Simulation "All Topics": strict NCCPA blueprint, no adaptive/weak-area bias
    if (selectedFocus === 'all') {
      settings.simulationStrict = true;
    }
    if (isDidacticWithCurriculum) {
      settings.systems = Array.from(enabledSystems);
    }
    onStartSession(settings);
  };

  const getFocusDescription = () => {
    switch (selectedFocus) {
      case 'all':
        return 'Strict NCCPA blueprint weighting. No weak-area bias — exam-representative mix only.';
      case 'growth':
        return `Target your ${stats.growthAreasCount} weakest areas for maximum improvement`;
      case 'flagged':
        return `Review ${stats.flaggedCount} questions you've marked for later`;
      case 'due':
        return 'Focus on questions due for spaced repetition review';
      default:
        return '';
    }
  };

  const focusOptions: Array<{
    id: FocusOption;
    label: string;
    subtitle: string;
    icon: React.ElementType;
    color: string;
    stat?: number;
  }> = [
    { id: 'all', label: 'All Topics', subtitle: 'Strict NCCPA blueprint weighting', icon: Brain, color: 'blue', stat: stats.totalQuestions },
    {
      id: 'growth',
      label: 'Growth Areas',
      subtitle: 'Target your weakest systems',
      icon: TrendingUp,
      color: 'amber',
      stat: stats.growthAreasCount,
    },
    { id: 'flagged', label: 'Flagged', subtitle: 'Questions you marked for later', icon: Flag, color: 'purple', stat: stats.flaggedCount },
    {
      id: 'due',
      label: examLabel === 'PANRE' ? 'Maintenance Due' : 'Due for Review',
      subtitle: 'Spaced repetition reviews',
      icon: Clock,
      color: 'emerald',
    },
  ];

  const getFocusTone = (tone: string) => {
    switch (tone) {
      case 'amber':
        return {
          border: 'border-[var(--color-data-provisional)]',
          bg: 'bg-[var(--color-data-provisional)]/10',
          badge: 'bg-[var(--color-data-provisional)]/15 text-[var(--color-data-provisional)]',
          icon: 'bg-[var(--color-data-provisional)] text-[var(--color-text-inverse)]',
          check: 'bg-[var(--color-data-provisional)]',
        };
      case 'emerald':
        return {
          border: 'border-[var(--color-data-pass)]',
          bg: 'bg-[var(--color-data-pass)]/10',
          badge: 'bg-[var(--color-data-pass)]/15 text-[var(--color-data-pass)]',
          icon: 'bg-[var(--color-data-pass)] text-[var(--color-text-inverse)]',
          check: 'bg-[var(--color-data-pass)]',
        };
      case 'purple':
        return {
          border: 'border-[var(--color-data-fail)]',
          bg: 'bg-[var(--color-data-fail)]/10',
          badge: 'bg-[var(--color-data-fail)]/15 text-[var(--color-data-fail)]',
          icon: 'bg-[var(--color-data-fail)] text-[var(--color-text-inverse)]',
          check: 'bg-[var(--color-data-fail)]',
        };
      default:
        return {
          border: 'border-[var(--color-accent)]',
          bg: 'bg-[var(--color-accent)]/10',
          badge: 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]',
          icon: 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]',
          check: 'bg-[var(--color-accent)]',
        };
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] py-8 px-4">
      <div className="mx-auto" style={{ maxWidth: 'var(--content-max-width, 72rem)' }}>
        {/* Header */}
        <motion.div
          initial={{ y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-3">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[var(--color-accent)]/10 to-[var(--color-accent)]/5 border border-[var(--color-accent)]/30">
              <Brain className="w-10 h-10 text-[var(--color-accent)]" />
            </div>
            <div>
              <h1 className="text-display-sm font-bold text-[var(--color-text-primary)]" style={{ letterSpacing: '-0.025em' }}>
                {examLabel === 'PANRE' ? 'Knowledge Maintenance' : `Core ${examLabel} Simulation`}
              </h1>
              <p className="text-[var(--color-text-muted)] mt-1">
                {examLabel === 'PANRE'
                  ? 'PANRE-LA check-in — maintain your certification knowledge'
                  : 'Strict blueprint-weighted exam simulation. No adaptive bias.'}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats Bar */}
        <motion.div
          initial={{ y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <div className="card-stat p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-[var(--color-data-pass)]" />
              <span className="text-label text-[var(--color-text-muted)]">Accuracy</span>
            </div>
            <div className="kpi-metric text-[var(--color-text-primary)]">
              {stats.accuracy}%
            </div>
          </div>

          <div className="card-stat p-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-[var(--color-accent)]" />
              <span className="text-label text-[var(--color-text-muted)]">Today</span>
            </div>
            <div className="kpi-metric text-[var(--color-text-primary)]">
              {stats.todayQuestions}
            </div>
          </div>

          <div className="card-stat p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-[var(--color-data-provisional)]" />
              <span className="text-label text-[var(--color-text-muted)]">Growth Areas</span>
            </div>
            <div className="kpi-metric text-[var(--color-text-primary)]">
              {stats.growthAreasCount}
            </div>
          </div>

          <div className="card-stat p-4">
            <div className="flex items-center gap-2 mb-1">
              <Flag className="w-4 h-4 text-[var(--color-data-fail)]" />
              <span className="text-label text-[var(--color-text-muted)]">Flagged</span>
            </div>
            <div className="kpi-metric text-[var(--color-text-primary)]">
              {stats.flaggedCount}
            </div>
          </div>
        </motion.div>

        {/* Focus Selection */}
        <motion.div
          initial={{ y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border)] p-6 mb-6"
        >
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
            Choose Your Focus
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {focusOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedFocus === option.id;
              const tone = getFocusTone(option.color);

              return (
                <button
                  type="button"
                  key={option.id}
                  onClick={() => setSelectedFocus(option.id)}
                  aria-pressed={isSelected}
                  className={`relative flex min-h-[88px] p-5 rounded-xl border-2 transition-all text-left items-center focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:outline-none ${
                    isSelected
                      ? `${tone.border} ${tone.bg}`
                      : 'border-[var(--color-border)] hover:border-[var(--color-border)] bg-[var(--color-bg-primary)]'
                  }`}
                >
                  <div className="flex w-full items-center gap-4">
                    <div
                      className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                        isSelected
                          ? tone.icon
                          : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'
                      }`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-[var(--color-text-primary)]">
                          {option.label}
                        </span>
                        {option.stat !== undefined && (
                          <span
                            className={`text-sm px-2 py-0.5 rounded-full shrink-0 ${
                              isSelected
                                ? tone.badge
                                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'
                            }`}
                          >
                            {option.stat}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] leading-snug">
                        {option.subtitle}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <div
                      className={`absolute top-3 right-3 w-6 h-6 rounded-full ${tone.check} flex items-center justify-center`}
                    >
                      <svg
                        className="w-4 h-4 text-[var(--color-text-inverse)]"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-4 bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border)]">
            <p className="text-sm text-[var(--color-text-muted)]">{getFocusDescription()}</p>
          </div>
        </motion.div>

        {/* Start Button */}
        <motion.button
          type="button"
          initial={{ y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onClick={handleStart}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-5 px-8 bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 text-[var(--color-text-inverse)] font-bold text-lg rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 min-h-[48px]"
          aria-label={
            examLabel === 'PANRE' ? 'Start maintenance session' : `Start ${examLabel} session`
          }
        >
          <Award className="w-6 h-6" aria-hidden />
          {examLabel === 'PANRE' ? 'Start Maintenance' : `Start ${examLabel} Session`}
        </motion.button>
      </div>
    </div>
  );
};
