/**
 * Wake-Time Settings Component
 *
 * Allows users to configure their sleep-wake schedule for personalized
 * circadian-adjusted study recommendations.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  type WakeTimePreferences,
  type Chronotype,
  type StudyRecommendation,
  createDefaultPreferences,
  updatePreferences,
  determineChronotype,
  getCognitiveState,
  getDailyStudySchedule,
  getOptimalExamTime,
  calculateCognitiveWindows,
} from '../../lib/wake-time';

interface WakeTimeSettingsProps {
  /** Current preferences (from localStorage or database) */
  initialPreferences?: WakeTimePreferences;
  /** Callback when preferences change */
  onPreferencesChange?: (prefs: WakeTimePreferences) => void;
  /** Whether to show the current status banner */
  showCurrentStatus?: boolean;
  /** Whether to show the daily schedule */
  showSchedule?: boolean;
}

/**
 * Chronotype display info
 */
const CHRONOTYPE_INFO: Record<Chronotype, { label: string; emoji: string; description: string }> = {
  early_bird: {
    label: 'Early Bird',
    emoji: '🌅',
    description: 'You naturally wake before 6:30 AM. Your peak cognition is in the early morning.',
  },
  moderate_early: {
    label: 'Moderate Early',
    emoji: '☀️',
    description: 'You typically wake between 6:30-7:30 AM. Good balance of morning energy.',
  },
  intermediate: {
    label: 'Intermediate',
    emoji: '⚖️',
    description:
      'The optimal 7:30-8:30 AM wake window. Associated with highest academic performance.',
  },
  moderate_late: {
    label: 'Moderate Late',
    emoji: '🌤️',
    description: 'You wake between 8:30-10 AM. Your peak cognition is late morning.',
  },
  night_owl: {
    label: 'Night Owl',
    emoji: '🦉',
    description: 'You naturally wake after 10 AM. Your peak cognition may extend into evening.',
  },
};

/**
 * Cognitive state color mapping
 */
const STATE_COLORS: Record<StudyRecommendation['cognitiveState'], string> = {
  peak: 'bg-[var(--color-data-pass)]',
  good: 'bg-[var(--color-accent)]',
  trough: 'bg-[var(--color-data-provisional)]',
  recovery: 'bg-[var(--color-accent)]',
  late_night: 'bg-[var(--color-accent)]',
  rest: 'bg-[var(--color-bg-secondary)]',
};

