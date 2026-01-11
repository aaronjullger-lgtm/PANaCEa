/**
 * LibraryCard - Renders medical content with proper formatting
 * 
 * Displays condition details with collapsible sections for:
 * - Definition
 * - Symptoms & Presentation
 * - Diagnostics
 * - Treatment
 * - Pearls
 * 
 * UPDATED: Now uses ContentFieldRenderer to fix [object Object] rendering bugs
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Star, AlertCircle } from 'lucide-react';
import type { MedicalContentDisplay } from '@/types/medical-content';
import { 
  ContentFieldRenderer, 
  ClinicalPearlsRenderer,
  ClassicTriadRenderer 
} from '@/components/ui/content-renderers';
import { safeParseJson, normalizeToStringArray } from '@/lib/utils/jsonParser';

interface LibraryCardProps {
  content: Partial<MedicalContentDisplay>;
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const CollapsibleSection: React.FC<SectionProps> = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Don't render if children is null/undefined
  if (!children) return null;

  return (
    <div className="border-b border-[var(--color-border)] last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-[var(--color-bg-secondary)] transition-colors"
      >
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h3>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-[var(--color-text-secondary)]" />
        ) : (
          <ChevronDown className="w-5 h-5 text-[var(--color-text-secondary)]" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 text-[var(--color-text-secondary)] leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
};

};

export const LibraryCard: React.FC<LibraryCardProps> = ({ content }) => {
  // Parse JSONB fields safely
  const clinicalPearls = safeParseJson(content.clinical_pearls, []);
  const classicTriad = safeParseJson(content.classic_triad, []);
  const buzzwords = normalizeToStringArray(content.buzzwords);
  const synonyms = normalizeToStringArray(safeParseJson(content.synonyms, []));
  
  return (
    <div className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-6 border-b border-[var(--color-border)]">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
              {content.condition}
            </h2>
            
            {/* Badges Row */}
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <span className="px-3 py-1 bg-[var(--color-bg-secondary)] rounded-lg text-[var(--color-text-secondary)] font-medium border border-[var(--color-border)]">
                {content.system}
              </span>
              
              {content.subcategory && (
                <span className="text-[var(--color-text-muted)]">{content.subcategory}</span>
              )}
              
              {content.pance_yield && (
                <span
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                    Number(content.pance_yield) >= 8
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      : Number(content.pance_yield) >= 5
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  <Star className="w-3 h-3" />
                  {content.pance_yield}/10 YIELD
                </span>
              )}
            </div>
            
            {/* Synonyms */}
            {synonyms.length > 0 && (
              <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                Also known as: {synonyms.join(', ')}
              </div>
            )}
          </div>
        </div>
        
        {/* Classic Patient Presentation */}
        {content.classic_patient && (
          <div className="mt-4 p-4 bg-white/50 dark:bg-black/20 rounded-lg border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-blue-500" />
              <div className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wide">
                Classic Patient
              </div>
            </div>
            <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
              {content.classic_patient}
            </p>
          </div>
        )}
      </div>

      {/* Content Sections */}
      <div className="divide-y divide-[var(--color-border)]">
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
          <CollapsibleSection title="Symptoms & Presentation">
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
            <ContentFieldRenderer value={buzzwords} variant="clinical" />
          </CollapsibleSection>
        )}

        {content.physicalExam && (
          <CollapsibleSection title="Physical Exam">
            <ContentFieldRenderer value={content.physicalExam} />
          </CollapsibleSection>
        )}

        {content.diagnostics && (
          <CollapsibleSection title="Diagnostics">
            <ContentFieldRenderer value={content.diagnostics} />
            {content.gold_standard_dx && (
              <div className="mt-3 p-3 bg-emerald-950/20 border border-emerald-800/30 rounded-lg">
                <div className="text-xs font-semibold text-emerald-400 mb-1">
                  Gold Standard
                </div>
                <div className="text-sm text-[var(--color-text-primary)]">
                  {content.gold_standard_dx}
                </div>
              </div>
            )}
            {content.best_initial_test && (
              <div className="mt-2 p-3 bg-blue-950/20 border border-blue-800/30 rounded-lg">
                <div className="text-xs font-semibold text-blue-400 mb-1">
                  Best Initial Test
                </div>
                <div className="text-sm text-[var(--color-text-primary)]">
                  {content.best_initial_test}
                </div>
              </div>
            )}
          </CollapsibleSection>
        )}

        {content.treatment && (
          <CollapsibleSection title="Treatment">
            <ContentFieldRenderer value={content.treatment} />
            {content.first_line_rx && (
              <div className="mt-3 p-3 bg-purple-950/20 border border-purple-800/30 rounded-lg">
                <div className="text-xs font-semibold text-purple-400 mb-1">
                  First Line Treatment
                </div>
                <div className="text-sm text-[var(--color-text-primary)]">
                  {content.first_line_rx}
                </div>
                {content.rx_mechanism && (
                  <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                    Mechanism: {content.rx_mechanism}
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
    </div>
  );
};
