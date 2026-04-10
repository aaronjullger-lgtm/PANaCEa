/**
 * Question Difficulty Indicator
 *
 * Shows the estimated difficulty of the current question based on:
 * - Word count / vignette length
 * - Presence of lab values, imaging, tables
 * - Topic complexity
 * - Historical performance on similar questions
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Brain, Gauge, Zap } from 'lucide-react';

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'expert';

interface DifficultyIndicatorProps {
  /** Question text for analysis */
  questionText: string;
  /** Question topic/system */
  topic?: string;
  /** Historical accuracy for this topic (0-100) */
  topicAccuracy?: number | null;
  /** Compact mode */
  compact?: boolean;
  /** Show detailed breakdown */
  showBreakdown?: boolean;
}

// ─── Word Count Thresholds ──────────────────────────────────────────────────────
const WORD_COUNT_LONG = 150;
const WORD_COUNT_MEDIUM = 80;
const WORD_COUNT_SHORT = 60;

// ─── Scoring Weights (points added to difficulty score, max 100) ──────────────
const SCORE_LONG_VIGNETTE = 25;
const SCORE_MEDIUM_VIGNETTE = 15;
const SCORE_SHORT_VIGNETTE = 8;
const SCORE_TABLE = 15;
const SCORE_LAB_VALUES = 15;
const SCORE_MULTI_STEP = 20;

// ─── Topic Accuracy Modifiers ─────────────────────────────────────────────────
const ACCURACY_CHALLENGING_THRESHOLD = 50;
const ACCURACY_REVIEW_THRESHOLD = 70;
const ACCURACY_MINOR_THRESHOLD = 85;
const SCORE_CHALLENGING_TOPIC = 25;
const SCORE_REVIEW_TOPIC = 15;
const SCORE_MINOR_TOPIC = 5;

// ─── Difficulty Level Thresholds (on 0–100 score) ─────────────────────────────
const DIFFICULTY_EXPERT_THRESHOLD = 70;
const DIFFICULTY_HARD_THRESHOLD = 45;
const DIFFICULTY_MEDIUM_THRESHOLD = 20;

interface DifficultyFactors {
  wordCount: number;
  hasTable: boolean;
  hasLabValues: boolean;
  hasMultipleSteps: boolean;
  vignetteComplexity: 'short' | 'medium' | 'long';
}

function analyzeQuestion(text: string): DifficultyFactors {
  // Clean HTML tags
  const cleanText = text.replace(/<[^>]*>/g, ' ').trim();

  // Word count
  const words = cleanText.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  // Check for tables
  const hasTable = text.includes('<table') || text.includes('|---|');

  // Check for lab values (numbers with units)
  const labPattern =
    /\d+\.?\d*\s*(mg\/dL|g\/dL|mEq\/L|mmol\/L|U\/L|IU\/L|ng\/mL|μg\/L|%|mm\/hr|cells\/μL)/i;
  const hasLabValues = labPattern.test(text);

  // Check for multi-step reasoning indicators
  const multiStepIndicators = [
    'after',
    'then',
    'following',
    'next step',
    'subsequently',
    'initial',
    'first-line',
    'if',
    'unless',
    'despite',
  ];
  const hasMultipleSteps = multiStepIndicators.some((ind) => cleanText.toLowerCase().includes(ind));

  // Vignette complexity based on word count
  let vignetteComplexity: 'short' | 'medium' | 'long' = 'short';
  if (wordCount > WORD_COUNT_LONG) vignetteComplexity = 'long';
  else if (wordCount > WORD_COUNT_MEDIUM) vignetteComplexity = 'medium';

  return {
    wordCount,
    hasTable,
    hasLabValues,
    hasMultipleSteps,
    vignetteComplexity,
  };
}

function calculateDifficulty(
  factors: DifficultyFactors,
  topicAccuracy?: number | null
): { level: DifficultyLevel; score: number; reasoning: string[] } {
  let score = 0;
  const reasoning: string[] = [];

  // Word count scoring (0-25 points)
  if (factors.wordCount > WORD_COUNT_LONG) {
    score += SCORE_LONG_VIGNETTE;
    reasoning.push('Long vignette');
  } else if (factors.wordCount > WORD_COUNT_MEDIUM) {
    score += SCORE_MEDIUM_VIGNETTE;
    reasoning.push('Medium-length vignette');
  } else if (factors.wordCount > WORD_COUNT_SHORT) {
    score += SCORE_SHORT_VIGNETTE;
  }

  // Table presence (15 points)
  if (factors.hasTable) {
    score += SCORE_TABLE;
    reasoning.push('Contains table data');
  }

  // Lab values (15 points)
  if (factors.hasLabValues) {
    score += SCORE_LAB_VALUES;
    reasoning.push('Lab interpretation required');
  }

  // Multi-step reasoning (20 points)
  if (factors.hasMultipleSteps) {
    score += SCORE_MULTI_STEP;
    reasoning.push('Multi-step reasoning');
  }

  // Topic accuracy modifier (0-25 points)
  if (topicAccuracy !== null && topicAccuracy !== undefined) {
    if (topicAccuracy < ACCURACY_CHALLENGING_THRESHOLD) {
      score += SCORE_CHALLENGING_TOPIC;
      reasoning.push('Challenging topic for you');
    } else if (topicAccuracy < ACCURACY_REVIEW_THRESHOLD) {
      score += SCORE_REVIEW_TOPIC;
      reasoning.push('Topic needs review');
    } else if (topicAccuracy < ACCURACY_MINOR_THRESHOLD) {
      score += SCORE_MINOR_TOPIC;
    }
  }

  // Normalize to 0-100
  const normalizedScore = Math.min(score, 100);

  // Determine level
  let level: DifficultyLevel = 'easy';
  if (normalizedScore >= DIFFICULTY_EXPERT_THRESHOLD) level = 'expert';
  else if (normalizedScore >= DIFFICULTY_HARD_THRESHOLD) level = 'hard';
  else if (normalizedScore >= DIFFICULTY_MEDIUM_THRESHOLD) level = 'medium';

  return { level, score: normalizedScore, reasoning };
}

