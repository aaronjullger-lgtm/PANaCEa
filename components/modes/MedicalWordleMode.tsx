import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Hash, Trophy, Calendar } from 'lucide-react';
import { getTodaysMedicalWordle } from '@/data/modes/dailyRitualsData';
import type { MedicalWordleGame } from '@/types';

interface MedicalWordleModeProps {
  onExit?: () => void;
}

type LetterStatus = 'correct' | 'present' | 'absent' | 'empty';

interface GuessResult {
  guess: string;
  results: LetterStatus[];
}

const MedicalWordleMode: React.FC<MedicalWordleModeProps> = ({ onExit }) => {
  const [game, setGame] = useState<MedicalWordleGame | null>(null);
  const [currentGuess, setCurrentGuess] = useState('');
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [showHint, setShowHint] = useState(false);
  const maxGuesses = 6;

  useEffect(() => {
    const todaysGame = getTodaysMedicalWordle();
    setGame(todaysGame);
    
    // Load saved progress from localStorage
    const savedProgress = localStorage.getItem(`wordle-${todaysGame.date}`);
    if (savedProgress) {
      const parsed = JSON.parse(savedProgress);
      setGuesses(parsed.guesses || []);
      setGameState(parsed.gameState || 'playing');
    }
  }, []);

  const evaluateGuess = (guess: string, target: string): LetterStatus[] => {
    const results: LetterStatus[] = Array(target.length).fill('absent');
    const targetChars = target.split('');
    const guessChars = guess.toUpperCase().split('');

    // First pass: mark correct positions
    guessChars.forEach((char, i) => {
      if (char === targetChars[i]) {
        results[i] = 'correct';
        targetChars[i] = ''; // Mark as used
      }
    });

    // Second pass: mark present letters
    guessChars.forEach((char, i) => {
      if (results[i] !== 'correct') {
        const targetIndex = targetChars.indexOf(char);
        if (targetIndex !== -1) {
          results[i] = 'present';
          targetChars[targetIndex] = ''; // Mark as used
        }
      }
    });

    return results;
  };

  const handleSubmitGuess = () => {
    if (!game || gameState !== 'playing') return;
    
    const normalizedGuess = currentGuess.toUpperCase().padEnd(game.targetWord.length, ' ').slice(0, game.targetWord.length);
    
    if (normalizedGuess.trim().length < 3) {
      alert('Word too short!');
      return;
    }

    const results = evaluateGuess(normalizedGuess, game.targetWord);
    const newGuess: GuessResult = { guess: normalizedGuess, results };
    const updatedGuesses = [...guesses, newGuess];
    
    setGuesses(updatedGuesses);
    setCurrentGuess('');

    // Check win condition
    const isWin = results.every(r => r === 'correct');
    const isLastGuess = updatedGuesses.length >= maxGuesses;

    let newState = gameState;
    if (isWin) {
      newState = 'won';
    } else if (isLastGuess) {
      newState = 'lost';
    }
    setGameState(newState);

    // Save progress
    if (game) {
      localStorage.setItem(`wordle-${game.date}`, JSON.stringify({
        guesses: updatedGuesses,
        gameState: newState,
      }));
    }
  };

  const getLetterColor = (status: LetterStatus): string => {
    switch (status) {
      case 'correct': return 'bg-green-500 text-white';
      case 'present': return 'bg-yellow-500 text-white';
      case 'absent': return 'bg-gray-400 text-white';
      default: return 'bg-gray-200 text-gray-700';
    }
  };

  if (!game) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full">
          <p className="text-center">Loading today's Medical Wordle...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Hash className="w-6 h-6 text-green-600" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Medical Wordle
            </h2>
          </div>
          <button
            onClick={onExit}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date */}
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-600 dark:text-gray-400">
          <Calendar className="w-4 h-4" />
          <span>{new Date(game.date).toLocaleDateString()}</span>
          <span className="ml-auto">Category: {game.category}</span>
        </div>

        {/* Game Board */}
        <div className="space-y-2 mb-6">
          {Array.from({ length: maxGuesses }).map((_, rowIndex) => {
            const guess = guesses[rowIndex];
            const isCurrentRow = rowIndex === guesses.length && gameState === 'playing';
            
            return (
              <div key={rowIndex} className="flex gap-2 justify-center">
                {Array.from({ length: game.targetWord.length }).map((_, colIndex) => {
                  const letter = guess ? guess.guess[colIndex] : (isCurrentRow ? currentGuess[colIndex] || '' : '');
                  const status = guess ? guess.results[colIndex] : 'empty';
                  
                  return (
                    <motion.div
                      key={colIndex}
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      className={`
                        w-12 h-12 flex items-center justify-center text-xl font-bold rounded
                        border-2 ${guess ? getLetterColor(status) : 'border-gray-300 bg-white dark:bg-gray-700'}
                      `}
                    >
                      {letter}
                    </motion.div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Input */}
        {gameState === 'playing' && (
          <div className="space-y-4">
            <input
              type="text"
              value={currentGuess}
              onChange={(e) => setCurrentGuess(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmitGuess()}
              maxLength={game.targetWord.length}
              placeholder={`Enter ${game.targetWord.length} letters...`}
              className="w-full p-3 border rounded-lg text-center text-xl font-bold uppercase"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleSubmitGuess}
                disabled={currentGuess.length < 3}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
              >
                Submit Guess
              </button>
              <button
                onClick={() => setShowHint(!showHint)}
                className="px-4 py-3 border border-green-600 text-green-600 rounded-lg hover:bg-green-50"
              >
                Hint
              </button>
            </div>
          </div>
        )}

        {/* Hints */}
        {showHint && game.hints && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
          >
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              Hints:
            </p>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 mt-2">
              {game.hints.class && <li>• Class: {game.hints.class}</li>}
              {game.hints.system && <li>• System: {game.hints.system}</li>}
            </ul>
          </motion.div>
        )}

        {/* Game Over */}
        {gameState !== 'playing' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-6 p-6 rounded-lg ${gameState === 'won' ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}
          >
            {gameState === 'won' ? (
              <>
                <div className="flex items-center gap-2 text-green-800 dark:text-green-200 mb-2">
                  <Trophy className="w-6 h-6" />
                  <p className="text-xl font-bold">Congratulations!</p>
                </div>
                <p className="text-green-700 dark:text-green-300">
                  You guessed it in {guesses.length} tries!
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-bold text-red-800 dark:text-red-200 mb-2">
                  Game Over
                </p>
                <p className="text-red-700 dark:text-red-300">
                  The word was: <span className="font-bold">{game.targetWord}</span>
                </p>
              </>
            )}
            <div className="mt-4 p-4 bg-white/50 dark:bg-gray-800/50 rounded">
              <p className="text-sm font-semibold mb-1">About this word:</p>
              <p className="text-sm">Category: {game.category}</p>
              {game.hints?.class && <p className="text-sm">Class: {game.hints.class}</p>}
            </div>
          </motion.div>
        )}

        {/* Instructions */}
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
          <p className="font-semibold mb-2">How to Play:</p>
          <ul className="space-y-1 text-gray-600 dark:text-gray-300">
            <li>• <span className="inline-block w-4 h-4 bg-green-500 rounded mr-2"></span>Green = Correct letter, correct position</li>
            <li>• <span className="inline-block w-4 h-4 bg-yellow-500 rounded mr-2"></span>Yellow = Correct letter, wrong position</li>
            <li>• <span className="inline-block w-4 h-4 bg-gray-400 rounded mr-2"></span>Gray = Letter not in word</li>
          </ul>
        </div>
      </motion.div>
    </div>
  );
};

export default MedicalWordleMode;
