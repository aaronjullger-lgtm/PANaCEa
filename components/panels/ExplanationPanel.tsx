/**
 * ExplanationPanel Component
 *
 * A post-answer rationale panel with Glass/Slate styling that displays:
 * - Core Rationale (3-6 bullets)
 * - Buzzwords & Clues (bolded list)
 * - Why the others were wrong (collapsible accordion)
 * - Teach Me This button
 * - Helpful / Not Helpful feedback buttons
 * - Error Tagger (only when incorrect)
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  BookOpen,
  Lightbulb,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import { highYieldPackage } from '@/lib/services/explanationCompression';
import { ErrorTagger } from '@/components/quiz';
import type { ErrorTag } from '@/types';
import { getConditionByIdSync, loadConditions } from '@/lib/loadConditions';
import { ClinicalSkeleton } from '@/components/ui/ClinicalSkeleton';
import { ClinicalPearlHighlight } from '@/components/ui/ClinicalPearlHighlight';
import { OpenStaxAttributionFooter } from '@/components/ui/OpenStaxAttributionFooter';
import { usePreferences } from '@/hooks/usePreferences';
import { useAuth } from '@clerk/clerk-react';
import { getApiEndpoint } from '@/lib/utils/apiConfig';
import { sanitizeForRationale } from '@/lib/sanitizeHtml';

/** Maximum number of bullet points to display in Core Rationale section */
const MAX_BULLETS = 6;

export interface DifferentialItem {
  /** The incorrect answer option text */
  option: string;
  /** Explanation of why this option is incorrect */
  reasoning: string;
}

export interface BasicScienceLink {
  title: string;
  conceptId: string;
}

export interface ExplanationPanelProps {
  /** The full explanation/rationale text */
  explanation: string;
  /** The condition name for mnemonic lookup */
  condition: string;
  /** Whether the user answered correctly */
  isCorrect: boolean;
  /** Array of incorrect answer differentials */
  differentials?: DifferentialItem[];
  /** Callback when "Teach Me This" button is clicked */
  onTeach?: () => void;
  /** Callback when feedback is provided */
  onFeedback?: (helpful: boolean) => void;
  /** Optional question ID for analytics */
  questionId?: string;
  /** Callback when error is tagged (only shown when incorrect) */
  onTagError?: (tag: ErrorTag) => void;
  /** Optional basic science links for foundational review */
  basicScienceLinks?: BasicScienceLink[];
  /** Optional condition ID to fetch basic science links */
  conditionId?: string;
  /** Clinical pearls array for high-yield teaching points */
  pearls?: string[];
  /** Additional rationale text (can be different from explanation) */
  rationale?: string;
  /** Optional: attribution source (e.g. 'openstax') */
  contentSource?: string;
  /** Optional: content source title (e.g. book name) */
  contentSourceTitle?: string;
}

/**
 * Glass panel container with correct/incorrect highlighting
 */
