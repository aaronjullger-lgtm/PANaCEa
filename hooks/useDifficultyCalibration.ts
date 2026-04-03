/**
 * useDifficultyCalibration Hook
 *
 * Maintains a rolling window of recent attempt results and provides
 * real-time difficulty calibration using the 85% Rule (Wilson et al., 2019).
 *
 * Usage: Call `recordAttempt()` after each answer. Read `calibration`
 * for the current mix and zone. Pass `calibration.mix` to question
 * selection APIs to adjust upcoming question difficulty.
 *
 * @module hooks/useDifficultyCalibration
 */

import { useState, useCallback, useRef } from 'react';
import {
  calibrateDifficulty,
  type AttemptRecord,
  type CalibrationResult,
  type DifficultyMix,
} from '@/lib/services/difficultyCalibrator';

export interface UseDifficultyCalibrationReturn {
  /** Record an attempt result */
  recordAttempt: (wasCorrect: boolean, difficulty: string | null) => void;
  /** Current calibration result (mix, accuracy, zone, message) */
  calibration: CalibrationResult;
  /** Current difficulty mix to pass to the next question batch */
  mix: DifficultyMix;
  /** Reset the calibration (e.g., on new session) */
  reset: () => void;
}

const DEFAULT_RESULT: CalibrationResult = {
  mix: { easy: 0.30, medium: 0.45, hard: 0.25 },
  accuracy: 0,
  zone: 'insufficient_data',
  message: 'Warming up — difficulty will adapt after a few more questions.',
};

export function useDifficultyCalibration(): UseDifficultyCalibrationReturn {
  const attemptsRef = useRef<AttemptRecord[]>([]);
  const [calibration, setCalibration] = useState<CalibrationResult>(DEFAULT_RESULT);

  const recordAttempt = useCallback(
    (wasCorrect: boolean, difficulty: string | null) => {
      attemptsRef.current.push({ wasCorrect, difficulty });

      // Only recalibrate every 5 questions to avoid jitter
      if (attemptsRef.current.length % 5 === 0 || attemptsRef.current.length <= 15) {
        const result = calibrateDifficulty(attemptsRef.current, calibration.mix);
        setCalibration(result);
      }
    },
    [calibration.mix]
  );

  const reset = useCallback(() => {
    attemptsRef.current = [];
    setCalibration(DEFAULT_RESULT);
  }, []);

  return {
    recordAttempt,
    calibration,
    mix: calibration.mix,
    reset,
  };
}
