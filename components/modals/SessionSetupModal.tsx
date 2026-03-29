import React, { useState, useRef } from 'react';
import { useFocusTrap, useKeyboardNavigation } from '@/lib/utils/accessibilityUtils';
import type { SessionSettings } from '@/types';
import { STUDY_PRESETS, type StudyPreset } from '@/config/training-modes';
import { getAllSystems } from '@/lib/constants/blueprint';
import { Zap, HeartPulse, TrendingDown, Sparkles, Stethoscope } from 'lucide-react';

const iconMap = {
  Zap,
  HeartPulse,
  TrendingDown,
  Sparkles,
};

interface SessionSetupModalProps {
  onClose: () => void;
  onStart: (settings: SessionSettings) => void;
  growthAreas: string[];
  dueQuestionsCount: number;
  flaggedQuestionsCount: number;
}

type Focus = SessionSettings['focus'];
// Note: Difficulty was removed from SessionSettings - all questions are PANCE-level

const PresetCard = ({ preset, onClick }: { preset: StudyPreset; onClick: () => void }) => {
  const Icon = iconMap[preset.iconName as keyof typeof iconMap] || Sparkles;
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-lg border bg-[var(--color-bg-secondary)] hover:bg-[var(--color-accent)]/15 dark:border-data-neutral transition-colors"
    >
      <div className="flex items-center gap-4">
        <Icon className="w-6 h-6 text-[var(--color-accent)]" />
        <div>
          <h4 className="font-bold text-[var(--color-accent)]">{preset.label}</h4>
          <p className="text-sm text-data-neutral dark:text-data-neutral">{preset.description}</p>
        </div>
      </div>
    </button>
  );
};

const SessionSetupModal: React.FC<SessionSetupModalProps> = ({
  onClose,
  onStart,
  growthAreas,
  dueQuestionsCount,
  flaggedQuestionsCount,
}) => {
  const [customSettings, setCustomSettings] = useState<Partial<SessionSettings>>({
    focus: 'all',
  });
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [selectedSystem, setSelectedSystem] = useState<string>('');
  const modalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(modalRef as React.RefObject<HTMLElement>, true);
  useKeyboardNavigation(onClose);

  // Get official NCCPA organ systems from blueprint
  const organSystems = getAllSystems();

  const handlePresetStart = (preset: StudyPreset) => {
    onStart({
      count: preset.settings.count,
      focus: preset.settings.focus,
      systems: preset.settings.systems,
    });
  };

  const handleCustomStart = () => {
    const settings: SessionSettings = {
      count: 20, // Default custom count
      ...customSettings,
      focus: (customSettings.focus ?? 'all') as SessionSettings['focus'],
    };

    // Add selected system if user chose one
    if (selectedSystem) {
      settings.systems = [selectedSystem];
    }

    onStart(settings);
  };

  return (
    <div
      className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-setup-title"
    >
      <div
        ref={modalRef}
        className="bg-[var(--color-bg-primary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] p-8 w-full max-w-md max-h-[90vh] overflow-y-auto border border-[var(--color-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="session-setup-title" className="text-2xl font-bold text-[var(--color-accent)] mb-2">
          New Study Session
        </h2>

        {!isCustomizing ? (
          <>
            <p className="text-data-neutral dark:text-data-neutral mb-6">
              Choose a preset or create a custom session.
            </p>
            <div className="space-y-3">
              {STUDY_PRESETS.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  onClick={() => handlePresetStart(preset)}
                />
              ))}
            </div>
            <div className="mt-6 text-center">
              <button
                onClick={() => setIsCustomizing(true)}
                className="text-sm font-semibold text-[var(--color-accent)] hover:underline"
              >
                Or create a custom session
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-data-neutral dark:text-data-neutral mb-6">Customize your practice quiz.</p>

            {/* System Selection */}
            <div className="mb-6">
              <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-accent)] mb-2">
                <Stethoscope className="w-4 h-4" />
                Focus on Organ System (Optional)
              </label>
              <select
                aria-label="Focus organ system"
                value={selectedSystem}
                onChange={(e) => setSelectedSystem(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border bg-[var(--color-bg-secondary)] text-[var(--color-accent)] dark:border-data-neutral focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all"
              >
                <option value="">All Systems (NCCPA Blueprint Weights)</option>
                {organSystems.map((system) => (
                  <option key={system} value={system}>
                    {system}
                  </option>
                ))}
              </select>
              <p className="text-xs text-data-neutral dark:text-data-neutral mt-1">
                {selectedSystem
                  ? `Practice questions exclusively from ${selectedSystem}`
                  : 'Questions will follow official NCCPA 2025 Blueprint distribution'}
              </p>
            </div>

            {/* PANCE-Level Notice */}
            <div className="bg-[color-mix(in_srgb,var(--color-category-practice)_20%,transparent)] rounded-lg p-3 border border-[var(--color-category-practice)] mb-6">
              <p className="text-sm text-[var(--color-category-practice)]">
                <strong>PANCE-Level Questions:</strong> All questions are calibrated to match real
                PANCE exam difficulty for optimal preparation.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center">
              <button
                onClick={() => {
                  setIsCustomizing(false);
                  setSelectedSystem(''); // Reset selection
                }}
                className="text-sm font-semibold text-data-neutral dark:text-data-neutral hover:underline"
              >
                Back to presets
              </button>
              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-md font-semibold text-sm bg-data-neutral text-data-neutral hover:bg-data-neutral dark:bg-data-neutral dark:text-data-neutral dark:hover:bg-data-neutral"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCustomStart}
                  className="px-6 py-2 rounded-md font-semibold text-sm bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:opacity-90 transition-opacity"
                >
                  Start Session
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SessionSetupModal;
