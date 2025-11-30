// components/QuizView.tsx
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchNewQuestion,
  generateAlternateRationale,
} from "../services/geminiService";
import type {
  Question,
  PerformanceRecord,
  SessionSettings,
} from "../types";
import { CloseIcon } from "./icons/CloseIcon";
import { FlagIcon } from "./icons/FlagIcon";
import { ArrowLeftIcon } from "./icons/ArrowLeftIcon";
import { ClearHighlightIcon } from "./icons/ClearHighlightIcon";
import AnswerChoice from "./quiz/AnswerChoice";

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

  // Text highlighting logic
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

        const span = document.createElement("span");
        span.className = "user-highlight";
        range.surroundContents(span);
        selection.removeAllRanges();
      } catch (e) {
        console.error("Highlighting failed.", e);
        window.getSelection()?.removeAllRanges();
      }
    };

    container.addEventListener("mouseup", handleMouseUp);
    return () => {
      container.removeEventListener("mouseup", handleMouseUp);
    };
  }, [text]);

  const hasTable = text.includes("<table");

  // ---------- TABLE BRANCH ----------
  if (hasTable) {
    // 1) Extract table HTML
    const tableMatch = text.match(/<table[\s\S]*?<\/table>/i);
    const tableHTML = tableMatch ? tableMatch[0] : "";

    // 2) Replace table with a sentinel
    const beforeAfter = text.replace(tableHTML, "|||TABLE|||");

    // 3) Normalize line breaks
    const normalized = beforeAfter
      .replace(/&lt;br\s*\/?&gt;/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/\n{2,}/g, "\n")
      .trim();

    const [beforeTable = "", afterTableRaw = ""] =
      normalized.split("|||TABLE|||");

    // 4) Pull out the last sentence (the actual question) after the table
    const lastSentenceMatch = afterTableRaw.match(/[^.!?]+[.!?]+\s*$/);
    const lastSentence = lastSentenceMatch ? lastSentenceMatch[0].trim() : "";

    const vignetteAfterTable = lastSentence
      ? afterTableRaw.replace(lastSentenceMatch![0], "").trim()
      : afterTableRaw.trim();

    return (
      <div
        ref={containerRef}
        id="question-container"
        className="text-xl md:text-2xl leading-relaxed text-[var(--color-text-primary)] bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm space-y-4"
        style={{ fontSize: `calc(1em + var(--font-size-adj))` }}
      >
        {/* Text before the table */}
        {beforeTable && (
          <p className="whitespace-pre-wrap">{beforeTable}</p>
        )}

        {/* Table */}
        <div
          className="my-2"
          dangerouslySetInnerHTML={{ __html: tableHTML }}
        />

        {/* Any non-final text after the table */}
        {vignetteAfterTable && (
          <p className="whitespace-pre-wrap">{vignetteAfterTable}</p>
        )}

        {/* Final bolded question line */}
        {lastSentence && (
          <p className="font-semibold whitespace-pre-wrap">
            {lastSentence}
          </p>
        )}
      </div>
    );
  }

  // ---------- NON-TABLE BRANCH ----------
  const normalizedText = text
    .replace(/&lt;br\s*\/?&gt;/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");

  const lastSentenceMatch = normalizedText.match(/[^.!?]+[.!?]+\s*$/);

  if (!lastSentenceMatch) {
    return (
      <div
        ref={containerRef}
        id="question-container"
        className="text-xl md:text-2xl font-semibold text-[var(--color-text-primary)] whitespace-pre-wrap bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm"
        style={{ fontSize: `calc(1em + var(--font-size-adj))` }}
      >
        {normalizedText}
      </div>
    );
  }

  const lastSentence = lastSentenceMatch[0].trim();
  const vignette = normalizedText.replace(lastSentenceMatch[0], "").trim();

  // Add visual enhancement (shadowed block/border) around question text for better focus
  return (
    <div
      ref={containerRef}
      id="question-container"
      className="text-xl md:text-2xl leading-relaxed text-[var(--color-text-primary)] bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm"
      style={{ fontSize: `calc(1em + var(--font-size-adj))` }}
    >
      <p className="whitespace-pre-wrap">{vignette}</p>
      <p className="font-semibold mt-4 whitespace-pre-wrap">
        {lastSentence}
      </p>
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
  updateQuestionNote,
}) => {
  // ---- QUEUE HANDLING ----
  const [queue, setQueue] = useState<Question[]>(initialQueue);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(
    initialQueue[0] || null
  );

  const [selectedAnswerIndex, setSelectedAnswerIndex] =
    useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [questionNumber, setQuestionNumber] = useState<number>(1);

  const [showRationale, setShowRationale] = useState<boolean>(false);
  const [alternateRationale, setAlternateRationale] =
    useState<string | null>(null);
  const [isExplainerLoading, setIsExplainerLoading] =
    useState<boolean>(false);

  const [localNote, setLocalNote] = useState<string>("");

  // Track eliminated answers (by index) for the current question
  const [eliminatedAnswers, setEliminatedAnswers] = useState<Set<number>>(new Set());

  const noteUpdateTimeout = useRef<number | null>(null);
  const optionButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);

  // Keep CSS variable in sync with fontSizeAdjustment
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--font-size-adj",
      `${fontSizeAdjustment * 0.1}rem`
    );
  }, [fontSizeAdjustment]);
  
  const isFlagged = useMemo(() => {
    if (!currentQuestion) return false;
    return flaggedQuestions.some(
      (q) => q.question === currentQuestion.question
    );
  }, [currentQuestion, flaggedQuestions]);

  // Keep current question synced with queue[0]
  useEffect(() => {
    setCurrentQuestion(queue[0] || null);
  }, [queue]);

  // ---- SHOULD WE REPLENISH ENDLESSLY? ----
  const shouldEndlesslyReplenish =
    sessionSettings.focus !== "review" &&
    sessionSettings.focus !== "reviewFlagged";

  // ---- REPLENISH QUEUE (ALL / GROWTH / TOPIC) ----
  const replenishQueue = useCallback(async () => {
  // Do NOT show the global loader here – this is background work
  if (!shouldEndlesslyReplenish) return;

  try {
    const newQuestion = await fetchNewQuestion(sessionSettings, growthAreas);

    // keep both queues in sync
    setParentQueue((prev) => [...prev, newQuestion]);
    setQueue((prev) => [...prev, newQuestion]);
  } catch (err: any) {
    console.error("Failed to replenish queue:", err);
    // soft-fail: show a small error but don't kill the session
    setError(
      err?.message ||
        "Failed to load the next question. You can keep working with the current queue."
    );
  }
}, [
  shouldEndlesslyReplenish,
  sessionSettings,
  growthAreas,
  setParentQueue,
  setError,
]);

  // ---- ADVANCE TO NEXT QUESTION ----
  const showNextQuestion = useCallback(() => {
    setIsAnswered(false);
    setSelectedAnswerIndex(null);
    setShowRationale(false);
    setAlternateRationale(null);
    setIsExplainerLoading(false);
    setQuestionNumber((prev) => prev + 1);
    setEliminatedAnswers(new Set()); // Reset eliminated answers for new question

    setQueue((prev) => {
      if (prev.length === 0) return prev;

      const [, ...rest] = prev;
      const newQueue = rest;

      setParentQueue(newQueue);

      // Finite sessions: REVIEW / REVIEW FLAGGED
      if (!shouldEndlesslyReplenish && newQueue.length === 0) {
        onEndSession();
      }

      return newQueue;
    });

    // Endless sessions: ALL + SAME, ALL + other difficulties, topic, growth
    if (shouldEndlesslyReplenish) {
      void replenishQueue();
    }
  }, [
    setParentQueue,
    shouldEndlesslyReplenish,
    replenishQueue,
    onEndSession,
  ]);

  // Initialize from incoming queue once
  useEffect(() => {
    if (!currentQuestion && initialQueue.length > 0) {
      setCurrentQuestion(initialQueue[0]);
    }
    setLocalNote(initialQueue[0]?.userNote || "");
    setEliminatedAnswers(new Set()); // Reset when new question loaded
  }, [initialQueue, currentQuestion]);

  // Handler for toggling elimination state
  const handleToggleEliminate = useCallback((index: number) => {
    if (isAnswered) return;
    setEliminatedAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, [isAnswered]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement).tagName.toLowerCase() === "textarea"
      ) {
        return;
      }

      // Map letter keys to indices (A=0, B=1, C=2, D=3)
      const letterToIndex: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };

      // Shift + A/B/C/D to toggle elimination
      if (!isAnswered && event.shiftKey) {
        const eliminateIndex = letterToIndex[event.key.toLowerCase()];

        if (eliminateIndex !== undefined && currentQuestion?.options[eliminateIndex]) {
          event.preventDefault();
          handleToggleEliminate(eliminateIndex);
          return;
        }
      }

      // Regular A/B/C/D to select (only if not eliminated)
      if (!isAnswered && !event.shiftKey) {
        const index = letterToIndex[event.key.toLowerCase()];
        if (index !== undefined && !eliminatedAnswers.has(index)) {
          event.preventDefault();
          optionButtonsRef.current[index]?.click();
        }
      }

      if (isAnswered && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        nextButtonRef.current?.click();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAnswered, handleToggleEliminate, eliminatedAnswers, currentQuestion]);

  const handleOptionClick = (index: number) => {
    // Guard against selecting eliminated answers
    if (isAnswered || !currentQuestion || eliminatedAnswers.has(index)) return;

    setSelectedAnswerIndex(index);
    setIsAnswered(true);
    const isCorrect = index === currentQuestion.correctAnswerIndex;

    if (sessionSettings.focus === "review") {
      updateReviewQuestion(currentQuestion, isCorrect);
    } else {
      if (!isCorrect) {
        addMissedQuestion(currentQuestion);
      }
    }

    // Record detailed performance, including system/subcategory/condition
    addPerformanceRecord({
      timestamp: Date.now(),
      system: currentQuestion.system ?? null,
      subcategory: currentQuestion.subcategory ?? null,
      conditionId: currentQuestion.conditionId,
      condition: currentQuestion.condition,
      topic: currentQuestion.topic,
      isCorrect,
      focus: sessionSettings.focus,
      difficulty: sessionSettings.difficulty,
    });
  };

  const handleExplainDifferently = useCallback(async () => {
    if (!currentQuestion || selectedAnswerIndex === null) return;

    setIsExplainerLoading(true);
    setAlternateRationale(null);

    try {
      const userAnswer = currentQuestion.options[selectedAnswerIndex];
      const correctAnswer =
        currentQuestion.options[currentQuestion.correctAnswerIndex];
      const explanation = await generateAlternateRationale(
        currentQuestion,
        userAnswer,
        correctAnswer
      );
      setAlternateRationale(explanation);
    } catch (err) {
      if (err instanceof Error) {
        setAlternateRationale(
          `Sorry, an error occurred while generating a new explanation: ${err.message}`
        );
      } else {
        setAlternateRationale(
          "Sorry, an unknown error occurred while generating a new explanation."
        );
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
      .filter((p) => p.topic === currentQuestion.topic)
      .slice(-100);

    const correct = topicQuestions.filter((p) => p.isCorrect).length;
    const total = topicQuestions.length;
    const score = total > 0 ? (correct / total) * 100 : 0;

    return { score, correct, total };
  }, [isAnswered, currentQuestion, performanceData]);

  const getBarColor = (score: number): string => {
    if (score < 50) return "bg-red-500";
    if (score < 80) return "bg-yellow-500";
    return "bg-green-500";
  };

  // SESSION COMPLETE (finite modes only)
  if (!currentQuestion) {
    if (initialQueue.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center space-y-4">
          <h2 className="text-2xl font-bold mb-2">Session Complete</h2>
          <p className="text-[var(--color-text-secondary)]">
            You’ve reached the end of this set of questions.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center mt-2">
            <button
              onClick={onShowMenu}
              className="px-6 py-2 bg-[var(--color-accent)] text-white font-semibold rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors shadow-md"
            >
              Back to Dashboard
            </button>
            <button
              onClick={onEndSession}
              className="px-6 py-2 bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] font-semibold rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors border border-[var(--color-border)]"
            >
              End Session
            </button>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="flex flex-col">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4 mt-1">
          <div className="flex items-center space-x-3 min-w-0">
            {/* Back to dashboard */}
            <button
              onClick={onShowMenu}
              className="p-2 rounded-full bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors flex-shrink-0 flex items-center justify-center border border-[var(--color-border)]"
              aria-label="Back to Menu"
            >
              <ArrowLeftIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />
            </button>
            <p className="text-sm font-medium text-[var(--color-text-muted)] truncate">
              Question {questionNumber}
            </p>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* Flag */}
            <button
              onClick={toggleFlag}
              title={isFlagged ? "Unflag for review" : "Flag for review"}
              className={`p-1.5 rounded-full transition-colors border ${
                isFlagged
                  ? "bg-yellow-100 text-yellow-700 border-yellow-300"
                  : "bg-[var(--color-card-bg)] text-slate-600 border-[var(--color-border)] hover:bg-white hover:border-[var(--color-accent)]"
              }`}
            >
              <FlagIcon className="w-5 h-5" />
            </button>

            {/* Clear Highlights */}
            <button
              onClick={() => {
                const container =
                  document.getElementById("question-container");
                if (!container) return;
                const spans =
                  container.querySelectorAll("span.user-highlight");
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
              className="p-1.5 rounded-full bg-[var(--color-card-bg)] border border-[var(--color-border)] text-slate-600 hover:bg-white hover:border-[var(--color-accent)] transition-colors"
            >
              <ClearHighlightIcon className="w-5 h-5" />
            </button>

            {/* Font size controls */}
            <div className="flex items-center border border-[var(--color-border)] rounded-md bg-[var(--color-card-bg)]">
              <button
                onClick={() =>
                  setFontSizeAdjustment((prev) => prev - 1)
                }
                className="px-2 py-0.5 text-[var(--color-text-secondary)] hover:bg-white rounded-l-md text-sm"
                aria-label="Decrease font size"
              >
                A-
              </button>
              <div className="w-px h-4 bg-[#D0C7BF]"></div>
              <button
                onClick={() =>
                  setFontSizeAdjustment((prev) => prev + 1)
                }
                className="px-2 py-0.5 text-[var(--color-text-secondary)] hover:bg-white rounded-r-md text-sm"
                aria-label="Increase font size"
              >
                A+
              </button>
            </div>

            {/* End session */}
            <button
              onClick={onEndSession}
              title="End Session"
              className="p-1.5 rounded-full bg-[var(--color-card-bg)] border border-[var(--color-border)] text-slate-600 hover:bg-red-50 hover:border-red-400 hover:text-red-600 transition-colors"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        <QuestionDisplay text={currentQuestion.question} />
      </div>

      {/* ANSWER OPTIONS */}
      <div className="space-y-3 mt-6">
        {currentQuestion.options.map((option, index) => {
          const isCorrect = index === currentQuestion.correctAnswerIndex;
          const isSelected = index === selectedAnswerIndex;

          return (
            <AnswerChoice
              key={index}
              ref={(el) => {
                optionButtonsRef.current[index] = el;
              }}
              text={option}
              index={index}
              isSelected={isSelected}
              isCorrect={isCorrect}
              isAnswered={isAnswered}
              isEliminated={eliminatedAnswers.has(index)}
              onSelect={handleOptionClick}
              onToggleEliminate={handleToggleEliminate}
              fontSizeAdjustment={fontSizeAdjustment}
            />
          );
        })}
      </div>

      {/* FEEDBACK / RATIONALE */}
      {isAnswered && (
        <div className="mt-6 animate-fade-in space-y-4">
          {topicStats && (
            <div className="p-4 bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-lg">
              <div className="flex justify-between items-center mb-1 text-sm">
                <span className="font-semibold text-[var(--color-text-secondary)]">
                  {currentQuestion.topic}
                </span>
                <span className="font-medium text-[var(--color-text-muted)]">
                  {topicStats.score.toFixed(0)}% (
                  {topicStats.correct}/{topicStats.total})
                </span>
              </div>
              <div className="w-full bg-[var(--color-bg-secondary)] rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full ${getBarColor(
                    topicStats.score
                  )} transition-all duration-500 ease-out`}
                  style={{ width: `${topicStats.score}%` }}
                ></div>
              </div>
            </div>
          )}

          <div className="p-4 bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-lg feedback-content">
            <h3 className="font-bold text-lg mb-2 text-[var(--color-text-primary)]">
              Rationale
            </h3>
            <div
              className="text-[var(--color-text-secondary)] leading-relaxed"
              dangerouslySetInnerHTML={{ __html: currentQuestion.rationale }}
            />

            {selectedAnswerIndex !==
              currentQuestion.correctAnswerIndex && (
              <div className="mt-4">
                <button
                  onClick={handleExplainDifferently}
                  disabled={isExplainerLoading}
                  className="px-4 py-2 bg-[#E6A495] text-[var(--color-accent)] font-semibold rounded-lg hover:bg-[#d99282] transition-colors text-sm disabled:opacity-50 disabled:cursor-wait"
                >
                  {isExplainerLoading
                    ? "Thinking..."
                    : "Explain this differently"}
                </button>
              </div>
            )}

            {isExplainerLoading && (
              <div className="mt-4 flex items-center space-x-2 text-[var(--color-text-secondary)]">
                <div className="w-2 h-2 bg-slate-500 rounded-full animate-pulse"></div>
                <div
                  className="w-2 h-2 bg-slate-500 rounded-full animate-pulse"
                  style={{ animationDelay: "0.2s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-slate-500 rounded-full animate-pulse"
                  style={{ animationDelay: "0.4s" }}
                ></div>
                <span className="text-sm">
                  Generating new explanation...
                </span>
              </div>
            )}

            {alternateRationale && !isExplainerLoading && (
              <div className="mt-4 pt-4 border-t border-slate-200 animate-fade-in">
                <h4 className="font-bold text-md mb-2 text-[var(--color-text-primary)]">
                  Alternate Explanation
                </h4>
                <p className="text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
                  {alternateRationale}
                </p>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-slate-200">
              <h3 className="font-bold text-lg mb-2 text-[var(--color-text-primary)]">
                Key Pearls: {currentQuestion.condition}
              </h3>
              <ul className="list-disc list-inside space-y-1 text-[var(--color-text-secondary)]">
                {currentQuestion.pearls.map((pearl, index) => (
                  <li
                    key={index}
                    dangerouslySetInnerHTML={{ __html: pearl }}
                  />
                ))}
              </ul>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200">
              <h3 className="font-bold text-lg mb-2 text-[var(--color-text-primary)]">
                My Notes
              </h3>
              <textarea
                value={localNote}
                onChange={handleNoteChange}
                placeholder="Type your notes here... They will be saved automatically."
                className="w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
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
            className="px-8 py-3 btn-glass font-bold rounded-lg"
          >
            Next Question
          </button>
        </div>
      )}
    </div>
  );
};

export default QuizView;
