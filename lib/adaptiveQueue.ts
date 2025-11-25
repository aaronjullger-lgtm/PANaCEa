import { Question, QuestionProgress } from '@prisma/client';

export interface PriorityContext {
  question: Question;
  progress?: QuestionProgress;
}

export function calculateAccuracy(progress?: QuestionProgress): number {
  if (!progress || progress.attempts === 0) {
    return 0;
  }
  return progress.correct / progress.attempts;
}

export function calculatePriorityScore(context: PriorityContext): number {
  const accuracy = calculateAccuracy(context.progress);
  const streak = context.progress?.streak ?? 0;
  const difficulty = context.question.difficulty;
  const score = (1 - accuracy) * 0.6 + (1 / (streak + 1)) * 0.2 + difficulty * 0.2;
  return Number(score.toFixed(6));
}

export function isDueForReview(progress: QuestionProgress | undefined, now: Date): boolean {
  if (!progress || !progress.nextReview) {
    return true;
  }
  return progress.nextReview.getTime() <= now.getTime();
}
