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
    description: 'The optimal 7:30-8:30 AM wake window. Associated with highest academic performance.',
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
  peak: 'bg-emerald-500',
  good: 'bg-blue-500',
  trough: 'bg-amber-500',
  recovery: 'bg-violet-500',
  late_night: 'bg-indigo-500',
  rest: 'bg-slate-500',
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
        <div
          className={`rounded-xl p-4 text-white ${STATE_COLORS[currentStatus.cognitiveState]}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">
                {currentStatus.isOptimal ? '✨ Optimal Study Time' : '💡 Current Status'}
              </h3>
              <p className="text-white/90 text-sm mt-1">{currentStatus.recommendation}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold capitalize">
                {currentStatus.cognitiveState.replace('_', ' ')}
              </div>
              <div className="text-white/70 text-sm">
                Stability: {Math.round((currentStatus.stabilityModifier - 1) * 100)}%
                {currentStatus.stabilityModifier > 1 ? ' bonus' : ''}
              </div>
            </div>
          </div>
          {currentStatus.hoursUntilOptimal && !currentStatus.isOptimal && (
            <div className="mt-3 text-sm text-white/80">
              ⏰ Next optimal window in ~{currentStatus.hoursUntilOptimal} hours
            </div>
          )}
        </div>
      )}

      {/* Chronotype Display */}
      <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{chronotypeInfo.emoji}</span>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {chronotypeInfo.label}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {chronotypeInfo.description}
            </p>
          </div>
        </div>
      </div>

      {/* Wake Time Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Weekday Wake Time
          </label>
          <input
            type="time"
            value={preferences.weekdayWakeTime}
            onChange={(e) => handleWakeTimeChange('weekdayWakeTime', e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 
                       bg-white dark:bg-slate-700 text-slate-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Your typical wake time on school/work days
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Weekend Wake Time
          </label>
          <input
            type="time"
            value={preferences.weekendWakeTime}
            onChange={(e) => handleWakeTimeChange('weekendWakeTime', e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 
                       bg-white dark:bg-slate-700 text-slate-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Your typical wake time on weekends/days off
          </p>
        </div>
      </div>

      {/* Irregular Schedule Toggle */}
      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
        <div>
          <span className="text-slate-700 dark:text-slate-300 font-medium">
            Irregular Sleep Schedule
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enable if your wake time varies significantly day to day
          </p>
        </div>
        <button
          onClick={handleIrregularToggle}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            preferences.irregularSchedule ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'
          }`}
        >
          <span
            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
              preferences.irregularSchedule ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Cognitive Windows Summary */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-3">
          Your Cognitive Windows
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg">
            <div className="text-emerald-600 dark:text-emerald-400 font-medium">Peak</div>
            <div className="text-slate-700 dark:text-slate-300">
              {cognitiveWindows.peakStart} - {cognitiveWindows.peakEnd}
            </div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
            <div className="text-amber-600 dark:text-amber-400 font-medium">Trough</div>
            <div className="text-slate-700 dark:text-slate-300">
              {cognitiveWindows.troughStart} - {cognitiveWindows.troughEnd}
            </div>
          </div>
          <div className="bg-violet-50 dark:bg-violet-900/20 p-3 rounded-lg">
            <div className="text-violet-600 dark:text-violet-400 font-medium">Recovery</div>
            <div className="text-slate-700 dark:text-slate-300">
              {cognitiveWindows.eveningStart} - {cognitiveWindows.eveningEnd}
            </div>
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          💡 Optimal exam time for your chronotype: <strong>{optimalExamTime}</strong>
        </div>
      </div>

      {/* Daily Schedule */}
      {showSchedule && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3">
            Recommended Daily Schedule
          </h3>
          <div className="space-y-2">
            {dailySchedule.map((slot, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  slot.priority === 'high'
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-500'
                    : slot.priority === 'medium'
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400'
                    : 'bg-slate-50 dark:bg-slate-700/50 border-l-4 border-slate-300'
                }`}
              >
                <div>
                  <div className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                    {slot.timeRange}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {slot.recommendation}
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    slot.priority === 'high'
                      ? 'bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200'
                      : slot.priority === 'medium'
                      ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
                      : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
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
      <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
        Based on chronobiology research: 8:30 AM wake time associated with 73.1% high scorers
        (Preckel et al., 2011)
      </p>
    </div>
  );
};

export default WakeTimeSettings;
