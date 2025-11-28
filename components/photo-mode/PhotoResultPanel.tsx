// components/photo-mode/PhotoResultPanel.tsx
// Shows correctness and DDx Comparison for incorrect answers

import React from "react";
import type { DiagnosisOption, MediaAsset } from "../../types/photoMode";

interface PhotoResultPanelProps {
  isCorrect: boolean;
  userChoice: DiagnosisOption;
  correctAnswer: DiagnosisOption;
  media: MediaAsset;
  timeTaken: number;
  onContinue: () => void;
}

/**
 * PhotoResultPanel - Displays feedback and DDx comparison
 * Shows side-by-side comparison when user answers incorrectly
 */
const PhotoResultPanel: React.FC<PhotoResultPanelProps> = ({
  isCorrect,
  userChoice,
  correctAnswer,
  media,
  timeTaken,
  onContinue,
}) => {
  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="w-full">
      {/* Result Header */}
      <div
        className={`p-4 rounded-lg mb-6 ${
          isCorrect
            ? "bg-green-900/50 border border-green-700"
            : "bg-red-900/50 border border-red-700"
        }`}
      >
        <div className="flex items-center gap-3">
          {isCorrect ? (
            <div className="w-12 h-12 flex items-center justify-center bg-green-600 rounded-full">
              <svg
                className="w-7 h-7 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          ) : (
            <div className="w-12 h-12 flex items-center justify-center bg-red-600 rounded-full">
              <svg
                className="w-7 h-7 text-white"
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
            </div>
          )}
          <div>
            <h3
              className={`text-xl font-bold ${
                isCorrect ? "text-green-400" : "text-red-400"
              }`}
            >
              {isCorrect ? "Correct!" : "Incorrect"}
            </h3>
            <p className="text-sm text-gray-400">
              Answered in {formatTime(timeTaken)}
            </p>
          </div>
        </div>
      </div>

      {/* DDx Comparison Panel - Only shown when incorrect */}
      {!isCorrect && (
        <div className="mb-6">
          <h4 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-yellow-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            Confusion Mapping: DDx Comparison
          </h4>

          <div className="grid md:grid-cols-2 gap-4">
            {/* User's Choice (Incorrect) */}
            <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <svg
                  className="w-5 h-5 text-red-400"
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
                <span className="text-sm font-medium text-red-400 uppercase tracking-wide">
                  Your Answer
                </span>
              </div>
              <h5 className="text-lg font-bold text-white mb-2">
                {userChoice.name}
              </h5>
              <p className="text-sm text-gray-400 mb-3">
                {userChoice.system}
                {userChoice.subcategory && ` • ${userChoice.subcategory}`}
              </p>

              <div className="mt-3 pt-3 border-t border-red-800">
                <p className="text-sm font-medium text-gray-300 mb-2">
                  Key Features:
                </p>
                <ul className="space-y-1">
                  {userChoice.keyFeatures.map((feature, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-gray-400 flex items-start gap-2"
                    >
                      <span className="text-red-400 mt-1">•</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {userChoice.rationale && (
                <div className="mt-3 pt-3 border-t border-red-800">
                  <p className="text-sm text-gray-300">
                    <span className="font-medium text-red-400">Why not: </span>
                    {userChoice.rationale}
                  </p>
                </div>
              )}
            </div>

            {/* Correct Answer */}
            <div className="p-4 bg-green-900/30 border border-green-800 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <svg
                  className="w-5 h-5 text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-sm font-medium text-green-400 uppercase tracking-wide">
                  Correct Answer
                </span>
              </div>
              <h5 className="text-lg font-bold text-white mb-2">
                {correctAnswer.name}
              </h5>
              <p className="text-sm text-gray-400 mb-3">
                {correctAnswer.system}
                {correctAnswer.subcategory && ` • ${correctAnswer.subcategory}`}
              </p>

              <div className="mt-3 pt-3 border-t border-green-800">
                <p className="text-sm font-medium text-gray-300 mb-2">
                  Key Features (Look for these):
                </p>
                <ul className="space-y-1">
                  {correctAnswer.keyFeatures.map((feature, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-gray-400 flex items-start gap-2"
                    >
                      <span className="text-green-400 mt-1">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {correctAnswer.rationale && (
                <div className="mt-3 pt-3 border-t border-green-800">
                  <p className="text-sm text-gray-300">
                    <span className="font-medium text-green-400">
                      Why correct:{" "}
                    </span>
                    {correctAnswer.rationale}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Learning Tip */}
          <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-800 rounded-lg">
            <div className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-sm text-yellow-200">
                <strong>Learning Tip:</strong> Compare the key features above.
                Notice how {correctAnswer.name} differs from {userChoice.name}{" "}
                in its presentation. This confusion pattern has been recorded to
                help you review similar cases.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Correct Answer Display - When user got it right */}
      {isCorrect && (
        <div className="mb-6 p-4 bg-gray-800 border border-gray-700 rounded-lg">
          <h5 className="text-lg font-bold text-white mb-2">
            {correctAnswer.name}
          </h5>
          <p className="text-sm text-gray-400 mb-3">
            {correctAnswer.system}
            {correctAnswer.subcategory && ` • ${correctAnswer.subcategory}`}
          </p>
          <div className="pt-3 border-t border-gray-700">
            <p className="text-sm font-medium text-gray-300 mb-2">
              Key Features:
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {correctAnswer.keyFeatures.map((feature, idx) => (
                <li
                  key={idx}
                  className="text-sm text-gray-400 flex items-center gap-2"
                >
                  <span className="text-green-400">✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
          {correctAnswer.rationale && (
            <p className="mt-3 pt-3 border-t border-gray-700 text-sm text-gray-300">
              {correctAnswer.rationale}
            </p>
          )}
        </div>
      )}

      {/* Image Reference */}
      <div className="mb-6 p-4 bg-gray-800 border border-gray-700 rounded-lg">
        <p className="text-sm text-gray-400 mb-2">Reference Image:</p>
        <div className="flex items-center gap-3">
          <img
            src={media.thumbnailUrl || media.url}
            alt={media.altText}
            className="w-16 h-16 object-cover rounded-lg"
          />
          <div>
            <p className="text-sm text-gray-300 font-medium uppercase">
              {media.type}
            </p>
            <p className="text-xs text-gray-500">Source: {media.source}</p>
          </div>
        </div>
      </div>

      {/* Continue Button */}
      <button
        onClick={onContinue}
        className="w-full py-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        Next Image
        <span className="ml-2 text-sm opacity-75">(Enter)</span>
      </button>
    </div>
  );
};

export default PhotoResultPanel;
