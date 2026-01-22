/**
 * Learning Style Card
 *
 * Displays detected learning style with 4-dimension visualization and personalized recommendations.
 * Dimensions:
 * - Pace Preference: Fast Decider / Thorough Analyzer / Balanced
 * - Explanation Engagement: Deep Dive / Moderate / Minimal
 * - Repetition Pattern: Spaced Repetition / Mass Practice / Mixed
 * - Error Recovery: Reflective / Quick / Adaptive
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, Zap, Book, RotateCcw, TrendingUp, Lightbulb, Info } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';

export interface LearningStyleProfile {
  // Four dimensions
  pacePreference: 'fast-decider' | 'thorough-analyzer' | 'balanced';
  explanationEngagement: 'deep-dive' | 'moderate' | 'minimal';
  repetitionPattern: 'spaced-repetition' | 'mass-practice' | 'mixed';
  errorRecovery: 'reflective' | 'quick' | 'adaptive';

  // Confidence scores (0-1)
  paceConfidence: number;
  engagementConfidence: number;
  repetitionConfidence: number;
  recoveryConfidence: number;

  // Summary
  overallStyle: string;
  dataPoints: number;
  lastAnalyzed: string;
}

interface LearningStyleCardProps {
  className?: string;
}

export const LearningStyleCard: React.FC<LearningStyleCardProps> = ({ className = '' }) => {
  const { getToken } = useAuth();
  const [profile, setProfile] = useState<LearningStyleProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRecommendations, setShowRecommendations] = useState(false);

  /**
   * Fetch learning style from API
   */
  useEffect(() => {
    const fetchLearningStyle = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new Error('Not authenticated');

        const response = await fetch('/api/user/profile', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        if (data.profile?.learningStyle) {
          setProfile(data.profile.learningStyle);
        }
      } catch (err) {
        console.error('[LearningStyleCard] Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load learning style');
      } finally {
        setIsLoading(false);
      }
    };

    void fetchLearningStyle();
  }, [getToken]);

  if (isLoading) {
    return (
      <div
        className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 ${className}`}
      >
        <div className="text-center text-slate-600 dark:text-slate-400">
          Analyzing your learning style...
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div
        className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 ${className}`}
      >
        <div className="text-center">
          <Brain className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-600 dark:text-slate-400 mb-2">
            {error || 'Complete more questions to detect your learning style'}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500">
            We need at least 50 questions to analyze your behavior patterns
          </p>
        </div>
      </div>
    );
  }

  const dimensions = [
    {
      id: 'pace',
      label: 'Pace Preference',
      icon: Zap,
      value: profile.pacePreference,
      confidence: profile.paceConfidence,
      descriptions: {
        'fast-decider': 'Quick decisions with high confidence',
        'thorough-analyzer': 'Careful deliberation and deep analysis',
        balanced: 'Flexible approach adapting to question complexity',
      },
    },
    {
      id: 'engagement',
      label: 'Explanation Style',
      icon: Book,
      value: profile.explanationEngagement,
      confidence: profile.engagementConfidence,
      descriptions: {
        'deep-dive': 'Thorough exploration of concepts and details',
        moderate: 'Balanced review of explanations',
        minimal: 'Efficient learning with targeted review',
      },
    },
    {
      id: 'repetition',
      label: 'Review Pattern',
      icon: RotateCcw,
      value: profile.repetitionPattern,
      confidence: profile.repetitionConfidence,
      descriptions: {
        'spaced-repetition': 'Optimal spacing for long-term retention',
        'mass-practice': 'Intensive focused study sessions',
        mixed: 'Adaptive combination of strategies',
      },
    },
    {
      id: 'recovery',
      label: 'Error Recovery',
      icon: TrendingUp,
      value: profile.errorRecovery,
      confidence: profile.recoveryConfidence,
      descriptions: {
        reflective: 'Deep analysis of mistakes for understanding',
        quick: 'Fast adjustment and forward movement',
        adaptive: 'Context-dependent recovery strategies',
      },
    },
  ];

  const recommendations = getRecommendations(profile);

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 ${className}`}
    >
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-1">
              <Brain className="w-7 h-7 text-purple-600" />
              Your Learning Style
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm">{profile.overallStyle}</p>
          </div>

          <button
            onClick={() => setShowRecommendations(!showRecommendations)}
            className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors text-sm font-medium flex items-center gap-1.5"
          >
            <Lightbulb className="w-4 h-4" />
            {showRecommendations ? 'Hide' : 'Show'} Tips
          </button>
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 dark:text-slate-500">
          <span>{profile.dataPoints} questions analyzed</span>
          <span>•</span>
          <span>Updated {new Date(profile.lastAnalyzed).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Dimensions */}
      <div className="p-6 space-y-5">
        {dimensions.map((dimension) => (
          <DimensionDisplay
            key={dimension.id}
            label={dimension.label}
            icon={dimension.icon}
            value={dimension.value}
            confidence={dimension.confidence}
            description={
              dimension.descriptions[dimension.value as keyof typeof dimension.descriptions] ?? ''
            }
          />
        ))}
      </div>

      {/* Recommendations */}
      {showRecommendations && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-slate-200 dark:border-slate-700 p-6 bg-purple-50 dark:bg-purple-900/10"
        >
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-purple-600" />
            Personalized Study Tips
          </h3>

          <ul className="space-y-2">
            {recommendations.map((rec, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"
              >
                <span className="text-purple-600 dark:text-purple-400 font-bold">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </div>
  );
};

/**
 * Dimension Display Component
 */
interface DimensionDisplayProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  confidence: number;
  description: string;
}

const DimensionDisplay: React.FC<DimensionDisplayProps> = ({
  label,
  icon: Icon,
  value,
  confidence,
  description,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <span className="font-medium text-slate-900 dark:text-slate-100">{label}</span>
        </div>

        <span className="text-sm text-slate-600 dark:text-slate-400">
          {Math.round(confidence * 100)}% confidence
        </span>
      </div>

      <div className="ml-7">
        <div className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm font-medium mb-1">
          {formatValue(value)}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
      </div>

      {/* Confidence Bar */}
      <div className="ml-7 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${confidence * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full"
        />
      </div>
    </div>
  );
};

/**
 * Format dimension value for display
 */
function formatValue(value: string): string {
  return value
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generate personalized recommendations based on learning style
 */
function getRecommendations(profile: LearningStyleProfile): string[] {
  const recs: string[] = [];

  // Pace-based recommendations
  if (profile.pacePreference === 'fast-decider') {
    recs.push('Take advantage of your quick decision-making with timed practice sessions');
    recs.push('Challenge yourself with harder questions to maintain engagement');
  } else if (profile.pacePreference === 'thorough-analyzer') {
    recs.push('Allocate extra time for complex vignettes that benefit from careful analysis');
    recs.push('Use your analytical strength for differential diagnosis questions');
  }

  // Engagement-based recommendations
  if (profile.explanationEngagement === 'deep-dive') {
    recs.push(
      'Continue exploring detailed explanations - your thoroughness builds strong foundations'
    );
    recs.push('Consider creating summary notes from explanations for later review');
  } else if (profile.explanationEngagement === 'minimal') {
    recs.push('Your efficient approach works well - supplement with quick pearl reviews');
    recs.push('Focus on high-yield summaries and bullet points');
  }

  // Repetition-based recommendations
  if (profile.repetitionPattern === 'spaced-repetition') {
    recs.push('Excellent! Spaced repetition is optimal for long-term retention');
    recs.push('Continue following FSRS intervals for best results');
  } else if (profile.repetitionPattern === 'mass-practice') {
    recs.push('Consider gradually increasing review intervals for better long-term retention');
    recs.push('Try reviewing missed questions 2-3 days later instead of immediately');
  }

  // Recovery-based recommendations
  if (profile.errorRecovery === 'reflective') {
    recs.push('Your reflective approach to mistakes is a major strength');
    recs.push('Use error logs to track patterns and prevent recurring mistakes');
  } else if (profile.errorRecovery === 'quick') {
    recs.push('Balance speed with brief reflection on why you got questions wrong');
    recs.push('Consider flagging difficult questions for deeper review later');
  }

  return recs;
}

export default LearningStyleCard;