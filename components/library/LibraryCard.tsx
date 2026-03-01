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
  ClassicTriadRenderer,
} from '@/components/ui/content-renderers';
import { safeParseJson, normalizeToStringArray, handleFakeNull } from '@/lib/utils/jsonParser';

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

export const LibraryCard: React.FC<LibraryCardProps> = ({ content }) => {
  // Parse JSONB fields safely
  const clinicalPearls = safeParseJson(handleFakeNull(content.clinical_pearls, null), []);
  const classicTriad = safeParseJson(handleFakeNull(content.classic_triad, null), []);
  const buzzwords = normalizeToStringArray(handleFakeNull(content.buzzwords, []));
  const synonyms = normalizeToStringArray(safeParseJson(handleFakeNull(content.synonyms, []), []));

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
                      ? 'bg-data-fail text-data-fail dark:bg-data-fail/30 dark:text-data-fail'
                      : Number(content.pance_yield) >= 5
                        ? 'bg-data-provisional text-data-provisional dark:bg-data-provisional/30 dark:text-data-provisional'
                        : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'
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
          <div className="mt-4 p-4 bg-white/50 dark:bg-[var(--color-bg-tertiary)]/60 rounded-lg border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-[var(--color-category-practice)]" />
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
        {handleFakeNull(content.overview, null) && (
          <CollapsibleSection title="Overview" defaultOpen>
            <ContentFieldRenderer value={handleFakeNull(content.overview, null)} />
          </CollapsibleSection>
        )}

        {handleFakeNull(content.pathophysiology, null) && (
          <CollapsibleSection title="Pathophysiology">
            <ContentFieldRenderer value={handleFakeNull(content.pathophysiology, null)} />
          </CollapsibleSection>
        )}

        {handleFakeNull(content.epidemiology, null) && (
          <CollapsibleSection title="Epidemiology">
            <ContentFieldRenderer value={handleFakeNull(content.epidemiology, null)} />
          </CollapsibleSection>
        )}

        {handleFakeNull(content.symptoms, null) && (
          <CollapsibleSection title="Symptoms & Presentation">
            <ContentFieldRenderer value={handleFakeNull(content.symptoms, null)} />
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

        {handleFakeNull(content.physicalExam, null) && (
          <CollapsibleSection title="Physical Exam">
            <ContentFieldRenderer value={handleFakeNull(content.physicalExam, null)} />
          </CollapsibleSection>
        )}

        {handleFakeNull(content.diagnostics, null) && (
          <CollapsibleSection title="Diagnostics">
            <ContentFieldRenderer value={handleFakeNull(content.diagnostics, null)} />
            {handleFakeNull(content.gold_standard_dx, null) && (
              <div className="mt-3 p-3 bg-data-pass/20 border border-data-pass/30 rounded-lg">
                <div className="text-xs font-semibold text-data-pass mb-1">Gold Standard</div>
                <div className="text-sm text-[var(--color-text-primary)]">
                  {handleFakeNull(content.gold_standard_dx, null)}
                </div>
              </div>
            )}
            {handleFakeNull(content.best_initial_test, null) && (
              <div className="mt-2 p-3 bg-[color-mix(in_srgb,var(--color-category-practice)_20%,transparent)] border border-[color-mix(in_srgb,var(--color-category-practice)_30%,transparent)] rounded-lg">
                <div className="text-xs font-semibold text-[var(--color-category-practice)] mb-1">Best Initial Test</div>
                <div className="text-sm text-[var(--color-text-primary)]">
                  {handleFakeNull(content.best_initial_test, null)}
                </div>
              </div>
            )}
          </CollapsibleSection>
        )}

        {handleFakeNull(content.treatment, null) && (
          <CollapsibleSection title="Treatment">
            <ContentFieldRenderer value={handleFakeNull(content.treatment, null)} />
            {handleFakeNull(content.first_line_rx, null) && (
              <div className="mt-3 p-3 bg-purple-950/20 border border-purple-800/30 rounded-lg">
                <div className="text-xs font-semibold text-purple-400 mb-1">
                  First Line Treatment
                </div>
                <div className="text-sm text-[var(--color-text-primary)]">
                  {handleFakeNull(content.first_line_rx, null)}
                </div>
                {handleFakeNull(content.rx_mechanism, null) && (
                  <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                    Mechanism: {handleFakeNull(content.rx_mechanism, null)}
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

        {handleFakeNull(content.complications, null) && (
          <CollapsibleSection title="Complications">
            <ContentFieldRenderer value={handleFakeNull(content.complications, null)} />
          </CollapsibleSection>
        )}

        {handleFakeNull(content.prognosis, null) && (
          <CollapsibleSection title="Prognosis">
            <ContentFieldRenderer value={handleFakeNull(content.prognosis, null)} />
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
};
