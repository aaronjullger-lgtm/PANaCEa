/**
 * ConditionMaster - Modal detail view for MedicalContent
 *
 * Delegates to SmartConditionView (Triage, Recognize, Order, Manage) when
 * conditionId is available. Falls back to legacy layout for content without conditionId.
 */

import React, { useMemo, useEffect, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  X,
  Info,
  Stethoscope,
  ClipboardList,
  Activity,
  Pill,
  FlaskConical,
  AlertTriangle,
  BookOpen,
  Lightbulb,
  Target,
} from 'lucide-react';
import { YieldBadge, SystemBadge } from '@/components/ui/badges';
import { parseListField, parseTextField, normalizeMedicalContent } from '@/lib/utils/normalization';
import { ContentFieldRenderer } from '@/components/ui/content-renderers';
// Lazy-load SmartConditionView locally to avoid circular dependency with config/lazyComponents
// (same pattern used in ClinicalReferenceLibrary.tsx)
const SmartConditionView = lazy(() =>
  import('./SmartConditionView').then((m) => ({ default: m.SmartConditionView }))
);
import { Skeleton } from '@/components/loading';
import type { MedicalContentDisplay } from '@/types/medical-content';

interface ConditionMasterProps {
  content: Partial<MedicalContentDisplay>;
  onClose?: () => void;
}

type AnyRecord = Record<string, unknown>;

const getValue = (data: AnyRecord, keys: string[]): unknown => {
  for (const key of keys) {
    if (key in data) {
      const value = data[key];
      if (value !== undefined && value !== null) return value;
    }
  }
  return undefined;
};

const Section: React.FC<{
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  accentColor?: string;
}> = ({ title, icon: Icon, children, accentColor }) => (
  <div className="border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-secondary)]/30">
    <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)]">
      <Icon className={`w-4 h-4 ${accentColor || 'text-[var(--color-accent)]'}`} />
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wide">
        {title}
      </h3>
    </div>
    <div className="p-4 space-y-4">{children}</div>
  </div>
);

const TextField: React.FC<{ label: string; value: unknown }> = ({ label, value }) => {
  const text = parseTextField(value);
  if (!text) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1">
        {label}
      </h4>
      <ContentFieldRenderer value={text} />
    </div>
  );
};

const MarkdownField: React.FC<{ label: string; value: unknown }> = ({ label, value }) => {
  const text = parseTextField(value);
  if (!text) return null;
  // Clean HTML entities for proper markdown rendering
  const cleanText = text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?p>/gi, '\n')
    .replace(/<\/?strong>/gi, '**')
    .replace(/<\/?b>/gi, '**')
    .replace(/<\/?em>/gi, '*')
    .replace(/<\/?i>/gi, '*');
  return (
    <div>
      <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1">
        {label}
      </h4>
      <div className="prose prose-sm prose-invert max-w-none text-[var(--color-text-secondary)]">
        <ReactMarkdown>{cleanText}</ReactMarkdown>
      </div>
    </div>
  );
};

const ListField: React.FC<{ label: string; value: unknown }> = ({ label, value }) => {
  const items = parseListField(value);
  if (!items.length) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1">
        {label}
      </h4>
      <ContentFieldRenderer value={items} variant="clinical" />
    </div>
  );
};

