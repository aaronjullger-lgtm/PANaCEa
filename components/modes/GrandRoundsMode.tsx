/**
 * Grand Rounds Live Mode Component
 * 
 * Weekly live quiz competition mode inspired by HQ Trivia.
 * Features real-time leaderboards and scheduled quiz sessions.
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
  Zap
} from 'lucide-react';
import { hapticSuccess, hapticError } from '@/lib/hapticFeedback';

interface GrandRoundsModeProps {
  onExit?: () => void;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  points: number;
}

interface Participant {
  id: string;
  name: string;
  score: number;
  correctAnswers: number;
}

type ViewState = 'landing' | 'waiting' | 'active' | 'leaderboard';

// Sample questions for the demo
const SAMPLE_QUESTIONS: QuizQuestion[] = [
  {
    id: 'gr1',
    question: 'Which artery is most commonly affected in STEMI?',
    options: ['Left Anterior Descending', 'Right Coronary', 'Left Circumflex', 'Diagonal'],
    correctIndex: 0,
    explanation: 'LAD occlusion causes anterior wall MI, the most common type.',
    points: 100
  },
  {
    id: 'gr2',
    question: 'First-line treatment for acute migraine with aura?',
    options: ['Propranolol', 'Sumatriptan', 'Topiramate', 'Ergotamine'],
    correctIndex: 1,
    explanation: 'Triptans are first-line for acute migraine treatment.',
    points: 150
  },
  {
    id: 'gr3',
    question: 'Most sensitive marker for myocardial infarction?',
    options: ['CK-MB', 'Troponin', 'Myoglobin', 'LDH'],
    correctIndex: 1,
    explanation: 'Troponin is the gold standard for MI diagnosis.',
    points: 200
  },
  {
    id: 'gr4',
    question: 'Target INR for mechanical aortic valve?',
    options: ['1.5-2.0', '2.0-3.0', '2.5-3.5', '3.0-4.0'],
    correctIndex: 1,
    explanation: 'Mechanical aortic valve requires INR 2.0-3.0.',
    points: 250
  },
  {
    id: 'gr5',
    question: 'Classic ECG finding in Brugada syndrome?',
    options: ['ST elevation V1-V3', 'Delta wave', 'U wave', 'Epsilon wave'],
    correctIndex: 0,
    explanation: 'Brugada shows coved ST elevation in V1-V3.',
    points: 300
  }
];

// Constants for mock participant generation
const MOCK_PARTICIPANT_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Iris', 'Jack'];
const DEFAULT_PARTICIPANT_COUNT = 10;
const MAX_INITIAL_SCORE = 500;
const MAX_INITIAL_CORRECT = 5;

// Generate mock participants
const generateMockParticipants = (count: number = DEFAULT_PARTICIPANT_COUNT): Participant[] => {
  return MOCK_PARTICIPANT_NAMES.slice(0, count).map((name, index) => ({
    id: `participant-${index}`,
    name,
    score: Math.floor(Math.random() * MAX_INITIAL_SCORE),
    correctAnswers: Math.floor(Math.random() * MAX_INITIAL_CORRECT)
  }));
};

const TIME_PER_QUESTION = 10; // seconds

const GrandRoundsMode: React.FC<GrandRoundsModeProps> = ({ onExit }) => {
  const [viewState, setViewState] = useState<ViewState>('landing');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [myScore, setMyScore] = useState(0);
  const [myCorrectAnswers, setMyCorrectAnswers] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isTimeUp, setIsTimeUp] = useState(false);

  // Initialize participants
  useEffect(() => {
    setParticipants(generateMockParticipants());
  }, []);

  // Start the quiz
  const handleStart = useCallback(() => {
    setQuestions(SAMPLE_QUESTIONS);
    setCurrentQuestionIndex(0);
    setMyScore(0);
    setMyCorrectAnswers(0);
    setTimeLeft(TIME_PER_QUESTION);
    setViewState('waiting');
    
    // Simulate countdown to start
    setTimeout(() => {
      setViewState('active');
    }, 3000);
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

    const isCorrect = selectedAnswer === currentQuestion.correctIndex;
    setIsSubmitted(true);

    if (isCorrect) {
      const points = currentQuestion.points;
      setMyScore(prev => prev + points);
      setMyCorrectAnswers(prev => prev + 1);
      hapticSuccess();
    } else {
      hapticError();
    }

    // Update mock participants
    setParticipants(prev => prev.map(p => ({
      ...p,
      score: p.score + Math.floor(Math.random() * currentQuestion.points),
      correctAnswers: p.correctAnswers + (Math.random() > 0.5 ? 1 : 0)
    })));
  }, [selectedAnswer, isSubmitted, currentQuestion]);

  const handleNext = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setIsSubmitted(false);
      setIsTimeUp(false);
      setTimeLeft(TIME_PER_QUESTION);
    } else {
      setViewState('leaderboard');
    }
  }, [currentQuestionIndex, questions.length]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (isTimeUp && !isSubmitted) {
      setIsSubmitted(true);
    }
  }, [isTimeUp, isSubmitted]);

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
                  <div className="text-2xl font-bold">{participants.length}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">Players Online</div>
                </div>
                <div className="space-y-2">
                  <Calendar className="w-8 h-8 text-amber-500 mx-auto" />
                  <div className="text-2xl font-bold">5</div>
                  <div className="text-xs text-[var(--color-text-muted)]">Questions</div>
                </div>
                <div className="space-y-2">
                  <Trophy className="w-8 h-8 text-amber-500 mx-auto" />
                  <div className="text-2xl font-bold">1000</div>
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
    // Add user to leaderboard
    const fullLeaderboard = [
      { id: 'me', name: 'You', score: myScore, correctAnswers: myCorrectAnswers },
      ...participants
    ].sort((a, b) => b.score - a.score);

    const myRank = fullLeaderboard.findIndex(p => p.id === 'me') + 1;

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
                  <div className="text-4xl font-bold text-amber-500">#{myRank}</div>
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
                {fullLeaderboard.slice(0, 10).map((participant, index) => {
                  const isMe = participant.id === 'me';
                  return (
                    <motion.div
                      key={participant.id}
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
                            `#${index + 1}`
                          )}
                        </div>
                        <div>
                          <div className={`font-semibold ${isMe ? 'text-amber-500' : ''}`}>
                            {participant.name}
                          </div>
                          <div className="text-xs text-[var(--color-text-muted)]">
                            {participant.correctAnswers} correct
                          </div>
                        </div>
                      </div>
                      <div className={`text-lg font-bold ${isMe ? 'text-amber-500' : ''}`}>
                        {participant.score}
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
                onClick={handleStart}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-3 px-6 rounded-lg transition-all"
              >
                Play Again
              </motion.button>
              
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
  const isCorrect = selectedAnswer === currentQuestion.correctIndex;

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
            {/* Points badge */}
            <div className="inline-flex items-center px-3 py-1 bg-amber-500/10 text-amber-500 text-sm font-medium rounded-full">
              {currentQuestion.points} points
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
                const isThisCorrect = index === currentQuestion.correctIndex;

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
