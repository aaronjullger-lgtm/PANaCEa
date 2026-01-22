/**
 * On-Demand Mnemonic Generator
 *
 * Allows users to generate personalized mnemonics using AI.
 * Features:
 * - "Generate Mnemonic" button
 * - Uses Gemini API for personalized mnemonics
 * - Save to user's personal library
 *
 * @see docs/CRITICAL_FIXES_SPRINT_TRACKER.md - Sprint E
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb,
  Sparkles,
  Save,
  Copy,
  RefreshCw,
  X,
  Check,
  BookmarkPlus,
  Brain,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';

interface MnemonicGeneratorProps {
  /** The medical concept to create a mnemonic for */
  concept: string;
  /** Optional context to improve mnemonic relevance */
  context?: string;
  /** System/category for the concept */
  system?: string;
  /** Callback when mnemonic is saved */
  onSave?: (mnemonic: SavedMnemonic) => void;
  /** Compact mode for inline usage */
  compact?: boolean;
}

interface SavedMnemonic {
  id: string;
  concept: string;
  mnemonic: string;
  system?: string;
  createdAt: Date;
  isFavorite: boolean;
}

interface GeneratedMnemonic {
  mnemonic: string;
  explanation: string;
  type: 'acronym' | 'story' | 'visual' | 'rhyme';
}

// Generate mnemonic via API
const generateMnemonic = async (
  concept: string,
  context?: string,
  existingMnemonics?: string[]
): Promise<GeneratedMnemonic> => {
  try {
    const response = await fetch('/api/ai/generate-mnemonic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ concept, context, existingMnemonics }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate mnemonic');
    }

    return await response.json();
  } catch (error) {
    // Fallback: generate a simple acronym-based mnemonic
    const words = concept.split(' ').filter((w) => w.length > 0);
    const acronym = words.map((w) => w.charAt(0).toUpperCase()).join('');

    return {
      mnemonic: `${acronym} - ${words
        .map((w, i) => {
          const acroWord = [
            'Always',
            'Be',
            'Carefully',
            'Diagnosing',
            'Each',
            'Finding',
            'Gets',
            'Help',
            'In',
            'Just',
          ][i % 10];
          return `${w.charAt(0).toUpperCase()}${w.slice(1)} (${acroWord})`;
        })
        .join(', ')}`,
      explanation: 'Auto-generated acronym mnemonic',
      type: 'acronym',
    };
  }
};

// Mnemonic type badges
const TypeBadge: React.FC<{ type: GeneratedMnemonic['type'] }> = ({ type }) => {
  const styles = {
    acronym: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    story: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    visual: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    rhyme: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[type]}`}>{type}</span>
  );
};

export const MnemonicGenerator: React.FC<MnemonicGeneratorProps> = ({
  concept,
  context,
  system,
  onSave,
  compact = false,
}) => {
  const { userId } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mnemonic, setMnemonic] = useState<GeneratedMnemonic | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previousMnemonics, setPreviousMnemonics] = useState<string[]>([]);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateMnemonic(concept, context, previousMnemonics);
      setMnemonic(result);
      setPreviousMnemonics((prev) => [...prev, result.mnemonic]);
      setIsSaved(false);
    } catch (err) {
      setError('Failed to generate mnemonic. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [concept, context, previousMnemonics]);

  const handleCopy = useCallback(() => {
    if (mnemonic) {
      navigator.clipboard.writeText(mnemonic.mnemonic);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  }, [mnemonic]);

  const handleSave = useCallback(async () => {
    if (!mnemonic || !userId) return;

    const saved: SavedMnemonic = {
      id: `mnem_${Date.now()}`,
      concept,
      mnemonic: mnemonic.mnemonic,
      system,
      createdAt: new Date(),
      isFavorite: false,
    };

    // Save to localStorage for now (would save to DB in production)
    const existing = JSON.parse(localStorage.getItem('panceai_mnemonics') || '[]');
    existing.push(saved);
    localStorage.setItem('panceai_mnemonics', JSON.stringify(existing));

    setIsSaved(true);
    onSave?.(saved);
  }, [mnemonic, userId, concept, system, onSave]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    if (!mnemonic) {
      handleGenerate();
    }
  }, [mnemonic, handleGenerate]);

  // Compact trigger button
  if (compact && !isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 rounded-md transition-colors"
      >
        <Lightbulb className="w-3 h-3" />
        <span>Mnemonic</span>
      </button>
    );
  }

  // Full trigger button
  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-medium rounded-lg shadow-sm transition-all hover:shadow-md"
      >
        <Sparkles className="w-4 h-4" />
        <span>Generate Mnemonic</span>
      </button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`${compact ? '' : 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'}`}
        onClick={(e) => {
          if (e.target === e.currentTarget && !compact) setIsOpen(false);
        }}
      >
        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          className={`bg-[var(--color-bg-primary)] rounded-xl shadow-xl border border-[var(--color-border)] ${
            compact ? 'w-full' : 'w-full max-w-md'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-500" />
              <h3 className="font-semibold text-[var(--color-text-primary)]">Mnemonic Generator</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-[var(--color-text-muted)]" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Concept Display */}
            <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg">
              <div className="text-xs text-[var(--color-text-muted)] mb-1">
                Creating mnemonic for:
              </div>
              <div className="font-medium text-[var(--color-text-primary)]">{concept}</div>
              {system && <div className="text-xs text-[var(--color-accent)] mt-1">{system}</div>}
            </div>

            {/* Loading State */}
            {isGenerating && (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-purple-500 animate-spin" />
                  <span className="text-[var(--color-text-muted)]">Generating mnemonic...</span>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            {/* Generated Mnemonic */}
            {mnemonic && !isGenerating && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <TypeBadge type={mnemonic.type} />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleCopy}
                      className="p-1.5 hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
                      title="Copy to clipboard"
                    >
                      {isCopied ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-[var(--color-text-muted)]" />
                      )}
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaved}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isSaved
                          ? 'text-green-500 bg-green-100 dark:bg-green-900/30'
                          : 'hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'
                      }`}
                      title="Save to library"
                    >
                      {isSaved ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <BookmarkPlus className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                  <p className="text-lg font-medium text-purple-900 dark:text-purple-100 leading-relaxed">
                    {mnemonic.mnemonic}
                  </p>
                </div>

                {mnemonic.explanation && (
                  <p className="text-sm text-[var(--color-text-muted)]">{mnemonic.explanation}</p>
                )}
              </motion.div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-primary)] transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                {mnemonic ? 'Try Another' : 'Generate'}
              </button>
              {isSaved && (
                <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Saved
                </span>
              )}
            </div>

            {/* Tips */}
            <div className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] p-3 rounded-lg">
              <strong>💡 Tip:</strong> Click "Try Another" for different mnemonic styles. Save your
              favorites to build a personal memory library!
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Mini button variant for inline use
export const MnemonicButton: React.FC<{
  concept: string;
  context?: string;
  system?: string;
}> = (props) => <MnemonicGenerator {...props} compact />;

export default MnemonicGenerator;