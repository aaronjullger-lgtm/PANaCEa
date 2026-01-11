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
import { ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, BookOpen, Lightbulb, AlertCircle, HelpCircle, ExternalLink, MessageCircle } from 'lucide-react';
import { 
  compressToBullets, 
  extractBuzzwords, 
  generateMnemonic,
  highYieldPackage 
} from '../lib/services/explanationCompression';
import ErrorTagger from './quiz/ErrorTagger';
import type { ErrorTag } from '../types';
import { getConditionByIdSync, loadConditions } from '../lib/loadConditions';
import { analyzeAnswer } from '@/services/CoachingService';

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
}

/**
 * Glass panel container with correct/incorrect highlighting
 */
const GlassPanel: React.FC<{ 
  isCorrect: boolean; 
  children: React.ReactNode;
  className?: string;
}> = ({ isCorrect, children, className = '' }) => {
  const highlightClass = isCorrect 
    ? 'bg-green-500/20 border-green-500/30' 
    : 'bg-red-500/20 border-red-500/30';

  return (
    <div 
      className={`
        backdrop-blur-md rounded-xl border p-5 shadow-lg
        bg-white/70 dark:bg-slate-800/80 
        border-slate-200/60 dark:border-slate-700/60
        ${highlightClass}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

/**
 * Section header with icon
 */
const SectionHeader: React.FC<{ 
  icon: React.ReactNode; 
  title: string;
  className?: string;
}> = ({ icon, title, className = '' }) => (
  <div className={`flex items-center gap-2 mb-3 ${className}`}>
    <span className="text-slate-600 dark:text-slate-400">{icon}</span>
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
      {differentials.map((diff, index) => (
        <div 
          key={index}
          className="border border-slate-200/60 dark:border-slate-700/60 rounded-lg overflow-hidden bg-white/50 dark:bg-slate-800/50"
        >
          <button
            onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
            className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-colors"
            aria-expanded={expandedIndex === index}
          >
            <span className="font-medium text-[var(--color-text-primary)] line-clamp-1">
              {diff.option}
            </span>
            {expandedIndex === index ? (
              <ChevronUp className="w-5 h-5 text-slate-500 flex-shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-500 flex-shrink-0" />
            )}
          </button>
          <AnimatePresence>
            {expandedIndex === index && (
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
      ))}
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
        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 dark:hover:border-green-700 transition-colors disabled:opacity-50"
        aria-label="Helpful"
      >
        <ThumbsUp className="w-4 h-4 text-slate-500 hover:text-green-600" />
      </button>
      <button
        onClick={() => handleFeedback(false)}
        disabled={disabled}
        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-700 transition-colors disabled:opacity-50"
        aria-label="Not helpful"
      >
        <ThumbsDown className="w-4 h-4 text-slate-500 hover:text-red-600" />
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
}) => {
  const [showTutor, setShowTutor] = useState(false);
  const [tutorQuestion, setTutorQuestion] = useState('');
  const [tutorResponse, setTutorResponse] = useState('');
  const [loadingTutor, setLoadingTutor] = useState(false);

  // Process explanation using the compression service
  const processedContent = useMemo(() => {
    return highYieldPackage(explanation, condition);
  }, [explanation, condition]);

  const { bullets, buzzwords, mnemonic } = processedContent;
  
  // Load basic science links from condition content if conditionId is provided
  const [loadedBasicScienceLinks, setLoadedBasicScienceLinks] = useState<BasicScienceLink[]>(basicScienceLinks);
  
  useEffect(() => {
    if (conditionId && !basicScienceLinks.length) {
      // Load from condition content using top-level import
      async function loadBasicScienceLinks() {
        // Ensure conditions are loaded
        await loadConditions();
        const conditionData = getConditionByIdSync(conditionId);
        if (conditionData?.sections?.basicScienceLinks) {
          try {
            const links = typeof conditionData.sections.basicScienceLinks === 'string' 
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

  const handleAskTutor = async () => {
    if (!tutorQuestion.trim()) return;
    
    setLoadingTutor(true);
    try {
      const response = await analyzeAnswer({
        questionText: tutorQuestion,
        userAnswer: '',
        correctAnswer: '',
        isCorrect: isCorrect,
        explanation: explanation,
        condition: condition,
      });
      setTutorResponse(response);
    } catch (error) {
      console.error('Failed to get tutor response:', error);
      setTutorResponse('Sorry, I encountered an error. Please try again.');
    } finally {
      setLoadingTutor(false);
    }
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
          <SectionHeader 
            icon={<Lightbulb className="w-5 h-5" />} 
            title="Core Rationale" 
          />
          <ul className="space-y-2 pl-1">
            {bullets.slice(0, MAX_BULLETS).map((bullet, index) => (
              <li 
                key={index} 
                className="flex items-start gap-2 text-[var(--color-text-secondary)] leading-relaxed"
              >
                <span className="text-[var(--color-accent)] mt-1.5 flex-shrink-0">•</span>
                <span 
                  dangerouslySetInnerHTML={{ __html: bullet }}
                  className="flex-1"
                />
              </li>
            ))}
          </ul>
        </section>

        {/* Buzzwords & Clues Section */}
        {buzzwords.length > 0 && (
          <section className="mb-6">
            <SectionHeader 
              icon={<AlertCircle className="w-5 h-5" />} 
              title="Buzzwords & Clues" 
            />
            <div className="flex flex-wrap gap-2">
              {buzzwords.map((buzzword, index) => (
                <span 
                  key={index}
                  className="px-3 py-1.5 bg-amber-100/80 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-full text-sm font-semibold border border-amber-200/60 dark:border-amber-700/40"
                >
                  {buzzword}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Mnemonic Section */}
        {mnemonic && mnemonic !== '[Mnemonic: None]' && (
          <section className="mb-6">
            <SectionHeader 
              icon={<HelpCircle className="w-5 h-5" />} 
              title="Memory Aid" 
            />
            <div className="p-3 bg-blue-50/80 dark:bg-blue-900/20 rounded-lg border border-blue-200/60 dark:border-blue-700/40">
              <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                {mnemonic}
              </p>
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
            <SectionHeader 
              icon={<Lightbulb className="w-5 h-5" />} 
              title="Clinical Pearls" 
            />
            <ul className="space-y-2 pl-1">
              {pearls.map((pearl, index) => (
                <li 
                  key={index} 
                  className="flex items-start gap-2 text-[var(--color-text-secondary)] leading-relaxed"
                >
                  <span className="text-amber-500 mt-1.5 flex-shrink-0">💡</span>
                  <span 
                    dangerouslySetInnerHTML={{ __html: pearl }}
                    className="flex-1"
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Rationale Section (if different from explanation) */}
        {rationale && rationale !== explanation && (
          <section className="mb-6">
            <SectionHeader 
              icon={<BookOpen className="w-5 h-5" />} 
              title="Additional Rationale" 
            />
            <div 
              className="text-[var(--color-text-secondary)] leading-relaxed"
              dangerouslySetInnerHTML={{ __html: rationale }}
            />
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
              {loadedBasicScienceLinks.map((link, index) => (
                <a
                  key={index}
                  href={`/concepts/${link.conceptId}`}
                  className="flex items-center gap-2 p-3 bg-blue-50/80 dark:bg-blue-900/20 rounded-lg border border-blue-200/60 dark:border-blue-700/40 hover:bg-blue-100/80 dark:hover:bg-blue-900/30 transition-colors group"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    {link.title}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Actions Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
          <div className="flex flex-wrap gap-2">
            {/* Teach Me This Button */}
            {onTeach && (
              <button
                onClick={onTeach}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white dark:text-slate-900 font-semibold rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors shadow-md"
              >
                <BookOpen className="w-4 h-4" />
                Teach Me This
              </button>
            )}

            {/* Ask Tutor Button */}
            <button
              onClick={() => setShowTutor(!showTutor)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-600 transition-colors shadow-md"
            >
              <MessageCircle className="w-4 h-4" />
              Ask Tutor
            </button>
          </div>

          {/* Feedback Buttons */}
          <FeedbackButtons onFeedback={onFeedback} />
        </div>

        {/* AI Tutor Section */}
        <AnimatePresence>
          {showTutor && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-700/60"
            >
              <div className="space-y-3">
                <SectionHeader 
                  icon={<MessageCircle className="w-5 h-5" />} 
                  title="Ask Your Virtual Tutor" 
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tutorQuestion}
                    onChange={(e) => setTutorQuestion(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAskTutor()}
                    placeholder="Why isn't it B? or Explain like I'm 5..."
                    className="flex-1 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={handleAskTutor}
                    disabled={!tutorQuestion.trim() || loadingTutor}
                    className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingTutor ? 'Thinking...' : 'Ask'}
                  </button>
                </div>
                {tutorResponse && (
                  <div className="p-4 bg-purple-50/80 dark:bg-purple-900/20 rounded-lg border border-purple-200/60 dark:border-purple-700/40">
                    <p className="text-sm text-purple-900 dark:text-purple-100 leading-relaxed whitespace-pre-wrap">
                      {tutorResponse}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassPanel>
    </motion.div>
  );
};

export default ExplanationPanel;
