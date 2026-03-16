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
  if (wordCount > 150) vignetteComplexity = 'long';
  else if (wordCount > 80) vignetteComplexity = 'medium';

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
  if (factors.wordCount > 150) {
    score += 25;
    reasoning.push('Long vignette');
  } else if (factors.wordCount > 100) {
    score += 15;
    reasoning.push('Medium-length vignette');
  } else if (factors.wordCount > 60) {
    score += 8;
  }

  // Table presence (15 points)
  if (factors.hasTable) {
    score += 15;
    reasoning.push('Contains table data');
  }

  // Lab values (15 points)
  if (factors.hasLabValues) {
    score += 15;
    reasoning.push('Lab interpretation required');
  }

  // Multi-step reasoning (20 points)
  if (factors.hasMultipleSteps) {
    score += 20;
    reasoning.push('Multi-step reasoning');
  }

  // Topic accuracy modifier (0-25 points)
  if (topicAccuracy !== null && topicAccuracy !== undefined) {
    if (topicAccuracy < 50) {
      score += 25;
      reasoning.push('Challenging topic for you');
    } else if (topicAccuracy < 70) {
      score += 15;
      reasoning.push('Topic needs review');
    } else if (topicAccuracy < 85) {
      score += 5;
    }
  }

  // Normalize to 0-100
  const normalizedScore = Math.min(score, 100);

  // Determine level
  let level: DifficultyLevel = 'easy';
  if (normalizedScore >= 70) level = 'expert';
  else if (normalizedScore >= 45) level = 'hard';
  else if (normalizedScore >= 20) level = 'medium';

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
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="text-xs text-[var(--color-text-muted)] space-y-1"
        >
          {reasoning.map((reason, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-[var(--color-text-[var(--color-text-muted)])]" />
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

// Calculate par time based on difficulty factors
function calculateParTime(factors: DifficultyFactors): number {
  // Base time: 60 seconds
  let parTime = 60000;

  // Add time for word count
  if (factors.vignetteComplexity === 'long') parTime += 30000;
  else if (factors.vignetteComplexity === 'medium') parTime += 15000;

  // Add time for tables
  if (factors.hasTable) parTime += 20000;

  // Add time for lab interpretation
  if (factors.hasLabValues) parTime += 15000;

  // Add time for multi-step reasoning
  if (factors.hasMultipleSteps) parTime += 10000;

  return parTime;
}

export default DifficultyIndicator;
