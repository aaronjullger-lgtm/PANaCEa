import { useRef, useState, useCallback } from 'react';

const DEFAULT_THRESHOLDS = {
  wellnessCheckEvery: 30,    // questions between wellness checks
  lateNightStart: 22,        // 10pm
  lateNightEnd: 5,           // 5am
  lateNightCheckInterval: 15, // questions between late-night checks
};

export type WellnessReason = 'rapid_questions' | 'late_night' | 'manual';

interface UseWellnessChecksOptions {
  wellnessCheckEvery?: number;
  lateNightStart?: number;
  lateNightEnd?: number;
  lateNightCheckInterval?: number;
}

export function useWellnessChecks(opts: UseWellnessChecksOptions = {}) {
  const {
    wellnessCheckEvery,
    lateNightStart,
    lateNightEnd,
    lateNightCheckInterval,
  } = { ...DEFAULT_THRESHOLDS, ...opts };

  const questionsAnswered = useRef(0);
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState<WellnessReason>('manual');

  const checkAfterAnswer = useCallback(() => {
    questionsAnswered.current += 1;

    // Threshold-based wellness check
    if (
      questionsAnswered.current > 0 &&
      questionsAnswered.current % wellnessCheckEvery === 0
    ) {
      setReason('rapid_questions');
      setShowModal(true);
      return;
    }

    // Late-night studying check
    const currentHour = new Date().getHours();
    if (
      (currentHour >= lateNightStart || currentHour < lateNightEnd) &&
      questionsAnswered.current > 0 &&
      questionsAnswered.current % lateNightCheckInterval === 0
    ) {
      setReason('late_night');
      setShowModal(true);
    }
  }, [wellnessCheckEvery, lateNightStart, lateNightEnd, lateNightCheckInterval]);

  const triggerManual = useCallback((r: WellnessReason = 'manual') => {
    setReason(r);
    setShowModal(true);
  }, []);

  const dismiss = useCallback(() => {
    setShowModal(false);
  }, []);

  return {
    showModal,
    reason,
    checkAfterAnswer,
    triggerManual,
    dismiss,
    questionsAnswered,
  };
}
