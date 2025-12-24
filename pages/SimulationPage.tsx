/**
 * SimulationPage - Core PANCE Simulation Dedicated Page
 * 
 * Displays the adaptive quiz engine with focus options (All Topics / Growth Areas / Flagged)
 * Replaces the modal flow with a dedicated route at /simulation/core-pance
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Brain, Target, Flag, TrendingUp, ChevronLeft, Zap, Clock, Award } from 'lucide-react';
import type { SessionSettings, PerformanceRecord, Question } from '../types';

interface SimulationPageProps {
  onStartSession: (settings: SessionSettings) => void;
  onBack: () => void;
  performanceData: PerformanceRecord[];
  flaggedQuestions: Question[];
  growthAreas: string[];
  examLabel?: string;
}

type FocusOption = 'all' | 'growth' | 'flagged' | 'due';

export const SimulationPage: React.FC<SimulationPageProps> = ({
  onStartSession,
  onBack,
  performanceData,
  flaggedQuestions,
  growthAreas,
  examLabel = 'PANCE',
}) => {
  const [selectedFocus, setSelectedFocus] = useState<FocusOption>('all');
  const [difficulty, setDifficulty] = useState<'same' | 'easier' | 'harder'>('same');

  // Calculate real stats from performance data
  const stats = useMemo(() => {
    const recent = performanceData.slice(-100);
    const correct = recent.filter(r => r.isCorrect).length;
    const accuracy = recent.length > 0 ? Math.round((correct / recent.length) * 100) : 0;
    
    const today = new Date().toDateString();
    const todayQuestions = performanceData.filter(r => 
      new Date(r.timestamp).toDateString() === today
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
        focus = 'review';
        break;
      case 'due':
        focus = 'review';
        break;
      default:
        focus = 'all';
    }

    onStartSession({ focus, difficulty });
  };

  const getFocusDescription = () => {
    switch (selectedFocus) {
      case 'all':
        return 'Cover all PANCE topics with AI-powered adaptive difficulty';
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

  const focusOptions: Array<{ id: FocusOption; label: string; icon: React.ElementType; color: string; stat?: number }> = [
    { id: 'all', label: 'All Topics', icon: Brain, color: 'blue', stat: stats.totalQuestions },
    { id: 'growth', label: 'Growth Areas', icon: TrendingUp, color: 'amber', stat: stats.growthAreasCount },
    { id: 'flagged', label: 'Flagged', icon: Flag, color: 'purple', stat: stats.flaggedCount },
    { id: 'due', label: 'Due for Review', icon: Clock, color: 'emerald' },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          
          <div className="flex items-center gap-4 mb-3">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-200 dark:border-blue-700">
              <Brain className="w-10 h-10 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
                Core {examLabel} Simulation
              </h1>
              <p className="text-[var(--color-text-muted)] mt-1">
                Gold standard adaptive quiz engine
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-emerald-500" />
              <span className="text-sm text-[var(--color-text-muted)]">Accuracy</span>
            </div>
            <div className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.accuracy}%</div>
          </div>
          
          <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-[var(--color-text-muted)]">Today</span>
            </div>
            <div className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.todayQuestions}</div>
          </div>
          
          <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-[var(--color-text-muted)]">Growth Areas</span>
            </div>
            <div className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.growthAreasCount}</div>
          </div>
          
          <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-1">
              <Flag className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-[var(--color-text-muted)]">Flagged</span>
            </div>
            <div className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.flaggedCount}</div>
          </div>
        </motion.div>

        {/* Focus Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
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
              
              return (
                <button
                  key={option.id}
                  onClick={() => setSelectedFocus(option.id)}
                  className={`relative p-5 rounded-xl border-2 transition-all text-left ${
                    isSelected
                      ? `border-${option.color}-500 bg-${option.color}-50 dark:bg-${option.color}-900/20`
                      : 'border-[var(--color-border)] hover:border-[var(--color-border)] bg-[var(--color-bg-primary)]'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${
                      isSelected
                        ? `bg-${option.color}-500 text-white`
                        : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'
                    }`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-[var(--color-text-primary)]">
                          {option.label}
                        </span>
                        {option.stat !== undefined && (
                          <span className={`text-sm px-2 py-0.5 rounded-full ${
                            isSelected
                              ? `bg-${option.color}-100 dark:bg-${option.color}-800 text-${option.color}-700 dark:text-${option.color}-200`
                              : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'
                          }`}>
                            {option.stat}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <div className={`absolute top-3 right-3 w-6 h-6 rounded-full bg-${option.color}-500 flex items-center justify-center`}>
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-4 bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border)]">
            <p className="text-sm text-[var(--color-text-muted)]">
              {getFocusDescription()}
            </p>
          </div>
        </motion.div>

        {/* Difficulty Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border)] p-6 mb-6"
        >
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
            Difficulty Adjustment
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { id: 'easier' as const, label: 'Easier', desc: 'Build confidence' },
              { id: 'same' as const, label: 'Adaptive', desc: 'Match your level' },
              { id: 'harder' as const, label: 'Harder', desc: 'Challenge yourself' },
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => setDifficulty(option.id)}
                className={`p-4 rounded-xl border-2 transition-all text-center ${
                  difficulty === option.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-[var(--color-border)] hover:border-[var(--color-border)] bg-[var(--color-bg-primary)]'
                }`}
              >
                <div className="font-semibold text-[var(--color-text-primary)] mb-1">
                  {option.label}
                </div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  {option.desc}
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Start Button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onClick={handleStart}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-5 px-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-lg rounded-xl shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center gap-3"
        >
          <Award className="w-6 h-6" />
          Start {examLabel} Session
        </motion.button>
      </div>
    </div>
  );
};
