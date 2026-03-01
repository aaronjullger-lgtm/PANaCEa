import React from 'react';
import { Settings, User, Clock, Stethoscope, Globe, Zap, BrainCircuit } from 'lucide-react';

export interface EncounterSettings {
  // Patient characteristics
  patientAge: 'pediatric' | 'adult' | 'geriatric' | 'random';
  patientSex: 'male' | 'female' | 'random';
  acuity: 'low' | 'medium' | 'high' | 'critical' | 'random';

  // Scenario focus
  focusArea:
    | 'all'
    | 'cardiology'
    | 'pulmonology'
    | 'gastroenterology'
    | 'neurology'
    | 'musculoskeletal'
    | 'dermatology'
    | 'hematology'
    | 'endocrinology'
    | 'psychiatry'
    | 'infectious disease'
    | 'reproductive';

  // Difficulty & realism
  complexity: 'straightforward' | 'moderate' | 'complex' | 'zebra';
  includeRedHerrings: boolean;
  requireDifferential: boolean;

  // Time constraints
  timeLimit: number | null; // minutes, null = no limit
  showTimer: boolean;

  // Imaging & diagnostics
  imagingAvailable: boolean;
  labsAvailable: boolean;
  requireInterpretation: boolean;

  // Language & communication
  patientLanguage: 'english' | 'spanish' | 'mixed';
  communicationStyle: 'cooperative' | 'vague' | 'challenging';

  // Feedback preferences
  realTimeFeedback: boolean;
  showQuestionRelevance: boolean;
  detailedAAR: boolean;
}

export const DEFAULT_ENCOUNTER_SETTINGS: EncounterSettings = {
  patientAge: 'random',
  patientSex: 'random',
  acuity: 'random',
  focusArea: 'all',
  complexity: 'moderate',
  includeRedHerrings: false,
  requireDifferential: false,
  timeLimit: null,
  showTimer: true,
  imagingAvailable: true,
  labsAvailable: true,
  requireInterpretation: true,
  patientLanguage: 'english',
  communicationStyle: 'cooperative',
  realTimeFeedback: false,
  showQuestionRelevance: true,
  detailedAAR: true,
};

interface EncounterSettingsModalProps {
  settings: EncounterSettings;
  onUpdate: (settings: EncounterSettings) => void;
  onClose: () => void;
  onStart: () => void;
}

