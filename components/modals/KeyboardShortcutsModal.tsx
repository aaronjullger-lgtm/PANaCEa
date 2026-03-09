import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Command, Keyboard } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: 'navigation' | 'quiz' | 'general';
}

const SHORTCUTS: ShortcutItem[] = [
  // Navigation shortcuts
  { keys: ['['], description: 'Toggle sidebar (expand/collapse/hide)', category: 'navigation' },
  // Quiz shortcuts
  { keys: ['A'], description: 'Answer A', category: 'quiz' },
  { keys: ['B'], description: 'Answer B', category: 'quiz' },
  { keys: ['C'], description: 'Answer C', category: 'quiz' },
  { keys: ['D'], description: 'Answer D', category: 'quiz' },
  { keys: ['Space'], description: 'Toggle explanation after selection', category: 'quiz' },
  { keys: ['Enter'], description: 'Proceed to next question', category: 'quiz' },
  { keys: ['Esc'], description: 'Return to dashboard', category: 'quiz' },
  // General shortcuts
  {
    keys: ['⌘/Ctrl', 'K'],
    description: 'Open command palette (quick navigation)',
    category: 'general',
  },
  { keys: ['⌘/Ctrl', '/'], description: 'Open keyboard shortcuts', category: 'general' },
];

const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  const navShortcuts = SHORTCUTS.filter((s) => s.category === 'navigation');
  const quizShortcuts = SHORTCUTS.filter((s) => s.category === 'quiz');
  const generalShortcuts = SHORTCUTS.filter((s) => s.category === 'general');

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-overlay)] backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="bg-[var(--color-bg-primary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] w-full max-w-lg max-h-[85vh] overflow-hidden border border-[var(--color-border)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="keyboard-shortcuts-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--color-bg-secondary)] rounded-lg">
                  <Keyboard className="w-5 h-5 text-[var(--color-text-secondary)]" />
                </div>
                <h2
                  id="keyboard-shortcuts-title"
                  className="text-xl font-bold text-[var(--color-text-primary)]"
                >
                  Keyboard Shortcuts
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
              {/* Navigation Shortcuts */}
              {navShortcuts.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
                    Navigation
                  </h3>
                  <div className="space-y-2">
                    {navShortcuts.map((shortcut, idx) => (
                      <ShortcutRow key={idx} shortcut={shortcut} />
                    ))}
                  </div>
                </div>
              )}

              {/* Quiz Shortcuts */}
              <div className="mb-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
                  Quiz Mode
                </h3>
                <div className="space-y-2">
                  {quizShortcuts.map((shortcut, idx) => (
                    <ShortcutRow key={idx} shortcut={shortcut} />
                  ))}
                </div>
              </div>

              {/* General Shortcuts */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
                  General
                </h3>
                <div className="space-y-2">
                  {generalShortcuts.map((shortcut, idx) => (
                    <ShortcutRow key={idx} shortcut={shortcut} />
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <p className="text-xs text-[var(--color-text-muted)] text-center">
                Press{' '}
                <kbd className="px-1.5 py-0.5 text-xs font-mono bg-[var(--color-bg-tertiary)] rounded">
                  Esc
                </kbd>{' '}
                to close
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const ShortcutRow: React.FC<{ shortcut: ShortcutItem }> = ({ shortcut }) => (
  <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors">
    <span className="text-sm text-[var(--color-text-secondary)]">{shortcut.description}</span>
    <div className="flex items-center gap-1">
      {shortcut.keys.map((key, idx) => (
        <React.Fragment key={idx}>
          <kbd className="px-2 py-1 text-xs font-mono font-semibold bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-md shadow-sm min-w-[28px] text-center">
            {key}
          </kbd>
          {idx < shortcut.keys.length - 1 && (
            <span className="text-[var(--color-text-muted)] text-xs">+</span>
          )}
        </React.Fragment>
      ))}
    </div>
  </div>
);

export default KeyboardShortcutsModal;
