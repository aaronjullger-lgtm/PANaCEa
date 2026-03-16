/**
 * Daily Challenges Hub
 *
 * Consolidates Grand Rounds, Diagnostic Puzzle, and Medical Wordle
 * into a dedicated section with prominent accessibility and daily engagement.
 */

import React, { useState, useEffect } from 'react';
import { Calendar, Trophy, Puzzle, SpellCheck } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { API_ENDPOINTS, buildApiUrl } from '@/lib/utils/apiConfig';
import { useDiagnosticPuzzle } from '@/hooks/useDiagnosticPuzzle';
import { useWordleGame } from '@/src/hooks/useWordleGame';
import { BackLink } from '@/components/navigation/BackLink';
import { ROUTES } from '@/config/routes';

interface ChallengeCardProps {
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
  streak?: number;
  resetTime?: string; // formatted time until reset
  loading: boolean;
  error?: string;
  buttonText: string;
  onAction: () => void;
}

const ChallengeCard: React.FC<ChallengeCardProps> = ({
  title,
  subtitle,
  description,
  icon,
  completed,
  streak,
  resetTime,
  loading,
  error,
  buttonText,
  onAction,
}) => {
  return (
    <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-action-muted rounded-lg text-action-primary">
            {icon}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-action-primary">{title}</h3>
            <p className="text-sm text-text-muted">{subtitle}</p>
          </div>
        </div>
        {completed && (
          <span className="px-3 py-1 text-xs font-semibold bg-success/20 text-success rounded-full border border-success/30">
            Completed
          </span>
        )}
      </div>

      <p className="text-text-secondary mb-4">{description}</p>

      <div className="flex items-center justify-between mb-6">
        <div className="space-y-1">
          {streak !== undefined && (
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-text-tertiary" />
              <span className="text-sm font-medium text-action-primary">{streak} day streak</span>
            </div>
          )}
          {resetTime && (
            <div className="text-xs text-text-tertiary">
              Resets in {resetTime}
            </div>
          )}
        </div>
        {loading && (
          <div className="text-xs text-text-tertiary">Loading...</div>
        )}
        {error && (
          <div className="text-xs text-error">{error}</div>
        )}
      </div>

      <button
        onClick={onAction}
        className="w-full py-2.5 px-4 bg-action-primary text-surface-primary font-medium rounded-lg hover:bg-action-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={loading}
      >
        {buttonText}
      </button>
    </div>
  );
};

export function DailyChallengesHub() {
  const { getToken } = useAuth();
  const [grandRoundsCompleted, setGrandRoundsCompleted] = useState<boolean>(false);
  const [grandRoundsLoading, setGrandRoundsLoading] = useState(true);
  const [grandRoundsError, setGrandRoundsError] = useState<string | null>(null);
  const [grandRoundsStreak, setGrandRoundsStreak] = useState<number | undefined>();

  const {
    puzzle: diagnosticPuzzle,
    userState: diagnosticUserState,
    isLoading: diagnosticLoading,
    error: diagnosticError,
    fetchDailyPuzzle,
  } = useDiagnosticPuzzle();

  const {
    game: wordleGame,
    status: wordleStatus,
    loading: wordleLoading,
    error: wordleError,
  } = useWordleGame();

  // Fetch Grand Rounds completion status
  useEffect(() => {
    const fetchGrandRoundsCompletion = async () => {
      setGrandRoundsLoading(true);
      setGrandRoundsError(null);
      try {
        const token = await getToken();
        const response = await fetch(buildApiUrl(API_ENDPOINTS.GRAND_ROUNDS_COMPLETED), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        setGrandRoundsCompleted(data.data?.completed ?? false);
        // TODO: fetch streak from another endpoint
      } catch (err) {
        setGrandRoundsError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setGrandRoundsLoading(false);
      }
    };
    fetchGrandRoundsCompletion();
  }, [getToken]);

  // Fetch diagnostic puzzle on mount (hook already does)
  useEffect(() => {
    fetchDailyPuzzle();
  }, [fetchDailyPuzzle]);

  // Determine completion for diagnostic puzzle
  const diagnosticCompleted = diagnosticUserState?.status === 'won' || diagnosticUserState?.status === 'lost';
  const diagnosticStreak = undefined; // not implemented yet

  // Determine completion for wordle
  const wordleCompleted = wordleStatus === 'won' || wordleStatus === 'lost';
  const wordleStreak = undefined;

  // Reset times (mock for now)
  const resetTime = '6 hours'; // TODO: calculate from midnight UTC

  const handleStartGrandRounds = () => {
    // Navigate to Grand Rounds mode
    window.location.href = '/grand-rounds';
  };

  const handleStartDiagnosticPuzzle = () => {
    // Navigate to Diagnostic Puzzle mode
    window.location.href = '/diagnostic-puzzle';
  };

  const handleStartWordle = () => {
    // [DISABLED] Medical Wordle API not implemented - redirect to /drills
    window.location.href = '/drills';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-10">
        <BackLink to={ROUTES.STUDY} className="mb-4" />
        <h1 className="text-3xl font-bold text-action-primary mb-2">Daily Challenges</h1>
        <p className="text-text-secondary">
          Engage with daily challenges to test your knowledge, compete with peers, and maintain your streak.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ChallengeCard
          title="Grand Rounds"
          subtitle="Daily Competitive Challenge"
          description="5 questions daily, speed-weighted scoring, global leaderboard."
          icon={<Trophy className="w-5 h-5" />}
          completed={grandRoundsCompleted}
          streak={grandRoundsStreak}
          resetTime={resetTime}
          loading={grandRoundsLoading}
          error={grandRoundsError}
          buttonText={grandRoundsCompleted ? 'Review' : 'Start Challenge'}
          onAction={handleStartGrandRounds}
        />
        <ChallengeCard
          title="Diagnostic Puzzle"
          subtitle="Daily Diagnostic Challenge"
          description="Solve a medical mystery with progressive clues."
          icon={<Puzzle className="w-5 h-5" />}
          completed={diagnosticCompleted}
          streak={diagnosticStreak}
          resetTime={resetTime}
          loading={diagnosticLoading}
          error={diagnosticError}
          buttonText={diagnosticCompleted ? 'Review' : 'Start Puzzle'}
          onAction={handleStartDiagnosticPuzzle}
        />
        <ChallengeCard
          title="Medical Wordle"
          subtitle="Daily Medical Term Guessing"
          description="Guess the medical buzzword in 6 attempts."
          icon={<SpellCheck className="w-5 h-5" />}
          completed={wordleCompleted}
          streak={wordleStreak}
          resetTime={resetTime}
          loading={wordleLoading}
          error={wordleError}
          buttonText={wordleCompleted ? 'Review' : 'Start Wordle'}
          onAction={handleStartWordle}
        />
      </div>

      {/* Optional aggregated streak */}
      <div className="mt-12 p-6 bg-surface-primary border border-border-subtle rounded-2xl">
        <h2 className="text-xl font-semibold text-action-primary mb-2">Daily Completion Streak</h2>
        <p className="text-text-secondary mb-4">
          Complete all three challenges each day to maximize your streak. Coming soon.
        </p>
        <div className="h-2 bg-action-muted rounded-full overflow-hidden">
          <div className="h-full bg-success" style={{ width: '0%' }} />
        </div>
      </div>
    </div>
  );
}