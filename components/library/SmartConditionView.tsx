/**
 * SmartConditionView - High-fidelity tabbed interface for PANCE board review
 *
 * Philosophy: Professional, clinical terminology (UpToDate/Dynamed style)
 * Layout: Clean, dense, information-rich
 * Tabs: High Yield (default) | Presentation | Diagnostics | Management
 *
 * Usage:
 * - Pass `data` directly for full control (new specification)
 * - Pass `conditionId` for hook-based loading (backward compatibility)
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Beaker,
  ChevronDown,
  ChevronRight,
  Heart,
  Lightbulb,
  Pill,
  Stethoscope,
  Target,
  TestTube,
  TrendingUp,
  Zap,
  Tag,
  Image as ImageIcon,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { YieldBadge } from '@/components/ui/badges/YieldBadge';
import { ContentFieldRenderer } from '@/components/ui/content-renderers';
import { useSmartCondition } from './hooks/useSmartCondition';
import { Skeleton } from '@/components/loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import { ImageGallery } from './SmartImage';

type TabId = 'highyield' | 'presentation' | 'diagnostics' | 'management';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConfusionPair {
  id: string;
  mistakenForId?: string;
  realConditionId?: string;
  selectedConditionId?: string;
  correctConditionId?: string;
  /** Human-readable display name — preferred over selectedConditionId for rendering */
  conditionName?: string;
  distinctiveFeature?: string;
  clinicalContext?: string;
  [key: string]: any;
}

interface DrugConditionLink {
  id: string;
  isFirstLine?: boolean;
  Drug?: {
    genericName?: string;
    brandName?: string;
    name?: string;
  };
}

interface TreatmentConditionLink {
  id: string;
  isFirstLine?: boolean;
  Treatment?: {
    name?: string;
  };
}

interface LabConditionLink {
  id: string;
  LabTest?: {
    name?: string;
    displayName?: string;
  };
  expectedResult?: string;
  significance?: string;
}

interface ImagingConditionLink {
  id: string;
  ImagingStudy?: {
    name?: string;
    displayName?: string;
  };
  classicFindings?: string;
  expectedFindings?: string[];
}

interface ECGConditionLink {
  id: string;
  ECGPattern?: {
    name?: string;
    displayName?: string;
  };
  findingDescription?: string;
}

interface FindingConditionLink {
  id: string;
  PhysicalExamFinding?: {
    name?: string;
    displayName?: string;
  };
  clinicalContext?: string;
  relationshipType?: string;
}

export interface MedicalContent {
  id: string;
  conditionId: string;
  system: string;
  subcategory?: string | null;
  condition: string;
  status?: string;
  relatedSystems?: string[];

  // High Yield
  pance_yield?: number | null;
  buzzwords?: string[] | null;
  classic_triad?: any;
  clinical_pearls?: any;
  mnemonic?: string | null;
  synonyms?: any;
  differentialDiagnosis?: string | null;

  // Presentation
  age_demographic?: any;
  gender_bias?: string | null;
  classic_patient?: string | null;
  symptoms?: string | null;
  physicalExam?: string | null;
  riskFactors?: string | null;
  etiology?: string | null;
  epidemiology?: string | null;

  // Diagnostics
  best_initial_test?: string | null;
  gold_standard_dx?: string | null;
  diagnostics?: string | null;

  // Management
  first_line_rx?: string | null;
  treatment?: string | null;
  disposition?: string | null;
  complications?: string | null;
  prognosis?: string | null;
  prevention?: string | null;
  patient_education?: string | null;

  // Relations
  ConfusionPair_ConfusionPair_correctConditionIdToMedicalContent?: ConfusionPair[];
  DrugConditionLink?: DrugConditionLink[];
  TreatmentConditionLink?: TreatmentConditionLink[];
  LabConditionLink?: LabConditionLink[];
  ImagingConditionLink?: ImagingConditionLink[];
  ECGConditionLink?: ECGConditionLink[];
  FindingConditionLink?: FindingConditionLink[];
  MediaAsset?: Array<{
    id: string;
    filename?: string;
    originalUrl?: string;
    thumbnailUrl?: string;
    description?: string;
    altText?: string;
    modality?: string;
    isClassicPortrayal?: boolean;
    sourceUrl?: string;
    licenseType?: string;
    attribution?: string;
    tags?: string[];
    qualityScore?: number;
  }>;

  [key: string]: any;
}

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

function parseListField(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string');
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((v) => typeof v === 'string');
    } catch {
      return value
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function parseTextField(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// Tab Configuration
// ---------------------------------------------------------------------------

const TAB_CONFIG: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'highyield', label: 'High Yield', icon: Zap },
  { id: 'presentation', label: 'Presentation', icon: Activity },
  { id: 'diagnostics', label: 'Diagnostics', icon: Beaker },
  { id: 'management', label: 'Management', icon: Stethoscope },
];

