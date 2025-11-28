// components/photo-mode/PhotoChoices.tsx
// Hybrid component: Type-ahead Search and Multiple Choice for diagnosis selection

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { DiagnosisOption, InputMode } from "../../types/photoMode";

interface PhotoChoicesProps {
  options: DiagnosisOption[];
  allDiagnoses: DiagnosisOption[];
  onSelect: (diagnosis: DiagnosisOption) => void;
  inputMode: InputMode;
  onModeChange: (mode: InputMode) => void;
  disabled?: boolean;
  startTime: number;
}

/**
 * PhotoChoices - Hybrid component for diagnosis selection
 * Supports both type-ahead search and multiple choice modes
 */
const PhotoChoices: React.FC<PhotoChoicesProps> = ({
  options,
  allDiagnoses,
  onSelect,
  inputMode,
  onModeChange,
  disabled = false,
  startTime,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Focus input when in typeahead mode
  useEffect(() => {
    if (inputMode === "typeahead" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputMode]);

  // Filter diagnoses based on search query
  const filteredDiagnoses = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase().trim();
    return allDiagnoses
      .filter((d) => {
        const nameMatch = d.name.toLowerCase().includes(query);
        const systemMatch = d.system.toLowerCase().includes(query);
        const subcategoryMatch = d.subcategory?.toLowerCase().includes(query);
        const featureMatch = d.keyFeatures.some((f) =>
          f.toLowerCase().includes(query)
        );
        return nameMatch || systemMatch || subcategoryMatch || featureMatch;
      })
      .slice(0, 10); // Limit results
  }, [searchQuery, allDiagnoses]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
      setHighlightedIndex(-1);
    },
    []
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            Math.min(prev + 1, filteredDiagnoses.length - 1)
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && filteredDiagnoses[highlightedIndex]) {
            onSelect(filteredDiagnoses[highlightedIndex]);
          }
          break;
        case "Escape":
          setSearchQuery("");
          setHighlightedIndex(-1);
          break;
      }
    },
    [disabled, filteredDiagnoses, highlightedIndex, onSelect]
  );

  const handleOptionClick = useCallback(
    (diagnosis: DiagnosisOption) => {
      if (disabled) return;
      onSelect(diagnosis);
    },
    [disabled, onSelect]
  );

  // Keyboard navigation for multiple choice
  useEffect(() => {
    if (inputMode !== "multiple-choice" || disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "1" && e.key <= "4") {
        const index = parseInt(e.key) - 1;
        if (options[index]) {
          onSelect(options[index]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inputMode, disabled, options, onSelect]);

  return (
    <div className="w-full">
      {/* Mode Toggle */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-200">
          What is your diagnosis?
        </h3>
        <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => onModeChange("multiple-choice")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              inputMode === "multiple-choice"
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
            disabled={disabled}
          >
            Multiple Choice
          </button>
          <button
            onClick={() => onModeChange("typeahead")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              inputMode === "typeahead"
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
            disabled={disabled}
          >
            Type to Search
          </button>
        </div>
      </div>

      {/* Type-ahead Search Mode */}
      {inputMode === "typeahead" && (
        <div className="relative">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              placeholder="Start typing a diagnosis..."
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={disabled}
              autoComplete="off"
            />
            <svg
              className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Search Results Dropdown */}
          {searchQuery && filteredDiagnoses.length > 0 && (
            <ul
              ref={listRef}
              className="absolute z-10 w-full mt-2 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-64 overflow-y-auto"
            >
              {filteredDiagnoses.map((diagnosis, index) => (
                <li key={diagnosis.id}>
                  <button
                    onClick={() => handleOptionClick(diagnosis)}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      index === highlightedIndex
                        ? "bg-blue-600 text-white"
                        : "text-gray-200 hover:bg-gray-700"
                    } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    disabled={disabled}
                  >
                    <div className="font-medium">{diagnosis.name}</div>
                    <div className="text-sm opacity-75">
                      {diagnosis.system}
                      {diagnosis.subcategory && ` • ${diagnosis.subcategory}`}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* No Results Message */}
          {searchQuery && filteredDiagnoses.length === 0 && (
            <div className="absolute z-10 w-full mt-2 px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-gray-400 text-center">
              No matching diagnoses found
            </div>
          )}

          {/* Hint */}
          {!searchQuery && (
            <p className="mt-2 text-sm text-gray-500">
              Use ↑↓ to navigate, Enter to select, Esc to clear
            </p>
          )}
        </div>
      )}

      {/* Multiple Choice Mode */}
      {inputMode === "multiple-choice" && (
        <div className="space-y-3">
          {options.map((option, index) => (
            <button
              key={option.id}
              onClick={() => handleOptionClick(option)}
              className={`w-full p-4 text-left rounded-lg border transition-all ${
                disabled
                  ? "opacity-50 cursor-not-allowed bg-gray-800 border-gray-700"
                  : "bg-gray-800 border-gray-600 hover:bg-gray-700 hover:border-blue-500 hover:shadow-lg active:scale-[0.99]"
              }`}
              disabled={disabled}
            >
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-gray-700 rounded-lg text-blue-400 font-bold">
                  {index + 1}
                </span>
                <div className="flex-grow">
                  <div className="font-semibold text-gray-200">{option.name}</div>
                  <div className="text-sm text-gray-400 mt-1">
                    {option.system}
                    {option.subcategory && ` • ${option.subcategory}`}
                  </div>
                </div>
              </div>
            </button>
          ))}
          
          {/* Keyboard Shortcut Hint */}
          <p className="text-center text-sm text-gray-500 mt-4">
            Press 1-4 to quickly select an answer
          </p>
        </div>
      )}
    </div>
  );
};

export default PhotoChoices;