export const WakeTimeSettings: React.FC<WakeTimeSettingsProps> = ({
  initialPreferences,
  onPreferencesChange,
  showCurrentStatus = true,
  showSchedule = true,
}) => {
  const [preferences, setPreferences] = useState<WakeTimePreferences>(
    initialPreferences || createDefaultPreferences()
  );
  const [currentStatus, setCurrentStatus] = useState<StudyRecommendation | null>(null);

  // Update current status every minute
  useEffect(() => {
    const updateStatus = () => {
      const status = getCognitiveState(preferences.weekdayWakeTime);
      setCurrentStatus(status);
    };

    updateStatus();
    const interval = setInterval(updateStatus, 60000);
    return () => clearInterval(interval);
  }, [preferences.weekdayWakeTime]);

  // Memoized values
  const chronotypeInfo = useMemo(
    () => CHRONOTYPE_INFO[preferences.chronotype],
    [preferences.chronotype]
  );

  const cognitiveWindows = useMemo(
    () => calculateCognitiveWindows(preferences.weekdayWakeTime),
    [preferences.weekdayWakeTime]
  );

  const dailySchedule = useMemo(
    () => getDailyStudySchedule(preferences.weekdayWakeTime),
    [preferences.weekdayWakeTime]
  );

  const optimalExamTime = useMemo(
    () => getOptimalExamTime(preferences.chronotype),
    [preferences.chronotype]
  );

  // Handlers
  const handleWakeTimeChange = (field: 'weekdayWakeTime' | 'weekendWakeTime', value: string) => {
    const newPrefs = updatePreferences(preferences, { [field]: value });
    setPreferences(newPrefs);
    onPreferencesChange?.(newPrefs);
  };

  const handleIrregularToggle = () => {
    const newPrefs = updatePreferences(preferences, {
      irregularSchedule: !preferences.irregularSchedule,
    });
    setPreferences(newPrefs);
    onPreferencesChange?.(newPrefs);
  };

  return (
    <div className="space-y-6">
      {/* Current Status Banner */}
      {showCurrentStatus && currentStatus && (
        <div className={`rounded-xl p-4 text-[var(--color-text-inverse)] ${STATE_COLORS[currentStatus.cognitiveState]}`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">
                {currentStatus.isOptimal ? 'Optimal Study Time' : 'Current Status'}
              </h3>
              <p className="text-[var(--color-text-inverse)]/90 text-sm mt-1">{currentStatus.recommendation}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold capitalize">
                {currentStatus.cognitiveState.replace('_', ' ')}
              </div>
              <div className="text-[var(--color-text-inverse)]/70 text-sm">
                Stability: {Math.round((currentStatus.stabilityModifier - 1) * 100)}%
                {currentStatus.stabilityModifier > 1 ? ' bonus' : ''}
              </div>
            </div>
          </div>
          {currentStatus.hoursUntilOptimal && !currentStatus.isOptimal && (
            <div className="mt-3 text-sm text-[var(--color-text-inverse)]/80">
              ⏰ Next optimal window in ~{currentStatus.hoursUntilOptimal} hours
            </div>
          )}
        </div>
      )}

      {/* Chronotype Display */}
      <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{chronotypeInfo.emoji}</span>
          <div>
            <h3 className="font-semibold text-[var(--color-text-primary)]">
              {chronotypeInfo.label}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {chronotypeInfo.description}
            </p>
          </div>
        </div>
      </div>

      {/* Wake Time Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            Weekday Wake Time
          </label>
          <input
            type="time"
            value={preferences.weekdayWakeTime}
            onChange={(e) => handleWakeTimeChange('weekdayWakeTime', e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-[var(--color-border-primary)] 
                       bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]
                       focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
          />
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Your typical wake time on school/work days
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            Weekend Wake Time
          </label>
          <input
            type="time"
            value={preferences.weekendWakeTime}
            onChange={(e) => handleWakeTimeChange('weekendWakeTime', e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-[var(--color-border-primary)] 
                       bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]
                       focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
          />
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Your typical wake time on weekends/days off
          </p>
        </div>
      </div>

      {/* Irregular Schedule Toggle */}
      <div className="flex items-center justify-between p-4 bg-[var(--color-bg-secondary)]/50 rounded-lg">
        <div>
          <span className="text-[var(--color-text-primary)] font-medium">
            Irregular Sleep Schedule
          </span>
          <p className="text-xs text-[var(--color-text-muted)]">
            Enable if your wake time varies significantly day to day
          </p>
        </div>
        <button
          onClick={handleIrregularToggle}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            preferences.irregularSchedule
              ? 'bg-[var(--color-accent)]'
              : 'bg-[var(--color-bg-tertiary)]'
          }`}
        >
          <span
            className={`absolute top-1 w-4 h-4 bg-[var(--color-bg-primary)] rounded-full transition-transform ${
              preferences.irregularSchedule ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Cognitive Windows Summary */}
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-xl p-4">
        <h3 className="font-semibold text-[var(--color-text-primary)] mb-3">
          Your Cognitive Windows
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div className="bg-[var(--color-data-pass)]/10 p-3 rounded-lg">
            <div className="text-[var(--color-data-pass)] font-medium">Peak</div>
            <div className="text-[var(--color-text-secondary)]">
              {cognitiveWindows.peakStart} - {cognitiveWindows.peakEnd}
            </div>
          </div>
          <div className="bg-[var(--color-data-provisional)]/10 p-3 rounded-lg">
            <div className="text-[var(--color-data-provisional)] font-medium">Trough</div>
            <div className="text-[var(--color-text-secondary)]">
              {cognitiveWindows.troughStart} - {cognitiveWindows.troughEnd}
            </div>
          </div>
          <div className="bg-[var(--color-accent)]/10 p-3 rounded-lg">
            <div className="text-[var(--color-accent)] font-medium">Recovery</div>
            <div className="text-[var(--color-text-secondary)]">
              {cognitiveWindows.eveningStart} - {cognitiveWindows.eveningEnd}
            </div>
          </div>
        </div>
        <div className="mt-3 text-xs text-[var(--color-text-muted)]">
          Optimal exam time for your chronotype: <strong>{optimalExamTime}</strong>
        </div>
      </div>

      {/* Daily Schedule */}
      {showSchedule && (
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-xl p-4">
          <h3 className="font-semibold text-[var(--color-text-primary)] mb-3">
            Recommended Daily Schedule
          </h3>
          <div className="space-y-2">
            {dailySchedule.map((slot, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  slot.priority === 'high'
                    ? 'bg-[var(--color-data-pass)]/10 border-l-4 border-[var(--color-data-pass)]'
                    : slot.priority === 'medium'
                      ? 'bg-[var(--color-accent)]/10 border-l-4 border-[var(--color-accent)]'
                      : 'bg-[var(--color-bg-tertiary)] border-l-4 border-[var(--color-border-primary)]'
                }`}
              >
                <div>
                  <div className="font-medium text-[var(--color-text-primary)] text-sm">
                    {slot.timeRange}
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)]">
                    {slot.recommendation}
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    slot.priority === 'high'
                      ? 'bg-[var(--color-data-pass)]/20 text-[var(--color-data-pass)]'
                      : slot.priority === 'medium'
                        ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                        : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'
                  }`}
                >
                  {slot.state}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Research Citation */}
      <p className="text-xs text-[var(--color-text-muted)] text-center">
        Based on chronobiology research: 8:30 AM wake time associated with 73.1% high scorers
        (Preckel et al., 2011)
      </p>
    </div>
  );
};

export default WakeTimeSettings;
