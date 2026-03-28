/**
 * Live Study Session Component
 * Real-time collaborative study session with peer benchmarking
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';
import {
  Users,
  Trophy,
  MessageSquare,
  Clock,
  Target,
  BarChart3,
  Zap,
  Award,
  TrendingUp,
  HelpCircle,
  Send,
  X,
  CheckCircle,
  User,
  Activity,
  Brain,
  Shield,
} from 'lucide-react';
import { StandardButton } from '../shared/StandardButton';
import {
  useRealTimeCollaboration,
  type PeerPresence,
  type LiveSession,
  type LiveLeaderboardEntry,
} from '@/services/domain/realTimeCollaborationService';

interface LiveStudySessionProps {
  sessionId?: string;
  groupId?: string;
  userId?: string;
  token?: string;
  onClose?: () => void;
  onSessionComplete?: (stats: any) => void;
}

export const LiveStudySession: React.FC<LiveStudySessionProps> = ({
  sessionId,
  groupId,
  userId: userIdProp,
  token: tokenProp,
  onClose,
  onSessionComplete,
}) => {
  const { userId: clerkUserId, getToken } = useAuth();
  const [resolvedToken, setResolvedToken] = useState<string>(tokenProp ?? '');
  const userId = userIdProp ?? clerkUserId ?? '';
  useEffect(() => {
    if (tokenProp != null) {
      setResolvedToken(tokenProp);
      return;
    }
    getToken?.().then((t) => setResolvedToken(t ?? ''));
  }, [tokenProp, getToken]);
  const token = tokenProp ?? resolvedToken;
  const [activeTab, setActiveTab] = useState<'session' | 'leaderboard' | 'chat' | 'benchmark'>(
    'session'
  );
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(60); // seconds
  const [chatMessage, setChatMessage] = useState('');
  const [sessionStats, setSessionStats] = useState({
    questionsAnswered: 0,
    correctAnswers: 0,
    currentStreak: 0,
    bestStreak: 0,
    averageTime: 0,
    score: 0,
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const questionStartTimeRef = useRef<number>(Date.now());

  // Mock questions for demonstration
  const mockQuestions = [
    {
      id: '1',
      text: 'A 45-year-old man presents with chest pain radiating to his left arm, diaphoresis, and nausea. ECG shows ST elevation in leads II, III, and aVF. Which coronary artery is most likely occluded?',
      options: [
        'Left anterior descending artery',
        'Left circumflex artery',
        'Right coronary artery',
        'Left main coronary artery',
      ],
      correctAnswer: 2,
      explanation:
        'ST elevation in inferior leads (II, III, aVF) suggests occlusion of the right coronary artery, which supplies the inferior wall of the heart.',
      system: 'Cardiovascular',
      difficulty: 3,
    },
    {
      id: '2',
      text: 'A 65-year-old woman with COPD presents with increased shortness of breath, productive cough with green sputum, and fever. Chest X-ray shows hyperinflation and increased bronchovascular markings. What is the most appropriate initial antibiotic?',
      options: ['Azithromycin', 'Levofloxacin', 'Amoxicillin-clavulanate', 'Doxycycline'],
      correctAnswer: 2,
      explanation:
        'Amoxicillin-clavulanate is recommended as first-line therapy for COPD exacerbations with increased sputum purulence.',
      system: 'Pulmonary',
      difficulty: 2,
    },
    {
      id: '3',
      text: 'A 28-year-old woman presents with right lower quadrant pain, nausea, and fever. Physical exam reveals rebound tenderness and guarding. Ultrasound shows an enlarged, non-compressible appendix. What is the next step in management?',
      options: [
        'IV antibiotics and observation',
        'CT scan for confirmation',
        'Appendectomy',
        'Pain management and discharge with follow-up',
      ],
      correctAnswer: 2,
      explanation:
        'Appendectomy is the definitive treatment for acute appendicitis. Prompt surgical intervention reduces the risk of perforation.',
      system: 'GI/Nutrition',
      difficulty: 3,
    },
  ];

  // Use real-time collaboration hook
  const {
    isConnected,
    connectionStatus,
    presence,
    activeSessions,
    chatMessages,
    joinSession,
    leaveSession,
    submitAnswer,
    sendChatMessage,
    updatePresence,
    getPeerBenchmark,
    getLiveLeaderboard,
  } = useRealTimeCollaboration({
    userId,
    token,
    autoConnect: true,
    onConnected: () => { /* connected */ },
    onDisconnected: (_code, _reason) => { /* disconnected */ },
    onError: (error) => console.error('Real-time error:', error),
  });

  const [peerBenchmark, setPeerBenchmark] = useState<any>(null);
  const [liveLeaderboard, setLiveLeaderboard] = useState<LiveLeaderboardEntry[]>([]);
  const [presenceList, setPresenceList] = useState<PeerPresence[]>([
    {
      userId: '1',
      displayName: 'Alex Chen',
      status: 'online',
      lastSeen: new Date(),
      currentActivity: { type: 'studying', system: 'Cardiovascular', startedAt: new Date() },
    },
    {
      userId: '2',
      displayName: 'Jamie Smith',
      status: 'online',
      lastSeen: new Date(),
      currentActivity: { type: 'quiz', questionCount: 15, accuracy: 0.85, startedAt: new Date() },
    },
    {
      userId: '3',
      displayName: 'Taylor Brown',
      status: 'away',
      lastSeen: new Date(Date.now() - 300000),
    },
    {
      userId: '4',
      displayName: 'Morgan Lee',
      status: 'busy',
      lastSeen: new Date(),
      currentActivity: { type: 'review', startedAt: new Date() },
    },
    {
      userId: '5',
      displayName: 'Casey Wilson',
      status: 'offline',
      lastSeen: new Date(Date.now() - 3600000),
    },
  ]);

  // Initialize session
  useEffect(() => {
    if (sessionId && isConnected) {
      joinSession(sessionId);
      updatePresence('online', { type: 'studying', system: 'Mixed', startedAt: new Date() });
    }

    // Load peer benchmark
    getPeerBenchmark().then(setPeerBenchmark).catch((err: unknown) => {
      console.error('[LiveStudySession] Failed to load peer benchmark:', err);
    });

    // Load leaderboard
    if (groupId) {
      getLiveLeaderboard(groupId).then(setLiveLeaderboard).catch((err: unknown) => {
        console.error('[LiveStudySession] Failed to load leaderboard:', err);
      });
    }

    // Start question timer
    startTimer();

    return () => {
      if (sessionId && isConnected) {
        leaveSession(sessionId);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [sessionId, groupId, isConnected]);

  const startTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    questionStartTimeRef.current = Date.now();
    setTimeRemaining(60);

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimeUp = () => {
    if (!isAnswerSubmitted) {
      setIsAnswerSubmitted(true);
      // Auto-submit wrong answer when time's up
      const timeSpent = Date.now() - questionStartTimeRef.current;
      if (sessionId) {
        submitAnswer(sessionId, mockQuestions[currentQuestionIndex]!.id, -1, timeSpent);
      }

      // Update stats
      setSessionStats((prev) => ({
        ...prev,
        questionsAnswered: prev.questionsAnswered + 1,
        currentStreak: 0,
        averageTime:
          (prev.averageTime * prev.questionsAnswered + timeSpent) / (prev.questionsAnswered + 1),
      }));
    }
  };

  const handleAnswerSelect = (answerIndex: number) => {
    if (isAnswerSubmitted) return;
    setSelectedAnswer(answerIndex);
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null || isAnswerSubmitted) return;

    const timeSpent = Date.now() - questionStartTimeRef.current;
    const isCorrect = selectedAnswer === mockQuestions[currentQuestionIndex]!.correctAnswer;

    setIsAnswerSubmitted(true);

    if (sessionId) {
      submitAnswer(sessionId, mockQuestions[currentQuestionIndex]!.id, selectedAnswer, timeSpent);
    }

    // Update stats
    setSessionStats((prev) => {
      const newStreak = isCorrect ? prev.currentStreak + 1 : 0;
      return {
        questionsAnswered: prev.questionsAnswered + 1,
        correctAnswers: prev.correctAnswers + (isCorrect ? 1 : 0),
        currentStreak: newStreak,
        bestStreak: Math.max(prev.bestStreak, newStreak),
        averageTime:
          (prev.averageTime * prev.questionsAnswered + timeSpent) / (prev.questionsAnswered + 1),
        score:
          prev.score + (isCorrect ? 100 : 0) + Math.max(0, Math.floor((60 - timeSpent / 1000) * 2)),
      };
    });
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < mockQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setIsAnswerSubmitted(false);
      startTimer();
    } else {
      // Session complete
      if (onSessionComplete) {
        onSessionComplete(sessionStats);
      }
    }
  };

  const handleSendChatMessage = () => {
    if (!chatMessage.trim() || !sessionId) return;

    sendChatMessage(sessionId, chatMessage);
    setChatMessage('');
  };

  const getStatusColor = (status: PeerPresence['status']) => {
    switch (status) {
      case 'online':
        return 'bg-data-pass';
      case 'away':
        return 'bg-[var(--color-data-provisional)]';
      case 'busy':
        return 'bg-data-fail';
      case 'offline':
        return 'bg-data-neutral';
      default:
        return 'bg-data-neutral';
    }
  };

  const getActivityIcon = (activityType?: string) => {
    switch (activityType) {
      case 'studying':
        return <Brain className="w-4 h-4" />;
      case 'quiz':
        return <Target className="w-4 h-4" />;
      case 'review':
        return <Activity className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const currentQuestion = mockQuestions[currentQuestionIndex];
  if (!currentQuestion) {
    return (
      <div className="flex flex-col h-full bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] p-6">
        <p className="text-[var(--color-text-muted)]">No questions available.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-[var(--color-data-pass)]' : 'bg-[var(--color-data-fail)]'}`} />
          <h2 className="text-lg font-semibold text-[var(--color-accent)]">
            Live Study Session
          </h2>
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
            {connectionStatus}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--color-text-muted)]" />
            <span className="text-sm font-medium text-[var(--color-accent)]">
              {presenceList.filter((p) => p.status === 'online').length} online
            </span>
          </div>
          {onClose && (
            <StandardButton
              variant="ghost"
              size="sm"
              onClick={onClose}
              icon={<X className="w-4 h-4" />}
            />
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Session */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto">
          {/* Session Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 border border-[var(--color-border)]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-muted)]">Score</span>
                <Trophy className="w-4 h-4 text-[var(--color-accent)]" />
              </div>
              <div className="text-2xl font-bold text-[var(--color-accent)] mt-2">
                {sessionStats.score}
              </div>
            </div>

            <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 border border-[var(--color-border)]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-muted)]">Accuracy</span>
                <Target className="w-4 h-4 text-data-pass" />
              </div>
              <div className="text-2xl font-bold text-[var(--color-accent)] mt-2">
                {sessionStats.questionsAnswered > 0
                  ? `${Math.round((sessionStats.correctAnswers / sessionStats.questionsAnswered) * 100)}%`
                  : '0%'}
              </div>
            </div>

            <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 border border-[var(--color-border)]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-muted)]">Streak</span>
                <Zap className="w-4 h-4 text-[var(--color-data-provisional)]" />
              </div>
              <div className="text-2xl font-bold text-[var(--color-accent)] mt-2">
                {sessionStats.currentStreak}
              </div>
            </div>

            <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 border border-[var(--color-border)]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-muted)]">Time</span>
                <Clock className="w-4 h-4 text-[var(--color-category-practice)]" />
              </div>
              <div className="text-2xl font-bold text-[var(--color-accent)] mt-2">
                {timeRemaining}s
              </div>
            </div>
          </div>

          {/* Question */}
          <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 border border-[var(--color-border)] mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 text-sm font-medium rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                  {currentQuestion.system}
                </span>
                <span className="text-sm text-[var(--color-text-muted)]">
                  Question {currentQuestionIndex + 1} of {mockQuestions.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${i < currentQuestion.difficulty ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`}
                  />
                ))}
              </div>
            </div>

            <h3 className="text-lg font-medium text-[var(--color-accent)] mb-6">
              {currentQuestion.text}
            </h3>

            {/* Answer Options */}
            <div className="space-y-3 mb-6">
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedAnswer === index;
                const isCorrect = index === currentQuestion.correctAnswer;
                const showCorrect = isAnswerSubmitted && isCorrect;
                const showIncorrect = isAnswerSubmitted && isSelected && !isCorrect;

                return (
                  <motion.button
                    key={index}
                    whileHover={{ scale: isAnswerSubmitted ? 1 : 1.02 }}
                    whileTap={{ scale: isAnswerSubmitted ? 1 : 0.98 }}
                    onClick={() => handleAnswerSelect(index)}
                    disabled={isAnswerSubmitted}
                    className={`w-full p-4 text-left rounded-lg border transition-all duration-200 ${
                      showCorrect
                        ? 'border-data-pass bg-data-pass/10'
                        : showIncorrect
                          ? 'border-data-fail bg-data-fail/10'
                          : isSelected
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                            : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50'
                    } ${isAnswerSubmitted ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            showCorrect
                              ? 'bg-data-pass text-white'
                              : showIncorrect
                                ? 'bg-data-fail text-white'
                                : isSelected
                                  ? 'bg-[var(--color-accent)] text-white'
                                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'
                          }`}
                        >
                          {String.fromCharCode(65 + index)}
                        </div>
                        <span
                          className={`font-medium ${
                            showCorrect
                              ? 'text-data-pass'
                              : showIncorrect
                                ? 'text-data-fail'
                                : isSelected
                                  ? 'text-[var(--color-accent)]'
                                  : 'text-[var(--color-accent)]'
                          }`}
                        >
                          {option}
                        </span>
                      </div>
                      {showCorrect && <CheckCircle className="w-5 h-5 text-data-pass" />}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Explanation */}
            {isAnswerSubmitted && currentQuestion.explanation && (
              <motion.div
                initial={{ y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-[color-mix(in_srgb,var(--color-category-practice)_10%,transparent)] border border-[color-mix(in_srgb,var(--color-category-practice)_30%,transparent)] rounded-lg"
              >
                <div className="flex items-center gap-2 mb-2">
                  <HelpCircle className="w-4 h-4 text-[var(--color-category-practice)]" />
                  <span className="text-sm font-medium text-[var(--color-category-practice)]">Explanation</span>
                </div>
                <p className="text-sm text-[color-mix(in_srgb,var(--color-category-practice)_80%,transparent)]">{currentQuestion.explanation}</p>
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-[var(--color-text-muted)]">
                {isAnswerSubmitted ? (
                  <span className="flex items-center gap-2">
                    {selectedAnswer === currentQuestion.correctAnswer ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-data-pass" />
                        <span className="text-data-pass">Correct! Well done.</span>
                      </>
                    ) : (
                      <>
                        <X className="w-4 h-4 text-data-fail" />
                        <span className="text-data-fail">
                          Incorrect. The right answer is{' '}
                          {String.fromCharCode(65 + currentQuestion.correctAnswer)}.
                        </span>
                      </>
                    )}
                  </span>
                ) : (
                  'Select your answer above'
                )}
              </div>

              <div className="flex items-center gap-3">
                {!isAnswerSubmitted ? (
                  <StandardButton
                    type="button"
                    variant="primary"
                    onClick={handleSubmitAnswer}
                    disabled={selectedAnswer === null}
                    icon={<Send className="w-4 h-4" />}
                    title={
                      selectedAnswer === null ? 'Select an answer first' : 'Submit your answer'
                    }
                    aria-label={
                      selectedAnswer === null
                        ? 'Submit answer (select an option first)'
                        : 'Submit answer'
                    }
                  >
                    Submit Answer
                  </StandardButton>
                ) : (
                  <StandardButton
                    variant="accent"
                    onClick={handleNextQuestion}
                    icon={<TrendingUp className="w-4 h-4" />}
                  >
                    {currentQuestionIndex < mockQuestions.length - 1
                      ? 'Next Question'
                      : 'Complete Session'}
                  </StandardButton>
                )}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[var(--color-text-muted)]">Session Progress</span>
              <span className="text-sm font-medium text-[var(--color-accent)]">
                {currentQuestionIndex + 1} / {mockQuestions.length}
              </span>
            </div>
            <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[var(--color-accent)]"
                initial={{ width: 0 }}
                animate={{ width: `${((currentQuestionIndex + 1) / mockQuestions.length) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>

        {/* Right Panel - Tabs */}
        <div className="w-80 border-l border-[var(--color-border)] flex flex-col">
          {/* Tab Headers */}
          <div className="flex border-b border-[var(--color-border)]">
            {(['session', 'leaderboard', 'chat', 'benchmark'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-accent)]'
                }`}
              >
                {tab === 'session' && 'Peers'}
                {tab === 'leaderboard' && 'Leaderboard'}
                {tab === 'chat' && 'Chat'}
                {tab === 'benchmark' && 'Benchmark'}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <AnimatePresence mode="wait">
              {activeTab === 'session' && (
                <motion.div
                  key="session"
                  initial={{ x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <h3 className="text-sm font-semibold text-[var(--color-accent)] mb-3">
                    Online Peers ({presenceList.filter((p) => p.status === 'online').length})
                  </h3>
                  {presenceList.map((peer) => (
                    <div
                      key={peer.userId}
                      className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center">
                            <User className="w-5 h-5 text-[var(--color-text-muted)]" />
                          </div>
                          <div
                            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface-primary ${getStatusColor(peer.status)}`}
                          />
                        </div>
                        <div>
                          <div className="font-medium text-[var(--color-accent)]">
                            {peer.displayName}
                          </div>
                          <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                            {peer.currentActivity && (
                              <>
                                {getActivityIcon(peer.currentActivity.type)}
                                <span>
                                  {peer.currentActivity.type === 'studying' &&
                                    `Studying ${peer.currentActivity.system}`}
                                  {peer.currentActivity.type === 'quiz' &&
                                    `Quiz: ${peer.currentActivity.questionCount} questions`}
                                  {peer.currentActivity.type === 'review' && 'Reviewing'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {peer.status === 'online'
                          ? 'Now'
                          : new Date(peer.lastSeen).getMinutes() < 5
                            ? 'Recently'
                            : `${Math.floor((Date.now() - peer.lastSeen.getTime()) / 60000)}m ago`}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}

              {activeTab === 'leaderboard' && (
                <motion.div
                  key="leaderboard"
                  initial={{ x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-3"
                >
                  <h3 className="text-sm font-semibold text-[var(--color-accent)] mb-3">
                    Live Leaderboard
                  </h3>
                  {liveLeaderboard.map((entry) => (
                    <div
                      key={entry.userId}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        entry.userId === userId
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                          : 'border-[var(--color-border)]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            entry.rank <= 3
                              ? 'bg-[var(--color-data-provisional)]/20 text-[var(--color-data-provisional)]'
                              : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'
                          }`}
                        >
                          {entry.rank}
                        </div>
                        <div>
                          <div className="font-medium text-[var(--color-accent)]">
                            {entry.displayName} {entry.userId === userId && '(You)'}
                          </div>
                          <div className="text-xs text-[var(--color-text-muted)]">
                            {entry.questionsAnswered} questions • {Math.round(entry.accuracy * 100)}
                            % accuracy
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[var(--color-accent)]">
                          {entry.score}
                        </div>
                        <div
                          className={`text-xs flex items-center justify-end gap-1 ${
                            entry.trend === 'up'
                              ? 'text-data-pass'
                              : entry.trend === 'down'
                                ? 'text-data-fail'
                                : 'text-[var(--color-text-muted)]'
                          }`}
                        >
                          {entry.trend === 'up' && <TrendingUp className="w-3 h-3" />}
                          {entry.trend === 'down' && <TrendingUp className="w-3 h-3 rotate-180" />}
                          {entry.delta > 0 ? '+' : ''}
                          {entry.delta}
                        </div>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}

              {activeTab === 'chat' && (
                <motion.div
                  key="chat"
                  initial={{ x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex flex-col h-full"
                >
                  <h3 className="text-sm font-semibold text-[var(--color-accent)] mb-3">
                    Group Chat
                  </h3>

                  {/* Chat Messages */}
                  <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                    {[
                      {
                        id: '1',
                        userId: '2',
                        displayName: 'Jamie Smith',
                        content: 'Anyone else finding the cardiovascular questions challenging?',
                        timestamp: new Date(Date.now() - 300000),
                        type: 'text' as const,
                      },
                      {
                        id: '2',
                        userId: '1',
                        displayName: 'Alex Chen',
                        content:
                          'The RCA supplies the inferior wall, remember the mnemonic "Right coronary = Right ventricle + Inferior wall"',
                        timestamp: new Date(Date.now() - 240000),
                        type: 'text' as const,
                      },
                      {
                        id: '3',
                        userId: 'system',
                        displayName: 'System',
                        content: 'Alex Chen answered question 1 correctly in 12.4s',
                        timestamp: new Date(Date.now() - 180000),
                        type: 'system' as const,
                      },
                      {
                        id: '4',
                        userId: '4',
                        displayName: 'Morgan Lee',
                        content: 'Great explanation Alex! That makes sense now.',
                        timestamp: new Date(Date.now() - 120000),
                        type: 'text' as const,
                      },
                    ].map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-3 rounded-lg ${
                          msg.userId === 'system'
                            ? 'bg-[color-mix(in_srgb,var(--color-category-practice)_10%,transparent)] border border-[color-mix(in_srgb,var(--color-category-practice)_20%,transparent)]'
                            : msg.userId === userId
                              ? 'bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 ml-8'
                              : 'bg-[var(--color-bg-secondary)] border border-[var(--color-border)] mr-8'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {msg.userId !== 'system' && (
                              <div className="w-6 h-6 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center">
                                <User className="w-3 h-3 text-[var(--color-text-muted)]" />
                              </div>
                            )}
                            <span
                              className={`text-xs font-medium ${
                                msg.userId === 'system'
                                  ? 'text-[var(--color-category-practice)]'
                                  : msg.userId === userId
                                    ? 'text-[var(--color-accent)]'
                                    : 'text-[var(--color-accent)]'
                              }`}
                            >
                              {msg.displayName}
                            </span>
                          </div>
                          <span className="text-xs text-[var(--color-text-muted)]">
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--color-accent)]">{msg.content}</p>
                      </div>
                    ))}
                  </div>

                  {/* Chat Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                      placeholder="Type a message..."
                      aria-label="Chat message"
                      className="flex-1 px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-accent)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                    />
                    <StandardButton
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleSendChatMessage}
                      disabled={!chatMessage.trim()}
                      icon={<Send className="w-4 h-4" />}
                      title={!chatMessage.trim() ? 'Type a message to send' : 'Send message'}
                      aria-label={
                        !chatMessage.trim() ? 'Send (type a message first)' : 'Send message'
                      }
                    >
                      <span className="sr-only">Send</span>
                    </StandardButton>
                  </div>
                </motion.div>
              )}

              {activeTab === 'benchmark' && peerBenchmark && (
                <motion.div
                  key="benchmark"
                  initial={{ x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <h3 className="text-sm font-semibold text-[var(--color-accent)]">
                    Peer Benchmarking
                  </h3>

                  <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-lg font-bold text-[var(--color-accent)]">
                          {peerBenchmark.comparison.percentile}th Percentile
                        </div>
                        <div className="text-sm text-[var(--color-text-muted)]">
                          Rank {peerBenchmark.comparison.rank} of{' '}
                          {peerBenchmark.comparison.totalPeers}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-[var(--color-accent)]">
                          {Math.round(peerBenchmark.comparison.accuracy * 100)}%
                        </div>
                        <div className="text-sm text-[var(--color-text-muted)]">
                          vs {Math.round(peerBenchmark.comparison.peerAverage * 100)}% average
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-[var(--color-accent)]">
                            Strengths
                          </span>
                          <Award className="w-4 h-4 text-data-pass" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {peerBenchmark.strengths.map((strength: string, index: number) => (
                            <span
                              key={index}
                              className="px-2 py-1 text-xs rounded-full bg-data-pass/10 text-data-pass"
                            >
                              {strength}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-[var(--color-accent)]">
                            Areas for Improvement
                          </span>
                          <Target className="w-4 h-4 text-[var(--color-category-practice)]" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {peerBenchmark.weaknesses.map((weakness: string, index: number) => (
                            <span
                              key={index}
                              className="px-2 py-1 text-xs rounded-full bg-[color-mix(in_srgb,var(--color-category-practice)_10%,transparent)] text-[var(--color-category-practice)]"
                            >
                              {weakness}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-[var(--color-accent)]">
                            Recommendations
                          </span>
                          <Shield className="w-4 h-4 text-[var(--color-accent)]" />
                        </div>
                        <ul className="space-y-2">
                          {peerBenchmark.recommendations.map((rec: string, index: number) => (
                            <li
                              key={index}
                              className="text-sm text-[var(--color-accent)] flex items-start gap-2"
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] mt-1.5 flex-shrink-0" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
