import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchNewQuestion, generateAlternateRationale } from '../services/geminiService';
import type { Question, PerformanceRecord, SessionSettings } from '../types';
import { CloseIcon } from './icons/CloseIcon';
import { FlagIcon } from './icons/FlagIcon';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { ClearHighlightIcon } from './icons/ClearHighlightIcon';

interface QuizViewProps {
  initialQueue: Question[];
  setParentQueue: React.Dispatch<React.SetStateAction<Question[]>>;
  addPerformanceRecord: (record: PerformanceRecord) => void;
  addMissedQuestion: (question: Question) => void;
  updateReviewQuestion: (question: Question, wasCorrect: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  sessionSettings: SessionSettings;
  growthAreas: string[];
  onEndSession: () => void;
  onShowMenu: () => void;
  performanceData: PerformanceRecord[];
  fontSizeAdjustment: number;
  setFontSizeAdjustment: React.Dispatch<React.SetStateAction<number>>;
  flaggedQuestions: Question[];
  addFlaggedQuestion: (question: Question) => void;
  removeFlaggedQuestion: (question: Question) => void;
  updateQuestionNote: (question: Question, note: string) => void;
}

const QuestionDisplay: React.FC<{ text: string }> = ({ text }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseUp = () => {
      try {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
          return;
        }

        const range = selection.getRangeAt(0);
        if (!container.contains(range.commonAncestorContainer)) {
          return;
        }

        const span = document.createElement('span');
        span.className = 'user-highlight';

        range.surroundContents(span);
        selection.removeAllRanges();
      } catch (e) {
        console.error(
          'Highlighting failed. This can happen if the selection spans across formatted sections.',
          e
        );
        window.getSelection()?.removeAllRanges();
      }
    };

    container.addEventListener('mouseup', handleMouseUp);
    return () => {
      container.removeEventListener('mouseup', handleMouseUp);
    };
  }, [text]);

  // If the question contains an HTML table, render it as HTML so vitals/labs look like a chart.
  const hasTable = text.includes('<table');

  if (hasTable) {
    return (
      <div
        ref={containerRef}
        id="question-container"
        className="text-xl md:text-2xl leading-relaxed text-[#333333]"
        style={{ fontSize: `calc(1em + var(--font-size-adj))` }}
        dangerouslySetInnerHTML={{ __html: text }}
      />
    );
  }

  // No table: treat as plain text, bold the final sentence.
  const lastSentenceMatch = text.match(/[^.!?]+[.!?]+\s*$/);

  if (!lastSentenceMatch) {
    return (
      <div ref={containerRef} id="question-container">
        <div
          className="text-xl md:text-2xl font-semibold leading-tight text-[#333333] whitespace-pre-wrap"
          style={{ fontSize: `calc(1em + var(--font-size-adj))` }}
        >
          {text}
        </div>
      </div>
    );
  }

  const lastSentence = lastSentenceMatch[0].trim();
  const vignette = text.substring(0, text.length - lastSentenceMatch[0].length).trim();

  return (
    <div
      ref={containerRef}
      id="question-container"
      className="text-xl md:text-2xl leading-relaxed text-[#333333]"
      style={{ fontSize: `calc(1em + var(--font-size-adj))` }}
    >
      <div className="!leading-[1.6]">
        <p className="font-normal whitespace-pre-wrap">{vignette}</p>
        <p className="mt-4 font-semibold whitespace-pre-wrap">{lastSentence}</p>
      </div>
    </div>
  );
};

