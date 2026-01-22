import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Bookmark, Plus, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { MedicalContentDisplay } from '@/types/medical-content';
import { SystemBadge, YieldBadge } from '@/components/ui/badges';
import {
  ContentFieldRenderer,
  ClinicalPearlsRenderer,
  ClassicTriadRenderer,
} from '@/components/ui/content-renderers';
import {
  safeParseJson,
  safeParseList,
  handleFakeNull,
  normalizeToStringArray,
} from '@/lib/utils/jsonParser';

interface MedicalContentCardProps {
  content: Partial<MedicalContentDisplay>;
  onBookmark?: () => void;
  onAddToDrill?: () => void;
  isBookmarked?: boolean;
  compact?: boolean;
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

/**
 * CollapsibleSection - Animated collapsible content section
 */
const CollapsibleSection: React.FC<SectionProps> = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (!children) return null;

  return (
    <div className="border-b border-[var(--color-border)] last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-[var(--color-bg-secondary)]/30 transition-colors group"
      >
        <h3 className="text-base font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">
          {title}
        </h3>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-5 h-5 text-[var(--color-text-muted)]" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 text-[var(--color-text-secondary)] leading-relaxed">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * MedicalContentCard - Dark sportsbook themed medical condition card
 *
 * Features:
 * - Display font headers (Teko) for condition names
 * - Unified badge system with system and yield indicators
 * - Dark slate background with subtle gradients
 * - Hover effects with scale and glow
 * - Collapsible sections with smooth animations
 * - Quick action buttons (bookmark, add to drill)
 */
export const MedicalContentCard: React.FC<MedicalContentCardProps> = ({
  content,
  onBookmark,
  onAddToDrill,
  isBookmarked = false,
  compact = false,
}) => {
  // Parse JSONB fields safely
  const clinicalPearls = safeParseList(content.clinical_pearls);
  // handleFakeNull returns T | null; we need to type assert for array check
  const classicTriadRaw = handleFakeNull(content.classic_triad, null);
  const classicTriad = Array.isArray(classicTriadRaw) ? classicTriadRaw as string[] : null;
  const buzzwords = safeParseList(content.buzzwords);
  const synonyms = safeParseList(content.synonyms);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -4 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`
        condition-card
        bg-[var(--color-glass-bg)] backdrop-blur-xl
        border border-[var(--color-glass-border)]
        rounded-2xl overflow-hidden
        shadow-lg shadow-[var(--color-glass-shadow)]
        hover:shadow-xl hover:shadow-blue-900/20 hover:border-[var(--color-accent)]
        transition-all duration-200
        dark:bg-[var(--card)] dark:border-[var(--border)]
        ${compact ? 'max-w-md' : 'max-w-4xl'}
      `}
    >
      {/* Header - Dark gradient with display font */}
      <div className="bg-gradient-to-br from-[var(--color-bg-secondary)] via-[var(--color-bg-primary)] to-[var(--color-bg-secondary)] p-6 border-b border-[var(--color-border)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Condition Name - Display Font */}
            <h2
              className="text-3xl font-bold text-[var(--color-text-primary)] mb-3 tracking-wide"
              style={{ fontFamily: "'Teko', 'Poppins', sans-serif" }}
            >
              {content.condition}
            </h2>

            {/* Badges Row */}
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {content.system && <SystemBadge system={content.system} size="md" />}

              {content.pance_yield && <YieldBadge yield={content.pance_yield} size="md" />}

              {content.subcategory && (
                <span className="px-2 py-1 bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)] rounded text-xs">
                  {content.subcategory}
                </span>
              )}
            </div>

            {/* Synonyms */}
            {synonyms.length > 0 && (
              <div className="text-xs text-[var(--color-text-muted)] mt-2">
                Also:{' '}
                <span className="text-[var(--color-text-secondary)]">{synonyms.join(', ')}</span>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col gap-2">
            {onBookmark && (
              <button
                onClick={onBookmark}
                className={`
                  p-2 rounded-lg transition-colors
                  ${
                    isBookmarked
                      ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                      : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700'
                  }
                `}
                aria-label="Bookmark"
              >
                <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
              </button>
            )}

            {onAddToDrill && (
              <button
                onClick={onAddToDrill}
                className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
                aria-label="Add to drill"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Classic Patient Presentation - Prominent callout */}
        {content.classic_patient && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-4 p-4 bg-blue-950/30 border border-blue-800/40 rounded-xl"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-xs font-bold text-blue-300 uppercase tracking-wider mb-1">
                  Classic Presentation
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">{content.classic_patient}</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Content Sections - Dark collapsible panels */}
      <div className="divide-y divide-[var(--color-border)] bg-[var(--color-bg-secondary)]/50">
        {content.overview && (
          <CollapsibleSection title="Overview" defaultOpen>
            <ContentFieldRenderer value={content.overview} />
          </CollapsibleSection>
        )}

        {content.pathophysiology && (
          <CollapsibleSection title="Pathophysiology">
            <ContentFieldRenderer value={content.pathophysiology} />
          </CollapsibleSection>
        )}

        {content.epidemiology && (
          <CollapsibleSection title="Epidemiology">
            <ContentFieldRenderer value={content.epidemiology} />
          </CollapsibleSection>
        )}

        {content.symptoms && (
          <CollapsibleSection title="Clinical Presentation">
            <ContentFieldRenderer value={content.symptoms} />
          </CollapsibleSection>
        )}

        {classicTriad && classicTriad.length > 0 && (
          <CollapsibleSection title="Classic Triad">
            <ClassicTriadRenderer triad={classicTriad} />
          </CollapsibleSection>
        )}

        {buzzwords.length > 0 && (
          <CollapsibleSection title="Buzzwords">
            <div className="flex flex-wrap gap-2">
              {buzzwords.map((word, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-lg bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)] text-sm font-medium"
                >
                  {word}
                </span>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {content.diagnostics && (
          <CollapsibleSection title="Diagnostics">
            <ContentFieldRenderer value={content.diagnostics} />
            <div className="mt-4 space-y-2">
              {content.gold_standard_dx && (
                <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-lg">
                  <div className="text-xs font-semibold text-emerald-300 mb-1">Gold Standard</div>
                  <div className="text-sm text-slate-200">{content.gold_standard_dx}</div>
                </div>
              )}
              {content.best_initial_test && (
                <div className="p-3 bg-blue-950/30 border border-blue-800/40 rounded-lg">
                  <div className="text-xs font-semibold text-blue-300 mb-1">Best Initial Test</div>
                  <div className="text-sm text-slate-200">{content.best_initial_test}</div>
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}

        {content.treatment && (
          <CollapsibleSection title="Treatment">
            <ContentFieldRenderer value={content.treatment} />
            {content.first_line_rx && (
              <div className="mt-4 p-3 bg-purple-950/30 border border-purple-800/40 rounded-lg">
                <div className="text-xs font-semibold text-purple-300 mb-1">
                  First Line Treatment
                </div>
                <div className="text-sm text-slate-200 mb-2">{content.first_line_rx}</div>
                {content.rx_mechanism && (
                  <div className="text-xs text-slate-400 border-t border-purple-800/30 pt-2">
                    <span className="font-medium">Mechanism:</span> {content.rx_mechanism}
                  </div>
                )}
              </div>
            )}
          </CollapsibleSection>
        )}

        {clinicalPearls && clinicalPearls.length > 0 && (
          <CollapsibleSection title="Clinical Pearls">
            <ClinicalPearlsRenderer pearls={clinicalPearls} />
          </CollapsibleSection>
        )}

        {content.complications && (
          <CollapsibleSection title="Complications">
            <ContentFieldRenderer value={content.complications} />
          </CollapsibleSection>
        )}

        {content.prognosis && (
          <CollapsibleSection title="Prognosis">
            <ContentFieldRenderer value={content.prognosis} />
          </CollapsibleSection>
        )}
      </div>
    </motion.div>
  );
};

export default MedicalContentCard;