/**
 * Quiz Components Export
 *
 * Exports all quiz-related components for the main study session.
 */

export { default as AnswerChoice } from './AnswerChoice';
export { default as ErrorTagger } from './ErrorTagger';
export { AnswerFeedback, useAnswerFeedback } from './AnswerFeedback';
export { SessionStatsOverlay } from './SessionStatsOverlay';
export { SessionEndSummary } from './SessionEndSummary';
export { SocraticTutorChat } from './SocraticTutorChat';
export { SRSFeedbackBadge } from './SRSFeedbackBadge';
export { QuestionTimer } from './QuestionTimer';
// Behavioral confidence (no manual input needed)
export {
  BehavioralCalibration,
  ConfidenceBadge,
  useBehavioralTracking,
} from './BehavioralCalibration';
export { DifficultyIndicator, useQuestionDifficulty } from './DifficultyIndicator';
export { QuickStatsMiniBar } from './QuickStatsMiniBar';
// Sprint 4 continued: Session momentum and insights
export { MomentumIndicator, MomentumBadge } from './MomentumIndicator';
export { SessionInsightsPanel } from './SessionInsightsPanel';
// Sprint 4 continued: Streaks and predictions
export { StreakVisualization, StreakBadge } from './StreakVisualization';
export { ScorePredictionCard } from './ScorePredictionCard';
// Sprint 4 continued: Smart pause and encouragement
export { SmartPauseIndicator, EncouragementToast } from './SmartPauseIndicator';
// Advanced analytics: Cognitive state tracking
export { CognitiveStateIndicator } from './CognitiveStateIndicator';
// Implicit FSRS: behavioral telemetry for Ghost Grader
export {
  BehavioralTrackerProvider,
  useBehavioralTracker,
  OptionHoverTracker,
  behavioralPayloadToTelemetryData,
  type BehavioralPayload,
  type BehavioralTrackerApi,
} from './Tracker';
