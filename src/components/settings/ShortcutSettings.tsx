/**
 * ShortcutSettings - Keyboard Shortcut Configuration Panel
 *
 * Allows users to view and customize keyboard shortcuts for the application.
 * Features:
 * - Visual display of all shortcuts
 * - Click-to-rebind interface
 * - Key conflict detection
 * - Reset to defaults
 * - Dark mode theme
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Keyboard, AlertCircle, Check } from 'lucide-react';
import {
  useShortcutContext,
  type ShortcutAction,
  formatKeyForDisplay,
  getActionDisplayName,
  isKeyConflict,
} from '../../context/ShortcutContext';

interface ShortcutSettingsProps {
  /** Optional callback when shortcuts are updated */
  onUpdate?: () => void;
  /** Optional CSS class for container */
  className?: string;
}

export const ShortcutSettings: React.FC<ShortcutSettingsProps> = ({ onUpdate, className = '' }) => {
  const { shortcuts, updateShortcut, resetShortcuts } = useShortcutContext();
  const [listeningFor, setListeningFor] = useState<ShortcutAction | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // List of all actions in display order
  const actions: ShortcutAction[] = [
    'FLIP_CARD',
    'MARK_CORRECT',
    'MARK_WRONG',
    'NEXT_QUESTION',
    'PREV_QUESTION',
    'PLAY_AUDIO',
    'TOGGLE_STATS',
  ];

  // Handle key capture when listening
  useEffect(() => {
    if (!listeningFor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      // Cancel on Escape
      if (event.key === 'Escape') {
        setListeningFor(null);
        return;
      }

      const newKey = event.key;

      // Check for conflicts
      const conflictAction = isKeyConflict(shortcuts, newKey, listeningFor);
      if (conflictAction) {
        setConflictWarning(
          `Key "${formatKeyForDisplay(newKey)}" is already assigned to ${getActionDisplayName(conflictAction)}`
        );
        setTimeout(() => setConflictWarning(null), 3000);
        setListeningFor(null);
        return;
      }

      // Update the shortcut
      updateShortcut(listeningFor, newKey);
      setListeningFor(null);

      // Show success message
      setSuccessMessage(
        `${getActionDisplayName(listeningFor)} set to "${formatKeyForDisplay(newKey)}"`
      );
      setTimeout(() => setSuccessMessage(null), 2000);

      // Notify parent component
      if (onUpdate) {
        onUpdate();
      }
    };

    // Add listener
    window.addEventListener('keydown', handleKeyDown, true);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [listeningFor, shortcuts, updateShortcut, onUpdate]);

  // Handle click outside to cancel listening
  useEffect(() => {
    if (!listeningFor) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setListeningFor(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [listeningFor]);

  // Handle reset to defaults
  const handleReset = () => {
    resetShortcuts();
    setSuccessMessage('Shortcuts reset to defaults');
    setTimeout(() => setSuccessMessage(null), 2000);

    if (onUpdate) {
      onUpdate();
    }
  };

  // Start listening for a key
  const startListening = (action: ShortcutAction) => {
    setListeningFor(action);
    setConflictWarning(null);
  };

  return (
    <div
      ref={containerRef}
      className={`bg-slate-900 rounded-xl border border-slate-700 p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Keyboard className="w-6 h-6 text-blue-400" />
          <h2 className="text-2xl font-bold text-slate-100">Keyboard Shortcuts</h2>
        </div>

        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-600"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="text-sm font-medium">Reset to Defaults</span>
        </button>
      </div>

      {/* Instructions */}
      <p className="text-slate-400 text-sm mb-6">
        Click any shortcut button to rebind it. Press{' '}
        <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-600 text-xs">Escape</kbd>{' '}
        to cancel.
      </p>

      {/* Success Message */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 mb-4 px-4 py-3 bg-green-900/30 border border-green-700 rounded-lg"
          >
            <Check className="w-5 h-5 text-green-400" />
            <span className="text-green-300 text-sm">{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conflict Warning */}
      <AnimatePresence>
        {conflictWarning && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 mb-4 px-4 py-3 bg-red-900/30 border border-red-700 rounded-lg"
          >
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-300 text-sm">{conflictWarning}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shortcut List */}
      <div className="space-y-3">
        {actions.map((action) => {
          const currentKey = shortcuts[action];
          const isListening = listeningFor === action;
          const displayName = getActionDisplayName(action);
          const displayKey = formatKeyForDisplay(currentKey);

          return (
            <motion.div
              key={action}
              layout
              className="flex items-center justify-between p-4 bg-slate-800 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
            >
              {/* Action Name */}
              <div className="flex-1">
                <h3 className="text-slate-100 font-medium">{displayName}</h3>
                <p className="text-slate-500 text-xs mt-1">{getActionDescription(action)}</p>
              </div>

              {/* Key Button */}
              <button
                onClick={() => startListening(action)}
                disabled={isListening}
                className={`
                  min-w-[120px] px-6 py-3 rounded-lg font-mono text-sm font-bold transition-all
                  ${
                    isListening
                      ? 'bg-blue-600 text-white border-2 border-blue-400 animate-pulse'
                      : 'bg-slate-700 text-slate-200 border-2 border-slate-600 hover:border-blue-500 hover:bg-slate-600'
                  }
                `}
              >
                {isListening ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                    Press any key...
                  </span>
                ) : (
                  <span className="tracking-wider">[ {displayKey} ]</span>
                )}
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Footer Note */}
      <div className="mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <p className="text-slate-400 text-xs">
          <strong className="text-slate-300">Note:</strong> Shortcuts are automatically saved to
          your browser's local storage. They will not trigger when you are typing in text fields.
        </p>
      </div>
    </div>
  );
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get a brief description for each action
 */
function getActionDescription(action: ShortcutAction): string {
  const descriptions: Record<ShortcutAction, string> = {
    FLIP_CARD: 'Reveal the answer on a flashcard',
    MARK_CORRECT: 'Mark current question as correct',
    MARK_WRONG: 'Mark current question as incorrect',
    NEXT_QUESTION: 'Navigate to the next question',
    PREV_QUESTION: 'Navigate to the previous question',
    PLAY_AUDIO: 'Play audio pronunciation or explanation',
    TOGGLE_STATS: 'Show/hide session statistics overlay',
  };

  return descriptions[action];
}

// ============================================================================
// COMPACT VERSION (Optional Alternative)
// ============================================================================

/**
 * Compact version of ShortcutSettings for smaller UI spaces
 */
export const ShortcutSettingsCompact: React.FC<ShortcutSettingsProps> = ({
  onUpdate,
  className = '',
}) => {
  const { shortcuts, updateShortcut, resetShortcuts } = useShortcutContext();
  const [listeningFor, setListeningFor] = useState<ShortcutAction | null>(null);

  const actions: ShortcutAction[] = [
    'FLIP_CARD',
    'MARK_CORRECT',
    'MARK_WRONG',
    'NEXT_QUESTION',
    'PREV_QUESTION',
    'PLAY_AUDIO',
    'TOGGLE_STATS',
  ];

  useEffect(() => {
    if (!listeningFor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      if (event.key === 'Escape') {
        setListeningFor(null);
        return;
      }
      updateShortcut(listeningFor, event.key);
      setListeningFor(null);
      if (onUpdate) onUpdate();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [listeningFor, updateShortcut, onUpdate]);

  return (
    <div className={`bg-slate-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-slate-100 font-semibold text-sm">Shortcuts</h3>
        <button onClick={resetShortcuts} className="text-xs text-slate-400 hover:text-slate-200">
          Reset
        </button>
      </div>

      <div className="space-y-2">
        {actions.map((action) => (
          <div key={action} className="flex items-center justify-between text-sm">
            <span className="text-slate-400">{getActionDisplayName(action)}</span>
            <button
              onClick={() => setListeningFor(action)}
              className={`
                px-3 py-1 rounded font-mono text-xs
                ${
                  listeningFor === action
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }
              `}
            >
              {listeningFor === action ? 'Press key...' : formatKeyForDisplay(shortcuts[action])}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ShortcutSettings;
