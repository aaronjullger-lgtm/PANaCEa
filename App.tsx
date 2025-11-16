
import React, { useState, useCallback, useMemo } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import type { PerformanceRecord, Question, TopicStats, SessionSettings } from './types';
import QuizView from './components/QuizView';
import MenuView from './components/MenuView';
import Loader from './components/Loader';
import { prefetchQuestions, refillShuffledContentQueue, refillShuffledTaskQueue } from './services/geminiService';

type View = 'quiz' | 'menu';

const App: React.FC = () => {
  const [view, setView] = useState<View>('menu');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('Generating with Gemini...');
  const [error, setError] = useState<string | null>(null);
  const [performanceData, setPerformanceData] = useLocalStorage<PerformanceRecord[]>('panceQuizData', []);
  const [missedQuestions, setMissedQuestions] = useLocalStorage<Question[]>('panceMissedQuestions', []);
  const [flaggedQuestions, setFlaggedQuestions] = useLocalStorage<Question[]>('panceFlaggedQuestions', []);
  const [isModalOpen, setModalOpen] = useState(false);
  const [fontSizeAdjustment, setFontSizeAdjustment] = useLocalStorage<number>('panceFontSizeAdjustment', 0);
  
  const [questionQueue, setQuestionQueue] = useState<Question[]>([]);
  const [sessionSettings, setSessionSettings] = useState<SessionSettings>({
    focus: 'all',
    difficulty: 'same',
  });
  
  const growthAreas = useMemo(() => {
    const topics = [...new Set(performanceData.map(q => q.topic))];
    const topicScores: TopicStats[] = topics.map(topic => {
      const topicQuestions = performanceData.filter(q => q.topic === topic);
      const correct = topicQuestions.filter(q => q.isCorrect).length;
      const total = topicQuestions.length;
      const score = total > 0 ? (correct / total) * 100 : 0;
      return { topic, score, correct, total };
    });

    const significantTopics = topicScores.filter(t => t.total >= 5);

    const redTopics = significantTopics
      .filter(t => t.score < 70)
      .sort((a, b) => a.score - b.score)
      .map(t => t.topic);

    if (redTopics.length > 0) {
      return redTopics;
    }

    const yellowTopics = significantTopics
      .filter(t => t.score >= 70 && t.score <= 85)
      .sort((a, b) => a.score - b.score)
      .map(t => t.topic);

    if (yellowTopics.length > 0) {
      return yellowTopics;
    }

    return [];
  }, [performanceData]);

  const handleStartSession = useCallback(async (settings: SessionSettings) => {
    setModalOpen(false);
    setView('quiz');
    setIsLoading(true);
    setLoadingMessage('Preparing your study session...');
    setError(null);
    setSessionSettings(settings);

    try {
      let initialQuestions: Question[] = [];
      if (settings.focus === 'review' && missedQuestions.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const dueQuestions = missedQuestions.filter(q => q.nextReviewDate && q.nextReviewDate <= today);
        initialQuestions = [...dueQuestions].sort(() => 0.5 - Math.random());
      } else if (settings.focus === 'reviewFlagged' && flaggedQuestions.length > 0) {
        initialQuestions = [...flaggedQuestions].sort(() => 0.5 - Math.random());
      } else {
        if (settings.focus === 'all') {
          refillShuffledContentQueue();
          refillShuffledTaskQueue();
        }
        initialQuestions = await prefetchQuestions(3, settings, growthAreas);
      }
      setQuestionQueue(initialQuestions);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred while preparing the session.");
      }
      setView('menu'); // Go back to menu on error
    } finally {
      setIsLoading(false);
      setLoadingMessage('Generating with Gemini...'); // Reset message
    }
  }, [growthAreas, missedQuestions, flaggedQuestions]);

  const addMissedQuestion = useCallback((question: Question) => {
    setMissedQuestions(prev => {
      const existingQuestionIndex = prev.findIndex(q => q.question === question.question);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextReviewDate = tomorrow.toISOString().split('T')[0];

      if (existingQuestionIndex !== -1) {
        const updatedQuestions = [...prev];
        const questionToUpdate = { ...updatedQuestions[existingQuestionIndex] };
        questionToUpdate.repetitionLevel = 1;
        questionToUpdate.nextReviewDate = nextReviewDate;
        updatedQuestions[existingQuestionIndex] = questionToUpdate;
        return updatedQuestions;
      } else {
        const newMissedQuestion: Question = {
          ...question,
          repetitionLevel: 1,
          nextReviewDate: nextReviewDate,
        };
        return [...prev, newMissedQuestion];
      }
    });
  }, [setMissedQuestions]);

  const updateReviewQuestion = useCallback((reviewedQuestion: Question, wasCorrect: boolean) => {
    setMissedQuestions(prev => {
      const questionIndex = prev.findIndex(q => q.question === reviewedQuestion.question);
      if (questionIndex === -1) return prev; 

      const updatedQuestions = [...prev];

      if (wasCorrect) {
        const questionToUpdate = { ...updatedQuestions[questionIndex] };
        const currentLevel = questionToUpdate.repetitionLevel || 1;
        const newLevel = currentLevel + 1;
        
        if (newLevel >= 5) {
          updatedQuestions.splice(questionIndex, 1);
          return updatedQuestions;
        }
        
        questionToUpdate.repetitionLevel = newLevel;
        const nextReview = new Date();
        let daysToAdd = 0;
        if (newLevel === 2) daysToAdd = 3;
        else if (newLevel === 3) daysToAdd = 7;
        else if (newLevel === 4) daysToAdd = 14;
        
        nextReview.setDate(nextReview.getDate() + daysToAdd);
        questionToUpdate.nextReviewDate = nextReview.toISOString().split('T')[0];
        updatedQuestions[questionIndex] = questionToUpdate;
        
      } else { 
        const questionToUpdate = { ...updatedQuestions[questionIndex] };
        questionToUpdate.repetitionLevel = 1;
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        questionToUpdate.nextReviewDate = tomorrow.toISOString().split('T')[0];
        updatedQuestions[questionIndex] = questionToUpdate;
      }
      
      return updatedQuestions;
    });
  }, [setMissedQuestions]);

  const addPerformanceRecord = useCallback((record: PerformanceRecord) => {
    setPerformanceData(prevData => [...prevData, record]);
  }, [setPerformanceData]);

  const addFlaggedQuestion = useCallback((question: Question) => {
    setFlaggedQuestions(prev => {
        if (prev.some(q => q.question === question.question)) {
            return prev; // Already flagged
        }
        return [...prev, question];
    });
  }, [setFlaggedQuestions]);

  const removeFlaggedQuestion = useCallback((question: Question) => {
    setFlaggedQuestions(prev => prev.filter(q => q.question !== question.question));
  }, [setFlaggedQuestions]);

  const updateQuestionNote = useCallback((questionToUpdate: Question, note: string) => {
    const updater = (q: Question) => q.question === questionToUpdate.question ? { ...q, userNote: note } : q;
    setQuestionQueue(prev => prev.map(updater));
    setMissedQuestions(prev => prev.map(updater));
    setFlaggedQuestions(prev => prev.map(updater));
  }, [setQuestionQueue, setMissedQuestions, setFlaggedQuestions]);


  const clearPerformanceData = () => {
    if (window.confirm("Are you sure you want to delete all your performance data? This cannot be undone.")) {
      setPerformanceData([]);
      setQuestionQueue([]);
      setView('menu');
    }
  };

  const clearMissedQuestionsData = () => {
    if (window.confirm("Are you sure you want to clear your Missed Question Bank? This cannot be undone.")) {
        setMissedQuestions([]);
    }
  };

  const clearFlaggedQuestionsData = () => {
    if (window.confirm("Are you sure you want to clear your Flagged Questions? This cannot be undone.")) {
        setFlaggedQuestions([]);
    }
  };
  
  const handleEndSession = () => {
    if (window.confirm("Are you sure you want to end this session? Your current question queue will be cleared.")) {
      setQuestionQueue([]);
      setView('menu');
    }
  };

  const handleShowMenu = () => {
    setError(null);
    setView('menu');
  };

  const handleShowQuiz = () => {
    if (questionQueue.length > 0) {
      setError(null);
      setView('quiz');
    } else {
      setModalOpen(true); // If no questions, prompt to start a session
    }
  };

  return (
    <div 
      className="min-h-screen bg-[#FDFDFD] text-[#333333] flex flex-col items-center justify-center p-4"
      style={{ '--font-size-adj': `${fontSizeAdjustment}px` } as React.CSSProperties}
    >
      <div className="relative w-full max-w-3xl min-h-[600px] bg-white rounded-2xl shadow-2xl p-6 md:p-10 transition-all duration-300">
        
        {isLoading && <Loader message={loadingMessage} />}
        
        {error && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 rounded-2xl p-4">
            <h2 className="text-xl font-bold text-red-600 mb-2">An Error Occurred</h2>
            <p className="text-center text-red-500">{error}</p>
            <button 
              onClick={() => {
                setError(null);
                setView('menu'); // Go back to menu on error
              }}
              className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Back to Menu
            </button>
          </div>
        )}
        
        <div className={view === 'menu' ? 'block' : 'hidden'}>
          <MenuView 
            performanceData={performanceData}
            missedQuestions={missedQuestions}
            flaggedQuestions={flaggedQuestions}
            onBackToQuiz={handleShowQuiz} // This is now "Continue Session"
            hasActiveSession={questionQueue.length > 0}
            clearPerformanceData={clearPerformanceData}
            clearMissedQuestionsData={clearMissedQuestionsData}
            clearFlaggedQuestionsData={clearFlaggedQuestionsData}
            setIsLoading={setIsLoading}
            setError={setError}
            onStartSession={() => setModalOpen(true)}
            isModalOpen={isModalOpen}
            onCloseModal={() => setModalOpen(false)}
            onConfirmSession={handleStartSession}
            growthAreas={growthAreas}
          />
        </div>

        <div className={view === 'quiz' ? 'block' : 'hidden'}>
          {questionQueue.length > 0 ? (
            <QuizView
              initialQueue={questionQueue}
              setParentQueue={setQuestionQueue}
              addPerformanceRecord={addPerformanceRecord}
              addMissedQuestion={addMissedQuestion}
              updateReviewQuestion={updateReviewQuestion}
              setIsLoading={setIsLoading}
              setError={setError}
              sessionSettings={sessionSettings}
              growthAreas={growthAreas}
              onEndSession={handleEndSession}
              onShowMenu={handleShowMenu}
              performanceData={performanceData}
              fontSizeAdjustment={fontSizeAdjustment}
              setFontSizeAdjustment={setFontSizeAdjustment}
              flaggedQuestions={flaggedQuestions}
              addFlaggedQuestion={addFlaggedQuestion}
              removeFlaggedQuestion={removeFlaggedQuestion}
              updateQuestionNote={updateQuestionNote}
            />
          ) : (
            // This view is shown if the queue runs out or fails to load
            <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
              <h2 className="text-2xl font-bold mb-4">Session Over</h2>
              <p className="text-slate-600 mb-6 text-center">You've completed all the questions in this session.</p>
              <button
                onClick={() => setModalOpen(true)}
                className="px-6 py-3 bg-[#3D1B0E] text-white font-bold rounded-lg hover:bg-[#2b130a] transition-colors"
              >
                Start a New Session
              </button>
            </div>
          )}
        </div>

      </div>
      <footer className="text-center text-slate-500 mt-6 text-sm">
        <p>PANCE AI Practice Quiz</p>
      </footer>
    </div>
  );
};

export default App;
