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
import { getApiEndpoint } from '@/lib/utils/apiConfig';

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

// Generate mnemonic via API (auth required in production)
async function generateMnemonicWithAuth(
  getToken: () => Promise<string | null>,
  concept: string,
  context?: string,
  existingMnemonics?: string[]
): Promise<GeneratedMnemonic> {
  const token = await getToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(getApiEndpoint('/api/ai/generate-mnemonic'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ concept, context, existingMnemonics }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate mnemonic');
  }

  const data = await response.json();
  return data.data ?? data;
}

const generateMnemonic = async (
  concept: string,
  context?: string,
  existingMnemonics?: string[],
  getToken?: () => Promise<string | null>
): Promise<GeneratedMnemonic> => {
  try {
    if (getToken) {
      return await generateMnemonicWithAuth(getToken, concept, context, existingMnemonics);
    }
    return await generateMnemonicWithAuth(async () => null, concept, context, existingMnemonics);
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
    acronym: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]',
    story: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]',
    visual: 'bg-[var(--color-data-pass)]/10 text-[var(--color-data-pass)]',
    rhyme: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
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
  const { userId, getToken } = useAuth();
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
      const result = await generateMnemonic(concept, context, previousMnemonics, getToken);
      setMnemonic(result);
      setPreviousMnemonics((prev) => [...prev, result.mnemonic]);
      setIsSaved(false);
    } catch (err) {
      setError('Failed to generate mnemonic. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [concept, context, previousMnemonics, getToken]);

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
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent)]/80 hover:from-[var(--color-accent)]/90 hover:to-[var(--color-accent)]/70 text-white font-medium rounded-lg shadow-sm transition-all hover:shadow-md"
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
        className={`${compact ? '' : 'fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] p-4'}`}
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
              <Brain className="w-5 h-5 text-[var(--color-accent)]" />
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
                  <RefreshCw className="w-5 h-5 text-[var(--color-accent)] animate-spin" />
                  <span className="text-[var(--color-text-muted)]">Generating mnemonic...</span>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="p-3 bg-[var(--color-data-fail)]/10 border border-[var(--color-data-fail)]/30 rounded-lg text-sm text-[var(--color-data-fail)]">
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
                        <Check className="w-4 h-4 text-[var(--color-data-pass)]" />
                      ) : (
                        <Copy className="w-4 h-4 text-[var(--color-text-muted)]" />
                      )}
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaved}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isSaved
                          ? 'text-[var(--color-data-pass)] bg-[var(--color-data-pass)]/10'
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

                <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg">
                  <p className="text-lg font-medium text-[var(--color-text-primary)] leading-relaxed">
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
                <span className="text-xs text-[var(--color-data-pass)] flex items-center gap-1">
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