const GlassPanel: React.FC<{
  isCorrect: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ isCorrect, children, className = '' }) => {
  // Use design system colors: data-pass (teal) and data-fail (red)
  const highlightClass = isCorrect
    ? 'bg-data-pass/20 border-data-pass/30'
    : 'bg-data-fail/20 border-data-fail/30';

  return (
    <div
      className={`
        backdrop-blur-md rounded-xl border p-5 shadow-lg
        bg-[var(--color-bg-primary)]/80 
        border-[var(--color-border)]/60
        ${highlightClass}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

function extractHtmlParagraphs(text: string): string[] {
  const stripped = text
    .replaceAll(/<\/p>/gi, '\n\n')
    .replaceAll(/<\/li>/gi, '\n')
    .replaceAll(/<[^>]*>/g, '')
    .trim();
  return stripped.split(/\n\n+/).filter((p) => p.trim().length > 0);
}

function extractNumberedOrBulletPoints(text: string, regex: RegExp): string[] {
  const points = text.split(regex);
  return points.map((p) => p.trim()).filter((p) => p.length > 0);
}

function splitBySentencesIntoParagraphs(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const paragraphs: string[] = [];
  let current: string[] = [];
  for (const sentence of sentences) {
    current.push(sentence);
    if (current.length >= 2 || current.join(' ').length > 200) {
      paragraphs.push(current.join(' '));
      current = [];
    }
  }
  if (current.length > 0) {
    paragraphs.push(current.join(' '));
  }
  return paragraphs;
}

/**
 * Format rationale text into structured paragraphs
 * Handles common patterns: numbered lists, sentence breaks, key points
 */
function formatRationale(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  if (text.includes('<p>') || text.includes('<li>')) return extractHtmlParagraphs(text);
  if (/\d+[.)]\s/.test(text)) return extractNumberedOrBulletPoints(text, /(?=\d+[.)]\s)/);
  if (/^[•\-*]\s/m.test(text)) return extractNumberedOrBulletPoints(text, /(?=[•\-*]\s)/);
  if (text.includes('\n\n')) return text.split(/\n\n+/).filter((p) => p.trim().length > 0);
  if (text.split(/(?<=[.!?])\s+/).length > 3) return splitBySentencesIntoParagraphs(text);
  return [text.trim()];
}

/**
 * Section header with icon
 */
const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  className?: string;
}> = ({ icon, title, className = '' }) => (
  <div className={`flex items-center gap-2 mb-3 ${className}`}>
    <span className="text-[var(--color-text-muted)]">{icon}</span>
    <h3 className="font-bold text-lg text-[var(--color-text-primary)]">{title}</h3>
  </div>
);

/**
 * Collapsible accordion for differentials
 */
const DifferentialAccordion: React.FC<{
  differentials: DifferentialItem[];
}> = ({ differentials }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!differentials || differentials.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {differentials.map((diff, index) => {
        const isExpanded = expandedIndex === index;
        return (
          <div
            key={`${diff.option}-${diff.reasoning.slice(0, 40)}`}
            className="border border-[var(--color-border)]/60 rounded-lg overflow-hidden bg-[var(--color-bg-primary)]/60"
          >
            <button
              type="button"
              onClick={() => setExpandedIndex(isExpanded ? null : index)}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-[var(--color-bg-tertiary)]/60 transition-colors"
              {...(isExpanded ? { 'aria-expanded': true } : { 'aria-expanded': false })}
            >
              <span className="font-medium text-[var(--color-text-primary)] line-clamp-1">
                {diff.option}
              </span>
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-[var(--color-text-muted)] flex-shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-[var(--color-text-muted)] flex-shrink-0" />
              )}
            </button>
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 pt-0 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                    {diff.reasoning}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Feedback buttons component
 */
const FeedbackButtons: React.FC<{
  onFeedback?: (helpful: boolean) => void;
  disabled?: boolean;
}> = ({ onFeedback, disabled }) => {
  const [feedbackGiven, setFeedbackGiven] = useState<boolean | null>(null);

  const handleFeedback = (helpful: boolean) => {
    if (feedbackGiven !== null || disabled) return;
    setFeedbackGiven(helpful);
    onFeedback?.(helpful);
  };

  if (feedbackGiven !== null) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
        <span>Thanks for your feedback!</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-[var(--color-text-muted)] mr-2">Was this helpful?</span>
      <button
        onClick={() => handleFeedback(true)}
        disabled={disabled}
        className="p-2 rounded-lg border border-[var(--color-border)] hover:bg-data-pass/10 hover:border-data-pass/30 transition-colors disabled:opacity-50"
        aria-label="Helpful"
      >
        <ThumbsUp className="w-4 h-4 text-[var(--color-text-muted)] hover:text-data-pass" />
      </button>
      <button
        onClick={() => handleFeedback(false)}
        disabled={disabled}
        className="p-2 rounded-lg border border-[var(--color-border)] hover:bg-data-fail/10 hover:border-data-fail/30 transition-colors disabled:opacity-50"
        aria-label="Not helpful"
      >
        <ThumbsDown className="w-4 h-4 text-[var(--color-text-muted)] hover:text-data-fail" />
      </button>
    </div>
  );
};

/**
 * ExplanationPanel - Main component
 */
const ExplanationPanel: React.FC<ExplanationPanelProps> = ({
  explanation,
  condition,
  isCorrect,
  differentials = [],
  onTeach,
  onFeedback,
  questionId,
  onTagError,
  basicScienceLinks = [],
  conditionId,
  pearls = [],
  rationale,
  contentSource,
  contentSourceTitle,
}) => {
  const [showTutor, setShowTutor] = useState(false);
  const [tutorQuestion, setTutorQuestion] = useState('');
  const [tutorResponse, setTutorResponse] = useState('');
  const [loadingTutor, setLoadingTutor] = useState(false);

  const { preferences } = usePreferences();
  const { getToken } = useAuth();
  const customSettings = preferences.customSettings as Record<string, unknown> | undefined;
  const activeKnowledgeCacheName = customSettings?.activeKnowledgeCacheName as string | undefined;
  const activeKnowledgeCacheDisplayName = customSettings?.activeKnowledgeCacheDisplayName as
    | string
    | undefined;

  interface CuratedPassageView {
    id: string;
    title: string;
    body: string;
    source: string;
    sourceUrl: string;
    license: string;
  }

  const [curatedPassage, setCuratedPassage] = useState<CuratedPassageView | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCurated() {
      if (!conditionId) {
        setCuratedPassage(null);
        return;
      }
      try {
        const endpoint = getApiEndpoint('/api/content/curated-passages');
        const url = `${endpoint}?conditionId=${encodeURIComponent(
          conditionId
        )}&limit=1&source=OpenStax`;
        const res = await fetch(url);
        if (!res.ok) return;

        const payload = (await res.json()) as
          | { passages?: CuratedPassageView[] }
          | { data?: { passages?: CuratedPassageView[] } };
        const root: any = (payload as any).data ?? payload;
        const list = (root?.passages || []) as CuratedPassageView[];
        if (!cancelled && list.length > 0) {
          setCuratedPassage(list[0] ?? null);
        } else if (!cancelled) {
          setCuratedPassage(null);
        }
      } catch (error) {
        console.warn('[ExplanationPanel] Failed to load curated passages', error);
      }
    }

    loadCurated();
    return () => {
      cancelled = true;
    };
  }, [conditionId]);

  // Process explanation using the compression service
  const processedContent = useMemo(() => {
    return highYieldPackage(explanation, condition);
  }, [explanation, condition]);

  const { bullets, buzzwords, mnemonic } = processedContent;

  // Load basic science links from condition content if conditionId is provided
  const [loadedBasicScienceLinks, setLoadedBasicScienceLinks] =
    useState<BasicScienceLink[]>(basicScienceLinks);

  useEffect(() => {
    if (conditionId && !basicScienceLinks.length) {
      // Load from condition content using top-level import
      const currentConditionId = conditionId; // Capture for closure type narrowing
      async function loadBasicScienceLinks() {
        // Ensure conditions are loaded
        await loadConditions();
        const conditionData = getConditionByIdSync(currentConditionId);
        if (conditionData?.sections?.basicScienceLinks) {
          try {
            const links =
              typeof conditionData.sections.basicScienceLinks === 'string'
                ? JSON.parse(conditionData.sections.basicScienceLinks)
                : conditionData.sections.basicScienceLinks;
            if (Array.isArray(links)) {
              setLoadedBasicScienceLinks(links);
            }
          } catch (e) {
            console.warn(`Failed to parse basicScienceLinks for condition: ${conditionId}`, e);
          }
        }
      }
      loadBasicScienceLinks();
    }
  }, [conditionId, basicScienceLinks.length]);

  const askTutorWithQuestion = async (studentQuestion: string) => {
    if (!studentQuestion.trim()) return;

    setLoadingTutor(true);
    setTutorResponse('');
    setShowTutor(true);

    try {
      const prompt = `You are a clinical tutor helping a PA student understand a medical concept.

Context:
- Question Status: ${isCorrect ? 'Answered Correctly' : 'Answered Incorrectly'}
- Condition: ${condition}
- Original Explanation: ${explanation}

Student's Question: ${studentQuestion}

Provide a clear, conversational explanation that:
- Directly answers their specific question
- Uses simple, accessible language
- Connects to clinical reasoning
- Builds confidence (especially if they got it wrong)

Keep your response concise (3-5 sentences max) and supportive.`;

      const { callGeminiTextStreaming } = await import('@/services/ai/geminiService');

      await callGeminiTextStreaming('gemini-3-flash-preview', prompt, 0.8, {
        getToken,
        ...(activeKnowledgeCacheName ? { cachedContent: activeKnowledgeCacheName } : {}),
        thinkingLevel: 'HIGH',
        systemInstruction:
          'You are a clinical tutor for PA students. Be concise (3-5 sentences), supportive, and use simple language. When citing library use {{Page:N}} or {{Pages:N-M}}.',
        onChunk: (chunk) => {
          setTutorResponse((prev) => prev + chunk);
        },
        onComplete: () => {
          setLoadingTutor(false);
        },
        onError: (err) => {
          console.error('Failed to get tutor response:', err);
          setTutorResponse(
            "Sorry, I couldn't answer that right now. The AI service may be temporarily busy. Please try again in a moment."
          );
          setLoadingTutor(false);
        },
      });
    } catch (err) {
      console.error('Failed to get tutor response:', err);
      setTutorResponse(
        "Sorry, I couldn't answer that right now. The AI service may be temporarily busy. Please try again in a moment."
      );
      setLoadingTutor(false);
    }
  };

  const handleAskTutor = async () => {
    await askTutorWithQuestion(tutorQuestion.trim());
  };

  const handleExplainSimple = async () => {
    await askTutorWithQuestion('Explain the key concept in 2–3 simple sentences.');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="space-y-4"
    >
      {/* Error Tagger - Only show when incorrect */}
      {!isCorrect && onTagError && (
        <div className="mb-4">
          <ErrorTagger onTagError={onTagError} />
        </div>
      )}

      {/* Main Glass Panel */}
      <GlassPanel isCorrect={isCorrect}>
        {/* Core Rationale Section */}
        <section className="mb-6">
          <SectionHeader icon={<Lightbulb className="w-5 h-5" />} title="Core Rationale" />
          <ul className="space-y-2 pl-1">
            {bullets.slice(0, MAX_BULLETS).map((bullet: string) => (
              <li
                key={bullet.slice(0, 80)}
                className="flex items-start gap-2 text-[var(--color-text-secondary)] leading-relaxed"
              >
                <span className="text-[var(--color-accent)] mt-1.5 flex-shrink-0">•</span>
                <span
                  dangerouslySetInnerHTML={{ __html: sanitizeForRationale(bullet) }}
                  className="flex-1"
                />
              </li>
            ))}
          </ul>
        </section>

        {/* Buzzwords & Clues Section */}
        {buzzwords.length > 0 && (
          <section className="mb-6">
            <SectionHeader icon={<AlertCircle className="w-5 h-5" />} title="Buzzwords & Clues" />
            <p className="text-sm text-[var(--color-text-secondary)]">{buzzwords.join(' · ')}</p>
          </section>
        )}

        {/* Mnemonic Section */}
        {mnemonic && mnemonic !== '[Mnemonic: None]' && (
          <section className="mb-6">
            <SectionHeader icon={<HelpCircle className="w-5 h-5" />} title="Memory Aid" />
            <div className="p-3 bg-[var(--color-accent)]/10 rounded-lg border border-[var(--color-accent)]/30">
              <p className="text-sm text-[var(--color-accent)] font-medium">{mnemonic}</p>
            </div>
          </section>
        )}

        {/* Why the Others Were Wrong Section */}
        {differentials.length > 0 && (
          <section className="mb-6">
            <SectionHeader
              icon={<AlertCircle className="w-5 h-5" />}
              title="Why the Others Were Wrong"
            />
            <DifferentialAccordion differentials={differentials} />
          </section>
        )}

        {/* Clinical Pearls Section */}
        {pearls.length > 0 && (
          <section className="mb-6">
            <SectionHeader icon={<Lightbulb className="w-5 h-5" />} title="Clinical Pearls" />
            <ul className="space-y-3 pl-0 list-none">
              {pearls.map((pearl) => (
                <li key={pearl.slice(0, 80)}>
                  <ClinicalPearlHighlight label="Pearl">
                    <span dangerouslySetInnerHTML={{ __html: pearl }} />
                  </ClinicalPearlHighlight>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Rationale Section (if different from explanation) */}
        {rationale && rationale !== explanation && (
          <section className="mb-6">
            <SectionHeader icon={<BookOpen className="w-5 h-5" />} title="Additional Rationale" />
            <div className="space-y-3">
              {formatRationale(rationale).map((paragraph) => (
                <p
                  key={paragraph.slice(0, 80)}
                  className="text-[var(--color-text-secondary)] leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: sanitizeForRationale(paragraph) }}
                />
              ))}
            </div>
          </section>
        )}

        {/* Basic Science Links Section */}
        {loadedBasicScienceLinks.length > 0 && (
          <section className="mb-6">
            <SectionHeader
              icon={<BookOpen className="w-5 h-5" />}
              title="Review: Foundational Science"
            />
            <div className="space-y-2">
              {loadedBasicScienceLinks.map((link) => (
                <a
                  key={link.conceptId}
                  href={`#concept-${link.conceptId}`}
                  className="flex items-center gap-2 p-3 bg-[var(--color-accent)]/10 rounded-lg border border-[var(--color-accent)]/30 hover:bg-[var(--color-accent)]/15 transition-colors group"
                  rel="noopener noreferrer"
                  aria-label={`Review concept: ${link.title}`}
                >
                  <ExternalLink className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium text-[var(--color-accent)]">
                    {link.title}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* When incorrect: prominent prompt to use the tutor */}
        {!isCorrect && (
          <p className="text-sm text-[var(--color-text-secondary)] mb-2">
            Struggling with this? Ask the tutor for a clearer explanation.
          </p>
        )}

        {/* Actions Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[var(--color-border)]/60">
          <div className="flex flex-wrap gap-2">
            {/* Teach Me This Button */}
            {onTeach && (
              <button
                onClick={onTeach}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-semibold rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors shadow-md"
              >
                <BookOpen className="w-4 h-4" />
                Teach Me This
              </button>
            )}

            {/* Ask Tutor Button */}
            <button
              onClick={() => setShowTutor(!showTutor)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)]/90 text-[var(--color-text-inverse)] font-semibold rounded-lg hover:bg-[var(--color-accent)] transition-colors shadow-md"
            >
              <MessageCircle className="w-4 h-4" />
              Ask Tutor
            </button>
            {/* One-tap simple explanation when incorrect */}
            {!isCorrect && (
              <button
                onClick={handleExplainSimple}
                disabled={loadingTutor}
                className="flex items-center gap-2 px-4 py-2 border-2 border-[var(--color-data-fail)]/50 bg-[var(--color-data-fail)]/10 text-[var(--color-text-primary)] font-medium rounded-lg hover:bg-[var(--color-data-fail)]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Explain in simple terms
              </button>
            )}
          </div>

          {/* Feedback Buttons */}
          <FeedbackButtons onFeedback={onFeedback} />
        </div>

        {/* Curated textbook excerpt (e.g. OpenStax) */}
        {curatedPassage && (
          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            <h3 className="font-bold text-lg mb-2 text-[var(--color-text-primary)]">
              From textbook: {curatedPassage.title}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
              {curatedPassage.body}
            </p>
            <OpenStaxAttributionFooter
              title={curatedPassage.title || contentSourceTitle || 'Textbook'}
              sourceUrl={curatedPassage.sourceUrl}
              licenseName={curatedPassage.license}
            />
          </div>
        )}

        {/* AI Tutor Section — styled when incorrect to stand out */}
        <AnimatePresence>
          {showTutor && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={`mt-4 pt-4 border-t ${isCorrect ? 'border-[var(--color-border)]/60' : 'ring-2 ring-[var(--color-data-fail)]/20 rounded-xl bg-[var(--color-data-fail)]/5 border-[var(--color-data-fail)]/30'}`}
            >
              <div className="space-y-3">
                <SectionHeader
                  icon={<MessageCircle className="w-5 h-5" />}
                  title="Ask Your Virtual Tutor"
                />
                {activeKnowledgeCacheName && (
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Answering using: {activeKnowledgeCacheDisplayName || 'your library'}
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tutorQuestion}
                    onChange={(e) => setTutorQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAskTutor()}
                    placeholder="Why isn't it B? or Explain like I'm 5..."
                    className="flex-1 px-4 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  />
                  <button
                    onClick={handleAskTutor}
                    disabled={!tutorQuestion.trim() || loadingTutor}
                    className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg hover:bg-[var(--color-accent)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingTutor ? 'Thinking...' : 'Ask'}
                  </button>
                </div>
                {/* Show skeleton while loading and no response yet */}
                {loadingTutor && !tutorResponse && (
                  <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
                    <ClinicalSkeleton variant="compact" lines={4} />
                  </div>
                )}

                {/* Show streaming response as it arrives */}
                {tutorResponse && (
                  <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
                    <p className="text-sm text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap">
                      {tutorResponse}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {contentSource === 'openstax' && (
          <OpenStaxAttributionFooter
            title={contentSourceTitle || 'Textbook'}
            sourceUrl="https://openstax.org"
          />
        )}
      </GlassPanel>
    </motion.div>
  );
};

export default ExplanationPanel;