const difficultyConfig: Record<
  DifficultyLevel,
  {
    label: string;
    color: string;
    bgColor: string;
    icon: typeof Brain;
  }
> = {
  easy: {
    label: 'Straightforward',
    color: 'text-[var(--color-data-pass)]',
    bgColor: 'bg-[var(--color-data-pass)]/10',
    icon: Zap,
  },
  medium: {
    label: 'Moderate',
    color: 'text-[var(--color-accent)]',
    bgColor: 'bg-[var(--color-accent)]/10',
    icon: Gauge,
  },
  hard: {
    label: 'Challenging',
    color: 'text-[var(--color-data-provisional)]',
    bgColor: 'bg-[var(--color-data-provisional)]/10',
    icon: Brain,
  },
  expert: {
    label: 'Complex',
    color: 'text-[var(--color-data-fail)]',
    bgColor: 'bg-[var(--color-data-fail)]/10',
    icon: Brain,
  },
};

export const DifficultyIndicator: React.FC<DifficultyIndicatorProps> = ({
  questionText,
  topic,
  topicAccuracy,
  compact = false,
  showBreakdown = false,
}) => {
  const factors = analyzeQuestion(questionText);
  const { level, score, reasoning } = calculateDifficulty(factors, topicAccuracy);
  const config = difficultyConfig[level];
  const Icon = config.icon;

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}
        title={`Difficulty: ${config.label}`}
      >
        <Icon className="w-3 h-3" />
        <span>{config.label}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${config.bgColor} ${config.color}`}
        >
          <Icon className="w-4 h-4" />
          <span className="text-sm font-medium">{config.label}</span>
        </div>

        {/* Difficulty meter */}
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4].map((dot) => (
            <motion.div
              key={dot}
              initial={{ scale: 0.8, opacity: 0.5 }}
              animate={{
                scale:
                  dot <= (level === 'easy' ? 1 : level === 'medium' ? 2 : level === 'hard' ? 3 : 4)
                    ? 1
                    : 0.8,
                opacity:
                  dot <= (level === 'easy' ? 1 : level === 'medium' ? 2 : level === 'hard' ? 3 : 4)
                    ? 1
                    : 0.3,
              }}
              className={`w-2 h-2 rounded-full ${
                dot <= (level === 'easy' ? 1 : level === 'medium' ? 2 : level === 'hard' ? 3 : 4)
                  ? config.color.replace('text-', 'bg-')
                  : 'bg-[var(--color-bg-tertiary)]'
              }`}
            />
          ))}
        </div>
      </div>

      {showBreakdown && reasoning.length > 0 && (
        <motion.div
          initial={{ height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="text-xs text-[var(--color-text-muted)] space-y-1"
        >
          {reasoning.map((reason, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-[var(--color-bg-secondary)]" />
              <span>{reason}</span>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
};

// Hook for getting difficulty info
export function useQuestionDifficulty(questionText: string, topicAccuracy?: number | null) {
  const factors = analyzeQuestion(questionText);
  const result = calculateDifficulty(factors, topicAccuracy);

  return {
    ...result,
    factors,
    parTimeMs: calculateParTime(factors),
  };
}

// ─── Par Time Constants (milliseconds) ──────────────────────────────────────
const PAR_TIME_BASE_MS = 60_000;
const PAR_TIME_LONG_VIGNETTE_MS = 30_000;
const PAR_TIME_MEDIUM_VIGNETTE_MS = 15_000;
const PAR_TIME_TABLE_MS = 20_000;
const PAR_TIME_LAB_VALUES_MS = 15_000;
const PAR_TIME_MULTI_STEP_MS = 10_000;

// Calculate par time based on difficulty factors
function calculateParTime(factors: DifficultyFactors): number {
  let parTime = PAR_TIME_BASE_MS;

  // Add time for word count
  if (factors.vignetteComplexity === 'long') parTime += PAR_TIME_LONG_VIGNETTE_MS;
  else if (factors.vignetteComplexity === 'medium') parTime += PAR_TIME_MEDIUM_VIGNETTE_MS;

  // Add time for tables
  if (factors.hasTable) parTime += PAR_TIME_TABLE_MS;

  // Add time for lab interpretation
  if (factors.hasLabValues) parTime += PAR_TIME_LAB_VALUES_MS;

  // Add time for multi-step reasoning
  if (factors.hasMultipleSteps) parTime += PAR_TIME_MULTI_STEP_MS;

  return parTime;
}

export default DifficultyIndicator;
