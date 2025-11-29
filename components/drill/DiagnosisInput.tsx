import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MASTER_CONDITION_LIST } from '@/hooks/game/use-photo-drill';

/** Delay in ms before closing dropdown on blur, allows click events to register */
const BLUR_DELAY_MS = 150;

/**
 * Re-export for backwards compatibility.
 * @deprecated Use MASTER_CONDITION_LIST from use-photo-drill.ts instead.
 */
export const ALL_CONDITIONS: string[] = MASTER_CONDITION_LIST;

interface DiagnosisInputProps {
  onSubmit: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Optional list of valid diagnoses to filter against. Defaults to MASTER_CONDITION_LIST. */
  options?: string[];
}

/**
 * DiagnosisInput - Command Palette style input for medical diagnosis selection.
 * 
 * Provides autocomplete functionality with keyboard navigation for selecting
 * from a list of medical conditions.
 */
const DiagnosisInput: React.FC<DiagnosisInputProps> = ({
  onSubmit,
  disabled = false,
  autoFocus = false,
  options = MASTER_CONDITION_LIST,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Filter conditions based on input (case-insensitive)
  const filteredConditions = inputValue.trim()
    ? options.filter((condition) =>
        condition.toLowerCase().includes(inputValue.toLowerCase())
      )
    : [];

  // Reset highlighted index when filtered results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredConditions.length]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current && isOpen) {
      const highlightedItem = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedItem) {
        highlightedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setIsOpen(value.trim().length > 0);
  };

  const handleSelect = (condition: string) => {
    setInputValue('');
    setIsOpen(false);
    onSubmit(condition);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filteredConditions.length === 0) {
      // If dropdown is closed, Enter submits the raw input
      if (e.key === 'Enter' && inputValue.trim()) {
        e.preventDefault();
        handleSelect(inputValue.trim());
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredConditions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredConditions[highlightedIndex]) {
          handleSelect(filteredConditions[highlightedIndex]);
        } else if (inputValue.trim()) {
          handleSelect(inputValue.trim());
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  const handleBlur = () => {
    // Delay closing to allow click events on dropdown items
    setTimeout(() => {
      setIsOpen(false);
    }, BLUR_DELAY_MS);
  };

  const handleFocus = () => {
    if (inputValue.trim()) {
      setIsOpen(true);
    }
  };

  // Animation variants for dropdown
  const dropdownVariants = {
    initial: { opacity: 0, y: -8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  };

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleFocus}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder="Type a diagnosis..."
        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Diagnosis input"
        aria-autocomplete="list"
        aria-controls="diagnosis-dropdown"
        aria-expanded={isOpen && filteredConditions.length > 0}
      />

      <AnimatePresence>
        {isOpen && filteredConditions.length > 0 && (
          <motion.div
            variants={dropdownVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 right-0 mb-2 z-50"
          >
            <ul
              ref={listRef}
              id="diagnosis-dropdown"
              role="listbox"
              className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto"
            >
              {filteredConditions.map((condition, index) => (
                <li
                  key={condition}
                  role="option"
                  aria-selected={index === highlightedIndex}
                  onClick={() => handleSelect(condition)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`px-4 py-2.5 cursor-pointer transition-colors ${
                    index === highlightedIndex
                      ? 'bg-slate-700 text-slate-100'
                      : 'text-slate-300 hover:bg-slate-700/50'
                  }`}
                >
                  <HighlightedText text={condition} query={inputValue} />
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Helper component to highlight matching text in dropdown options.
 */
const HighlightedText: React.FC<{ text: string; query: string }> = ({
  text,
  query,
}) => {
  if (!query.trim()) return <>{text}</>;

  const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
  const parts = text.split(regex);
  const queryLower = query.toLowerCase();

  return (
    <>
      {parts.map((part, index) => {
        const isMatch = part.toLowerCase() === queryLower;
        const key = `${index}-${isMatch ? 'match' : 'text'}-${part}`;
        return isMatch ? (
          <span key={key} className="text-sky-400 font-medium">
            {part}
          </span>
        ) : (
          <span key={key}>{part}</span>
        );
      })}
    </>
  );
};

/**
 * Escape special regex characters in a string.
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default DiagnosisInput;