// ---------------------------------------------------------------------------
// CollapsibleSection – Reduces scrolling fatigue on dense condition pages
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  icon: Icon,
  iconColor,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon?: React.ElementType;
  iconColor?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <section>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center gap-2 text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3 group cursor-pointer"
        aria-expanded={isOpen}
      >
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'} text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]`}
        />
        {Icon && <Icon className={`w-4 h-4 ${iconColor ?? 'text-[var(--color-accent)]'}`} />}
        {title}
      </button>
      {isOpen && children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Zone 2: "High Yield" Tab - Rapid Review & Differentiation
// ---------------------------------------------------------------------------

function HighYieldTab({ data }: Readonly<{ data: MedicalContent }>) {
  const triad = parseListField(data.classic_triad);
  const pearls = parseListField(data.clinical_pearls);
  const mnemonic = parseTextField(data.mnemonic);
  const buzzwords = parseListField(data.buzzwords);
  const goldStandard = parseTextField(data.gold_standard_dx);
  const firstLineRx = parseTextField(data.first_line_rx);
  const bestInitialTest = parseTextField(data.best_initial_test);
  const confusionPairs = data.ConfusionPair_ConfusionPair_correctConditionIdToMedicalContent ?? [];

  const hasContent = triad.length > 0 || pearls.length > 0 || mnemonic || buzzwords.length > 0
    || goldStandard || firstLineRx || bestInitialTest || confusionPairs.length > 0;

  if (!hasContent) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-text-muted)] italic">No high-yield content available yet for this condition.</p>
      </div>
    );
  }

  // Track which section is first for defaultOpen
  let sectionIndex = 0;

  return (
    <div className="space-y-6">
      {/* Classic Triad/Pentad — always open first */}
      {triad.length > 0 && (
        <CollapsibleSection
          title="Classic Triad / Pentad"
          icon={Target}
          defaultOpen={sectionIndex++ === 0}
        >
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {triad.map((item, idx) => (
              <div
                key={item}
                className="flex items-start gap-3 p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-bold text-sm shrink-0">
                  {idx + 1}
                </div>
                <span className="text-[var(--color-text-primary)] text-base leading-relaxed pt-1">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Differential Diagnosis Table */}
      {confusionPairs.length > 0 && (
        <CollapsibleSection
          title="Differential Diagnosis"
          icon={TrendingUp}
          defaultOpen={sectionIndex++ === 0}
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[var(--color-bg-secondary)]/50 border-b border-[var(--color-border)]">
                  <th className="text-left p-3 text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                    Suspect Condition
                  </th>
                  <th className="text-left p-3 text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                    Distinguishing Feature
                  </th>
                </tr>
              </thead>
              <tbody>
                {confusionPairs.map((pair) => {
                  // Prefer explicit conditionName, then selectedConditionId (which may be a name
                  // from the summary mapper), then mistakenForId. Filter out UUID-looking values.
                  const rawName =
                    pair.conditionName ?? pair.selectedConditionId ?? pair.mistakenForId;
                  const looksLikeUuid = rawName && /^[0-9a-f]{8}-[0-9a-f]{4}/.test(rawName);
                  const displayName = looksLikeUuid
                    ? 'Alternative Diagnosis'
                    : (rawName ?? 'Alternative Diagnosis');
                  return (
                    <tr key={pair.id} className="border-b border-[var(--color-border)]">
                      <td className="p-3 text-[var(--color-text-primary)] text-base leading-relaxed">
                        {displayName}
                      </td>
                      <td className="p-3 text-[var(--color-text-primary)] text-base leading-relaxed">
                        {pair.distinctiveFeature ?? pair.clinicalContext ?? 'See clinical pearls'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      {/* Quick Reference — Gold Standard, First Line, Best Initial Test */}
      {(goldStandard || firstLineRx || bestInitialTest) && (
        <CollapsibleSection
          title="Quick Reference"
          icon={Zap}
          iconColor="text-data-pass"
          defaultOpen={sectionIndex++ === 0}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {goldStandard && (
              <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                <h4 className="text-xs font-semibold text-[var(--color-text-muted)] mb-1 uppercase tracking-wide">
                  Gold Standard Dx
                </h4>
                <p className="text-[var(--color-text-primary)] text-base font-medium">{goldStandard}</p>
              </div>
            )}
            {bestInitialTest && (
              <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                <h4 className="text-xs font-semibold text-[var(--color-text-muted)] mb-1 uppercase tracking-wide">
                  Best Initial Test
                </h4>
                <p className="text-[var(--color-text-primary)] text-base font-medium">{bestInitialTest}</p>
              </div>
            )}
            {firstLineRx && (
              <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                <h4 className="text-xs font-semibold text-[var(--color-text-muted)] mb-1 uppercase tracking-wide">
                  First-Line Treatment
                </h4>
                <p className="text-[var(--color-text-primary)] text-base font-medium">{firstLineRx}</p>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Buzzwords */}
      {buzzwords.length > 0 && (
        <CollapsibleSection
          title="Buzzwords"
          icon={Tag}
          defaultOpen={sectionIndex++ === 0}
        >
          <div className="flex flex-wrap gap-2">
            {buzzwords.map((word) => (
              <span
                key={word}
                className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20"
              >
                {word}
              </span>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Clinical Pearls */}
      {(pearls.length > 0 || mnemonic) && (
        <CollapsibleSection
          title="Clinical Pearls"
          icon={Lightbulb}
          iconColor="text-data-provisional"
          defaultOpen={sectionIndex++ === 0}
        >
          <div className="space-y-3">
            {mnemonic && (
              <div className="p-4 rounded-xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30">
                <h4 className="text-xs font-semibold text-[var(--color-accent)] mb-2 uppercase tracking-wide">
                  Mnemonic
                </h4>
                <p className="text-[var(--color-text-primary)] text-base leading-relaxed font-medium">
                  {mnemonic}
                </p>
              </div>
            )}
            {pearls.length > 0 && (
              <ul className="space-y-2">
                {pearls.map((pearl) => (
                  <li
                    key={pearl}
                    className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-bg-secondary)]/50"
                  >
                    <span className="text-data-provisional shrink-0">•</span>
                    <span className="text-[var(--color-text-primary)] text-base leading-relaxed">
                      {pearl}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zone 3: "Presentation" Tab - Hx & Px
// ---------------------------------------------------------------------------

function PresentationTab({
  data,
  detailsLoadFailed,
}: Readonly<{ data: MedicalContent; detailsLoadFailed?: boolean }>) {
  const demographicText = (() => {
    const parts: string[] = [];
    const ageDemo = data.age_demographic;
    const genderBias = parseTextField(data.gender_bias);

    if (ageDemo && typeof ageDemo === 'object' && !Array.isArray(ageDemo)) {
      const o = ageDemo as Record<string, unknown>;
      if (o.range && typeof o.range === 'string') parts.push(o.range);
      if (o.peak && typeof o.peak === 'string') parts.push(`Peak: ${o.peak}`);
    } else if (typeof ageDemo === 'string') {
      parts.push(ageDemo);
    }
    if (genderBias) parts.push(genderBias);
    return parts.length ? parts.join(' • ') : null;
  })();

  const classicPatient = parseTextField(data.classic_patient);
  const symptoms = parseTextField(data.symptoms);
  const physicalExam = parseTextField(data.physicalExam);
  const riskFactors = parseTextField(data.riskFactors);
  const etiology = parseTextField(data.etiology);
  const epidemiology = parseTextField(data.epidemiology);
  const findings = data.FindingConditionLink ?? [];

  if (detailsLoadFailed) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-text-muted)] italic">
          Details couldn&apos;t be loaded. Use the Retry button above to try again.
        </p>
      </div>
    );
  }

  const hasContent =
    demographicText ||
    classicPatient ||
    symptoms ||
    physicalExam ||
    riskFactors ||
    etiology ||
    epidemiology ||
    findings.length > 0;

  if (!hasContent) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-text-muted)] italic">
          We&apos;re still enriching this section. High-yield cards remain available above.
        </p>
      </div>
    );
  }

  let sectionIndex = 0;

  return (
    <div className="space-y-6">
      {/* Clinical Vignette — always first & open */}
      {classicPatient && (
        <CollapsibleSection title="Clinical Vignette" defaultOpen={sectionIndex++ === 0}>
          <div className="p-4 rounded-xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 italic">
            <p className="text-[var(--color-text-primary)] text-base leading-relaxed">
              &quot;{classicPatient}&quot;
            </p>
          </div>
        </CollapsibleSection>
      )}

      {/* Epidemiology */}
      {(demographicText || epidemiology) && (
        <CollapsibleSection title="Epidemiology" icon={User} defaultOpen={sectionIndex++ === 0}>
          <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] space-y-2">
            {demographicText && (
              <p className="text-[var(--color-text-primary)] text-base leading-relaxed">
                {demographicText}
              </p>
            )}
            {epidemiology && (
              <ContentFieldRenderer value={epidemiology} className="text-base leading-relaxed" />
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Risk Factors & Etiology */}
      {(riskFactors || etiology) && (
        <CollapsibleSection title="Risk Factors & Etiology" defaultOpen={sectionIndex++ === 0}>
          <div className="space-y-3">
            {riskFactors && (
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-muted)] mb-2">
                  Risk Factors
                </h4>
                <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]/50">
                  <ContentFieldRenderer
                    value={riskFactors}
                    variant="clinical"
                    className="text-base leading-relaxed"
                  />
                </div>
              </div>
            )}
            {etiology && (
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-muted)] mb-2">
                  Etiology
                </h4>
                <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]/50">
                  <ContentFieldRenderer
                    value={etiology}
                    variant="clinical"
                    className="text-base leading-relaxed"
                  />
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Signs & Symptoms - Subjective vs Objective */}
      {(symptoms || physicalExam || findings.length > 0) && (
        <CollapsibleSection title="Signs & Symptoms" defaultOpen={sectionIndex++ === 0}>
          <div className="grid gap-4 md:grid-cols-2">
            {symptoms && (
              <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                <h4 className="text-sm font-semibold text-[var(--color-text-muted)] mb-2 uppercase">
                  Subjective (History)
                </h4>
                <ContentFieldRenderer
                  value={symptoms}
                  variant="clinical"
                  className="text-base leading-relaxed"
                />
              </div>
            )}
            {(physicalExam || findings.length > 0) && (
              <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                <h4 className="text-sm font-semibold text-[var(--color-text-muted)] mb-2 uppercase">
                  Objective (Physical Exam)
                </h4>
                {physicalExam && (
                  <ContentFieldRenderer
                    value={physicalExam}
                    variant="clinical"
                    className="text-base leading-relaxed"
                  />
                )}
                {findings.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {findings.map((f) => (
                      <li
                        key={f.id}
                        className="text-base leading-relaxed text-[var(--color-text-primary)]"
                      >
                        • {f.PhysicalExamFinding?.displayName ?? f.PhysicalExamFinding?.name}
                        {(f.clinicalContext || f.relationshipType) && (
                          <span className="text-[var(--color-text-muted)] ml-1">
                            ({f.clinicalContext ?? f.relationshipType})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zone 4: "Diagnostics" Tab - Workup Hierarchy
// ---------------------------------------------------------------------------

function DiagnosticsTab({
  data,
  detailsLoadFailed,
}: Readonly<{ data: MedicalContent; detailsLoadFailed?: boolean }>) {
  const bestInitial = parseTextField(data.best_initial_test);
  const goldStandard = parseTextField(data.gold_standard_dx);
  const diagnostics = parseTextField(data.diagnostics);
  const labs = data.LabConditionLink ?? [];
  const imaging = data.ImagingConditionLink ?? [];
  const ecg = data.ECGConditionLink ?? [];

  if (detailsLoadFailed) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-text-muted)] italic">
          Details couldn&apos;t be loaded. Use the Retry button above to try again.
        </p>
      </div>
    );
  }

  const hasContent =
    bestInitial ||
    goldStandard ||
    diagnostics ||
    labs.length > 0 ||
    imaging.length > 0 ||
    ecg.length > 0;

  if (!hasContent) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-text-muted)] italic">
          We&apos;re still enriching this section. High-yield cards remain available above.
        </p>
      </div>
    );
  }

  let sectionIndex = 0;

  return (
    <div className="space-y-6">
      {/* Diagnostic Criteria - Screening & Confirmatory — always open first */}
      {(bestInitial || goldStandard) && (
        <CollapsibleSection title="Diagnostic Criteria" defaultOpen={sectionIndex++ === 0}>
          <div className="space-y-3">
            {bestInitial && (
              <div className="p-4 rounded-xl bg-data-pass/10 border border-data-pass/30">
                <div className="flex items-start gap-3">
                  <div className="px-2 py-0.5 rounded text-xs font-bold bg-data-pass/30 text-data-pass shrink-0">
                    SCREENING
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-data-pass mb-1 uppercase tracking-wide">
                      Best Initial Test
                    </h4>
                    <p className="text-[var(--color-text-primary)] text-base leading-relaxed">
                      {bestInitial}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {goldStandard && (
              <div className="p-4 rounded-xl bg-data-provisional/10 border border-data-provisional/30">
                <div className="flex items-start gap-3">
                  <div className="px-2 py-0.5 rounded text-xs font-bold bg-data-provisional/30 text-data-provisional shrink-0">
                    CONFIRMATORY
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-data-provisional mb-1 uppercase tracking-wide">
                      Gold Standard
                    </h4>
                    <p className="text-[var(--color-text-primary)] text-base leading-relaxed">
                      {goldStandard}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Findings - Labs, Imaging */}
      {(labs.length > 0 || imaging.length > 0 || ecg.length > 0) && (
        <CollapsibleSection title="Findings" defaultOpen={sectionIndex++ === 0}>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Labs Column */}
            {labs.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-[var(--color-text-muted)] mb-2 flex items-center gap-2 uppercase">
                  <TestTube className="w-4 h-4" />
                  Labs
                </h4>
                <ul className="space-y-2">
                  {labs.map((lab) => (
                    <li
                      key={lab.id}
                      className="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
                    >
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {lab.LabTest?.displayName ?? lab.LabTest?.name}
                      </span>
                      {(lab.expectedResult || lab.significance) && (
                        <p className="text-sm text-[var(--color-text-muted)] mt-1">
                          {[lab.expectedResult, lab.significance].filter(Boolean).join(' • ')}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Imaging Column */}
            {(imaging.length > 0 || ecg.length > 0) && (
              <div className="space-y-4">
                {imaging.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--color-text-muted)] mb-2 flex items-center gap-2 uppercase">
                      <ImageIcon className="w-4 h-4" />
                      Imaging
                    </h4>
                    <ul className="space-y-2">
                      {imaging.map((img) => (
                        <li
                          key={img.id}
                          className="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
                        >
                          <span className="font-medium text-[var(--color-text-primary)]">
                            {img.ImagingStudy?.displayName ?? img.ImagingStudy?.name}
                          </span>
                          {(img.classicFindings || img.expectedFindings) && (
                            <p className="text-sm text-[var(--color-text-muted)] mt-1">
                              {img.classicFindings ?? img.expectedFindings?.join(', ')}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {ecg.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--color-text-muted)] mb-2 flex items-center gap-2 uppercase">
                      <Activity className="w-4 h-4" />
                      ECG
                    </h4>
                    <ul className="space-y-2">
                      {ecg.map((e) => (
                        <li
                          key={e.id}
                          className="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
                        >
                          <span className="font-medium text-[var(--color-text-primary)]">
                            {e.ECGPattern?.displayName ?? e.ECGPattern?.name}
                          </span>
                          {e.findingDescription && (
                            <p className="text-sm text-[var(--color-text-muted)] mt-1">
                              {e.findingDescription}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Additional Diagnostics */}
      {diagnostics && (
        <CollapsibleSection title="Additional Diagnostics" defaultOpen={sectionIndex++ === 0}>
          <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
            <ContentFieldRenderer
              value={diagnostics}
              variant="clinical"
              className="text-base leading-relaxed"
            />
          </div>
        </CollapsibleSection>
      )}

      {/* Classic Findings Gallery */}
      {(() => {
        const diagnosticImages = (data.MediaAsset ?? [])
          .filter((asset) => {
            const mod = asset.modality?.toLowerCase() || '';
            return (
              mod.includes('radiology') ||
              mod.includes('x-ray') ||
              mod.includes('ct') ||
              mod.includes('mri') ||
              mod.includes('ecg') ||
              mod.includes('ekg') ||
              mod.includes('histology') ||
              mod.includes('pathology') ||
              mod.includes('imaging')
            );
          })
          .sort((a, b) => {
            // Sort by: isClassic first, then quality score
            if (a.isClassicPortrayal && !b.isClassicPortrayal) return -1;
            if (!a.isClassicPortrayal && b.isClassicPortrayal) return 1;
            return (b.qualityScore ?? 0) - (a.qualityScore ?? 0);
          });

        if (diagnosticImages.length === 0) return null;

        return (
          <section>
            <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Classic Findings
            </h3>
            <ImageGallery
              images={diagnosticImages.map((asset) => ({
                id: asset.id,
                src: asset.thumbnailUrl || asset.originalUrl || '',
                alt:
                  asset.altText ||
                  asset.description ||
                  `${data.condition} ${asset.modality || 'imaging'}`,
                title:
                  asset.description ||
                  `${data.condition} - ${asset.modality || 'Diagnostic Image'}`,
                source: asset.attribution || 'Open-i / NLM',
                license: asset.licenseType || 'OPEN_ACCESS_CC_BY',
                attribution: asset.attribution,
                modality: asset.modality,
                isClassic: asset.isClassicPortrayal,
                caption: asset.description,
              }))}
              columns={3}
            />
          </section>
        );
      })()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zone 5: "Management" Tab - Therapeutics & Disposition
// ---------------------------------------------------------------------------

function ManagementTab({
  data,
  detailsLoadFailed,
}: Readonly<{ data: MedicalContent; detailsLoadFailed?: boolean }>) {
  const firstLine = parseTextField(data.first_line_rx);
  const treatment = parseTextField(data.treatment);
  const disposition = parseTextField(data.disposition);
  const complications = parseTextField(data.complications);
  const prognosis = parseTextField(data.prognosis);
  const prevention = parseTextField(data.prevention);
  const patientEd = parseTextField(data.patient_education);

  const drugs = data.DrugConditionLink ?? [];
  const treatments = data.TreatmentConditionLink ?? [];

  const firstLineDrug = drugs.find((d) => d.isFirstLine);
  const firstLineTreatment = treatments.find((t) => t.isFirstLine);

  const firstLineFromLinks = (() => {
    if (firstLineDrug?.Drug?.genericName) return firstLineDrug.Drug.genericName;
    if (firstLineDrug?.Drug?.brandName) return firstLineDrug.Drug.brandName;
    if (firstLineTreatment?.Treatment?.name) return firstLineTreatment.Treatment.name;
    return null;
  })();

  const alternatives = [
    ...drugs.filter((d) => !d.isFirstLine),
    ...treatments.filter((t) => !t.isFirstLine),
  ];

  // Even when details fail to load, drug/treatment links come from the basic query
  // and may still be available. Show partial content instead of a blank slate.
  const hasBasicContent = firstLine || firstLineFromLinks || alternatives.length > 0;

  if (detailsLoadFailed && !hasBasicContent) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-text-muted)] italic">
          Details couldn&apos;t be loaded. Use the Retry button above to try again.
        </p>
      </div>
    );
  }

  const hasContent =
    firstLine ||
    firstLineFromLinks ||
    alternatives.length > 0 ||
    treatment ||
    disposition ||
    complications ||
    prognosis ||
    prevention ||
    patientEd;

  if (!hasContent) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-text-muted)] italic">
          We&apos;re still enriching this section. High-yield cards remain available above.
        </p>
      </div>
    );
  }

  let sectionIndex = 0;

  return (
    <div className="space-y-6">
      {/* Degraded state banner when details failed but drug links are available */}
      {detailsLoadFailed && hasBasicContent && (
        <div className="p-3 rounded-lg bg-data-provisional/10 border border-data-provisional/30 text-sm text-[var(--color-text-muted)]">
          Some details couldn&apos;t be loaded. Showing available treatment information.
        </div>
      )}

      {/* Pharmacotherapy - First Line Rx — always open first */}
      {(firstLine || firstLineFromLinks) && (
        <CollapsibleSection
          title="Pharmacotherapy"
          icon={Pill}
          iconColor="text-data-pass"
          defaultOpen={sectionIndex++ === 0}
        >
          <div className="p-4 rounded-xl bg-data-pass/10 border border-data-pass/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-data-pass/30 text-data-pass">
                FIRST-LINE
              </span>
            </div>
            <p className="text-lg font-semibold text-[var(--color-text-primary)]">
              {firstLine ?? firstLineFromLinks}
            </p>
          </div>
          {alternatives.length > 0 && (
            <div className="mt-3">
              <h4 className="text-sm font-semibold text-[var(--color-text-muted)] mb-2">
                If Allergy / Contraindication
              </h4>
              <ul className="space-y-1">
                {alternatives.map((alt) => {
                  let name = 'Alternative';
                  if ('Drug' in alt && alt.Drug) {
                    name =
                      alt.Drug.genericName ?? alt.Drug.brandName ?? alt.Drug.name ?? 'Alternative';
                  } else if ('Treatment' in alt && alt.Treatment) {
                    name = alt.Treatment.name ?? 'Alternative';
                  }
                  return (
                    <li
                      key={alt.id}
                      className="text-[var(--color-text-primary)] text-base leading-relaxed"
                    >
                      • {name}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Treatment Approach */}
      {treatment && (
        <CollapsibleSection title="Treatment Approach" defaultOpen={sectionIndex++ === 0}>
          <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
            <ContentFieldRenderer
              value={treatment}
              variant="clinical"
              className="text-base leading-relaxed"
            />
          </div>
        </CollapsibleSection>
      )}

      {/* Disposition */}
      {disposition && (
        <CollapsibleSection
          title="Disposition"
          icon={Stethoscope}
          defaultOpen={sectionIndex++ === 0}
        >
          <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
            <ContentFieldRenderer value={disposition} className="text-base leading-relaxed" />
          </div>
        </CollapsibleSection>
      )}

      {/* Clinical Safety - Complications */}
      {complications && (
        <CollapsibleSection
          title="Clinical Safety"
          icon={AlertTriangle}
          iconColor="text-data-provisional"
          defaultOpen={sectionIndex++ === 0}
        >
          <div className="p-4 rounded-xl bg-data-provisional/5 border border-data-provisional/20">
            <h4 className="text-sm font-semibold text-data-provisional mb-2 uppercase tracking-wide">
              Complications
            </h4>
            <ContentFieldRenderer
              value={complications}
              variant="clinical"
              className="text-base leading-relaxed"
            />
          </div>
        </CollapsibleSection>
      )}

      {/* Prognosis */}
      {prognosis && (
        <CollapsibleSection title="Prognosis" defaultOpen={sectionIndex++ === 0}>
          <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
            <ContentFieldRenderer value={prognosis} className="text-base leading-relaxed" />
          </div>
        </CollapsibleSection>
      )}

      {/* Prevention & Patient Education */}
      {(prevention || patientEd) && (
        <CollapsibleSection
          title="Counseling Points"
          icon={Heart}
          iconColor="text-[var(--color-data-fail)]"
          defaultOpen={sectionIndex++ === 0}
        >
          <div className="space-y-3">
            {prevention && (
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-muted)] mb-2">
                  Prevention
                </h4>
                <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]/50">
                  <ContentFieldRenderer value={prevention} className="text-base leading-relaxed" />
                </div>
              </div>
            )}
            {patientEd && (
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-muted)] mb-2">
                  Patient Education
                </h4>
                <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]/50">
                  <ContentFieldRenderer value={patientEd} className="text-base leading-relaxed" />
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component (Internal - receives data directly)
// ---------------------------------------------------------------------------

interface SmartConditionViewCoreProps {
  data: MedicalContent;
  onClose?: () => void;
  /** True while the details endpoint is still loading */
  isLoadingDetails?: boolean;
  /** Error message from the details endpoint */
  errorDetails?: string | null;
  /** Retry function for details fetch */
  onRetryDetails?: () => void;
}

const SmartConditionViewCore: React.FC<SmartConditionViewCoreProps> = ({
  data,
  onClose,
  isLoadingDetails = false,
  errorDetails,
  onRetryDetails,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('highyield');
  const detailsLoadFailed = !!errorDetails;

  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--color-bg-primary)]">
      {/* Zone 1: Clinical Summary Header */}
      <div className="sticky top-0 z-10 bg-[var(--color-bg-primary)] border-b border-[var(--color-border)]">
        <div className="p-4 md:p-6">
          {/* Condition Name with close button */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-text-primary)]">
                {data.condition}
              </h1>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close"
              >
                <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)] rotate-180" />
              </button>
            )}
          </div>

          {/* Yield Badge and System */}
          {(data.pance_yield || data.system) && (
            <div className="flex flex-wrap items-center gap-3 mb-3">
              {data.pance_yield && (
                <div className="flex items-center gap-2">
                  <YieldBadge yield={data.pance_yield} size="md" />
                  <span className="text-sm text-[var(--color-text-muted)]">—</span>
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {(() => {
                      if (data.pance_yield >= 3) return 'High Yield';
                      if (data.pance_yield === 2) return 'Medium Yield';
                      return 'Low Yield';
                    })()}
                  </span>
                </div>
              )}
              {data.system && (
                <Badge variant="category" className="text-sm">
                  {data.system}
                  {data.subcategory && ` • ${data.subcategory}`}
                </Badge>
              )}
            </div>
          )}

          {/* Terminology & Buzzwords */}
          {(() => {
            const synonyms = parseListField(data.synonyms);
            const buzzwords = parseListField(data.buzzwords);
            return (
              <>
                {synonyms.length > 0 && (
                  <div className="flex items-start gap-2 mb-3">
                    <span className="text-sm font-semibold text-[var(--color-text-muted)] shrink-0">
                      AKA:
                    </span>
                    <span className="text-sm text-[var(--color-text-primary)]">
                      {synonyms.join(', ')}
                    </span>
                  </div>
                )}
                {buzzwords.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                      Keywords
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {buzzwords.map((word) => (
                        <Badge key={word} variant="highYield" className="text-sm">
                          {word}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 p-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/20 overflow-x-auto">
        {TAB_CONFIG.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] min-w-[44px]
              ${
                activeTab === id
                  ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] border border-[var(--color-accent)]/40'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]'
              }
            `}
            aria-label={label}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content - min-h-0 so overflow-y-auto can scroll when embedded */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 md:p-6">
        {/* Details-fetch error banner — only shown on tabs that require details data */}
        {errorDetails && activeTab !== 'highyield' && (
          <div className="mb-4 rounded-lg border border-[var(--color-data-fail)]/40 bg-[var(--color-data-fail)]/10 px-4 py-3 text-sm text-[var(--color-text-secondary)]">
            <div className="flex items-center justify-between gap-3">
              <span>
                Unable to load full details. The High Yield tab is still available.
              </span>
              {onRetryDetails && (
                <button
                  onClick={onRetryDetails}
                  className="flex-shrink-0 rounded-md px-3 py-1 font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === 'highyield' && (
            <motion.div
              key="highyield"
              initial={{ y: 8 }}
              animate={{ y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <ErrorBoundary>
                <HighYieldTab data={data} />
              </ErrorBoundary>
            </motion.div>
          )}
          {activeTab === 'presentation' && (
            <motion.div
              key="presentation"
              initial={{ y: 8 }}
              animate={{ y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <ErrorBoundary>
                {isLoadingDetails ? (
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-2/3" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : (
                  <PresentationTab data={data} detailsLoadFailed={detailsLoadFailed} />
                )}
              </ErrorBoundary>
            </motion.div>
          )}
          {activeTab === 'diagnostics' && (
            <motion.div
              key="diagnostics"
              initial={{ y: 8 }}
              animate={{ y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <ErrorBoundary>
                {isLoadingDetails ? (
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-2/3" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : (
                  <DiagnosticsTab data={data} detailsLoadFailed={detailsLoadFailed} />
                )}
              </ErrorBoundary>
            </motion.div>
          )}
          {activeTab === 'management' && (
            <motion.div
              key="management"
              initial={{ y: 8 }}
              animate={{ y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <ErrorBoundary>
                {isLoadingDetails ? (
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-2/3" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : (
                  <ManagementTab data={data} detailsLoadFailed={detailsLoadFailed} />
                )}
              </ErrorBoundary>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Public Component (Wrapper - supports both conditionId and data props)
// ---------------------------------------------------------------------------

export interface SmartConditionViewProps {
  /** Direct data prop (new specification) */
  data?: MedicalContent;
  /** Condition ID for hook-based loading (backward compatibility) */
  conditionId?: string;
  /** Close handler */
  onClose?: () => void;
  /** Embedded mode (deprecated, kept for compatibility) */
  embedded?: boolean;
}

export const SmartConditionView: React.FC<SmartConditionViewProps> = ({
  data: dataProp,
  conditionId,
  onClose,
  embedded,
}) => {
  // Hook-based loading (when conditionId is provided)
  const {
    summary,
    details,
    isLoadingSummary,
    isLoadingDetails,
    errorSummary,
    errorDetails,
    fetchDetails,
    refetchSummary,
  } = useSmartCondition(conditionId);

  // Auto-fetch details once on mount (not on every render).
  // Guard: skip if already loaded, already loading, or already errored (prevents retry storm).
  useEffect(() => {
    if (conditionId && !details && !isLoadingDetails && !errorDetails) {
      fetchDetails();
    }
  }, [conditionId, details, isLoadingDetails, errorDetails, fetchDetails]);

  // If data prop is provided directly, use it (no loading/error states since data is complete)
  if (dataProp) {
    return <SmartConditionViewCore data={dataProp} onClose={onClose} />;
  }

  // Otherwise, use hook-based loading
  if (!conditionId) {
    return (
      <div className="p-6">
        <EmptyState title="Error" description="No condition data or conditionId provided" action={{ label: 'Try Again', onClick: onClose }} />
      </div>
    );
  }

  if (isLoadingSummary) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-32 w-full" />
        <div className="flex gap-2">
          {TAB_CONFIG.map(({ id }) => (
            <Skeleton key={`skeleton-${id}`} className="h-10 w-24" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (errorSummary || !summary) {
    return (
      <div className="p-6">
        <EmptyState
          title="Condition not found"
          description={errorSummary ?? "We couldn't load this condition."}
          action={{ label: 'Try Again', onClick: refetchSummary }}
        />
      </div>
    );
  }

  // Merge summary and details into MedicalContent format
  const mergedData: MedicalContent = {
    id: summary.id,
    conditionId: summary.conditionId,
    system: summary.system,
    condition: summary.condition,
    pance_yield: summary.pance_yield,
    buzzwords: summary.buzzwords,
    synonyms: summary.synonyms,
    classic_triad: summary.classic_triad,
    clinical_pearls: summary.clinical_pearls,
    mnemonic: summary.mnemonic,
    ConfusionPair_ConfusionPair_correctConditionIdToMedicalContent: summary.confusedWith.map(
      (c) => ({
        id: c.id,
        mistakenForId: c.conditionId,
        selectedConditionId: c.condition,
        conditionName: c.condition, // Explicit display name for UUID guard
      })
    ),
    // Add details if loaded
    ...(details
      ? {
          subcategory: details.subcategory,
          symptoms: details.symptoms,
          physicalExam: details.physicalExam,
          treatment: details.treatment,
          diagnostics: details.diagnostics,
          best_initial_test: details.best_initial_test,
          gold_standard_dx: details.gold_standard_dx,
          first_line_rx: details.first_line_rx,
          disposition: details.disposition,
          complications: details.complications,
          prognosis: details.prognosis,
          prevention: details.prevention,
          patient_education: details.patient_education,
          age_demographic: details.age_demographic,
          gender_bias: details.gender_bias,
          classic_patient: details.classic_patient,
          riskFactors: details.riskFactors,
          etiology: details.etiology,
          epidemiology: details.epidemiology,
          differentialDiagnosis: details.differentialDiagnosis,
          LabConditionLink: details.LabConditionLink,
          ImagingConditionLink: details.ImagingConditionLink,
          DrugConditionLink: details.DrugConditionLink,
          TreatmentConditionLink: details.TreatmentConditionLink,
          FindingConditionLink: details.FindingConditionLink,
          ECGConditionLink: details.ECGConditionLink,
        }
      : {}),
  };

  return (
    <SmartConditionViewCore
      data={mergedData}
      onClose={onClose}
      isLoadingDetails={isLoadingDetails}
      errorDetails={errorDetails}
      onRetryDetails={fetchDetails}
    />
  );
};

export default SmartConditionView;