const PillListField: React.FC<{ label: string; value: unknown; color?: string }> = ({
  label,
  value,
  color = 'accent',
}) => {
  const items = parseListField(value);
  if (!items.length) return null;

  const colorClasses = {
    accent:
      'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/30',
    rose: 'bg-[var(--color-data-fail)]/15 text-[var(--color-data-fail)]/60 border-[var(--color-data-fail)]/30',
    blue: 'bg-[color-mix(in_srgb,var(--color-category-practice)_15%,transparent)] text-[var(--color-category-practice)] border-[color-mix(in_srgb,var(--color-category-practice)_30%,transparent)]',
    amber: 'bg-data-provisional/15 text-data-provisional border-data-provisional/30',
  };

  return (
    <div>
      <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
        {label}
      </h4>
      <div className="flex flex-wrap gap-2">
        {items.map((item, idx) => (
          <span
            key={idx}
            className={`px-2.5 py-1 rounded-lg border text-sm font-medium ${colorClasses[color as keyof typeof colorClasses] || colorClasses.accent}`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
};

export const ConditionMaster: React.FC<ConditionMasterProps> = ({ content, onClose }) => {
  useEffect(() => {
    if (!onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const conditionId = content.conditionId ?? (content as { id?: string }).id ?? null;
  const normalized = useMemo(() => normalizeMedicalContent(content), [content]);

  // Use SmartConditionView when we have conditionId (fetches full data with relations)
  if (conditionId) {
    return (
      <AnimatePresence>
        <motion.div
          initial={false}
          animate={{}}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-[var(--color-overlay)] backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.97, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Condition details"
            className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          >
            <Suspense
              fallback={
                <div className="p-6 space-y-4">
                  <Skeleton className="h-10 w-3/4" />
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              }
            >
              <SmartConditionView conditionId={conditionId} onClose={onClose} />
            </Suspense>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Extract key values for hero cards (legacy fallback)
  const goldStandard = parseTextField(getValue(normalized, ['gold_standard', 'gold_standard_dx']));
  const firstLineRx = parseTextField(getValue(normalized, ['first_line_rx']));
  const bestInitialTest = parseTextField(getValue(normalized, ['best_initial_test']));
  const classicPatient = parseTextField(normalized.classic_patient);
  const buzzwords = parseListField(normalized.buzzwords);
  const clinicalPearls = parseListField(normalized.clinical_pearls);
  const classicTriad = parseListField(normalized.classic_triad);
  const mnemonic = parseTextField((normalized as AnyRecord).mnemonic);
  const differentialDx = parseListField((normalized as AnyRecord).differentialDiagnosis);

  return (
    <AnimatePresence>
      <motion.div
        initial={false}
        animate={{}}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-[var(--color-overlay)] backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.97, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.97, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={`Condition details: ${normalized.condition}`}
          className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/30">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-3xl font-bold text-[var(--color-text-primary)] tracking-wide font-teko">
                  {normalized.condition}
                </h2>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {normalized.system && <SystemBadge system={normalized.system} />}
                  <YieldBadge yield={normalized.pance_yield} size="md" />
                  {normalized.subcategory && (
                    <span className="px-2 py-1 bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] border border-[var(--color-border)] rounded text-xs">
                      {normalized.subcategory}
                    </span>
                  )}
                </div>
              </div>
              {onClose && (
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="p-2 hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-[var(--color-text-muted)]" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Quick Facts Hero Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {goldStandard && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-data-provisional/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-data-provisional" />
                    <span className="text-xs font-semibold text-data-provisional uppercase tracking-wide">
                      Gold Standard Dx
                    </span>
                  </div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {goldStandard}
                  </p>
                </div>
              )}
              {firstLineRx && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-data-pass/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Pill className="w-4 h-4 text-data-pass" />
                    <span className="text-xs font-semibold text-data-pass uppercase tracking-wide">
                      First-Line Rx
                    </span>
                  </div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {firstLineRx}
                  </p>
                </div>
              )}
              {bestInitialTest && (
                <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                  <div className="flex items-center gap-2 mb-2">
                    <FlaskConical className="w-4 h-4 text-[var(--color-accent)]" />
                    <span className="text-xs font-semibold text-[var(--color-accent)] uppercase tracking-wide">
                      Best Initial Test
                    </span>
                  </div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {bestInitialTest}
                  </p>
                </div>
              )}
            </div>

            {/* Classic Patient */}
            {classicPatient && (
              <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border)]">
                <div className="flex items-start gap-3">
                  <BookOpen className="w-5 h-5 text-[var(--color-accent)] mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--color-accent)] uppercase tracking-wide mb-1">
                      Classic Patient
                    </h4>
                    <p className="text-sm text-[var(--color-text-primary)] leading-relaxed italic">
                      "{classicPatient}"
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Buzzwords */}
            {buzzwords.length > 0 && (
              <PillListField label="Buzzwords / Key Associations" value={buzzwords} />
            )}

            {/* Clinical Pearls */}
            {clinicalPearls.length > 0 && (
              <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border)]">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-5 h-5 text-[var(--color-accent)]" />
                  <h4 className="text-sm font-semibold text-[var(--color-accent)] uppercase tracking-wide">
                    Clinical Pearls
                  </h4>
                </div>
                <ul className="space-y-2">
                  {clinicalPearls.map((pearl, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]"
                    >
                      <span className="text-[var(--color-accent)] mt-1">•</span>
                      <span>{pearl}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Mnemonic */}
            {mnemonic && (
              <div className="p-4 rounded-xl bg-gradient-to-br from-[var(--color-accent)]/15 to-[var(--color-accent)]/10 border border-[var(--color-accent)]/30">
                <div className="flex items-center gap-2 mb-2">
                  <svg
                    className="w-5 h-5 text-[var(--color-accent)]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <h4 className="text-sm font-semibold text-[var(--color-accent)] uppercase tracking-wide">
                    Memory Aid / Mnemonic
                  </h4>
                </div>
                <p className="text-base font-bold text-[var(--color-text-primary)] font-mono tracking-wide">
                  {mnemonic}
                </p>
              </div>
            )}

            {/* Classic Triad */}
            {classicTriad.length > 0 && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-[var(--color-data-fail)]/10 to-[var(--color-data-fail)]/5 border border-[var(--color-data-fail)]/30">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-[var(--color-data-fail)]" />
                  <h4 className="text-sm font-semibold text-[var(--color-data-fail)] uppercase tracking-wide">
                    Classic Triad
                  </h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {classicTriad.map((item, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 rounded-lg bg-[var(--color-data-fail)]/100/15 text-[var(--color-data-fail)] border border-[var(--color-data-fail)]/30 text-sm font-medium"
                    >
                      {idx + 1}. {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Differential Diagnosis */}
            {differentialDx.length > 0 && (
              <PillListField
                label="Differential Diagnosis"
                value={differentialDx.slice(0, 8)}
                color="blue"
              />
            )}

            {/* Expandable Sections - Properly organized */}
            <div className="space-y-4 pt-2">
              {/* Section 1: Clinical Presentation */}
              <Section title="Clinical Presentation" icon={Stethoscope} accentColor="text-[var(--color-category-practice)]">
                <TextField label="Symptoms" value={normalized.symptoms} />
                <TextField
                  label="Physical Exam"
                  value={getValue(normalized, ['physicalExam', 'physical_exam', 'signs'])}
                />
              </Section>

              {/* Section 2: Workup & Diagnostics */}
              <Section
                title="Workup & Diagnostics"
                icon={FlaskConical}
                accentColor="text-data-provisional"
              >
                <TextField label="Diagnostics" value={getValue(normalized, ['diagnostics'])} />
                <TextField label="Labs" value={getValue(normalized, ['labs'])} />
                <TextField label="Imaging" value={getValue(normalized, ['imaging'])} />
              </Section>

              {/* Section 3: Treatment */}
              <Section title="Treatment" icon={Pill} accentColor="text-data-pass">
                <MarkdownField label="Treatment Approach" value={normalized.treatment} />
                <TextField
                  label="Patient Education"
                  value={getValue(normalized, ['patient_education'])}
                />
              </Section>

              {/* Section 4: Outcomes & Prognosis */}
              <Section
                title="Outcomes & Prognosis"
                icon={AlertTriangle}
                accentColor="text-[var(--color-data-fail)]"
              >
                <TextField label="Complications" value={normalized.complications} />
                <TextField label="Prognosis" value={normalized.prognosis} />
                <TextField label="Disposition" value={getValue(normalized, ['disposition'])} />
                <TextField label="Prevention" value={getValue(normalized, ['prevention'])} />
              </Section>

              {/* Section 5: Background & Etiology */}
              <Section title="Background & Etiology" icon={Info} accentColor="text-[var(--color-accent)]">
                <TextField label="Epidemiology" value={normalized.epidemiology} />
                <TextField label="Etiology" value={normalized.etiology} />
                <TextField
                  label="Risk Factors"
                  value={getValue(normalized, ['riskFactors', 'risk_factors'])}
                />
                <MarkdownField label="Pathophysiology" value={normalized.pathophysiology} />
                <ListField label="Related Systems" value={normalized.relatedSystems} />
              </Section>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ConditionMaster;
