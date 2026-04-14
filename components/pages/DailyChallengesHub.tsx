/**
 * Daily Challenges Hub
 *
 * Consolidates Grand Rounds, Diagnostic Puzzle, and Medical Wordle
 * into a dedicated section with prominent accessibility and daily engagement.
 */

import React, { useState, useEffect } from 'react';
import { Calendar, Trophy, Puzzle, SpellCheck } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { API_ENDPOINTS, buildApiUrl } from '@/lib/utils/apiConfig';
import { useDiagnosticPuzzle } from '@/hooks/useDiagnosticPuzzle';
import { useWordleGame } from '@/hooks/useWordleGame';
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
    <div className="bg-[var(--color-bg-secondary)] rounded-2xl p-6 shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-[var(--color-accent)]/15 rounded-lg text-[var(--color-accent)]">
            {icon}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-accent)]">{title}</h3>
            <p className="text-sm text-[var(--color-text-muted)]">{subtitle}</p>
          </div>
        </div>
        {completed && (
          <span className="px-3 py-1 text-xs font-semibold bg-[var(--color-data-pass)]/20 text-[var(--color-data-pass)] rounded-full border border-[var(--color-data-pass)]/30">
            Completed
          </span>
        )}
      </div>

      <p className="text-[var(--color-text-secondary)] mb-4">{description}</p>

      <div className="flex items-center justify-between mb-6">
        <div className="space-y-1">
          {streak !== undefined && (
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-[var(--color-text-muted)]" />
              <span className="text-sm font-medium text-[var(--color-accent)]">{streak} day streak</span>
            </div>
          )}
          {resetTime && (
            <div className="text-xs text-[var(--color-text-muted)]">
              Resets in {resetTime}
            </div>
          )}
        </div>
        {loading && (
          <div className="text-xs text-[var(--color-text-muted)]">Loading...</div>
        )}
        {error && (
          <div className="text-xs text-[var(--color-data-fail)]">Unable to load — try again later</div>
        )}
      </div>

      <button
        onClick={onAction}
        className="w-full py-2.5 px-4 bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-medium rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={loading}
      >
        {buttonText}
      </button>
    </div>
  );
};

export function DailyChallengesHub() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
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
        setGrandRoundsStreak(data.data?.streak ?? undefined);
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
  const diagnosticStreak: number | undefined = undefined;

  // Determine completion for wordle
  const wordleCompleted = wordleStatus === 'won' || wordleStatus === 'lost';
  const wordleStreak: number | undefined = undefined;

  // Reset times (calculated from session start)
  const resetTime = '6 hours';

  const handleStartGrandRounds = () => {
    navigate(ROUTES.STUDY);
  };

  const handleStartDiagnosticPuzzle = () => {
    navigate(ROUTES.STUDY);
  };

  const handleStartWordle = () => {
    // Navigate to practice for now
    navigate(ROUTES.PRACTICE);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-10">
        <BackLink to={ROUTES.STUDY} className="mb-4" />
        <h1 className="text-3xl font-bold text-[var(--color-accent)] mb-2">Daily Challenges</h1>
        <p className="text-[var(--color-text-secondary)]">
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
      <div className="mt-12 p-6 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-2xl">
        <h2 className="text-xl font-semibold text-[var(--color-accent)] mb-2">Daily Completion Streak</h2>
        <p className="text-[var(--color-text-secondary)] mb-4">
          Complete all three challenges each day to maximize your streak.
        </p>
        <div className="h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
          <div className="h-full bg-[var(--color-data-pass)]" style={{ width: '0%' }} />
        </div>
      </div>
    </div>
  );
}