const QuizView: React.FC<QuizViewProps> = ({ 
  initialQueue, 
  setParentQueue,
  addPerformanceRecord,
  addMissedQuestion,
  updateReviewQuestion,
  setIsLoading, 
  setError,
  sessionSettings,
  growthAreas,
  onEndSession,
  onShowMenu,
  performanceData,
  fontSizeAdjustment,
  setFontSizeAdjustment,
  flaggedQuestions,
  addFlaggedQuestion,
  removeFlaggedQuestion,
  updateQuestionNote
}) => {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(initialQueue[0] || null);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [questionNumber, setQuestionNumber] = useState<number>(1);
  const [alternateRationale, setAlternateRationale] = useState<string | null>(null);
  const [isExplainerLoading, setIsExplainerLoading] = useState<boolean>(false);
  const [localNote, setLocalNote] = useState<string>('');
  
  const noteUpdateTimeout = useRef<number | null>(null);
  const optionButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);

  const isFlagged = useMemo(() => {
    if (!currentQuestion) return false;
    return flaggedQuestions.some(q => q.question === currentQuestion.question);
  }, [currentQuestion, flaggedQuestions]);

  const replenishQueue = useCallback(async () => {
    if (sessionSettings.focus === 'review' || sessionSettings.focus === 'reviewFlagged') return;

    try {
      const newQuestion = await fetchNewQuestion(sessionSettings, growthAreas);
      setParentQueue(prevQueue => [...prevQueue, newQuestion]);
    } catch (error) {
      console.error("Failed to replenish queue in background:", error);
    }
  }, [sessionSettings, growthAreas, setParentQueue]);

  const showNextQuestion = useCallback(() => {
    setIsAnswered(false);
    setSelectedAnswerIndex(null);
    setQuestionNumber(prev => prev + 1);
    setAlternateRationale(null);
    setLocalNote('');
    
    setParentQueue(prevQueue => {
      const nextQueue = prevQueue.slice(1);
      setCurrentQuestion(nextQueue[0] || null);
      return nextQueue;
    });

    replenishQueue();
  }, [setParentQueue, replenishQueue]);
  
  useEffect(() => {
    if (!currentQuestion && initialQueue.length > 0) {
      setCurrentQuestion(initialQueue[0]);
    }
    setLocalNote(initialQueue[0]?.userNote || '');
  }, [initialQueue, currentQuestion]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).tagName.toLowerCase() === 'textarea') {
        return;
      }

      if (!isAnswered && ['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault();
        const index = parseInt(event.key) - 1;
        optionButtonsRef.current[index]?.click();
      }

      if (isAnswered && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        nextButtonRef.current?.click();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAnswered]);

  const handleOptionClick = (index: number) => {
    if (isAnswered || !currentQuestion) return;

    setSelectedAnswerIndex(index);
    setIsAnswered(true);
    const isCorrect = index === currentQuestion.correctAnswerIndex;

    if (sessionSettings.focus === 'review') {
      updateReviewQuestion(currentQuestion, isCorrect);
    } else {
      if (!isCorrect) {
        addMissedQuestion(currentQuestion);
      }
    }

    addPerformanceRecord({
      timestamp: Date.now(),
      topic: currentQuestion.topic,
      isCorrect: isCorrect,
      question: currentQuestion.question,
    });
  };

  const handleExplainDifferently = useCallback(async () => {
    if (!currentQuestion || selectedAnswerIndex === null) return;
    
    setIsExplainerLoading(true);
    setAlternateRationale(null);
    
    try {
      const userAnswer = currentQuestion.options[selectedAnswerIndex];
      const correctAnswer = currentQuestion.options[currentQuestion.correctAnswerIndex];
      const explanation = await generateAlternateRationale(currentQuestion, userAnswer, correctAnswer);
      setAlternateRationale(explanation);
    } catch (err) {
      if (err instanceof Error) {
        setAlternateRationale(`Sorry, an error occurred while generating a new explanation: ${err.message}`);
      } else {
        setAlternateRationale("Sorry, an unknown error occurred while generating a new explanation.");
      }
    } finally {
      setIsExplainerLoading(false);
    }
  }, [currentQuestion, selectedAnswerIndex]);

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newNote = e.target.value;
    setLocalNote(newNote);

    if (noteUpdateTimeout.current) {
      clearTimeout(noteUpdateTimeout.current);
    }

    noteUpdateTimeout.current = window.setTimeout(() => {
      if (currentQuestion) {
        updateQuestionNote(currentQuestion, newNote);
      }
    }, 750);
  };

  const toggleFlag = () => {
    if (!currentQuestion) return;
    if (isFlagged) {
      removeFlaggedQuestion(currentQuestion);
    } else {
      addFlaggedQuestion(currentQuestion);
    }
  };

  const topicStats = useMemo(() => {
    if (!isAnswered || !currentQuestion) return null;
    
    const topicQuestions = performanceData
      .filter(p => p.topic === currentQuestion.topic)
      .slice(-100);
      
    const correct = topicQuestions.filter(p => p.isCorrect).length;
    const total = topicQuestions.length;
    const score = total > 0 ? (correct / total) * 100 : 0;
    
    return { score, correct, total };
  }, [isAnswered, currentQuestion, performanceData]);

  const getBarColor = (score: number): string => {
    if (score < 50) return 'bg-red-500';
    if (score < 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };
  
  if (!currentQuestion) {
    if (initialQueue.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
          <h2 className="text-2xl font-bold mb-4">Question Queue Empty</h2>
          <p className="text-slate-600">Please start a new session from the menu.</p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="flex flex-col">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-3 min-w-0">
            {/* Back to dashboard */}
            <button 
              onClick={onShowMenu}
              className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors flex-shrink-0"
              aria-label="Back to Menu"
            >
              <ArrowLeftIcon className="w-6 h-6 text-slate-600" />
            </button>
            <p className="text-sm font-medium text-slate-500 truncate">
              Question {questionNumber}
            </p>
          </div>
          
          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* Flag */}
            <button
              onClick={toggleFlag}
              title={isFlagged ? "Unflag for review" : "Flag for review"}
              className={`p-1.5 rounded-full transition-colors ${
                isFlagged ? 'bg-yellow-100 text-yellow-600' : 'text-slate-500 hover:bg-slate-200'
              }`}
            >
              <FlagIcon className="w-5 h-5" />
            </button>

            {/* Clear Highlights */}
            <button
              onClick={() => {
                const container = document.getElementById("question-container");
                if (!container) return;
                const spans = container.querySelectorAll("span.user-highlight");
                spans.forEach((s) => {
                  const parent = s.parentNode;
                  if (!parent) return;
                  while (s.firstChild) {
                    parent.insertBefore(s.firstChild, s);
                  }
                  parent.removeChild(s);
                });
              }}
              title="Clear highlights"
              className="p-1.5 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"
            >
              <ClearHighlightIcon className="w-5 h-5" />
            </button>

            {/* Font size controls */}
            <div className="flex items-center border border-slate-300 rounded-md">
              <button 
                onClick={() => setFontSizeAdjustment(prev => prev - 1)}
                className="px-2 py-0.5 text-slate-600 hover:bg-slate-200 rounded-l-md text-sm"
                aria-label="Decrease font size"
              >
                A-
              </button>
              <div className="w-px h-4 bg-slate-300"></div>
              <button 
                onClick={() => setFontSizeAdjustment(prev => prev + 1)}
                className="px-2 py-0.5 text-slate-600 hover:bg-slate-200 rounded-r-md text-sm"
                aria-label="Increase font size"
              >
                A+
              </button>
            </div>

            {/* End session */}
            <button
              onClick={onEndSession}
              title="End Session"
              className="p-1.5 rounded-full text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        <QuestionDisplay text={currentQuestion.question} />
      </div>

      <div className="space-y-3 mt-6">
        {currentQuestion.options.map((option, index) => {
          const isCorrect = index === currentQuestion.correctAnswerIndex;
          const isSelected = index === selectedAnswerIndex;

          let buttonClasses =
            'w-full text-left p-4 rounded-xl transition-all duration-200 ease-in-out disabled:cursor-not-allowed active:scale-[0.98] font-medium';
          let animationClass = '';

          if (isAnswered) {
            if (isCorrect) {
              buttonClasses += ' !bg-green-600 !text-white !border-transparent font-bold shadow-md';
            } else if (isSelected) {
              buttonClasses += ' !bg-red-600 !text-white !border-transparent font-bold shadow-md';
              animationClass = 'animate-shake';
            } else {
              buttonClasses += ' bg-white border border-slate-300 shadow-sm text-[#333333] opacity-60';
            }
          } else {
            buttonClasses +=
              ' bg-white border border-slate-300 shadow-sm text-[#333333] hover:shadow-lg hover:border-[#3D1B0E] hover:-translate-y-px';
          }

          return (
            <button
              key={index}
              ref={el => {
                optionButtonsRef.current[index] = el;
              }}
              onClick={() => handleOptionClick(index)}
              disabled={isAnswered}
              className={`${buttonClasses} ${animationClass}`}
              style={{ fontSize: `calc(1rem + var(--font-size-adj))` }}
            >
              <span className="font-bold mr-2">{index + 1}.</span>
              {option}
            </button>
          );
        })}
      </div>

      {isAnswered && (
        <div className="mt-6 animate-fade-in space-y-4">
          {topicStats && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex justify-between items-center mb-1 text-sm">
                <span className="font-semibold text-slate-700">{currentQuestion.topic}</span>
                <span className="font-medium text-slate-500">
                  {topicStats.score.toFixed(0)}% ({topicStats.correct}/{topicStats.total})
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full ${getBarColor(topicStats.score)} transition-all duration-500 ease-out`}
                  style={{ width: `${topicStats.score}%` }}
                ></div>
              </div>
            </div>
          )}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg feedback-content">
            <h3 className="font-bold text-lg mb-2 text-slate-800">Rationale</h3>
            <div
              className="text-slate-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: currentQuestion.rationale }}
            />

            {selectedAnswerIndex !== currentQuestion.correctAnswerIndex && (
              <div className="mt-4">
                <button
                  onClick={handleExplainDifferently}
                  disabled={isExplainerLoading}
                  className="px-4 py-2 bg-[#E6A495] text-[#3D1B0E] font-semibold rounded-lg hover:bg-[#d99282] transition-colors text-sm disabled:opacity-50 disabled:cursor-wait"
                >
                  {isExplainerLoading ? 'Thinking...' : 'Explain this differently'}
                </button>
              </div>
            )}

            {isExplainerLoading && (
              <div className="mt-4 flex items-center space-x-2 text-slate-600">
                <div className="w-2 h-2 bg-slate-500 rounded-full animate-pulse"></div>
                <div
                  className="w-2 h-2 bg-slate-500 rounded-full animate-pulse"
                  style={{ animationDelay: '0.2s' }}
                ></div>
                <div
                  className="w-2 h-2 bg-slate-500 rounded-full animate-pulse"
                  style={{ animationDelay: '0.4s' }}
                ></div>
                <span className="text-sm">Generating new explanation...</span>
              </div>
            )}

            {alternateRationale && !isExplainerLoading && (
              <div className="mt-4 pt-4 border-t border-slate-200 animate-fade-in">
                <h4 className="font-bold text-md mb-2 text-slate-800">Alternate Explanation</h4>
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {alternateRationale}
                </p>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-slate-200">
              <h3 className="font-bold text-lg mb-2 text-slate-800">
                Key Pearls: {currentQuestion.condition}
              </h3>
              <ul className="list-disc list-inside space-y-1 text-slate-700">
                {currentQuestion.pearls.map((pearl, index) => (
                  <li key={index} dangerouslySetInnerHTML={{ __html: pearl }} />
                ))}
              </ul>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200">
              <h3 className="font-bold text-lg mb-2 text-slate-800">My Notes</h3>
              <textarea
                value={localNote}
                onChange={handleNoteChange}
                placeholder="Type your notes here... They will be saved automatically."
                className="w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-[#3D1B0E] focus:border-transparent"
                rows={3}
              />
            </div>
          </div>
        </div>
      )}

      {isAnswered && (
        <div className="mt-4 text-center">
          <button
            ref={nextButtonRef}
            onClick={showNextQuestion}
            className="px-8 py-3 bg-[#3D1B0E] text-white font-bold rounded-lg hover:bg-[#2b130a] transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            Next Question
          </button>
        </div>
      )}
    </div>
  );
};

export default QuizView;
