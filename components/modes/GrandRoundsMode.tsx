/**
 * Grand Rounds Live Mode Component
 * 
 * Daily competitive challenge mode with speed-weighted scoring.
 * Features real-time leaderboards and daily challenges.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  Users, 
  Calendar,
  Clock,
  Play,
  CheckCircle,
  XCircle,
  Crown,
  Medal,
  Zap,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useUser } from '@clerk/clerk-react';
import { hapticSuccess, hapticError } from '@/lib/hapticFeedback';
import { 
  getTodaysChallenge, 
  getTodaysLeaderboard, 
  submitCompletion,
  hasCompletedToday,
  type LeaderboardEntry 
} from '@/services/grandRoundsService';
import type { Question } from '@/types';

interface GrandRoundsModeProps {
  onExit?: () => void;
}

type ViewState = 'loading' | 'completed' | 'landing' | 'waiting' | 'active' | 'leaderboard' | 'error';

const TIME_PER_QUESTION = 10; // seconds

const GrandRoundsMode: React.FC<GrandRoundsModeProps> = ({ onExit }) => {
  const { user } = useUser();
  const userId = user?.id || 'demo-user';
  
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [myScore, setMyScore] = useState(0);
  const [myCorrectAnswers, setMyCorrectAnswers] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);

  // Check if user has already completed today's challenge
  useEffect(() => {
    const checkCompletion = async () => {
      try {
        const completed = await hasCompletedToday(userId);
        if (completed) {
          setViewState('completed');
          // Load leaderboard even if completed
          const board = await getTodaysLeaderboard(100);
          setLeaderboard(board);
        } else {
          setViewState('landing');
        }
      } catch (err) {
        console.error('Error checking completion:', err);
        setError('Failed to check completion status');
        setViewState('error');
      }
    };
    
    checkCompletion();
  }, [userId]);

  // Start the quiz - Load today's challenge from API
  const handleStart = useCallback(async () => {
    setViewState('waiting');
    setError(null);
    
    try {
      // Fetch today's challenge from API
      const challenge = await getTodaysChallenge();
      
      // TODO: Load actual questions based on challenge.questionIds
      // For now, using sample questions - this will be replaced when question loading is implemented
      // const loadedQuestions = await loadQuestionsByIds(challenge.questionIds);
      
      // Temporary: Generate 5 mock questions with the challenge seed
      const mockQuestions: Question[] = Array.from({ length: 5 }, (_, i) => ({
        id: `gr-${challenge.id}-${i}`,
        question: `Challenge Question ${i + 1} (from API challenge ${challenge.id})`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: Math.floor(Math.random() * 4),
        explanation: 'This is a temporary explanation. Real questions will come from the database.',
        condition: 'Grand Rounds',
        conditionId: 'grand-rounds',
        system: 'CV' as const,
        difficulty: 'medium' as const,
        questionType: 'multiple_choice' as const
      }));
      
      setQuestions(mockQuestions);
      setCurrentQuestionIndex(0);
      setMyScore(0);
      setMyCorrectAnswers(0);
      setTimeLeft(TIME_PER_QUESTION);
      setStartTime(Date.now());
      
      // Simulate countdown to start
      setTimeout(() => {
        setViewState('active');
      }, 3000);
    } catch (err) {
      console.error('Error loading challenge:', err);
      setError('Failed to load today\'s challenge. Please try again.');
      setViewState('error');
    }
  }, []);

  // Timer countdown
  useEffect(() => {
    if (viewState !== 'active' || isSubmitted || isTimeUp) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsTimeUp(true);
          setIsSubmitted(true);
          hapticError();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [viewState, isSubmitted, isTimeUp]);

  const currentQuestion = questions[currentQuestionIndex];

  const handleAnswerSelect = (index: number) => {
    if (isSubmitted) return;
    setSelectedAnswer(index);
  };

  const handleSubmit = useCallback(() => {
    if (selectedAnswer === null || isSubmitted || !currentQuestion) return;

    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
    setIsSubmitted(true);

    if (isCorrect) {
      // Points based on question difficulty
      const points = 100 + (currentQuestionIndex * 50); // Increasing points per question
      setMyScore(prev => prev + points);
      setMyCorrectAnswers(prev => prev + 1);
      hapticSuccess();
    } else {
      hapticError();
    }
  }, [selectedAnswer, isSubmitted, currentQuestion, currentQuestionIndex]);

  const handleNext = useCallback(async () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setIsSubmitted(false);
      setIsTimeUp(false);
      setTimeLeft(TIME_PER_QUESTION);
    } else {
      // Quiz complete - submit to API
      const completionTime = Date.now() - startTime;
      
      try {
        const rank = await submitCompletion(
          userId,
          myScore,
          completionTime,
          myCorrectAnswers
        );
        
        setMyRank(rank);
        
        // Load leaderboard
        const board = await getTodaysLeaderboard(100);
        setLeaderboard(board);
        
        setViewState('leaderboard');
      } catch (err) {
        console.error('Error submitting completion:', err);
        setError('Failed to submit score. Your progress was not saved.');
        setViewState('error');
      }
    }
  }, [currentQuestionIndex, questions.length, userId, myScore, myCorrectAnswers, startTime]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (isTimeUp && !isSubmitted) {
      setIsSubmitted(true);
    }
  }, [isTimeUp, isSubmitted]);

  // Loading state
  if (viewState === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto" />
          <p className="text-[var(--color-text-secondary)]">Loading today's challenge...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (viewState === 'error') {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[var(--color-bg-secondary)] rounded-xl p-8 text-center space-y-4">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h2 className="text-2xl font-bold">Error</h2>
          <p className="text-[var(--color-text-secondary)]">{error || 'An unexpected error occurred'}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold transition-colors"
            >
              Try Again
            </button>
            {onExit && (
              <button
                onClick={onExit}
                className="px-6 py-3 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] rounded-lg font-semibold transition-colors"
              >
                Exit
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Already completed today
  if (viewState === 'completed') {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[var(--color-bg-secondary)] rounded-xl p-8 text-center space-y-4">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
          <h2 className="text-2xl font-bold">Challenge Complete!</h2>
          <p className="text-[var(--color-text-secondary)]">
            You've already completed today's Grand Rounds challenge. Come back tomorrow for a new challenge!
          </p>
          {leaderboard.length > 0 && (
            <div className="mt-6 text-left">
              <h3 className="text-lg font-semibold mb-3">Today's Top 10</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {leaderboard.slice(0, 10).map((entry) => (
                  <div 
                    key={entry.userId}
                    className={`flex items-center justify-between p-2 rounded-lg ${
                      entry.userId === userId ? 'bg-amber-500/20' : 'bg-[var(--color-bg-tertiary)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-[var(--color-text-muted)]">#{entry.rank}</span>
                      <span className="text-sm">{entry.userName || `User ${entry.userId.slice(0, 8)}`}</span>
                    </div>
                    <span className="font-semibold text-amber-500">{entry.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {onExit && (
            <button
              onClick={onExit}
              className="w-full px-6 py-3 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] rounded-lg font-semibold transition-colors mt-4"
            >
              Exit
            </button>
          )}
        </div>
      </div>
    );
  }

  // Landing page
  if (viewState === 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-500/10 via-[var(--color-bg-primary)] to-orange-500/10 text-[var(--color-text-primary)] flex flex-col">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 flex items-center justify-center p-6"
        >
          <div className="max-w-2xl w-full space-y-8">
            <div className="text-center space-y-4">
              <motion.div
                animate={{ 
                  rotate: [0, -5, 5, 0],
                  scale: [1, 1.05, 1]
                }}
                transition={{ 
                  repeat: Infinity,
                  duration: 3,
                  ease: "easeInOut"
                }}
                className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-full"
              >
                <Trophy className="w-12 h-12 text-amber-500" />
              </motion.div>
              
              <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                Grand Rounds Live
              </h1>
              
              <p className="text-xl text-[var(--color-text-muted)]">
                Weekly Quiz Competition
              </p>
            </div>

            <div className="bg-[var(--color-bg-secondary)] rounded-xl p-8 space-y-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-2">
                  <Users className="w-8 h-8 text-amber-500 mx-auto" />
                  <div className="text-2xl font-bold">Live</div>
                  <div className="text-xs text-[var(--color-text-muted)]">Daily Challenge</div>
                </div>
                <div className="space-y-2">
                  <Calendar className="w-8 h-8 text-amber-500 mx-auto" />
                  <div className="text-2xl font-bold">5</div>
                  <div className="text-xs text-[var(--color-text-muted)]">Questions</div>
                </div>
                <div className="space-y-2">
                  <Trophy className="w-8 h-8 text-amber-500 mx-auto" />
                  <div className="text-2xl font-bold">Up to 1000</div>
                  <div className="text-xs text-[var(--color-text-muted)]">Total Points</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">Live Competition</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Compete in real-time against other medical professionals.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">Timed Questions</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      10 seconds per question. Think fast and answer faster!
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Crown className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">Leaderboard Rankings</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Climb the ranks and prove your medical knowledge!
                    </p>
                  </div>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStart}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-4 px-6 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg"
              >
                <Play className="w-5 h-5" />
                Join Grand Rounds
              </motion.button>

              <button
                onClick={onExit}
                className="w-full text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] py-2 transition-colors"
              >
                Back to Menu
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Waiting/countdown page
  if (viewState === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-500/10 via-[var(--color-bg-primary)] to-orange-500/10 text-[var(--color-text-primary)] flex flex-col items-center justify-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-6"
        >
          <Trophy className="w-20 h-20 text-amber-500 mx-auto" />
          <h2 className="text-3xl font-bold">Get Ready!</h2>
          <p className="text-xl text-[var(--color-text-muted)]">
            Grand Rounds is about to begin...
          </p>
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="text-6xl font-bold text-amber-500"
          >
            3
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // Leaderboard page
  if (viewState === 'leaderboard') {
    // Merge current user with leaderboard
    const displayBoard = leaderboard.map((entry, index) => ({
      ...entry,
      displayRank: index + 1
    }));

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-500/10 via-[var(--color-bg-primary)] to-orange-500/10 text-[var(--color-text-primary)] flex flex-col">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-1 p-6"
        >
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center space-y-4">
              <Trophy className="w-20 h-20 text-amber-500 mx-auto" />
              <h1 className="text-4xl font-bold">Final Leaderboard</h1>
              <p className="text-xl text-[var(--color-text-muted)]">
                Grand Rounds Complete
              </p>
            </div>

            {/* My score */}
            <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-xl p-6 border-2 border-amber-500/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-bold text-amber-500">#{myRank || '?'}</div>
                  <div>
                    <div className="font-semibold text-lg">Your Score</div>
                    <div className="text-sm text-[var(--color-text-muted)]">
                      {myCorrectAnswers}/{questions.length} correct
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-amber-500">{myScore}</div>
                  <div className="text-sm text-[var(--color-text-muted)]">points</div>
                </div>
              </div>
            </div>

            {/* Top 10 leaderboard */}
            <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 space-y-4">
              <h2 className="text-xl font-bold mb-4">Top Players</h2>
              <div className="space-y-2">
                {displayBoard.slice(0, 10).map((entry, index) => {
                  const isMe = entry.userId === userId;
                  return (
                    <motion.div
                      key={entry.userId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        isMe 
                          ? 'bg-amber-500/20 border-2 border-amber-500/50' 
                          : 'bg-[var(--color-bg-primary)]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 text-center font-bold ${
                          index === 0 ? 'text-yellow-500' :
                          index === 1 ? 'text-gray-400' :
                          index === 2 ? 'text-amber-700' :
                          ''
                        }`}>
                          {index < 3 ? (
                            index === 0 ? <Crown className="w-5 h-5 inline" /> :
                            <Medal className="w-5 h-5 inline" />
                          ) : (
                            `#${entry.displayRank}`
                          )}
                        </div>
                        <div>
                          <div className={`font-semibold ${isMe ? 'text-amber-500' : ''}`}>
                            {entry.userName || `User ${entry.userId.slice(0, 8)}`}
                          </div>
                          <div className="text-xs text-[var(--color-text-muted)]">
                            {entry.correctAnswers} correct
                          </div>
                        </div>
                      </div>
                      <div className={`text-lg font-bold ${isMe ? 'text-amber-500' : ''}`}>
                        {entry.score}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onExit}
                className="flex-1 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-accent)]/10 text-[var(--color-text-primary)] font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Exit
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Active quiz page
  if (!currentQuestion) return null;

  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-500/10 via-[var(--color-bg-primary)] to-orange-500/10 text-[var(--color-text-primary)] flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--color-bg-primary)]/95 backdrop-blur-sm border-b border-[var(--color-border)] p-4">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="w-6 h-6 text-amber-500" />
              <div>
                <div className="font-semibold">Grand Rounds</div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm text-[var(--color-text-muted)]">Score</div>
              <div className="text-xl font-bold text-amber-500">{myScore}</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-[var(--color-bg-secondary)] rounded-full h-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full"
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Timer */}
          <div className="flex items-center justify-center gap-2">
            <Clock className={`w-5 h-5 ${timeLeft <= 3 ? 'text-amber-500' : 'text-[var(--color-text-muted)]'}`} />
            <motion.div
              animate={{ 
                scale: timeLeft <= 3 ? [1, 1.1, 1] : 1,
                color: timeLeft <= 3 ? '#f59e0b' : undefined
              }}
              transition={{ repeat: timeLeft <= 3 ? Infinity : 0, duration: 0.5 }}
              className={`text-2xl font-bold ${timeLeft <= 3 ? 'text-amber-500' : ''}`}
            >
              {timeLeft}s
            </motion.div>
          </div>
        </div>
      </div>

      {/* Question content */}
      <div className="flex-1 p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="max-w-4xl mx-auto space-y-6"
          >
            {/* Points badge - removed since we don't have points property in Question type */}
            <div className="inline-flex items-center px-3 py-1 bg-amber-500/10 text-amber-500 text-sm font-medium rounded-full">
              Question {currentQuestionIndex + 1}
            </div>

            {/* Question */}
            <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6">
              <h2 className="text-xl font-semibold leading-relaxed">
                {currentQuestion.question}
              </h2>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedAnswer === index;
                const showResult = isSubmitted;
                const isThisCorrect = index === currentQuestion.correctAnswer;

                return (
                  <motion.button
                    key={index}
                    whileHover={!isSubmitted ? { scale: 1.01 } : {}}
                    whileTap={!isSubmitted ? { scale: 0.99 } : {}}
                    onClick={() => handleAnswerSelect(index)}
                    disabled={isSubmitted}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                      showResult
                        ? isThisCorrect
                          ? 'bg-green-500/10 border-green-500 text-green-500'
                          : isSelected
                          ? 'bg-red-500/10 border-red-500 text-red-500'
                          : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)] opacity-50'
                        : isSelected
                        ? 'bg-amber-500/10 border-amber-500'
                        : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)] hover:border-amber-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex-1">{option}</span>
                      {showResult && isThisCorrect && (
                        <CheckCircle className="w-5 h-5 ml-2 flex-shrink-0" />
                      )}
                      {showResult && isSelected && !isThisCorrect && (
                        <XCircle className="w-5 h-5 ml-2 flex-shrink-0" />
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Explanation */}
            {isSubmitted && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-lg ${
                  isCorrect
                    ? 'bg-green-500/10 border-2 border-green-500/50'
                    : 'bg-red-500/10 border-2 border-red-500/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {isCorrect ? (
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <div className={`font-semibold mb-1 ${isCorrect ? 'text-green-500' : 'text-red-500'}`}>
                      {isTimeUp ? 'Time\'s Up!' : isCorrect ? `Correct! +${currentQuestion.points} points` : 'Incorrect'}
                    </div>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {currentQuestion.explanation}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              {!isSubmitted ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={selectedAnswer === null}
                  className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all ${
                    selectedAnswer === null
                      ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
                  }`}
                >
                  Submit Answer
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleNext}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-3 px-6 rounded-lg transition-all"
                >
                  {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'View Leaderboard'}
                </motion.button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default GrandRoundsMode;
