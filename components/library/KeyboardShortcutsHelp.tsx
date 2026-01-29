/**
 * KeyboardShortcutsHelp - Modal showing available keyboard shortcuts
 *
 * Quick reference for power users
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  description: string;
  context?: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['/'], description: 'Focus search input', context: 'Global' },
  { keys: ['Esc'], description: 'Close detail panel / modal', context: 'Global' },
  { keys: ['←', 'k'], description: 'Previous condition', context: 'Detail panel' },
  { keys: ['→', 'j'], description: 'Next condition', context: 'Detail panel' },
  { keys: ['b'], description: 'Toggle bookmark', context: 'Detail panel' },
  { keys: ['q'], description: 'Start quick quiz', context: 'Detail panel' },
  { keys: ['c'], description: 'Open DDx compare', context: 'Detail panel' },
  { keys: ['h'], description: 'Toggle High Yield filter', context: 'Sidebar' },
  { keys: ['?'], description: 'Show this help', context: 'Global' },
];

const Key: React.FC<{ children: string }> = ({ children }) => (
  <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-xs font-mono text-[var(--color-text-primary)] shadow-sm">
    {children}
  </kbd>
);

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  isOpen,
  onClose,
}) => {
  // Handle keyboard shortcut to close
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[var(--color-overlay)] backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-[var(--color-accent)]" />
                Keyboard Shortcuts
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Shortcuts List */}
            <div className="p-4 space-y-3">
              {SHORTCUTS.map((shortcut, index) => (
                <div key={index} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5">
                    {shortcut.keys.map((key, keyIndex) => (
                      <React.Fragment key={key}>
                        <Key>{key}</Key>
                        {keyIndex < shortcut.keys.length - 1 && (
                          <span className="text-xs text-[var(--color-text-muted)]">or</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {shortcut.description}
                    </p>
                    {shortcut.context && (
                      <p className="text-[10px] text-[var(--color-text-muted)]">
                        {shortcut.context}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]/30">
              <p className="text-xs text-[var(--color-text-muted)] text-center">
                Press <Key>?</Key> to toggle this help
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default KeyboardShortcutsHelp;
