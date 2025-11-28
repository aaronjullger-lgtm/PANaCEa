// components/photo-mode/GlobalPhotoMode.tsx
// Main container component managing the photo drill state machine

import React, { useState, useCallback, useEffect, useRef } from "react";
import PhotoViewer from "./PhotoViewer";
import PhotoChoices from "./PhotoChoices";
import PhotoResultPanel from "./PhotoResultPanel";
import { usePhotoDrill } from "../../hooks/usePhotoDrill";
import type { DiagnosisOption, InputMode, PhotoDrillFilters } from "../../types/photoMode";
import type { SystemCode } from "../../types";

interface GlobalPhotoModeProps {
  /** Initial filters for the drill */
  initialFilters?: PhotoDrillFilters;
  /** Callback when session ends */
  onEndSession?: () => void;
  /** Callback to return to menu */
  onBackToMenu?: () => void;
}

/**
 * GlobalPhotoMode - Main container for the photo drill system
 * Manages state machine: view -> answering -> feedback -> ddx_comparison
 */
const GlobalPhotoMode: React.FC<GlobalPhotoModeProps> = ({
  initialFilters,
  onEndSession,
  onBackToMenu,
}) => {
  const {
    session,
    isLoading,
    error,
    loadNextQuestion,
    startAnswering,
    submitAnswer,
    proceedToNext,
    setInputMode,
    resetSession,
    allDiagnoses,
    currentOptions,
  } = usePhotoDrill({ filters: initialFilters });

  const [answerStartTime, setAnswerStartTime] = useState<number>(0);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<PhotoDrillFilters>(
    initialFilters || {}
  );

  const containerRef = useRef<HTMLDivElement>(null);

  // Start timer when entering answering phase
  useEffect(() => {
    if (session.state === "answering") {
      setAnswerStartTime(Date.now());
    }
  }, [session.state]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Enter to proceed in feedback/ddx_comparison states
      if (
        (session.state === "feedback" || session.state === "ddx_comparison") &&
        e.key === "Enter"
      ) {
        handleNext();
      }

      // Handle Escape to go back to menu
      if (e.key === "Escape" && onBackToMenu) {
        onBackToMenu();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [session.state, onBackToMenu]);

  const handleStartAnswering = useCallback(() => {
    startAnswering();
  }, [startAnswering]);

  const handleSelectAnswer = useCallback(
    (answer: DiagnosisOption) => {
      const timeTaken = Date.now() - answerStartTime;
      submitAnswer(answer, timeTaken);
    },
    [submitAnswer, answerStartTime]
  );

  const handleNext = useCallback(async () => {
    proceedToNext();
    await loadNextQuestion();
  }, [proceedToNext, loadNextQuestion]);

  const handleModeChange = useCallback(
    (mode: InputMode) => {
      setInputMode(mode);
    },
    [setInputMode]
  );

  const handleEndSession = useCallback(() => {
    resetSession();
    onEndSession?.();
  }, [resetSession, onEndSession]);

  // Get the last answered question for result panel
  const lastAnsweredQuestion =
    session.answeredQuestions[session.answeredQuestions.length - 1];

  // Calculate score percentage
  const scorePercentage =
    session.score.total > 0
      ? Math.round((session.score.correct / session.score.total) * 100)
      : 0;

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-[#0a0a14] text-white"
    >
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#0a0a14]/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBackToMenu && (
              <button
                onClick={onBackToMenu}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                aria-label="Back to menu"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold text-white">Photo Mode</h1>
              <p className="text-sm text-gray-400">
                Visual Pattern Recognition Drill
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Score Display */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg">
              <span className="text-sm text-gray-400">Score:</span>
              <span className="font-bold text-blue-400">
                {session.score.correct}/{session.score.total}
              </span>
              {session.score.total > 0 && (
                <span
                  className={`text-sm ${
                    scorePercentage >= 80
                      ? "text-green-400"
                      : scorePercentage >= 60
                      ? "text-yellow-400"
                      : "text-red-400"
                  }`}
                >
                  ({scorePercentage}%)
                </span>
              )}
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
              aria-label="Toggle filters"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
            </button>

            {/* End Session */}
            <button
              onClick={handleEndSession}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="End session"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="border-t border-gray-800 bg-gray-900/50 px-4 py-3">
            <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <span>System:</span>
                <select
                  value={filters.system || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    const validSystems: SystemCode[] = ["CV", "DERM", "PULM", "MSK", "HEENT", "NEURO", "ENDO", "GI", "GU", "HEME", "ID", "PSYCH", "RENAL", "REPRO", "PRO", "OTHER"];
                    const system = validSystems.includes(value as SystemCode) ? (value as SystemCode) : undefined;
                    setFilters({
                      ...filters,
                      system,
                    });
                  }}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm"
                >
                  <option value="">All Systems</option>
                  <option value="CV">Cardiovascular</option>
                  <option value="DERM">Dermatology</option>
                  <option value="PULM">Pulmonary</option>
                  <option value="MSK">Musculoskeletal</option>
                  <option value="HEENT">HEENT</option>
                  <option value="NEURO">Neurology</option>
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-300">
                <span>Image Type:</span>
                <select
                  value={filters.mediaType || ""}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      mediaType:
                        (e.target.value as any) || undefined,
                    })
                  }
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm"
                >
                  <option value="">All Types</option>
                  <option value="ecg">ECG</option>
                  <option value="xray">X-Ray</option>
                  <option value="ct">CT</option>
                  <option value="mri">MRI</option>
                  <option value="derm">Dermatology</option>
                  <option value="fundoscopy">Fundoscopy</option>
                </select>
              </label>

              <button
                onClick={() => setFilters({})}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !session.currentQuestion && (
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-400">Loading medical image...</p>
          </div>
        )}

        {/* Main Drill Interface */}
        {session.currentQuestion && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Image Panel */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <PhotoViewer
                  media={session.currentQuestion.media}
                  onStartAnswering={
                    session.state === "view" ? handleStartAnswering : undefined
                  }
                  isInteractive={session.state === "view"}
                />
              </div>
            </div>

            {/* Interaction Panel */}
            <div className="lg:col-span-1">
              {/* State: View - Show prompt to start */}
              {session.state === "view" && (
                <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                  <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700 max-w-md">
                    <svg
                      className="w-16 h-16 mx-auto mb-4 text-blue-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    <h3 className="text-xl font-bold text-white mb-2">
                      Study the Image
                    </h3>
                    <p className="text-gray-400 mb-4">
                      Examine the medical image carefully. Zoom in on details
                      using scroll or the controls. When ready, click "Ready to
                      Diagnose" to make your diagnosis.
                    </p>
                    <p className="text-sm text-gray-500">
                      Image Type:{" "}
                      <span className="text-blue-400 uppercase">
                        {session.currentQuestion.media.type}
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* State: Answering - Show choices */}
              {session.state === "answering" && (
                <div className="animate-fade-in">
                  <PhotoChoices
                    options={currentOptions}
                    allDiagnoses={allDiagnoses}
                    onSelect={handleSelectAnswer}
                    inputMode={session.inputMode}
                    onModeChange={handleModeChange}
                    startTime={answerStartTime}
                  />
                </div>
              )}

              {/* State: Feedback / DDx Comparison - Show results */}
              {(session.state === "feedback" ||
                session.state === "ddx_comparison") &&
                lastAnsweredQuestion && (
                  <div className="animate-fade-in">
                    <PhotoResultPanel
                      isCorrect={lastAnsweredQuestion.isCorrect}
                      userChoice={lastAnsweredQuestion.userAnswer}
                      correctAnswer={
                        lastAnsweredQuestion.question.correctDiagnosis
                      }
                      media={lastAnsweredQuestion.question.media}
                      timeTaken={lastAnsweredQuestion.timeTaken}
                      onContinue={handleNext}
                    />
                  </div>
                )}
            </div>
          </div>
        )}

        {/* Session Summary (when no current question) */}
        {!session.currentQuestion && !isLoading && session.score.total > 0 && (
          <div className="max-w-lg mx-auto text-center py-12">
            <h2 className="text-2xl font-bold text-white mb-4">
              Session Complete!
            </h2>
            <div className="p-6 bg-gray-800 rounded-xl mb-6">
              <div className="text-4xl font-bold text-blue-400 mb-2">
                {session.score.correct}/{session.score.total}
              </div>
              <div
                className={`text-lg ${
                  scorePercentage >= 80
                    ? "text-green-400"
                    : scorePercentage >= 60
                    ? "text-yellow-400"
                    : "text-red-400"
                }`}
              >
                {scorePercentage}% Accuracy
              </div>
            </div>

            {/* Confusion Map Summary */}
            {Object.keys(session.confusionMap).length > 0 && (
              <div className="text-left p-4 bg-gray-800/50 rounded-xl mb-6">
                <h3 className="text-lg font-semibold text-white mb-3">
                  Areas for Review:
                </h3>
                <ul className="space-y-2">
                  {Object.entries(session.confusionMap).map(
                    ([diagnosisId, confusions]) => {
                      const diagnosis = allDiagnoses.find(
                        (d) => d.id === diagnosisId
                      );
                      return (
                        <li key={diagnosisId} className="text-gray-300 text-sm">
                          <span className="text-red-400">
                            {diagnosis?.name || diagnosisId}
                          </span>
                          <span className="text-gray-500">
                            {" "}
                            confused with:{" "}
                          </span>
                          <span className="text-yellow-400">
                            {confusions.map((c) => c.mistakenName).join(", ")}
                          </span>
                        </li>
                      );
                    }
                  )}
                </ul>
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => loadNextQuestion()}
                className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Continue Drilling
              </button>
              {onBackToMenu && (
                <button
                  onClick={onBackToMenu}
                  className="px-6 py-3 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Back to Menu
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default GlobalPhotoMode;
