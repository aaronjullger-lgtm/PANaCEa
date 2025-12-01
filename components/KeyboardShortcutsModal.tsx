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
  // Quiz shortcuts
  { keys: ['A'], description: 'Select answer option A', category: 'quiz' },
  { keys: ['B'], description: 'Select answer option B', category: 'quiz' },
  { keys: ['C'], description: 'Select answer option C', category: 'quiz' },
  { keys: ['D'], description: 'Select answer option D', category: 'quiz' },
  { keys: ['Space'], description: 'Reveal explanation after selection', category: 'quiz' },
  { keys: ['⌘/Ctrl', 'Enter'], description: 'Proceed to next question', category: 'quiz' },
  { keys: ['Esc'], description: 'Pause or exit current session', category: 'quiz' },
  // General shortcuts
  { keys: ['⌘/Ctrl', 'K'], description: 'Open keyboard shortcuts', category: 'general' },
];

const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
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

  const quizShortcuts = SHORTCUTS.filter(s => s.category === 'quiz');
  const generalShortcuts = SHORTCUTS.filter(s => s.category === 'general');

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden border border-slate-200 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <Keyboard className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Keyboard Shortcuts
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
              {/* Quiz Shortcuts */}
              <div className="mb-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
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
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
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
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-slate-200 dark:bg-slate-700 rounded">Esc</kbd> to close
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const ShortcutRow: React.FC<{ shortcut: ShortcutItem }> = ({ shortcut }) => (
  <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
    <span className="text-sm text-slate-700 dark:text-slate-300">
      {shortcut.description}
    </span>
    <div className="flex items-center gap-1">
      {shortcut.keys.map((key, idx) => (
        <React.Fragment key={idx}>
          <kbd className="px-2 py-1 text-xs font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 rounded-md shadow-sm min-w-[28px] text-center">
            {key}
          </kbd>
          {idx < shortcut.keys.length - 1 && (
            <span className="text-slate-400 text-xs">+</span>
          )}
        </React.Fragment>
      ))}
    </div>
  </div>
);

export default KeyboardShortcutsModal;
