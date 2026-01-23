/**
 * Exam Service - Simulated PANCE/PANRE-LA Exam Management
 * Sprint 5: Core exam simulation logic
 *
 * Handles:
 * - Exam session creation and management
 * - Blueprint-weighted question selection
 * - Block timing and progress tracking
 * - Score calculation and reporting
 */

import type { Question, Condition } from '@prisma/client';

// =============================================================================
// TYPES
// =============================================================================

export interface ExamConfig {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  totalQuestions: number;
  timeMinutes: number;
  blocks: number;
  questionsPerBlock: number;
  passingScore: number;
  blueprintWeights: Record<string, number>;
  isActive: boolean;
}

export interface ExamAttempt {
  id: string;
  userId: string;
  configId: string;
  startedAt: Date;
  completedAt?: Date;
  lastActiveAt: Date;
  currentBlock: number;
  currentQuestionInBlock: number;
  blockTimes: BlockTime[];
  status: ExamStatus;
  totalTimeUsedSeconds: number;
  score?: number;
  percentCorrect?: number;
  systemScores?: Record<string, number>;
  passStatus?: 'passed' | 'failed' | 'pending';
}

export interface ExamAnswer {
  id: string;
  attemptId: string;
  questionId: string;
  blockNumber: number;
  questionNumber: number;
  selectedAnswer?: string;
  isCorrect?: boolean;
  isFlagged: boolean;
  timeSpentSeconds: number;
  answeredAt?: Date;
  organSystem?: string;
}

export interface BlockTime {
  block: number;
  startedAt: string;
  endedAt?: string;
  timeUsedSeconds: number;
}

export type ExamStatus = 'in_progress' | 'paused' | 'completed' | 'abandoned' | 'timed_out';

export interface ExamQuestion extends Question {
  blockNumber: number;
  questionNumber: number;
  condition?: Condition;
}

export interface ScoreReport {
  overallScore: number;
  percentCorrect: number;
  passStatus: 'passed' | 'failed';
  systemBreakdown: SystemScore[];
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unanswered: number;
  flaggedCount: number;
  timeUsedMinutes: number;
  timeAllowedMinutes: number;
  blockScores: BlockScore[];
  strengths: string[];
  weaknesses: string[];
}

export interface SystemScore {
  system: string;
  displayName: string;
  percentCorrect: number;
  questionsAttempted: number;
  questionsCorrect: number;
  blueprintWeight: number;
  performanceLevel: 'strong' | 'adequate' | 'needs_improvement';
}

export interface BlockScore {
  blockNumber: number;
  percentCorrect: number;
  timeUsedSeconds: number;
  questionsAnswered: number;
}

// =============================================================================
// NCCPA BLUEPRINT WEIGHTS (2024)
// =============================================================================

export const NCCPA_BLUEPRINT_WEIGHTS: Record<string, { weight: number; displayName: string }> = {
  cardiovascular: { weight: 11, displayName: 'Cardiovascular' },
  pulmonary: { weight: 9, displayName: 'Pulmonary' },
  gastrointestinal: { weight: 9, displayName: 'Gastrointestinal / Nutritional' },
  musculoskeletal: { weight: 9, displayName: 'Musculoskeletal' },
  heent: { weight: 8, displayName: 'EENT (Eyes, Ears, Nose, Throat)' },
  reproductive: { weight: 8, displayName: 'Reproductive' },
  neurological: { weight: 7, displayName: 'Neurologic System' },
  psychiatry: { weight: 7, displayName: 'Psychiatry / Behavioral' },
  endocrine: { weight: 6, displayName: 'Endocrine' },
  dermatology: { weight: 5, displayName: 'Dermatologic' },
  genitourinary: { weight: 5, displayName: 'Genitourinary' },
  hematology: { weight: 4, displayName: 'Hematologic' },
  infectious_disease: { weight: 4, displayName: 'Infectious Diseases' },
  nephrology: { weight: 4, displayName: 'Renal' },
  emergency_medicine: { weight: 2, displayName: 'Emergency Medicine' },
  professional_practice: { weight: 2, displayName: 'Professional Practice' },
};

// =============================================================================
// EXAM SERVICE CLASS
// =============================================================================

