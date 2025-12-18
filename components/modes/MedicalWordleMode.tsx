/**
 * Medical Wordle Mode
 * 
 * Daily medical term guessing game - Wordle-style with 6 attempts.
 * Loads the shared daily word via the Wordle API so progress is persisted server-side.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, HelpCircle, Share2, RotateCcw, Trophy, Calendar } from 'lucide-react';
import { useWordleGame } from '@/hooks/useWordleGame';
import { hapticSuccess, hapticError } from '@/lib/hapticFeedback';
import type { MedicalWordleGame } from '@/types';

interface MedicalWordleModeProps {
  onExit?: () => void;
}

type LetterStatus = 'correct' | 'present' | 'absent' | 'empty';

interface LetterResult {
  letter: string;
  status: LetterStatus;
}

const MAX_ATTEMPTS = 6;

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
];

const MedicalWordleMode: React.FC<MedicalWordleModeProps> = ({ onExit }) => {
  const { game, guesses, status, error, submitGuess, refetch } = useWordleGame();
  const [currentGuess, setCurrentGuess] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [shake, setShake] = useState(false);
  const [revealRow, setRevealRow] = useState<number | null>(null);

  // Calculate keyboard letter statuses
  const keyboardStatus = useMemo(() => {
    const status: Record<string, LetterStatus> = {};
    if (!game) return status;

    const target = game.targetWord.toUpperCase();

    guesses.forEach((guess) => {
      const upper = guess.toUpperCase();
      for (let i = 0; i < upper.length; i++) {
        const letter = upper[i];
        if (target[i] === letter) {
          status[letter] = 'correct';
        } else if (target.includes(letter) && status[letter] !== 'correct') {
          status[letter] = 'present';
        } else if (!status[letter]) {
          status[letter] = 'absent';
        }
      }
    });

    return status;
  }, [game, guesses]);

  // Evaluate a guess against the target word
  const evaluateGuess = useCallback((guess: string): LetterResult[] => {
    if (!game) return [];

    const target = game.targetWord.toUpperCase();
    const guessUpper = guess.toUpperCase();
    const result: LetterResult[] = [];
    const targetLetters = target.split('');
    const usedIndices: number[] = [];

    // First pass: mark correct positions
    for (let i = 0; i < guessUpper.length; i++) {
      if (guessUpper[i] === targetLetters[i]) {
        result[i] = { letter: guessUpper[i], status: 'correct' };
        usedIndices.push(i);
      }
    }

    // Second pass: mark present letters
    for (let i = 0; i < guessUpper.length; i++) {
      if (result[i]) continue;

      const letter = guessUpper[i];
      const targetIndex = targetLetters.findIndex(
        (t, idx) => t === letter && !usedIndices.includes(idx)
      );

      if (targetIndex !== -1) {
        result[i] = { letter, status: 'present' };
        usedIndices.push(targetIndex);
      } else {
        result[i] = { letter, status: 'absent' };
      }
    }

    return result;
  }, [game]);

  // Handle keyboard input
  const handleKeyPress = useCallback(
    (key: string) => {
      if (status !== 'playing' || !game) return;

      const targetLength = game.targetWord.length;

      if (key === 'ENTER') {
        if (currentGuess.length !== targetLength) {
          setShake(true);
          setTimeout(() => setShake(false), 500);
          return;
        }

        const upperGuess = currentGuess.toUpperCase();
        setCurrentGuess('');
        setRevealRow(guesses.length);

        submitGuess(upperGuess)
          .then(() => {
            const revealDelay = targetLength * 150 + 300;
            setTimeout(() => setRevealRow(null), revealDelay);
          })
          .catch(() => {
            setRevealRow(null);
            setCurrentGuess(upperGuess);
            setShake(true);
            hapticError();
            setTimeout(() => setShake(false), 500);
          });
      } else if (key === '⌫' || key === 'BACKSPACE') {
        setCurrentGuess((prev) => prev.slice(0, -1));
      } else if (/^[A-Z]$/i.test(key) && currentGuess.length < targetLength) {
        setCurrentGuess((prev) => prev + key.toUpperCase());
      }
    },
    [currentGuess, game, guesses.length, status, submitGuess]
  );

  useEffect(() => {
    if (status === 'won') {
      hapticSuccess();
    } else if (status === 'lost') {
      hapticError();
    }
  }, [status]);

  // Physical keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) return;

      if (e.key === 'Enter') {
        handleKeyPress('ENTER');
      } else if (e.key === 'Backspace') {
        handleKeyPress('⌫');
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        handleKeyPress(e.key.toUpperCase());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyPress]);

  // Share results
  const handleShare = () => {
    if (!game || status === 'playing') return;

    const emojiGrid = guesses.map((guess) => {
      return evaluateGuess(guess)
        .map((r) => {
          if (r.status === 'correct') return '🟩';
          if (r.status === 'present') return '🟨';
          return '⬛';
        })
        .join('');
    }).join('\n');

    const result = `PANaCEa Daily Term ${game.date}\n${status === 'won' ? guesses.length : 'X'}/${MAX_ATTEMPTS}\n\n${emojiGrid}`;

    if (navigator.share) {
      navigator.share({ text: result });
    } else {
      navigator.clipboard.writeText(result);
    }
  };

  // Render game board row
  const renderRow = (rowIndex: number) => {
    if (!game) return null;

    const targetLength = game.targetWord.length;
    const isCurrentRow = rowIndex === guesses.length && status === 'playing';
    const isGuessedRow = rowIndex < guesses.length;
    const guess = isGuessedRow ? guesses[rowIndex] : isCurrentRow ? currentGuess : '';
    const results = isGuessedRow ? evaluateGuess(guess) : [];

    return (
      <div
        key={rowIndex}
        className={`flex gap-1.5 justify-center ${shake && isCurrentRow ? 'animate-shake' : ''}`}
      >
        {Array.from({ length: targetLength }).map((_, i) => {
          const letter = guess[i] || '';
          const result = results[i];
          const isRevealing = revealRow === rowIndex;
          const revealDelay = i * 150;

          let bgClass = 'bg-slate-800 border-slate-700';
          if (result) {
            bgClass =
              result.status === 'correct'
                ? 'bg-emerald-600 border-emerald-500'
                : result.status === 'present'
                ? 'bg-amber-600 border-amber-500'
                : 'bg-slate-700 border-slate-600';
          } else if (letter) {
            bgClass = 'bg-slate-700 border-slate-500';
          }

          return (
            <motion.div
              key={i}
              initial={isRevealing ? { rotateX: 0 } : false}
              animate={isRevealing ? { rotateX: 360 } : {}}
              transition={{ delay: revealDelay / 1000, duration: 0.3 }}
              className={`
                w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center
                text-xl sm:text-2xl font-bold text-white uppercase
                border-2 rounded-lg transition-colors
                ${bgClass}
              `}
            >
              {letter}
            </motion.div>
          );
        })}
      </div>
    );
  };

  // Render keyboard
  const renderKeyboard = () => (
    <div className="flex flex-col gap-1.5 mt-4">
      {KEYBOARD_ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-1 justify-center">
          {row.map((key) => {
            const status = keyboardStatus[key];
            let bgClass = 'bg-slate-700 hover:bg-slate-600';
            if (status === 'correct') bgClass = 'bg-emerald-600';
            else if (status === 'present') bgClass = 'bg-amber-600';
            else if (status === 'absent') bgClass = 'bg-slate-800';

            const isWide = key === 'ENTER' || key === '⌫';

            return (
              <button
                key={key}
                onClick={() => handleKeyPress(key)}
                disabled={status !== 'playing'}
                className={`
                  ${isWide ? 'px-3 sm:px-4' : 'w-8 sm:w-10'}
                  h-12 sm:h-14 rounded-lg font-semibold text-sm sm:text-base
                  text-white transition-colors
                  ${bgClass}
                  disabled:opacity-50
                `}
              >
                {key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );

  if (!game) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 dark:bg-slate-950 flex items-center justify-center">
        {error ? (
          <div className="text-center space-y-3">
            <p className="text-lg font-semibold text-slate-100">Wordle challenge unavailable</p>
            <p className="text-sm text-slate-400">{error}</p>
            <button
              onClick={refetch}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="animate-pulse text-slate-400">Loading today's challenge...</div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 dark:bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800/50">
        <button
          onClick={onExit}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
          aria-label="Exit"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Exit</span>
        </button>

        <div className="text-center">
          <h1 className="text-lg font-semibold text-slate-200">Daily Term Challenge</h1>
          <div className="flex items-center justify-center gap-1 text-xs text-slate-400">
            <Calendar className="w-3 h-3" />
            {new Date(game.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        </div>

        <button
          onClick={() => setShowHint(!showHint)}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
          aria-label="Toggle hint"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </header>

      {/* Hint Panel */}
      <AnimatePresence>
        {showHint && game.hints && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-slate-900 border-b border-slate-800 overflow-hidden"
          >
            <div className="p-4 text-center">
              <p className="text-sm text-slate-300">
                <span className="text-slate-500">Category:</span>{' '}
                <span className="font-medium capitalize text-amber-400">{game.category}</span>
              </p>
              {game.hints.class && (
                <p className="text-sm text-slate-300 mt-1">
                  <span className="text-slate-500">Type:</span>{' '}
                  <span className="font-medium text-cyan-400">{game.hints.class}</span>
                </p>
              )}
              {game.hints.system && (
                <p className="text-sm text-slate-300 mt-1">
                  <span className="text-slate-500">System:</span>{' '}
                  <span className="font-medium text-emerald-400">{game.hints.system}</span>
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Board */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-1.5">
        {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => renderRow(i))}
      </div>

      {/* Result Modal */}
      <AnimatePresence>
        {status !== 'playing' && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute inset-x-4 bottom-32 sm:bottom-40 mx-auto max-w-md bg-slate-800 rounded-xl p-6 shadow-2xl border border-slate-700"
          >
            <div className="text-center space-y-4">
              {status === 'won' ? (
                <>
                  <Trophy className="w-12 h-12 text-amber-500 mx-auto" />
                  <h2 className="text-2xl font-bold text-emerald-400">Excellent!</h2>
                  <p className="text-slate-300">
                    You got it in {guesses.length}/{MAX_ATTEMPTS} tries
                  </p>
                </>
              ) : (
                <>
                  <X className="w-12 h-12 text-red-500 mx-auto" />
                  <h2 className="text-2xl font-bold text-red-400">Better luck tomorrow</h2>
                  <p className="text-slate-300">
                    The word was:{' '}
                    <span className="font-bold text-amber-400">{game.targetWord}</span>
                  </p>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleShare}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
                <button
                  onClick={onExit}
                  className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-colors"
                >
                  Exit
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard */}
      <div className="pb-6 px-2">
        {renderKeyboard()}
      </div>

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

export default MedicalWordleMode;
