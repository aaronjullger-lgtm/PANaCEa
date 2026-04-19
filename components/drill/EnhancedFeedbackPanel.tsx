/**
 * EnhancedFeedbackPanel - Rich feedback with database-linked reference data
 *
 * Extends the basic FeedbackPanel with:
 * - "Deep Dive" links to relevant reference data
 * - Related concept cards (physiology, anatomy, etc.)
 * - Clinical pearls from database
 * - Key equations and mnemonics when available
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  XCircle,
  ArrowRight,
  BookOpen,
  Lightbulb,
  Brain,
  Stethoscope,
  TestTube,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles,
  Award,
  Image,
  Zap,
  Clock,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface RelatedReference {
  type: 'physiology' | 'anatomy' | 'lab' | 'procedure' | 'ecg' | 'finding' | 'imaging';
  id: string;
  name: string;
  preview?: string;
}

interface EnhancedFeedbackPanelProps {
  isCorrect: boolean;
  correctAnswer?: string;
  userAnswer?: string | null;
  explanation: string;
  pearl?: string;
  keyFindings?: string[]; // Key findings to display (e.g., from lab cases)
  onNext: () => void;
  nextLabel?: string;
  // Enhanced props
  category?: string; // e.g., 'physiology', 'anatomy', 'ecg'
  tags?: string[]; // Tags for finding related content
  relatedConceptId?: string; // Direct link to a reference item
  onDeepDive?: (type: string, id: string) => void; // Handler for opening reference detail
  // DEV-003 Item 5 props
  isRapidGuess?: boolean; // Indicates answer was submitted <500ms
  nextReview?: {
    intervalDays: number;
    nextDueDate: string;
    stability: number;
    difficulty: number;
  } | null;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  physiology: Brain,
  anatomy: Stethoscope,
  lab: TestTube,
  procedure: BookOpen,
  ecg: Sparkles,
  finding: Lightbulb,
  imaging: Image,
};

const TYPE_COLORS: Record<string, string> = {
  physiology: 'bg-[var(--color-data-provisional)]/10 text-[var(--color-data-provisional)]',
  anatomy: 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]',
  lab: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
  procedure: 'bg-[var(--color-data-pass)]/10 text-[var(--color-data-pass)]',
  ecg: 'bg-[var(--color-data-fail)]/10 text-[var(--color-data-fail)]',
  finding: 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]',
  imaging: 'bg-data-neutral/10 text-data-neutral',
};

export const EnhancedFeedbackPanel: React.FC<EnhancedFeedbackPanelProps> = ({
  isCorrect,
  correctAnswer,
  userAnswer,
  explanation,
  pearl,
  keyFindings,
  onNext,
  nextLabel = 'Next Question',
  category,
  tags = [],
  relatedConceptId,
  onDeepDive,
  isRapidGuess,
  nextReview,
}) => {
  const { getToken } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const [showDeepDive, setShowDeepDive] = useState(false);
  const [relatedData, setRelatedData] = useState<any>(null);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);
  const [relatedReferences, setRelatedReferences] = useState<RelatedReference[]>([]);
  const [relatedError, setRelatedError] = useState(false);

  // Fetch related reference data when expanded using dedicated API
  useEffect(() => {
    if (!showDeepDive || !category) return;

    const fetchRelatedData = async () => {
      setIsLoadingRelated(true);
      setRelatedError(false);
      try {
        const token = await getToken();

        // Use the dedicated related-content API
        const response = await fetch('/api/drills/related-content', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify({
            category,
            tags,
            conceptId: relatedConceptId,
            limit: 5,
          }),
        });

        if (response.ok) {
          const result = (await response.json()) as {
            success?: boolean;
            data?: {
              primary?: unknown;
              related?: Array<{
                id?: string;
                displayName?: string;
                name?: string;
                description?: string;
                normalRange?: string;
                category?: string;
              }>;
            };
          };
          if (result.success && result.data) {
            if (result.data.primary) {
              setRelatedData(result.data.primary);
            }
            if (result.data.related && result.data.related.length > 0) {
              setRelatedReferences(
                result.data.related.map((item) => ({
                  type: category as RelatedReference['type'],
                  id: item.id ?? '',
                  name: item.displayName ?? item.name ?? '',
                  preview:
                    item.description?.slice(0, 100) ?? item.normalRange ?? item.category ?? '',
                }))
              );
            }
          }
        } else {
          console.warn('Failed to fetch related content:', response.status);
          setRelatedError(true);
        }
      } catch (err) {
        console.error('Error fetching related data:', err);
        setRelatedError(true);
      } finally {
        setIsLoadingRelated(false);
      }
    };

    fetchRelatedData();
  }, [showDeepDive, category, relatedConceptId, tags, getToken]);

  const feedbackVariants = prefersReducedMotion
    ? { initial: {}, animate: {}, exit: {} }
    : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 } };

  return (
    <motion.div
      variants={feedbackVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
      className={`${
        isCorrect
          ? 'bg-[var(--color-data-pass)]/10 border-t-2 border-[var(--color-data-pass)]'
          : 'bg-[var(--color-data-fail)]/10 border-t-2 border-[var(--color-data-fail)]'
      }`}
    >
      <div className="max-w-4xl mx-auto p-3 sm:p-4">
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {isCorrect ? (
                <CheckCircle className="w-5 h-5 text-[var(--color-data-pass)]" />
              ) : (
                <XCircle className="w-5 h-5 text-[var(--color-data-fail)]" />
              )}
              <span
                className={`text-lg font-bold ${isCorrect ? 'text-[var(--color-data-pass)]' : 'text-[var(--color-data-fail)]'}`}
              >
                {isCorrect ? 'Correct!' : 'Incorrect'}
              </span>
            </div>
            {!isCorrect && correctAnswer && (
              <div className="text-sm text-[var(--color-text-secondary)] mt-1 ml-7">
                Correct answer:{' '}
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {correctAnswer}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onNext}
            className={`inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg font-medium transition-colors text-sm sm:text-base w-full sm:w-auto ${
              isCorrect
                ? 'bg-[var(--color-data-pass)] hover:bg-[var(--color-data-pass)]/80 text-[var(--color-text-primary)]'
                : 'bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)]'
            }`}
          >
            {nextLabel}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Rapid Guess Indicator */}
        {isRapidGuess && (
          <motion.div
            initial={prefersReducedMotion ? false : { y: -10 }}
            animate={{ y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
            className="flex items-center gap-2 p-2.5 mb-3 bg-[var(--color-data-provisional)]/10 border border-[var(--color-data-provisional)]/30 rounded-lg text-sm"
          >
            <Zap className="w-4 h-4 text-[var(--color-data-provisional)] flex-shrink-0" />
            <span className="text-[var(--color-data-provisional)] font-medium">
              Rapid Guess — Answer submitted very quickly
            </span>
          </motion.div>
        )}

        {/* Next Review Information */}
        {nextReview && (
          <motion.div
            initial={prefersReducedMotion ? false : { y: -10 }}
            animate={{ y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2, delay: 0.1 }}
            className="flex items-start gap-3 p-3 mb-3 bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/30 rounded-lg"
          >
            <Clock className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[var(--color-text-primary)]">
                Next Review in{' '}
                <span className="text-[var(--color-accent)]">
                  {Math.round(nextReview.intervalDays) <= 0
                    ? 'Today'
                    : Math.round(nextReview.intervalDays) === 1
                      ? 'Tomorrow'
                      : `${Math.round(nextReview.intervalDays)} days`}
                </span>
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">
                Due: {new Date(nextReview.nextDueDate).toLocaleDateString()}
              </div>
              {/* Stability and Difficulty indicators (for FSRS insight) */}
              <div className="flex items-center gap-4 mt-2 text-xs" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontVariantNumeric: 'tabular-nums' }}>
                <div className="flex items-center gap-1">
                  <span className="text-[var(--color-text-muted)]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>Stability:</span>
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {nextReview.stability.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[var(--color-text-muted)]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>Difficulty:</span>
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {nextReview.difficulty.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Explanation */}
        <div className="text-sm text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] rounded-lg p-3">
          <span className="font-medium text-[var(--color-text-primary)]">Explanation: </span>
          {explanation}
        </div>

        {/* Key Findings (for lab cases, etc.) */}
        {keyFindings && keyFindings.length > 0 && (
          <div className="text-sm bg-[var(--color-bg-secondary)] rounded-lg p-4 mt-2 border border-[var(--color-border)]">
            <h4 className="font-semibold text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
              <TestTube className="w-4 h-4 text-[var(--color-data-pass)]" />
              Key Findings
            </h4>
            <ul className="space-y-1">
              {keyFindings.map((finding, idx) => (
                <li key={idx} className="text-[var(--color-text-secondary)] flex items-start gap-2">
                  <span className="text-[var(--color-data-pass)] mt-1">•</span>
                  <span>{finding}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Pearl */}
        {pearl && (
          <div className="text-sm text-[var(--color-text-primary)] bg-[var(--color-accent)]/10 rounded-lg p-3 mt-2 border border-[var(--color-accent)]/30 flex items-start gap-2">
            <Award className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              <span className="font-medium">Pearl: </span>
              {pearl}
            </span>
          </div>
        )}

        {/* Deep Dive Section */}
        {(category || tags.length > 0) && (
          <div className="mt-3">
            <button
              onClick={() => setShowDeepDive(!showDeepDive)}
              aria-expanded={showDeepDive}
              className="w-full flex items-center justify-between p-2 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] transition-colors text-sm"
            >
              <span className="flex items-center gap-2 text-[var(--color-text-primary)] font-medium">
                <BookOpen className="w-4 h-4 text-[var(--color-accent)]" />
                Deep Dive - Related Reference Material
              </span>
              {showDeepDive ? (
                <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
              )}
            </button>

            <AnimatePresence>
              {showDeepDive && (
                <motion.div
                  initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={prefersReducedMotion ? undefined : { height: 0, opacity: 0 }}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 space-y-3">
                    {isLoadingRelated ? (
                      <div className="text-center py-4 text-[var(--color-text-muted)] text-sm">
                        Loading related content...
                      </div>
                    ) : (
                      <>
                        {/* Single Related Data (e.g., specific physiology concept) */}
                        {relatedData && (
                          <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 border border-[var(--color-border)]">
                            <div className="flex items-start gap-3">
                              <div
                                className={`p-2 rounded-lg ${TYPE_COLORS[category || 'physiology']}`}
                              >
                                {React.createElement(
                                  TYPE_ICONS[category || 'physiology'] || Brain,
                                  { className: 'w-5 h-5' }
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-[var(--color-text-primary)]">
                                  {relatedData.displayName || relatedData.name}
                                </h4>
                                {relatedData.description && (
                                  <p className="text-sm text-[var(--color-text-secondary)] mt-1 line-clamp-2">
                                    {relatedData.description}
                                  </p>
                                )}

                                {/* Key Points */}
                                {relatedData.keyPoints && relatedData.keyPoints.length > 0 && (
                                  <div className="mt-3">
                                    <h5 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1">
                                      Key Points
                                    </h5>
                                    <ul className="text-sm text-[var(--color-text-secondary)] space-y-1">
                                      {relatedData.keyPoints
                                        .slice(0, 3)
                                        .map((point: string, i: number) => (
                                          <li key={i} className="flex items-start gap-2">
                                            <span className="text-[var(--color-accent)] mt-1">
                                              •
                                            </span>
                                            <span>{point}</span>
                                          </li>
                                        ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Clinical Pearls */}
                                {relatedData.clinicalPearls &&
                                  relatedData.clinicalPearls.length > 0 && (
                                    <div className="mt-3 p-2 bg-[var(--color-accent)]/10 rounded-lg">
                                      <h5 className="text-xs font-medium text-[var(--color-text-primary)] mb-1 flex items-center gap-1">
                                        <Lightbulb className="w-3 h-3" />
                                        Clinical Pearls
                                      </h5>
                                      <ul className="text-sm text-[var(--color-text-secondary)] space-y-1">
                                        {relatedData.clinicalPearls
                                          .slice(0, 2)
                                          .map((pearl: string, i: number) => (
                                            <li key={i}>• {pearl}</li>
                                          ))}
                                      </ul>
                                    </div>
                                  )}

                                {/* Key Equations (for physiology) */}
                                {relatedData.keyEquations && (
                                  <div className="mt-3 p-2 bg-[var(--color-accent)]/10 rounded-lg">
                                    <h5 className="text-xs font-medium text-[var(--color-text-primary)] mb-1">
                                      Key Equations
                                    </h5>
                                    <div className="text-sm text-[var(--color-text-secondary)] font-mono">
                                      {Array.isArray(relatedData.keyEquations)
                                        ? relatedData.keyEquations
                                            .slice(0, 2)
                                            .map((eq: any, i: number) => (
                                              <div key={i}>
                                                {typeof eq === 'string'
                                                  ? eq
                                                  : eq.formula || eq.equation}
                                              </div>
                                            ))
                                        : typeof relatedData.keyEquations === 'object' &&
                                            relatedData.keyEquations.formula
                                          ? relatedData.keyEquations.formula
                                          : null}
                                    </div>
                                  </div>
                                )}

                                {/* Mnemonics */}
                                {relatedData.mnemonics && relatedData.mnemonics.length > 0 && (
                                  <div className="mt-3 p-2 bg-[var(--color-data-provisional)]/10 rounded-lg">
                                    <h5 className="text-xs font-medium text-[var(--color-text-primary)] mb-1 flex items-center gap-1">
                                      <Brain className="w-3 h-3" />
                                      Memory Tip
                                    </h5>
                                    <p className="text-sm text-[var(--color-text-secondary)] font-medium">
                                      {relatedData.mnemonics[0]}
                                    </p>
                                  </div>
                                )}

                                {onDeepDive && (
                                  <button
                                    onClick={() =>
                                      onDeepDive(category || 'physiology', relatedData.id)
                                    }
                                    className="mt-3 text-sm text-[var(--color-accent)] hover:underline flex items-center gap-1"
                                  >
                                    View full reference
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Multiple Related References */}
                        {relatedReferences.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                              Related Topics
                            </h5>
                            {relatedReferences.map((ref) => {
                              const Icon = TYPE_ICONS[ref.type] || BookOpen;
                              return (
                                <button
                                  key={ref.id}
                                  onClick={() => onDeepDive?.(ref.type, ref.id)}
                                  className="w-full flex items-center gap-3 p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors text-left"
                                >
                                  <div className={`p-1.5 rounded ${TYPE_COLORS[ref.type]}`}>
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-[var(--color-text-primary)] text-sm">
                                      {ref.name}
                                    </div>
                                    {ref.preview && (
                                      <div className="text-xs text-[var(--color-text-muted)] truncate">
                                        {ref.preview}
                                      </div>
                                    )}
                                  </div>
                                  <ExternalLink className="w-4 h-4 text-[var(--color-text-muted)]" />
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {!relatedData && relatedReferences.length === 0 && (
                          <div className="text-center py-4 text-[var(--color-text-muted)] text-sm">
                            {relatedError
                              ? 'Unable to load reference material. Check your connection.'
                              : 'No additional reference material found for this topic.'}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default EnhancedFeedbackPanel;
