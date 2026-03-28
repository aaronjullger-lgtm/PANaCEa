/**
 * Diagnostic Puzzle Mode
 *
 * Daily diagnostic mini-game inspired by Doctordle.
 * Progressive disclosure of 5-6 clinical vignette clues.
 * User guesses the diagnosis with autocomplete/fuzzy-search.
 * Global daily case rotation with persistence.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, HelpCircle, Share2, Trophy, Calendar, Search } from 'lucide-react';
import { useDiagnosticPuzzle } from '@/hooks/useDiagnosticPuzzle';
import { useConditionSearch } from '@/hooks/useConditionSearch';
import { hapticSuccess, hapticError } from '@/lib/hapticFeedback';

interface DiagnosticPuzzleModeProps {
  onExit?: () => void;
}

const MAX_ATTEMPTS = 6;

const DiagnosticPuzzleMode: React.FC<DiagnosticPuzzleModeProps> = ({ onExit }) => {
  const {
    puzzle,
    userState,
    isLoading,
    isSubmitting,
    error,
    fetchDailyPuzzle,
    submitGuess,
    stats,
    fetchStats,
  } = useDiagnosticPuzzle();
  const [guessInput, setGuessInput] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [shake, setShake] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { results: suggestions, isLoading: isSearching, setQuery: setSearchQuery, clear: clearSearch } = useConditionSearch({ limit: 10 });

  // Focus input on mount
  useEffect(() => {
    if (puzzle && userState?.status === 'playing') {
      inputRef.current?.focus();
    }
  }, [puzzle, userState]);

  // Handle guess submission
  const handleSubmitGuess = useCallback(async () => {
    if (!guessInput.trim() || isSubmitting || !puzzle || userState?.status !== 'playing') {
      return;
    }
    await submitGuess(guessInput.trim());
    setGuessInput('');
    clearSearch();
    setShowSuggestions(false);
  }, [guessInput, isSubmitting, puzzle, userState, submitGuess, clearSearch]);

  // Handle key presses (Enter to submit, Escape to clear)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmitGuess();
    } else if (e.key === 'Escape') {
      setGuessInput('');
      setShowSuggestions(false);
      clearSearch();
    }
  }, [handleSubmitGuess, clearSearch]);

  // Update search query when guessInput changes
  useEffect(() => {
    setSearchQuery(guessInput);
    if (guessInput.length >= 2) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [guessInput, setSearchQuery]);

  // Haptic feedback on win/loss
  useEffect(() => {
    if (userState?.status === 'won') {
      hapticSuccess();
    } else if (userState?.status === 'lost') {
      hapticError();
    }
  }, [userState]);

  // Share results
  const handleShare = () => {
    if (!puzzle || !userState || userState.status === 'playing') return;

    const emojiRow = Array.from({ length: MAX_ATTEMPTS })
      .map((_, i) => i < userState.guesses.length ? '🟩' : '⬛')
      .join('');
    const result = `PANaCEa Diagnostic Puzzle ${puzzle.date}\n${userState.status === 'won' ? userState.guesses.length : 'X'}/${MAX_ATTEMPTS}\n\n${emojiRow}`;

    if (navigator.share) {
      navigator.share({ text: result });
    } else {
      navigator.clipboard.writeText(result);
    }
  };

  // Render clue cards
  const renderClues = () => {
    if (!puzzle) return null;
    const { clues, totalClues } = puzzle;
    return (
      <div className="space-y-3 max-w-2xl mx-auto">
        {clues.map((clue, idx) => (
          <motion.div
            key={idx}
            initial={{ y: 10 }}
            animate={{ y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="p-4 bg-data-neutral/20 border border-data-neutral/30 rounded-xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-data-provisional/20 flex items-center justify-center">
                <span className="text-sm font-bold text-data-provisional">{idx + 1}</span>
              </div>
              <div className="flex-1">
                <p className="text-[var(--color-text-primary)] whitespace-pre-line">{clue}</p>
              </div>
            </div>
          </motion.div>
        ))}
        {Array.from({ length: totalClues - clues.length }).map((_, idx) => (
          <div key={`hidden-${idx}`} className="p-4 bg-data-neutral/10 border border-data-neutral/20 rounded-xl opacity-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-data-neutral/30 flex items-center justify-center">
                <span className="text-sm font-bold text-data-neutral">{clues.length + idx + 1}</span>
              </div>
              <div className="h-4 bg-data-neutral/30 rounded w-3/4"></div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render guess history
  const renderGuesses = () => {
    if (!userState || userState.guesses.length === 0) return null;
    return (
      <div className="mt-6 max-w-2xl mx-auto">
        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">Your Guesses</h3>
        <div className="space-y-2">
          {userState.guesses.map((guess, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg">
              <div className="w-8 h-8 rounded-full bg-data-neutral/30 flex items-center justify-center">
                <span className="text-sm font-bold text-[var(--color-text-primary)]">{idx + 1}</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-[var(--color-text-primary)]">{guess}</p>
              </div>
              <div className={`px-2 py-1 rounded text-xs font-semibold ${guess.toLowerCase() === puzzle?.conditionName.toLowerCase() ? 'bg-data-pass/20 text-data-pass' : 'bg-data-fail/20 text-data-fail'}`}>
                {guess.toLowerCase() === puzzle?.conditionName.toLowerCase() ? 'Correct' : 'Incorrect'}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render input with autocomplete
  const renderInput = () => {
    if (!puzzle || userState?.status !== 'playing') return null;
    return (
      <div className="max-w-2xl mx-auto mt-8 relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--color-text-secondary)]" />
          <input
            ref={inputRef}
            type="text"
            value={guessInput}
            onChange={(e) => setGuessInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter diagnosis (e.g., 'Pneumonia')..."
            aria-label="Enter your diagnosis"
            className="w-full pl-12 pr-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-data-provisional"
            disabled={isSubmitting}
            autoComplete="off"
            spellCheck={false}
          />
          {guessInput && (
            <button
              onClick={() => setGuessInput('')}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              title="Clear input"
              aria-label="Clear input"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div
            initial={{ y: -5 }}
            animate={{ y: 0 }}
            className="absolute top-full left-0 right-0 mt-1 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl shadow-lg z-10 overflow-hidden"
          >
            {suggestions.map((suggestion, idx) => (
              <button
                key={suggestion.id ?? idx}
                onClick={() => {
                  setGuessInput(suggestion.condition);
                  setShowSuggestions(false);
                }}
                className="w-full text-left px-4 py-3 hover:bg-[var(--color-bg-secondary)] transition-colors border-b border-[var(--color-border)] last:border-b-0"
                title={`Select ${suggestion.condition}`}
                aria-label={`Select ${suggestion.condition}`}
              >
                <div className="font-medium text-[var(--color-text-primary)]">{suggestion.condition}</div>
                <div className="text-xs text-[var(--color-text-secondary)]">{suggestion.system} • {suggestion.subcategory || 'Unknown'}</div>
              </button>
            ))}
          </motion.div>
        )}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-[var(--color-text-secondary)]">
            Attempts left: <span className="font-bold">{userState?.attemptsLeft ?? 0}</span> / {MAX_ATTEMPTS}
          </div>
          <button
            onClick={handleSubmitGuess}
            disabled={!guessInput.trim() || isSubmitting}
            className="px-6 py-2 bg-data-provisional hover:bg-data-provisional/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Guess'}
          </button>
        </div>
      </div>
    );
  };

  // Render statistics
  const renderStats = () => {
    if (!stats) return null;
    return (
      <div className="max-w-2xl mx-auto mt-8 p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl">
        <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">Your Diagnostic Puzzle Stats</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.total}</div>
            <div className="text-sm text-[var(--color-text-secondary)]">Played</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-data-pass">{stats.wins}</div>
            <div className="text-sm text-[var(--color-text-secondary)]">Wins</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[var(--color-text-primary)]">{Math.round(stats.winRate)}%</div>
            <div className="text-sm text-[var(--color-text-secondary)]">Win Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-data-provisional">{stats.streak}</div>
            <div className="text-sm text-[var(--color-text-secondary)]">Streak</div>
          </div>
        </div>
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">Guess Distribution</h4>
          <div className="space-y-2">
            {Object.entries(stats.guessDistribution).map(([guesses, count]) => (
              <div key={guesses} className="flex items-center gap-3">
                <div className="w-8 text-sm font-medium text-[var(--color-text-primary)]">{guesses}</div>
                <div className="flex-1 h-6 bg-data-neutral/30 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / stats.wins) * 100}%` }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="h-full bg-data-provisional"
                  />
                </div>
                <div className="text-sm text-[var(--color-text-primary)]">{count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Render result modal
  const renderResultModal = () => {
    if (!puzzle || !userState || userState.status === 'playing') return null;
    const isWon = userState.status === 'won';
    return (
      <AnimatePresence>
        <motion.div
          initial={{ y: 50 }}
          animate={{ y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="absolute inset-x-4 bottom-32 sm:bottom-40 mx-auto max-w-md bg-[var(--color-bg-secondary)] rounded-xl p-6 shadow-[0_18px_42px_var(--color-shadow-soft)] border border-[var(--color-border)]"
        >
          <div className="text-center space-y-4">
            {isWon ? (
              <>
                <Trophy className="w-12 h-12 text-data-provisional mx-auto" />
                <h2 className="text-2xl font-bold text-data-pass">Excellent Diagnosis!</h2>
                <p className="text-[var(--color-text-primary)]">
                  You identified <span className="font-bold text-data-provisional">{puzzle.conditionName}</span> in {userState.guesses.length}/{MAX_ATTEMPTS} clues.
                </p>
              </>
            ) : (
              <>
                <X className="w-12 h-12 text-data-fail mx-auto" />
                <h2 className="text-2xl font-bold text-data-fail">Better Luck Tomorrow</h2>
                <p className="text-[var(--color-text-primary)]">
                  The diagnosis was:{' '}
                  <span className="font-bold text-data-provisional">{puzzle.conditionName}</span>
                </p>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-data-pass hover:bg-data-pass/90 text-white rounded-lg font-semibold transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
              <button
                onClick={onExit}
                className="flex-1 px-4 py-3 bg-data-neutral hover:bg-data-neutral/90 text-white rounded-lg font-semibold transition-colors"
              >
                Exit
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  };

  // Loading / error state
  if (isLoading || !puzzle) {
    return (
      <div className="fixed inset-0 z-50 bg-data-neutral dark:bg-data-neutral flex items-center justify-center">
        {error ? (
          <div className="text-center space-y-3">
            <p className="text-lg font-semibold text-data-neutral">Daily diagnostic unavailable</p>
            <p className="text-sm text-data-neutral">{error}</p>
            <button
              onClick={() => fetchDailyPuzzle()}
              className="px-4 py-2 bg-data-pass hover:bg-data-pass text-white rounded-lg font-semibold"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="animate-pulse text-data-neutral">Loading today's diagnostic puzzle...</div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-data-neutral dark:bg-data-neutral text-data-neutral flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-data-neutral/50">
        <button
          onClick={onExit}
          className="flex items-center gap-2 text-data-neutral hover:text-data-neutral transition-colors"
          aria-label="Exit"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Exit</span>
        </button>

        <div className="text-center">
          <h1 className="text-lg font-semibold text-data-neutral">Daily Diagnostic Puzzle</h1>
          <div className="flex items-center justify-center gap-1 text-xs text-data-neutral">
            <Calendar className="w-3 h-3" />
            {new Date(puzzle.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        </div>

        <button
          onClick={() => setShowHint(!showHint)}
          className="flex items-center gap-2 text-data-neutral hover:text-data-neutral transition-colors"
          aria-label="Toggle hint"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </header>

      {/* Hint Panel */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-data-neutral border-b border-data-neutral overflow-hidden"
          >
            <div className="p-4 text-center">
              <p className="text-sm text-data-neutral">
                <span className="text-data-neutral">System:</span>{' '}
                <span className="font-medium text-data-provisional">{puzzle.system || 'Unknown'}</span>
              </p>
              {puzzle.difficulty && (
                <p className="text-sm text-data-neutral mt-1">
                  <span className="text-data-neutral">Difficulty:</span>{' '}
                  <span className="font-medium text-data-provisional">{puzzle.difficulty}/5</span>
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto">
          {renderClues()}
          {renderGuesses()}
          {renderInput()}
          {renderStats()}
        </div>
      </div>

      {/* Result modal */}
      {renderResultModal()}

      {/* Shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-5px); }
          40%, 80% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default DiagnosticPuzzleMode;