export class ExamService {
  /**
   * Calculate number of questions per system based on blueprint weights
   */
  static calculateSystemDistribution(totalQuestions: number): Record<string, number> {
    const distribution: Record<string, number> = {};
    let assigned = 0;

    // Calculate proportional distribution
    for (const [system, { weight }] of Object.entries(NCCPA_BLUEPRINT_WEIGHTS)) {
      const questions = Math.round((weight / 100) * totalQuestions);
      distribution[system] = questions;
      assigned += questions;
    }

    // Adjust for rounding errors - add/remove from largest systems
    const diff = totalQuestions - assigned;
    if (diff !== 0) {
      const sortedSystems = Object.entries(distribution).sort((a, b) => b[1] - a[1]);

      for (let i = 0; i < Math.abs(diff); i++) {
        const systemIndex = i % sortedSystems.length;
        const systemEntry = sortedSystems[systemIndex];
        if (systemEntry && systemEntry[0] && distribution[systemEntry[0]] !== undefined) {
          distribution[systemEntry[0]] += diff > 0 ? 1 : -1;
        }
      }
    }

    return distribution;
  }

  /**
   * Generate a weighted random selection of questions matching blueprint
   */
  static async selectExamQuestions(
    availableQuestions: Question[],
    totalNeeded: number,
    distribution: Record<string, number>
  ): Promise<Question[]> {
    const selected: Question[] = [];
    const usedIds = new Set<string>();

    // Group available questions by system
    const bySystem: Record<string, Question[]> = {};
    for (const q of availableQuestions) {
      const system = (q as any).organSystem?.toLowerCase().replace(/\s+/g, '_') || 'other';
      if (!bySystem[system]) bySystem[system] = [];
      bySystem[system].push(q);
    }

    // Select questions for each system
    for (const [system, count] of Object.entries(distribution)) {
      const pool = bySystem[system] || [];
      const shuffled = [...pool].sort(() => Math.random() - 0.5);

      for (let i = 0; i < count && i < shuffled.length; i++) {
        const question = shuffled[i];
        if (question && !usedIds.has(question.id)) {
          selected.push(question);
          usedIds.add(question.id);
        }
      }
    }

    // If we don't have enough, fill from any system
    if (selected.length < totalNeeded) {
      const allAvailable = availableQuestions.filter((q) => !usedIds.has(q.id));
      const shuffled = [...allAvailable].sort(() => Math.random() - 0.5);
      for (const q of shuffled) {
        if (selected.length >= totalNeeded) break;
        if (q) selected.push(q);
      }
    }

    // Shuffle final selection
    return selected.sort(() => Math.random() - 0.5);
  }

  /**
   * Organize questions into blocks
   */
  static organizeIntoBlocks(
    questions: Question[],
    blocksCount: number,
    questionsPerBlock: number
  ): ExamQuestion[][] {
    const blocks: ExamQuestion[][] = [];

    for (let b = 0; b < blocksCount; b++) {
      const blockQuestions: ExamQuestion[] = [];
      const start = b * questionsPerBlock;
      const end = Math.min(start + questionsPerBlock, questions.length);

      for (let q = start; q < end; q++) {
        const question = questions[q];
        if (question) {
          blockQuestions.push({
            ...question,
            blockNumber: b + 1,
            questionNumber: q - start + 1,
          });
        }
      }

      blocks.push(blockQuestions);
    }

    return blocks;
  }

  /**
   * Calculate time remaining for current block
   */
  static calculateBlockTimeRemaining(blockStartedAt: Date, timePerBlockMinutes: number): number {
    const elapsed = Date.now() - blockStartedAt?.getTime();
    const remaining = timePerBlockMinutes * 60 * 1000 - elapsed;
    return Math.max(0, Math.floor(remaining / 1000));
  }

  /**
   * Calculate overall exam time remaining
   */
  static calculateExamTimeRemaining(
    examStartedAt: Date,
    totalTimeMinutes: number,
    pausedSeconds: number = 0
  ): number {
    const elapsed = Date.now() - examStartedAt?.getTime() - pausedSeconds * 1000;
    const remaining = totalTimeMinutes * 60 * 1000 - elapsed;
    return Math.max(0, Math.floor(remaining / 1000));
  }

  /**
   * Calculate scaled score from raw percentage
   * PANCE uses a scaled score of 200-800, passing is 350
   */
  static calculateScaledScore(percentCorrect: number): number {
    // Linear scaling: 0% = 200, 100% = 800
    const scaledScore = 200 + percentCorrect * 6;
    return Math.round(scaledScore);
  }

