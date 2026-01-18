import React, { useState } from 'react';
import type { SessionSettings } from '../types';
import { STUDY_PRESETS, StudyPreset } from '../config/training-modes';
import { Zap, HeartPulse, TrendingDown, Sparkles } from 'lucide-react';

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
type Difficulty = SessionSettings['difficulty'];

const PresetCard = ({ preset, onClick }: { preset: StudyPreset; onClick: () => void }) => {
  const Icon = iconMap[preset.iconName as keyof typeof iconMap] || Sparkles;
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-lg border bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 dark:border-slate-600 transition-colors"
    >
      <div className="flex items-center gap-4">
        <Icon className="w-6 h-6 text-[var(--color-accent)]" />
        <div>
          <h4 className="font-bold text-slate-800 dark:text-slate-200">{preset.label}</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400">{preset.description}</p>
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
    difficulty: 'same',
  });
  const [isCustomizing, setIsCustomizing] = useState(false);

  const handlePresetStart = (preset: StudyPreset) => {
    onStart({
      count: preset.settings.count,
      difficulty: preset.settings.difficulty,
      focus: preset.settings.focus,
      systems: preset.settings.systems,
    });
  };

  const handleCustomStart = () => {
    onStart({
      count: 20, // Default custom count
      ...customSettings,
    } as SessionSettings);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          New Study Session
        </h2>

        {!isCustomizing ? (
          <>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
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
            <p className="text-slate-500 dark:text-slate-400 mb-6">Customize your practice quiz.</p>
            {/* This is where the old customization UI would go. For now, it's simplified. */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>PANCE-Level Questions:</strong> All questions are calibrated to match real
                PANCE exam difficulty for optimal preparation.
              </p>
            </div>
            <div className="mt-8 flex justify-between items-center">
              <button
                onClick={() => setIsCustomizing(false)}
                className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:underline"
              >
                Back to presets
              </button>
              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-md font-semibold text-sm bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCustomStart}
                  className="px-6 py-2 rounded-md font-semibold text-sm bg-[var(--color-accent)] text-white dark:text-slate-900"
                >
                  Start
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
