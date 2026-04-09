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
      <div role="status" aria-label="Loading" className="flex items-center justify-center min-h-[400px]">
        <Loader2 aria-hidden="true" className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
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
          <p className="text-data-neutral mt-1">
            Create a focused practice session with your chosen topics
          </p>
        </div>
        <button
          onClick={onCancel}
          aria-label="Cancel session setup"
          className="p-2 rounded-lg hover:bg-data-neutral dark:hover:bg-data-neutral transition-colors"
        >
          <X className="w-5 h-5 text-data-neutral" />
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
                  ? 'bg-[color-mix(in_srgb,var(--color-category-practice)_30%,transparent)] text-[var(--color-category-practice)]'
                  : index < stepIndex
                    ? 'text-data-pass'
                    : 'text-data-neutral'
              }`}
            >
              {index < stepIndex ? <Check className="w-4 h-4" /> : step.icon}
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {index < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 ${
                  index < stepIndex ? 'bg-data-pass' : 'bg-data-neutral'
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
          initial={{ x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="bg-[var(--color-bg-secondary)] rounded-2xl shadow-lg p-6"
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
              : 'hover:bg-data-neutral dark:hover:bg-data-neutral'
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
                ? 'bg-[var(--color-category-practice)] hover:bg-[var(--color-category-practice)] text-[var(--color-text-inverse)]'
                : 'bg-data-neutral text-data-neutral cursor-not-allowed'
            }`}
          >
            <Play className="w-5 h-5" />
            Start Session
          </button>
        ) : (
          <button
            onClick={goNext}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-category-practice)] hover:bg-[var(--color-category-practice)] text-[var(--color-text-inverse)] transition-colors"
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
          <p className="text-sm text-data-neutral">
            Choose the systems you want to study ({config.systems.length} selected)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onSelectAll}
            className="text-sm text-[var(--color-category-practice)] hover:text-[var(--color-category-practice)]"
          >
            Select All
          </button>
          <span className="text-data-neutral">|</span>
          <button
            onClick={onDeselectAll}
            className="text-sm text-data-neutral hover:text-data-neutral"
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
                  : 'border-data-neutral hover:border-[var(--color-accent)]/50'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`shrink-0 w-5 h-5 rounded flex items-center justify-center ${
                    config.systems.includes(system.code)
                      ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                      : 'bg-data-neutral'
                  }`}
                >
                  {config.systems.includes(system.code) && <Check className="w-3 h-3" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="font-semibold text-[var(--color-text-primary)] text-sm truncate"
                    title={system.code}
                  >
                    {system.code}
                  </div>
                  <div
                    className="text-xs text-data-neutral truncate"
                    title={fullName}
                  >
                    {fullName}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {config.systems.length === 0 && (
        <div className="mt-4 p-3 bg-data-provisional rounded-lg flex items-center gap-2 text-data-provisional">
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
      <p className="text-sm text-data-neutral mb-4">
        What aspects do you want to be tested on? ({config.focusAreas.length} selected)
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {focusAreas.map(([area, meta]) => (
          <button
            key={area}
            onClick={() => onToggleFocusArea(area)}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              config.focusAreas.includes(area)
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5 dark:bg-[var(--color-accent)]/20'
                : 'border-data-neutral hover:border-[var(--color-accent)]/30'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{meta.icon}</span>
              <div>
                <div className="font-medium text-[var(--color-text-primary)]">{meta.label}</div>
                <div className="text-sm text-data-neutral">{meta.description}</div>
              </div>
              {config.focusAreas.includes(area) && (
                <Check className="w-5 h-5 text-[var(--color-accent)] ml-auto" />
              )}
            </div>
          </button>
        ))}
      </div>

      {config.focusAreas.length === 0 && (
        <div className="mt-4 p-3 bg-data-provisional rounded-lg flex items-center gap-2 text-data-provisional">
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
          <label className="block text-sm font-medium text-data-neutral mb-2">
            Questions per round
          </label>
          <div className="flex gap-2">
            {[5, 10, 15, 20].map((num) => (
              <button
                key={num}
                onClick={() => onChange({ ...config, questionsPerIncrement: num })}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  config.questionsPerIncrement === num
                    ? 'bg-[var(--color-category-practice)] text-[var(--color-text-inverse)]'
                    : 'bg-data-neutral text-data-neutral hover:bg-data-neutral dark:hover:bg-data-neutral'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty - Fixed at PANCE-Level for standardized practice */}
        <div>
          <label className="block text-sm font-medium text-data-neutral mb-2">
            Difficulty
          </label>
          <div className="flex gap-2">
            <div className="px-4 py-2 rounded-lg font-medium bg-[var(--color-category-practice)] text-[var(--color-text-inverse)]">
              PANCE-Level
            </div>
            <span className="text-sm text-data-neutral self-center ml-2">
              (Standardized difficulty for accurate practice)
            </span>
          </div>
        </div>

        {/* Retry missed questions */}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-[var(--color-text-primary)]">
              Retry questions to review
            </div>
            <div className="text-sm text-data-neutral">
              Review questions you got wrong at the end of each round
            </div>
          </div>
          <button
            onClick={() =>
              onChange({ ...config, retryMissedQuestions: !config.retryMissedQuestions })
            }
            className={`relative w-12 h-6 rounded-full transition-colors ${
              config.retryMissedQuestions ? 'bg-[var(--color-category-practice)]' : 'bg-data-neutral'
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 rounded-full bg-[var(--color-bg-primary)] transition-transform ${
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
        <div className="p-4 bg-data-neutral rounded-xl">
          <div className="flex items-center gap-2 text-data-neutral mb-2">
            <Layers className="w-4 h-4" />
            <span className="font-medium">Systems ({config.systems.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {config.systems.map((code) => (
              <span
                key={code}
                className="px-2 py-1 bg-[color-mix(in_srgb,var(--color-category-practice)_30%,transparent)] text-[var(--color-category-practice)] rounded-full text-sm"
              >
                {ABBREVIATION_TO_TOPIC_MAP[code] || code}
              </span>
            ))}
          </div>
        </div>

        {/* Focus Areas */}
        <div className="p-4 bg-data-neutral rounded-xl">
          <div className="flex items-center gap-2 text-data-neutral mb-2">
            <Target className="w-4 h-4" />
            <span className="font-medium">Focus Areas ({config.focusAreas.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {config.focusAreas.map((area) => (
              <span
                key={area}
                className="px-2 py-1 bg-[var(--color-accent)]/10 dark:bg-[var(--color-accent)]/30 text-[var(--color-accent)] rounded-full text-sm"
              >
                {FOCUS_AREA_META[area].icon} {FOCUS_AREA_META[area].label}
              </span>
            ))}
          </div>
        </div>

        {/* Settings Summary */}
        <div className="p-4 bg-data-neutral rounded-xl">
          <div className="flex items-center gap-2 text-data-neutral mb-2">
            <Settings className="w-4 h-4" />
            <span className="font-medium">Settings</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-data-neutral">Questions per round:</div>
            <div className="font-medium text-[var(--color-text-primary)]">
              {config.questionsPerIncrement}
            </div>
            <div className="text-data-neutral">Difficulty:</div>
            <div className="font-medium text-[var(--color-text-primary)] capitalize">
              {config.difficulty}
            </div>
            <div className="text-data-neutral">Retry missed:</div>
            <div className="font-medium text-[var(--color-text-primary)]">
              {config.retryMissedQuestions ? 'Yes' : 'No'}
            </div>
          </div>
        </div>

        {/* Validation Errors */}
        {!validation.valid && (
          <div
            id="session-builder-validation"
            role="alert"
            className="p-4 bg-[var(--color-data-fail)]/10 border border-[var(--color-data-fail)]/30 rounded-xl"
          >
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
        <div className="p-4 bg-[color-mix(in_srgb,var(--color-category-practice)_20%,transparent)] rounded-xl text-[var(--color-category-practice)] text-sm">
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
