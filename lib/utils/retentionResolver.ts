/**
 * Retention Resolver — TARGETED session desired-retention computation.
 *
 * Determines the FSRS `request_retention` value to use for a TARGETED session
 * based on the user's exam date. If the exam falls within the exam-approach
 * window, a tighter retention value is returned to shorten review intervals
 * and maximise recall density near the exam.
 *
 * Only called from the TARGETED FSRS write path. All other session types
 * use their own (fixed) FSRS parameter set.
 */
import { FSRS_RETENTION_CONFIG } from '../config/fsrsConfig';

export interface RetentionResolution {
  /** The resolved request_retention value (0–1) to pass to the FSRS scheduler. */
  desiredRetention: number;
  /** True when exam-approach mode is active (exam within window). */
  examApproachMode: boolean;
  /** Days until exam, or null if examDate is null. */
  daysUntilExam: number | null;
}

/**
 * Resolve the FSRS desired retention for a TARGETED session.
 *
 * @param examDate  User's registered exam date (from User.examDate), or null.
 * @param now       Current time (defaults to Date.now() — injectable for tests).
 */
export function resolveTargetedRetention(
  examDate: Date | null | undefined,
  now: Date = new Date()
): RetentionResolution {
  const {
    defaultDesiredRetention,
    examApproachRetention,
    examApproachWindowDays,
  } = FSRS_RETENTION_CONFIG;

  if (!examDate) {
    return {
      desiredRetention: defaultDesiredRetention,
      examApproachMode: false,
      daysUntilExam: null,
    };
  }

  const daysUntilExam = Math.ceil(
    (examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  // If exam is in the past or exactly today, use exam-approach retention.
  const examApproachMode = daysUntilExam <= examApproachWindowDays;

  return {
    desiredRetention: examApproachMode ? examApproachRetention : defaultDesiredRetention,
    examApproachMode,
    daysUntilExam,
  };
}