  /**
   * Generate comprehensive score report
   */
  static generateScoreReport(
    answers: ExamAnswer[],
    config: ExamConfig,
    totalTimeSeconds: number
  ): ScoreReport {
    const totalQuestions = answers.length;
    const answered = answers.filter((a) => a.selectedAnswer);
    const correct = answers.filter((a) => a.isCorrect);
    const flagged = answers.filter((a) => a.isFlagged);

    const percentCorrect = totalQuestions > 0 ? (correct.length / totalQuestions) * 100 : 0;

    const scaledScore = this.calculateScaledScore(percentCorrect);
    const passStatus = scaledScore >= config.passingScore ? 'passed' : 'failed';

    // Calculate system breakdown
    const systemStats: Record<string, { correct: number; total: number }> = {};
    for (const answer of answers) {
      const system = answer.organSystem || 'other';
      if (!systemStats[system]) {
        systemStats[system] = { correct: 0, total: 0 };
      }
      systemStats[system].total++;
      if (answer.isCorrect) systemStats[system].correct++;
    }

    const systemBreakdown: SystemScore[] = Object.entries(systemStats)
      .map(([system, stats]) => {
        const pct = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
        const blueprintWeight = NCCPA_BLUEPRINT_WEIGHTS[system]?.weight || 0;

        let performanceLevel: 'strong' | 'adequate' | 'needs_improvement';
        if (pct >= 75) performanceLevel = 'strong';
        else if (pct >= 60) performanceLevel = 'adequate';
        else performanceLevel = 'needs_improvement';

        return {
          system,
          displayName: NCCPA_BLUEPRINT_WEIGHTS[system]?.displayName || system,
          percentCorrect: Math.round(pct * 10) / 10,
          questionsAttempted: stats.total,
          questionsCorrect: stats.correct,
          blueprintWeight,
          performanceLevel,
        };
      })
      .sort((a, b) => b.blueprintWeight - a.blueprintWeight);

    // Calculate block scores
    const blockStats: Record<number, { correct: number; total: number; time: number }> = {};
    for (const answer of answers) {
      if (!blockStats[answer.blockNumber]) {
        blockStats[answer.blockNumber] = { correct: 0, total: 0, time: 0 };
      }
      if (blockStats[answer.blockNumber]) {
        blockStats[answer.blockNumber].total++;
        blockStats[answer.blockNumber].time += answer.timeSpentSeconds;
        if (answer.isCorrect) {
          blockStats[answer.blockNumber].correct++;
        }
      }
    }

    const blockScores: BlockScore[] = Object.entries(blockStats)
      .map(([block, stats]) => ({
        blockNumber: parseInt(block),
        percentCorrect: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
        timeUsedSeconds: stats.time,
        questionsAnswered: stats.total,
      }))
      .sort((a, b) => a.blockNumber - b.blockNumber);

    // Identify strengths and weaknesses
    const strengths = systemBreakdown
      .filter((s) => s.performanceLevel === 'strong')
      .slice(0, 3)
      .map((s) => s.displayName);

    const weaknesses = systemBreakdown
      .filter((s) => s.performanceLevel === 'needs_improvement')
      .slice(0, 3)
      .map((s) => s.displayName);

    return {
      overallScore: scaledScore,
      percentCorrect: Math.round(percentCorrect * 10) / 10,
      passStatus,
      systemBreakdown,
      totalQuestions,
      correctAnswers: correct.length,
      incorrectAnswers: answered.length - correct.length,
      unanswered: totalQuestions - answered.length,
      flaggedCount: flagged.length,
      timeUsedMinutes: Math.round(totalTimeSeconds / 60),
      timeAllowedMinutes: config.timeMinutes,
      blockScores,
      strengths,
      weaknesses,
    };
  }

  /**
   * Check if user can resume an exam
   */
  static canResumeExam(attempt: ExamAttempt): boolean {
    if (attempt.status === 'completed' || attempt.status === 'abandoned') {
      return false;
    }

    // Allow resume within 24 hours
    const hoursSinceLastActive =
      (Date.now() - new Date(attempt.lastActiveAt)?.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastActive < 24;
  }

  /**
   * Format time for display (MM:SS)
   */
  static formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Format time for display with hours (HH:MM:SS)
   */
  static formatTimeWithHours(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

export default ExamService;