export const EncounterSettingsModal: React.FC<EncounterSettingsModalProps> = ({
  settings,
  onUpdate,
  onClose,
  onStart,
}) => {
  const updateSetting = <K extends keyof EncounterSettings>(
    key: K,
    value: EncounterSettings[K]
  ) => {
    onUpdate({ ...settings, [key]: value });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] p-4">
      <div className="bg-[var(--color-bg-secondary)] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-[0_18px_42px_var(--color-shadow-soft)] border border-[var(--color-border)]">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] p-6 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="w-8 h-8 text-[var(--color-category-practice)] text-[var(--color-category-practice)]" />
              <div>
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
                  Customize Your Encounter
                </h2>
                <p className="text-sm text-data-neutral dark:text-data-neutral">
                  Tailor the patient encounter to your learning needs
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-data-neutral dark:hover:bg-data-neutral rounded-lg transition-colors"
            >
              <span className="text-2xl">&times;</span>
            </button>
          </div>
        </div>

        {/* Settings Grid */}
        <div className="p-6 space-y-8">
          {/* Patient Demographics */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-[var(--color-category-practice)] text-[var(--color-category-practice)]" />
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Patient Demographics
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-data-neutral dark:text-data-neutral mb-2">
                  Age Group
                </label>
                <select
                  value={settings.patientAge}
                  onChange={(e) =>
                    updateSetting('patientAge', e.target.value as EncounterSettings['patientAge'])
                  }
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-focus-ring)]"
                >
                  <option value="random">Random</option>
                  <option value="pediatric">Pediatric (0-18)</option>
                  <option value="adult">Adult (18-65)</option>
                  <option value="geriatric">Geriatric (65+)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-data-neutral dark:text-data-neutral mb-2">
                  Sex
                </label>
                <select
                  value={settings.patientSex}
                  onChange={(e) =>
                    updateSetting('patientSex', e.target.value as EncounterSettings['patientSex'])
                  }
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-focus-ring)]"
                >
                  <option value="random">Random</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-data-neutral dark:text-data-neutral mb-2">
                  Acuity
                </label>
                <select
                  value={settings.acuity}
                  onChange={(e) =>
                    updateSetting('acuity', e.target.value as EncounterSettings['acuity'])
                  }
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-focus-ring)]"
                >
                  <option value="random">Random</option>
                  <option value="low">Low (Stable)</option>
                  <option value="medium">Medium (Moderate)</option>
                  <option value="high">High (Urgent)</option>
                  <option value="critical">Critical (Emergency)</option>
                </select>
              </div>
            </div>
          </section>

          {/* Clinical Focus */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Stethoscope className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Clinical Focus
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-data-neutral dark:text-data-neutral mb-2">
                  System/Specialty
                </label>
                <select
                  value={settings.focusArea}
                  onChange={(e) =>
                    updateSetting('focusArea', e.target.value as EncounterSettings['focusArea'])
                  }
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-focus-ring)]"
                >
                  <option value="all">All Systems</option>
                  <option value="cardiology">Cardiology</option>
                  <option value="pulmonology">Pulmonology</option>
                  <option value="gastroenterology">Gastroenterology</option>
                  <option value="neurology">Neurology</option>
                  <option value="musculoskeletal">Musculoskeletal</option>
                  <option value="dermatology">Dermatology</option>
                  <option value="hematology">Hematology</option>
                  <option value="endocrinology">Endocrinology</option>
                  <option value="psychiatry">Psychiatry</option>
                  <option value="infectious disease">Infectious Disease</option>
                  <option value="reproductive">Reproductive Health</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-data-neutral dark:text-data-neutral mb-2">
                  Complexity
                </label>
                <select
                  value={settings.complexity}
                  onChange={(e) =>
                    updateSetting('complexity', e.target.value as EncounterSettings['complexity'])
                  }
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-focus-ring)]"
                >
                  <option value="straightforward">Straightforward (Common)</option>
                  <option value="moderate">Moderate (Typical)</option>
                  <option value="complex">Complex (Challenging)</option>
                  <option value="zebra">Zebra (Rare Diagnosis)</option>
                </select>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.includeRedHerrings}
                  onChange={(e) => updateSetting('includeRedHerrings', e.target.checked)}
                  className="w-5 h-5 rounded border-[var(--color-border)] text-purple-600 focus:ring-[var(--color-focus-ring)]"
                />
                <span className="text-sm text-data-neutral dark:text-data-neutral">
                  Include red herrings (distractors in history)
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.requireDifferential}
                  onChange={(e) => updateSetting('requireDifferential', e.target.checked)}
                  className="w-5 h-5 rounded border-[var(--color-border)] text-purple-600 focus:ring-[var(--color-focus-ring)]"
                />
                <span className="text-sm text-data-neutral dark:text-data-neutral">
                  Require differential diagnosis (3-5 diagnoses)
                </span>
              </label>
            </div>
          </section>

          {/* Diagnostics & Imaging */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <BrainCircuit className="w-5 h-5 text-data-pass dark:text-data-pass" />
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Diagnostics & Imaging
              </h3>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.imagingAvailable}
                  onChange={(e) => updateSetting('imagingAvailable', e.target.checked)}
                  className="w-5 h-5 rounded border-[var(--color-border)] text-data-pass focus:ring-[var(--color-focus-ring)]"
                />
                <span className="text-sm text-data-neutral dark:text-data-neutral">
                  Enable imaging orders (X-ray, CT, MRI, Ultrasound)
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.labsAvailable}
                  onChange={(e) => updateSetting('labsAvailable', e.target.checked)}
                  className="w-5 h-5 rounded border-[var(--color-border)] text-data-pass focus:ring-[var(--color-focus-ring)]"
                />
                <span className="text-sm text-data-neutral dark:text-data-neutral">
                  Enable lab orders (CBC, CMP, cultures, etc.)
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.requireInterpretation}
                  onChange={(e) => updateSetting('requireInterpretation', e.target.checked)}
                  disabled={!settings.imagingAvailable && !settings.labsAvailable}
                  className="w-5 h-5 rounded border-[var(--color-border)] text-data-pass focus:ring-[var(--color-focus-ring)] disabled:opacity-50"
                />
                <span className="text-sm text-data-neutral dark:text-data-neutral">
                  Show actual images/results and require interpretation
                </span>
              </label>
            </div>
          </section>

          {/* Communication */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Communication
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-data-neutral dark:text-data-neutral mb-2">
                  Patient Language
                </label>
                <select
                  value={settings.patientLanguage}
                  onChange={(e) =>
                    updateSetting(
                      'patientLanguage',
                      e.target.value as EncounterSettings['patientLanguage']
                    )
                  }
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-focus-ring)]"
                >
                  <option value="english">English</option>
                  <option value="spanish">Spanish (with interpreter)</option>
                  <option value="mixed">Mixed (code-switching)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-data-neutral dark:text-data-neutral mb-2">
                  Communication Style
                </label>
                <select
                  value={settings.communicationStyle}
                  onChange={(e) =>
                    updateSetting(
                      'communicationStyle',
                      e.target.value as EncounterSettings['communicationStyle']
                    )
                  }
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-focus-ring)]"
                >
                  <option value="cooperative">Cooperative (Standard)</option>
                  <option value="vague">Vague (Poor historian)</option>
                  <option value="challenging">Challenging (Anxious/Evasive)</option>
                </select>
              </div>
            </div>
          </section>

          {/* Time & Feedback */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-data-fail dark:text-data-fail" />
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Time & Feedback
              </h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-data-neutral dark:text-data-neutral mb-2">
                  Time Limit (minutes)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="60"
                    step="5"
                    value={settings.timeLimit || 0}
                    onChange={(e) =>
                      updateSetting(
                        'timeLimit',
                        e.target.value === '0' ? null : parseInt(e.target.value)
                      )
                    }
                    className="flex-1"
                  />
                  <span className="text-sm font-medium text-[var(--color-text-primary)] w-20">
                    {settings.timeLimit ? `${settings.timeLimit} min` : 'No limit'}
                  </span>
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showTimer}
                  onChange={(e) => updateSetting('showTimer', e.target.checked)}
                  className="w-5 h-5 rounded border-[var(--color-border)] text-data-fail focus:ring-[var(--color-focus-ring)]"
                />
                <span className="text-sm text-data-neutral dark:text-data-neutral">
                  Show timer during encounter
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.realTimeFeedback}
                  onChange={(e) => updateSetting('realTimeFeedback', e.target.checked)}
                  className="w-5 h-5 rounded border-[var(--color-border)] text-data-fail focus:ring-[var(--color-focus-ring)]"
                />
                <span className="text-sm text-data-neutral dark:text-data-neutral">
                  Real-time feedback (show question relevance immediately)
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showQuestionRelevance}
                  onChange={(e) => updateSetting('showQuestionRelevance', e.target.checked)}
                  className="w-5 h-5 rounded border-[var(--color-border)] text-data-fail focus:ring-[var(--color-focus-ring)]"
                />
                <span className="text-sm text-data-neutral dark:text-data-neutral">
                  Show question relevance in results
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.detailedAAR}
                  onChange={(e) => updateSetting('detailedAAR', e.target.checked)}
                  className="w-5 h-5 rounded border-[var(--color-border)] text-data-fail focus:ring-[var(--color-focus-ring)]"
                />
                <span className="text-sm text-data-neutral dark:text-data-neutral">
                  Generate detailed After Action Report
                </span>
              </label>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] p-6">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-lg border border-[var(--color-border)] dark:border-data-neutral hover:bg-[var(--color-bg-tertiary)] transition-colors text-data-neutral dark:text-data-neutral font-medium"
            >
              Cancel
            </button>
            <button
              onClick={onStart}
              className="px-8 py-3 rounded-lg bg-[var(--color-category-practice)] hover:bg-[var(--color-category-practice)] text-white font-semibold transition-colors shadow-lg hover:shadow-xl"
            >
              Start Customized Encounter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
