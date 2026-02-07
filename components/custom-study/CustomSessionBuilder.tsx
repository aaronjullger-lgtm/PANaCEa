/**
 * Custom Study Session Builder
 *
 * Multi-step wizard for creating custom, Quizlet-style study sessions.
 * Allows multi-select of systems, subcategories, conditions, and focus areas.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronLeft,
  Play,
  BookOpen,
  Target,
  Settings,
  Check,
  X,
  AlertCircle,
  Loader2,
  Filter,
  Layers,
} from 'lucide-react';
import { ABBREVIATION_TO_TOPIC_MAP, getSystemDisplayFullName } from '../../src/constants';
import type { SystemCode } from '../../types';
import type {
  CustomSessionConfig,
  FocusArea,
  AvailableContent,
  SystemWithContent,
} from '../../types/custom-session';
import { FOCUS_AREA_META, DEFAULT_CUSTOM_SESSION_CONFIG } from '../../types/custom-session';
import { customSessionService } from '@/services/core';

interface Props {
  onStartSession: (config: CustomSessionConfig) => void;
  onCancel: () => void;
}

type BuilderStep = 'content' | 'focus' | 'settings' | 'review';

const STEPS: { id: BuilderStep; label: string; icon: React.ReactNode }[] = [
  { id: 'content', label: 'Content', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'focus', label: 'Focus Areas', icon: <Target className="w-4 h-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  { id: 'review', label: 'Review', icon: <Check className="w-4 h-4" /> },
];

export default function CustomSessionBuilder({ onStartSession, onCancel }: Props) {
  const [currentStep, setCurrentStep] = useState<BuilderStep>('content');
  const [config, setConfig] = useState<CustomSessionConfig>(DEFAULT_CUSTOM_SESSION_CONFIG);
  const [availableContent, setAvailableContent] = useState<AvailableContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load available content on mount
  useEffect(() => {
    async function loadContent() {
      try {
        setIsLoading(true);
        // For now, build content from constants (will be replaced with API call)
        const systems: SystemWithContent[] = Object.entries(ABBREVIATION_TO_TOPIC_MAP)
          .filter(([code]) => code !== 'PRO' && code !== 'OTHER')
          .map(([code, name]) => ({
            code: code as SystemCode,
            name,
            subcategories: [], // Will be populated from API
            totalConditions: 0,
          }));

        setAvailableContent({
          systems,
          userMaterials: [],
        });
        setError(null);
      } catch (err) {
        setError('Failed to load available content');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    loadContent();
  }, []);

  // Step navigation
  const stepIndex = STEPS.findIndex((s) => s.id === currentStep);

  const goNext = useCallback(() => {
    const nextIndex = Math.min(stepIndex + 1, STEPS.length - 1);
    const nextStep = STEPS[nextIndex];
    if (nextStep) {
      setCurrentStep(nextStep.id);
    }
  }, [stepIndex]);

  const goBack = useCallback(() => {
    const prevIndex = Math.max(stepIndex - 1, 0);
    const prevStep = STEPS[prevIndex];
    if (prevStep) {
      setCurrentStep(prevStep.id);
    }
  }, [stepIndex]);

  // Validation
  const validation = customSessionService.validateConfig(config);

  // Handle system toggle
  const toggleSystem = (systemCode: SystemCode) => {
    setConfig((prev) => {
      const newSystems = prev.systems.includes(systemCode)
        ? prev.systems.filter((s) => s !== systemCode)
        : [...prev.systems, systemCode];
      return { ...prev, systems: newSystems };
    });
  };

  // Handle focus area toggle
  const toggleFocusArea = (area: FocusArea) => {
    setConfig((prev) => {
      const newAreas = prev.focusAreas.includes(area)
        ? prev.focusAreas.filter((a) => a !== area)
        : [...prev.focusAreas, area];
      return { ...prev, focusAreas: newAreas };
    });
  };

  // Select all / deselect all
  const selectAllSystems = () => {
    if (availableContent) {
      setConfig((prev) => ({
        ...prev,
        systems: availableContent.systems.map((s) => s.code),
      }));
    }
  };

  const deselectAllSystems = () => {
    setConfig((prev) => ({ ...prev, systems: [] }));
  };

  // Handle start
  const handleStart = () => {
    if (validation.valid) {
      onStartSession(config);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Custom Study Session
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Create a focused practice session with your chosen topics
          </p>
        </div>
        <button
          onClick={onCancel}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      {/* Step Progress */}
      <div className="flex items-center mb-8">
        {STEPS.map((step, index) => (
          <React.Fragment key={step.id}>
            <button
              onClick={() => setCurrentStep(step.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                currentStep === step.id
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : index < stepIndex
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-slate-400'
              }`}
            >
              {index < stepIndex ? <Check className="w-4 h-4" /> : step.icon}
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {index < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 ${
                  index < stepIndex ? 'bg-green-400' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6"
        >
          {currentStep === 'content' && (
            <ContentStep
              config={config}
              availableContent={availableContent}
              onToggleSystem={toggleSystem}
              onSelectAll={selectAllSystems}
              onDeselectAll={deselectAllSystems}
            />
          )}

          {currentStep === 'focus' && (
            <FocusStep config={config} onToggleFocusArea={toggleFocusArea} />
          )}

          {currentStep === 'settings' && <SettingsStep config={config} onChange={setConfig} />}

          {currentStep === 'review' && <ReviewStep config={config} validation={validation} />}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-6">
        <button
          onClick={goBack}
          disabled={stepIndex === 0}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            stepIndex === 0
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>

        {currentStep === 'review' ? (
          <button
            onClick={handleStart}
            disabled={!validation.valid}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors ${
              validation.valid
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Play className="w-5 h-5" />
            Start Session
          </button>
        ) : (
          <button
            onClick={goNext}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// STEP COMPONENTS
// ============================================================================

interface ContentStepProps {
  config: CustomSessionConfig;
  availableContent: AvailableContent | null;
  onToggleSystem: (code: SystemCode) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

function ContentStep({
  config,
  availableContent,
  onToggleSystem,
  onSelectAll,
  onDeselectAll,
}: ContentStepProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Select Organ Systems
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Choose the systems you want to study ({config.systems.length} selected)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onSelectAll}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Select All
          </button>
          <span className="text-slate-300">|</span>
          <button
            onClick={onDeselectAll}
            className="text-sm text-slate-600 hover:text-slate-700 dark:text-slate-400"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {availableContent?.systems.map((system) => {
          const fullName = getSystemDisplayFullName(system.code);
          return (
            <button
              key={system.code}
              onClick={() => onToggleSystem(system.code)}
              title={fullName}
              className={`min-w-0 p-3 rounded-xl border-2 transition-all text-left ${
                config.systems.includes(system.code)
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                  : 'border-slate-200 dark:border-slate-700 hover:border-[var(--color-accent)]/50'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`shrink-0 w-5 h-5 rounded flex items-center justify-center ${
                    config.systems.includes(system.code)
                      ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                      : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  {config.systems.includes(system.code) && <Check className="w-3 h-3" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[var(--color-text-primary)] text-sm truncate" title={system.code}>
                    {system.code}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 truncate" title={fullName}>
                    {fullName}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {config.systems.length === 0 && (
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center gap-2 text-amber-700 dark:text-amber-300">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">Please select at least one organ system</span>
        </div>
      )}
    </div>
  );
}

interface FocusStepProps {
  config: CustomSessionConfig;
  onToggleFocusArea: (area: FocusArea) => void;
}

function FocusStep({ config, onToggleFocusArea }: FocusStepProps) {
  const focusAreas = Object.entries(FOCUS_AREA_META) as [
    FocusArea,
    (typeof FOCUS_AREA_META)[FocusArea],
  ][];

  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
        Choose Focus Areas
      </h2>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
        What aspects do you want to be tested on? ({config.focusAreas.length} selected)
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {focusAreas.map(([area, meta]) => (
          <button
            key={area}
            onClick={() => onToggleFocusArea(area)}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              config.focusAreas.includes(area)
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                : 'border-slate-200 dark:border-slate-700 hover:border-purple-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{meta.icon}</span>
              <div>
                <div className="font-medium text-[var(--color-text-primary)]">{meta.label}</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">{meta.description}</div>
              </div>
              {config.focusAreas.includes(area) && (
                <Check className="w-5 h-5 text-purple-500 ml-auto" />
              )}
            </div>
          </button>
        ))}
      </div>

      {config.focusAreas.length === 0 && (
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center gap-2 text-amber-700 dark:text-amber-300">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">Please select at least one focus area</span>
        </div>
      )}
    </div>
  );
}

interface SettingsStepProps {
  config: CustomSessionConfig;
  onChange: (config: CustomSessionConfig) => void;
}

function SettingsStep({ config, onChange }: SettingsStepProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
        Session Settings
      </h2>

      <div className="space-y-6">
        {/* Questions per increment */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Questions per round
          </label>
          <div className="flex gap-2">
            {[5, 10, 15, 20].map((num) => (
              <button
                key={num}
                onClick={() => onChange({ ...config, questionsPerIncrement: num })}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  config.questionsPerIncrement === num
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty - Fixed at PANCE-Level for standardized practice */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Difficulty
          </label>
          <div className="flex gap-2">
            <div className="px-4 py-2 rounded-lg font-medium bg-blue-600 text-white">
              PANCE-Level
            </div>
            <span className="text-sm text-slate-500 dark:text-slate-400 self-center ml-2">
              (Standardized difficulty for accurate practice)
            </span>
          </div>
        </div>

        {/* Retry missed questions */}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-[var(--color-text-primary)]">Retry questions to review</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Review questions you got wrong at the end of each round
            </div>
          </div>
          <button
            onClick={() =>
              onChange({ ...config, retryMissedQuestions: !config.retryMissedQuestions })
            }
            className={`relative w-12 h-6 rounded-full transition-colors ${
              config.retryMissedQuestions ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                config.retryMissedQuestions ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

interface ReviewStepProps {
  config: CustomSessionConfig;
  validation: { valid: boolean; errors: string[] };
}

function ReviewStep({ config, validation }: ReviewStepProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
        Review Your Session
      </h2>

      <div className="space-y-4">
        {/* Systems */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 mb-2">
            <Layers className="w-4 h-4" />
            <span className="font-medium">Systems ({config.systems.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {config.systems.map((code) => (
              <span
                key={code}
                className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm"
              >
                {ABBREVIATION_TO_TOPIC_MAP[code] || code}
              </span>
            ))}
          </div>
        </div>

        {/* Focus Areas */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 mb-2">
            <Target className="w-4 h-4" />
            <span className="font-medium">Focus Areas ({config.focusAreas.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {config.focusAreas.map((area) => (
              <span
                key={area}
                className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm"
              >
                {FOCUS_AREA_META[area].icon} {FOCUS_AREA_META[area].label}
              </span>
            ))}
          </div>
        </div>

        {/* Settings Summary */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 mb-2">
            <Settings className="w-4 h-4" />
            <span className="font-medium">Settings</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-slate-600 dark:text-slate-400">Questions per round:</div>
            <div className="font-medium text-[var(--color-text-primary)]">
              {config.questionsPerIncrement}
            </div>
            <div className="text-slate-600 dark:text-slate-400">Difficulty:</div>
            <div className="font-medium text-[var(--color-text-primary)] capitalize">
              {config.difficulty}
            </div>
            <div className="text-slate-600 dark:text-slate-400">Retry missed:</div>
            <div className="font-medium text-[var(--color-text-primary)]">
              {config.retryMissedQuestions ? 'Yes' : 'No'}
            </div>
          </div>
        </div>

        {/* Validation Errors */}
        {!validation.valid && (
          <div id="session-builder-validation" role="alert" className="p-4 bg-[var(--color-data-fail)]/10 border border-[var(--color-data-fail)]/30 rounded-xl">
            <div className="flex items-center gap-2 text-[var(--color-data-fail)] mb-2">
              <AlertCircle className="w-4 h-4" />
              <span className="font-medium">Please fix the following:</span>
            </div>
            <ul className="list-disc list-inside text-sm text-[var(--color-data-fail)]">
              {validation.errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Info Banner */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-700 dark:text-blue-300 text-sm">
          <p>
            <strong>Note:</strong> This is a practice session. Progress is not saved to your spaced
            repetition schedule. Questions you miss will be repeated at the end of each round.
          </p>
        </div>
      </div>
    </div>
  );
}

export { CustomSessionBuilder };
