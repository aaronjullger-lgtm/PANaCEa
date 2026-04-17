/**
 * referenceConfigs.tsx
 *
 * ReferenceViewConfig definitions for all 11 entity types that plug into
 * GenericReferenceView. Each config provides API endpoint, filters, card
 * renderer, detail renderer, search fields, and optional drill params.
 *
 * Visual hierarchy (3 tiers):
 *   1. CRITICAL — red left-border + warning bg (contraindications, emergencies)
 *   2. CLINICAL — standard rendering (descriptions, mechanisms, technique)
 *   3. STUDY   — PANCE Focus accordion at top of detail view
 */

import React from 'react';
import type { ReferenceViewConfig, FilterField } from './GenericReferenceView';
import {
  Scissors, Scan, Activity, Bone, TestTube2,
  Brain, Stethoscope, BookOpen, ClipboardList,
  Star, AlertTriangle, Zap, MapPin,
  FlaskConical, Calculator, ChevronRight,
} from 'lucide-react';

// ============================================================================
// TYPOGRAPHY TOKENS
// ============================================================================

const FONT_HEADING = "'Poppins', system-ui, sans-serif";
const FONT_BODY = "'Inter', system-ui, sans-serif";
const FONT_MONO = "'JetBrains Mono', 'Fira Code', monospace";

// ============================================================================
// SHARED HELPERS
// ============================================================================

const badge = (text: string, bg: string, color: string) => (
  <span style={{
    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999,
    background: bg, color, whiteSpace: 'nowrap', fontFamily: FONT_BODY,
  }}>{text}</span>
);

const highYieldBadge = () => badge('★ High Yield', '#fef3c7', '#92400e');

const arrayPreview = (arr: string[] | undefined, max = 3) => {
  if (!arr?.length) return null;
  const shown = arr.slice(0, max);
  const more = arr.length - max;
  return (
    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: FONT_BODY }}>
      {shown.join(' · ')}{more > 0 ? ` +${more} more` : ''}
    </span>
  );
};

/** Card title — Poppins heading font */
const cardTitle = (text: string) => (
  <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text-primary)', fontFamily: FONT_HEADING }}>
    {text}
  </span>
);

// ---- Standard detail section (clinical tier) ----
const detailSection = (label: string, content: React.ReactNode) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{
      fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: 0.6, color: 'var(--color-text-secondary)',
      marginBottom: 4, fontFamily: FONT_BODY,
    }}>
      {label}
    </div>
    <div style={{
      fontSize: 14, color: 'var(--color-text-primary)',
      lineHeight: 1.6, fontFamily: FONT_BODY,
    }}>
      {content}
    </div>
  </div>
);

// ---- Critical detail section (safety tier — contraindications, emergencies) ----
const detailSectionCritical = (label: string, content: React.ReactNode) => (
  <div style={{
    marginBottom: 14, padding: '10px 12px', borderRadius: 8,
    borderLeft: '3px solid #ef4444',
    background: 'color-mix(in srgb, var(--color-bg-secondary) 80%, #fef2f2 20%)',
  }}>
    <div style={{
      fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: 0.6, color: '#dc2626', marginBottom: 4,
      fontFamily: FONT_BODY, display: 'flex', alignItems: 'center', gap: 5,
    }}>
      <AlertTriangle size={12} /> {label}
    </div>
    <div style={{
      fontSize: 14, color: 'var(--color-text-primary)',
      lineHeight: 1.6, fontFamily: FONT_BODY,
    }}>
      {content}
    </div>
  </div>
);

// ---- Critical list variant ----
const detailListCritical = (label: string, items: string[] | undefined) => {
  if (!items?.length) return null;
  return detailSectionCritical(label, (
    <ul style={{ margin: 0, paddingLeft: 18 }}>
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  ));
};

const detailList = (label: string, items: string[] | undefined) => {
  if (!items?.length) return null;
  return detailSection(label, (
    <ul style={{ margin: 0, paddingLeft: 18 }}>
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  ));
};

/** Monospace clinical data display — for lab ranges, dosages, sensitivity/specificity */
const clinicalData = (text: string) => (
  <span style={{ fontFamily: FONT_MONO, fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
    {text}
  </span>
);

/** Diagnostic accuracy display with mono font */
const diagnosticAccuracy = (vals: { label: string; value: string }[]) => (
  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
    {vals.map(({ label, value }) => (
      <span key={label} style={{ fontFamily: FONT_BODY, fontSize: 14 }}>
        {label}: <strong style={{ fontFamily: FONT_MONO, fontVariantNumeric: 'tabular-nums' }}>{value}</strong>
      </span>
    ))}
  </div>
);

// ---- Collapsible detail group for progressive disclosure ----
const detailGroup = (title: string, children: React.ReactNode) => (
  <details open style={{ marginBottom: 16 }}>
    <summary style={{
      fontSize: 13, fontWeight: 700, fontFamily: FONT_HEADING,
      color: 'var(--color-text-primary)', cursor: 'pointer',
      padding: '8px 0', borderBottom: '1px solid var(--color-border)',
      marginBottom: 10, listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <ChevronRight size={14} style={{ transition: 'transform 0.15s' }} />
      {title}
    </summary>
    <div>{children}</div>
  </details>
);

// ---- Cross-reference hint to related sections ----
const crossRefHint = (text: string, icon?: React.ReactNode) => (
  <div style={{
    marginBottom: 14, padding: '8px 12px', borderRadius: 8,
    background: 'color-mix(in srgb, var(--color-bg-secondary) 90%, var(--color-accent, #3b82f6) 10%)',
    border: '1px dashed var(--color-border)',
    fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: FONT_BODY,
    display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.5,
  }}>
    {icon || <BookOpen size={13} />}
    {text}
  </div>
);

// ---- PANCE Focus accordion (study tier — positioned at TOP of detail) ----
const studyPanel = (pearls?: string[], tips?: string[], mistakes?: string[], mnemonics?: string[], boardFacts?: string[], accentColor?: string) => {
  const sections = [
    { label: 'Board Yield Facts', items: boardFacts, emoji: '🎯' },
    { label: 'Clinical Pearls', items: pearls, emoji: '💎' },
    { label: 'Test Question Tips', items: tips, emoji: '📝' },
    { label: 'Common Mistakes', items: mistakes, emoji: '⚠️' },
    { label: 'Mnemonics', items: mnemonics, emoji: '🧠' },
  ].filter(s => s.items?.length);

  if (!sections.length) return null;

  const counts = sections.map(s => `${s.items!.length} ${s.label.toLowerCase().replace(/^board yield /, '').replace(/^test question /, '').replace(/^common /, '')}`).join(' · ');

  return (
    <details style={{
      marginBottom: 16, borderRadius: 10,
      border: `1px solid ${accentColor || 'var(--color-border)'}`,
      background: 'var(--color-bg-secondary)',
      overflow: 'hidden',
    }}>
      <summary style={{
        padding: '10px 14px', cursor: 'pointer', listStyle: 'none',
        display: 'flex', alignItems: 'center', gap: 8,
        fontFamily: FONT_HEADING, fontSize: 14, fontWeight: 700,
        color: accentColor || 'var(--color-text-primary)',
        borderLeft: `3px solid ${accentColor || 'var(--color-text-primary)'}`,
      }}>
        <span>📚 PANCE Focus</span>
        <span style={{
          fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)',
          fontFamily: FONT_BODY, marginLeft: 'auto',
        }}>
          {counts}
        </span>
        <ChevronRight size={14} style={{ color: 'var(--color-text-secondary)', transition: 'transform 0.15s' }} />
      </summary>
      <div style={{ padding: '4px 14px 14px' }}>
        {sections.map(({ label, items, emoji }) => (
          <details key={label} open style={{ marginBottom: 6 }}>
            <summary style={{
              fontSize: 12, fontWeight: 700, fontFamily: FONT_BODY,
              textTransform: 'uppercase', letterSpacing: 0.6,
              color: 'var(--color-text-secondary)', cursor: 'pointer',
              padding: '4px 0', listStyle: 'none',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span>{emoji}</span> {label}
            </summary>
            <ul style={{ margin: '4px 0 8px', paddingLeft: 18, fontSize: 14, lineHeight: 1.6, fontFamily: FONT_BODY, color: 'var(--color-text-primary)' }}>
              {items!.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </details>
        ))}
      </div>
    </details>
  );
};

// ============================================================================
// 1. PROCEDURES
// ============================================================================

interface ProcedureItem {
  id: string; name: string; displayName?: string; category?: string;
  type?: string; system?: string; description?: string;
  isHighYield?: boolean; panceYield?: number;
  indications?: string[]; complications?: string[];
  technique?: string; preparation?: string; duration?: string;
  absoluteContraindications?: string[]; relativeContraindications?: string[];
  clinicalPearls?: string[]; testQuestionTips?: string[];
  commonMistakes?: string[]; mnemonics?: string[]; boardYieldFacts?: string[];
  equipment?: string[]; postProcedureCare?: string;
}

export const procedureConfig: ReferenceViewConfig<ProcedureItem> = {
  entityName: 'Procedures',
  entityNameSingular: 'Procedure',
  entitySlug: 'procedures',
  icon: Scissors,
  accentColor: '#8b5cf6',
  apiEndpoint: '/api/reference/procedures',
  getId: (p) => p.id,
  getDisplayName: (p) => p.displayName || p.name,
  getSubtitle: (p) => p.category,
  isHighYield: (p) => !!p.isHighYield,
  getPanceYield: (p) => p.panceYield,
  searchFields: [
    (p) => p.name, (p) => p.displayName, (p) => p.description,
    (p) => p.category, (p) => p.system,
  ],
  filters: [
    { key: 'category', label: 'Categories', autoDerive: true, accessor: (p: ProcedureItem) => p.category },
    { key: 'system', label: 'Systems', autoDerive: true, accessor: (p: ProcedureItem) => p.system },
    { key: 'type', label: 'Types', autoDerive: true, accessor: (p: ProcedureItem) => p.type },
  ],
  getDrillParams: (p) => ({ system: p.system, tag: p.name }),
  cardRenderer: (p, expanded) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {cardTitle(p.displayName || p.name)}
        {p.isHighYield && highYieldBadge()}
        {p.category && badge(p.category, '#f3e8ff', '#7c3aed')}
      </div>
      {!expanded && p.description && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: FONT_BODY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</p>
      )}
    </div>
  ),
  detailRenderer: (p) => (
    <div>
      {studyPanel(p.clinicalPearls, p.testQuestionTips, p.commonMistakes, p.mnemonics, p.boardYieldFacts, '#8b5cf6')}
      {detailGroup('Preparation', <>
        {p.description && detailSection('Description', p.description)}
        {p.preparation && detailSection('Preparation', p.preparation)}
        {detailList('Equipment', p.equipment)}
        {p.duration && detailSection('Duration', p.duration)}
      </>)}
      {detailGroup('Technique', <>
        {p.technique && detailSection('Technique', p.technique)}
      </>)}
      {detailGroup('Safety', <>
        {detailList('Indications', p.indications)}
        {detailListCritical('Absolute Contraindications', p.absoluteContraindications)}
        {detailListCritical('Relative Contraindications', p.relativeContraindications)}
        {detailListCritical('Complications', p.complications)}
      </>)}
      {p.postProcedureCare && detailGroup('Follow-Up', <>
        {detailSection('Post-Procedure Care', p.postProcedureCare)}
      </>)}
    </div>
  ),
};

// ============================================================================
// 2. IMAGING STUDIES
// ============================================================================

interface ImagingItem {
  id: string; name: string; modality?: string; bodyRegion?: string;
  description?: string; isHighYield?: boolean; panceYield?: number;
  usesContrast?: boolean; usesRadiation?: boolean;
  indications?: string[]; contraindications?: string[];
  classicSigns?: string[]; firstLineFor?: string[];
  limitations?: string[]; advantages?: string[];
  clinicalPearls?: string[]; testQuestionTips?: string[];
  commonMistakes?: string[]; boardYieldFacts?: string[];
  normalFindings?: string; preparation?: string;
  scanDuration?: string; radiationDose?: string;
}

export const imagingConfig: ReferenceViewConfig<ImagingItem> = {
  entityName: 'Imaging Studies',
  entityNameSingular: 'Imaging Study',
  entitySlug: 'imaging',
  icon: Scan,
  accentColor: '#0ea5e9',
  apiEndpoint: '/api/reference/imaging',
  getId: (i) => i.id,
  getDisplayName: (i) => i.name,
  getSubtitle: (i) => i.modality,
  isHighYield: (i) => !!i.isHighYield,
  getPanceYield: (i) => i.panceYield,
  searchFields: [
    (i) => i.name, (i) => i.description, (i) => i.modality, (i) => i.bodyRegion,
  ],
  filters: [
    { key: 'modality', label: 'Modalities', autoDerive: true, accessor: (i: ImagingItem) => i.modality },
    { key: 'bodyRegion', label: 'Body Regions', autoDerive: true, accessor: (i: ImagingItem) => i.bodyRegion },
  ],
  cardRenderer: (i, expanded) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {cardTitle(i.name)}
        {i.isHighYield && highYieldBadge()}
        {i.modality && badge(i.modality, '#e0f2fe', '#0369a1')}
        {i.usesRadiation && badge('☢ Radiation', '#fef2f2', '#991b1b')}
      </div>
      {!expanded && i.bodyRegion && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: FONT_BODY }}>{i.bodyRegion}</p>
      )}
    </div>
  ),
  detailRenderer: (i) => (
    <div>
      {studyPanel(i.clinicalPearls, i.testQuestionTips, i.commonMistakes, undefined, i.boardYieldFacts, '#0ea5e9')}
      {i.description && detailSection('Description', i.description)}
      {detailList('Indications', i.indications)}
      {detailList('Classic Signs', i.classicSigns)}
      {detailList('First-Line For', i.firstLineFor)}
      {i.normalFindings && detailSection('Normal Findings', i.normalFindings)}
      {detailListCritical('Contraindications', i.contraindications)}
      {detailList('Limitations', i.limitations)}
      {i.preparation && detailSection('Preparation', i.preparation)}
      {i.scanDuration && detailSection('Scan Duration', clinicalData(i.scanDuration))}
      {i.radiationDose && detailSection('Radiation Dose', clinicalData(i.radiationDose))}
    </div>
  ),
};

// ============================================================================
// 3. ECG PATTERNS
// ============================================================================

interface ECGItem {
  id: string; name: string; displayName?: string;
  category?: string; subcategory?: string;
  isHighYield?: boolean; isEmergency?: boolean; panceYield?: number;
  rate?: string; rhythm?: string; pWave?: string;
  prInterval?: string; qrsComplex?: string; stSegment?: string; tWave?: string;
  diagnosticCriteria?: string[]; pathognomonic?: string;
  etiology?: string[]; symptoms?: string[];
  acuteManagement?: string; medications?: string[];
  mimics?: string[];
  clinicalPearls?: string[]; testQuestionTips?: string[];
  commonMistakes?: string[]; mnemonics?: string[]; boardYieldFacts?: string[];
}

export const ecgConfig: ReferenceViewConfig<ECGItem> = {
  entityName: 'ECG Patterns',
  entityNameSingular: 'ECG Pattern',
  entitySlug: 'ecg',
  icon: Activity,
  accentColor: '#ef4444',
  apiEndpoint: '/api/reference/ecg',
  getId: (e) => e.id,
  getDisplayName: (e) => e.displayName || e.name,
  getSubtitle: (e) => e.category,
  isHighYield: (e) => !!e.isHighYield,
  getPanceYield: (e) => e.panceYield,
  searchFields: [
    (e) => e.name, (e) => e.displayName, (e) => e.category,
    (e) => e.pathognomonic, (e) => e.rhythm,
  ],
  filters: [
    { key: 'category', label: 'Categories', autoDerive: true, accessor: (e: ECGItem) => e.category },
    { key: 'subcategory', label: 'Subcategories', autoDerive: true, accessor: (e: ECGItem) => e.subcategory },
  ],
  getDrillParams: (e) => ({ tag: e.displayName || e.name }),
  cardRenderer: (e, expanded) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {cardTitle(e.displayName || e.name)}
        {e.isHighYield && highYieldBadge()}
        {e.isEmergency && badge('⚡ Emergency', '#fef2f2', '#991b1b')}
        {e.category && badge(e.category, '#fee2e2', '#dc2626')}
      </div>
      {!expanded && e.rhythm && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: FONT_BODY }}>Rhythm: {e.rhythm}</p>
      )}
    </div>
  ),
  detailRenderer: (e) => (
    <div>
      {studyPanel(e.clinicalPearls, e.testQuestionTips, e.commonMistakes, e.mnemonics, e.boardYieldFacts, '#ef4444')}
      {e.pathognomonic && detailSection('Pathognomonic Finding', <strong>{e.pathognomonic}</strong>)}
      {detailGroup('Waveform Analysis', <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {e.rate && detailSection('Rate', e.rate)}
          {e.rhythm && detailSection('Rhythm', e.rhythm)}
          {e.pWave && detailSection('P Wave', e.pWave)}
          {e.prInterval && detailSection('PR Interval', e.prInterval)}
          {e.qrsComplex && detailSection('QRS Complex', e.qrsComplex)}
          {e.stSegment && detailSection('ST Segment', e.stSegment)}
          {e.tWave && detailSection('T Wave', e.tWave)}
        </div>
      </>)}
      {detailGroup('Clinical Context', <>
        {detailList('Diagnostic Criteria', e.diagnosticCriteria)}
        {detailList('Etiology', e.etiology)}
        {detailList('Symptoms', e.symptoms)}
      </>)}
      {detailGroup('Management', <>
        {e.acuteManagement && detailSectionCritical('Acute Management', e.acuteManagement)}
        {detailList('Medications', e.medications)}
        {detailList('Mimics', e.mimics)}
      </>)}
    </div>
  ),
};

// ============================================================================
// 4. ANATOMY STRUCTURES
// ============================================================================

interface AnatomyItem {
  id: string; name: string; system?: string; region?: string;
  type?: string; description?: string; function?: string;
  innervation?: string; bloodSupply?: string;
  clinicalSignificance?: string; isHighYield?: boolean; panceYield?: number;
  origin?: string; insertion?: string;
  nerveRoots?: string; dermatome?: string; myotome?: string;
  commonPathology?: string[]; surfaceLandmarks?: string[];
  clinicalPearls?: string[]; testQuestionTips?: string[];
  commonMistakes?: string[]; mnemonics?: string[]; boardYieldFacts?: string[];
}

export const anatomyConfig: ReferenceViewConfig<AnatomyItem> = {
  entityName: 'Anatomy',
  entityNameSingular: 'Structure',
  entitySlug: 'anatomy',
  icon: Bone,
  accentColor: '#f59e0b',
  apiEndpoint: '/api/reference/anatomy',
  getId: (a) => a.id,
  getDisplayName: (a) => a.name,
  getSubtitle: (a) => [a.system, a.region].filter(Boolean).join(' · '),
  isHighYield: (a) => !!a.isHighYield,
  getPanceYield: (a) => a.panceYield,
  searchFields: [
    (a) => a.name, (a) => a.description, (a) => a.system,
    (a) => a.region, (a) => a.innervation,
  ],
  filters: [
    { key: 'system', label: 'Systems', autoDerive: true, accessor: (a: AnatomyItem) => a.system },
    { key: 'region', label: 'Regions', autoDerive: true, accessor: (a: AnatomyItem) => a.region },
    { key: 'type', label: 'Types', autoDerive: true, accessor: (a: AnatomyItem) => a.type },
  ],
  getDrillParams: (a) => ({ system: a.system, tag: a.name }),
  cardRenderer: (a, expanded) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {cardTitle(a.name)}
        {a.isHighYield && highYieldBadge()}
        {a.system && badge(a.system, '#fef3c7', '#92400e')}
      </div>
      {!expanded && a.region && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: FONT_BODY }}>{a.region}{a.type ? ` · ${a.type}` : ''}</p>
      )}
    </div>
  ),
  detailRenderer: (a) => (
    <div>
      {studyPanel(a.clinicalPearls, a.testQuestionTips, a.commonMistakes, a.mnemonics, a.boardYieldFacts, '#f59e0b')}
      {detailGroup('Structure', <>
        {a.description && detailSection('Description', a.description)}
        {a.function && detailSection('Function', a.function)}
        {a.origin && a.insertion && detailSection('Attachments', `Origin: ${a.origin} → Insertion: ${a.insertion}`)}
        {detailList('Surface Landmarks', a.surfaceLandmarks)}
      </>)}
      {detailGroup('Neurovascular', <>
        {a.innervation && detailSection('Innervation', a.innervation)}
        {a.bloodSupply && detailSection('Blood Supply', a.bloodSupply)}
        {a.nerveRoots && detailSection('Nerve Roots', a.nerveRoots)}
        {a.dermatome && detailSection('Dermatome', a.dermatome)}
        {a.myotome && detailSection('Myotome', a.myotome)}
      </>)}
      {detailGroup('Clinical', <>
        {a.clinicalSignificance && detailSection('Clinical Significance', a.clinicalSignificance)}
        {detailList('Common Pathology', a.commonPathology)}
      </>)}
    </div>
  ),
};

// ============================================================================
// 5. SPECIAL TESTS
// ============================================================================

interface SpecialTestItem {
  id: string; name: string; displayName?: string;
  system?: string; region?: string; description?: string;
  sensitivity?: number; specificity?: number;
  technique?: string; positiveTest?: string; interpretation?: string;
  imageUrl?: string; videoUrl?: string;
}

export const specialTestConfig: ReferenceViewConfig<SpecialTestItem> = {
  entityName: 'Special Tests',
  entityNameSingular: 'Special Test',
  entitySlug: 'special-tests',
  icon: TestTube2,
  accentColor: '#10b981',
  apiEndpoint: '/api/reference/special-tests',
  getId: (t) => t.id,
  getDisplayName: (t) => t.displayName || t.name,
  getSubtitle: (t) => [t.system, t.region].filter(Boolean).join(' · '),
  searchFields: [
    (t) => t.name, (t) => t.displayName, (t) => t.description,
    (t) => t.system, (t) => t.region, (t) => t.positiveTest,
  ],
  filters: [
    { key: 'system', label: 'Systems', autoDerive: true, accessor: (t: SpecialTestItem) => t.system },
    { key: 'region', label: 'Regions', autoDerive: true, accessor: (t: SpecialTestItem) => t.region },
  ],
  cardRenderer: (t, expanded) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {cardTitle(t.displayName || t.name)}
        {t.region && badge(t.region, '#d1fae5', '#065f46')}
      </div>
      {!expanded && (
        <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: FONT_MONO, fontVariantNumeric: 'tabular-nums' as React.CSSProperties }}>
          {t.sensitivity != null && <span>Sn: {(t.sensitivity * 100).toFixed(0)}%</span>}
          {t.specificity != null && <span>Sp: {(t.specificity * 100).toFixed(0)}%</span>}
        </div>
      )}
    </div>
  ),
  detailRenderer: (t) => (
    <div>
      {t.description && detailSection('Description', t.description)}
      {t.technique && detailSection('Technique', t.technique)}
      {t.positiveTest && detailSection('Positive Test', t.positiveTest)}
      {t.interpretation && detailSection('Interpretation', t.interpretation)}
      {(t.sensitivity != null || t.specificity != null) && detailSection('Diagnostic Accuracy',
        diagnosticAccuracy([
          ...(t.sensitivity != null ? [{ label: 'Sensitivity', value: `${(t.sensitivity * 100).toFixed(0)}%` }] : []),
          ...(t.specificity != null ? [{ label: 'Specificity', value: `${(t.specificity * 100).toFixed(0)}%` }] : []),
        ])
      )}
    </div>
  ),
};

// ============================================================================
// 6. PHYSIOLOGY CONCEPTS
// ============================================================================

interface PhysiologyItem {
  id: string; name: string; displayName?: string;
  system?: string; category?: string; description?: string;
  mechanism?: string; clinicalSignificance?: string;
  pathophysiology?: string; normalValues?: string;
  feedbackLoops?: string; isHighYield?: boolean; panceYield?: number;
  relatedConditions?: string[]; relatedDrugs?: string[];
  compensatoryMechanisms?: string[]; decompensationSigns?: string[];
  clinicalPearls?: string[]; testQuestionTips?: string[];
  commonMistakes?: string[]; mnemonics?: string[]; boardYieldFacts?: string[];
}

export const physiologyConfig: ReferenceViewConfig<PhysiologyItem> = {
  entityName: 'Physiology',
  entityNameSingular: 'Physiology Concept',
  entitySlug: 'physiology',
  icon: Brain,
  accentColor: '#6366f1',
  apiEndpoint: '/api/reference/physiology',
  getId: (p) => p.id,
  getDisplayName: (p) => p.displayName || p.name,
  getSubtitle: (p) => p.system,
  isHighYield: (p) => !!p.isHighYield,
  getPanceYield: (p) => p.panceYield,
  searchFields: [
    (p) => p.name, (p) => p.displayName, (p) => p.description,
    (p) => p.system, (p) => p.category, (p) => p.mechanism,
  ],
  filters: [
    { key: 'system', label: 'Systems', autoDerive: true, accessor: (p: PhysiologyItem) => p.system },
    { key: 'category', label: 'Categories', autoDerive: true, accessor: (p: PhysiologyItem) => p.category },
  ],
  getDrillParams: (p) => ({ system: p.system, tag: p.displayName || p.name }),
  cardRenderer: (p, expanded) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {cardTitle(p.displayName || p.name)}
        {p.isHighYield && highYieldBadge()}
        {p.system && badge(p.system, '#e0e7ff', '#4338ca')}
      </div>
      {!expanded && p.description && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: FONT_BODY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</p>
      )}
    </div>
  ),
  detailRenderer: (p) => (
    <div>
      {studyPanel(p.clinicalPearls, p.testQuestionTips, p.commonMistakes, p.mnemonics, p.boardYieldFacts, '#6366f1')}
      {p.description && detailSection('Description', p.description)}
      {p.mechanism && detailSection('Mechanism', p.mechanism)}
      {p.normalValues && detailSection('Normal Values', clinicalData(p.normalValues))}
      {p.pathophysiology && detailSection('Pathophysiology', p.pathophysiology)}
      {p.feedbackLoops && detailSection('Feedback Loops', p.feedbackLoops)}
      {p.clinicalSignificance && detailSection('Clinical Significance', p.clinicalSignificance)}
      {detailList('Related Conditions', p.relatedConditions)}
      {detailList('Related Drugs', p.relatedDrugs)}
      {detailList('Compensatory Mechanisms', p.compensatoryMechanisms)}
      {detailListCritical('Decompensation Signs', p.decompensationSigns)}
    </div>
  ),
};

// ============================================================================
// 7. PHYSICAL EXAM FINDINGS
// ============================================================================

interface FindingItem {
  id: string; name: string; system?: string; category?: string;
  findingType?: string; description?: string;
  clinicalSignificance?: string; isHighYield?: boolean; panceYield?: number;
  eponymousName?: string; howToElicit?: string; howToDocument?: string;
  sensitivity?: number; specificity?: number;
  positiveLR?: number; negativeLR?: number;
  positiveIndicates?: string[]; negativeIndicates?: string[];
  differentialFor?: string[]; equipmentNeeded?: string[];
  clinicalPearls?: string[]; testQuestionTips?: string[];
  commonMistakes?: string[]; mnemonics?: string[]; boardYieldFacts?: string[];
}

export const findingsConfig: ReferenceViewConfig<FindingItem> = {
  entityName: 'Physical Exam Findings',
  entityNameSingular: 'Finding',
  entitySlug: 'findings',
  icon: Stethoscope,
  accentColor: '#ec4899',
  apiEndpoint: '/api/reference/findings',
  getId: (f) => f.id,
  getDisplayName: (f) => f.eponymousName ? `${f.name} (${f.eponymousName})` : f.name,
  getSubtitle: (f) => f.system,
  isHighYield: (f) => !!f.isHighYield,
  getPanceYield: (f) => f.panceYield,
  searchFields: [
    (f) => f.name, (f) => f.eponymousName, (f) => f.description,
    (f) => f.system, (f) => f.category, (f) => f.howToElicit,
  ],
  filters: [
    { key: 'system', label: 'Systems', autoDerive: true, accessor: (f: FindingItem) => f.system },
    { key: 'category', label: 'Categories', autoDerive: true, accessor: (f: FindingItem) => f.category },
    { key: 'findingType', label: 'Types', autoDerive: true, accessor: (f: FindingItem) => f.findingType },
  ],
  getDrillParams: (f) => ({ system: f.system, tag: f.name }),
  cardRenderer: (f, expanded) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {cardTitle(f.name)}
        {f.isHighYield && highYieldBadge()}
        {f.system && badge(f.system, '#fce7f3', '#9d174d')}
        {f.eponymousName && <span style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--color-text-secondary)', fontFamily: FONT_BODY }}>{f.eponymousName}</span>}
      </div>
      {!expanded && (
        <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: FONT_MONO, fontVariantNumeric: 'tabular-nums' as React.CSSProperties }}>
          {f.sensitivity != null && <span>Sn: {(f.sensitivity * 100).toFixed(0)}%</span>}
          {f.specificity != null && <span>Sp: {(f.specificity * 100).toFixed(0)}%</span>}
          {f.positiveLR != null && <span>+LR: {f.positiveLR.toFixed(1)}</span>}
        </div>
      )}
    </div>
  ),
  detailRenderer: (f) => (
    <div>
      {studyPanel(f.clinicalPearls, f.testQuestionTips, f.commonMistakes, f.mnemonics, f.boardYieldFacts, '#ec4899')}
      {detailGroup('Examination', <>
        {f.description && detailSection('Description', f.description)}
        {f.howToElicit && detailSection('How to Elicit', f.howToElicit)}
        {detailList('Equipment Needed', f.equipmentNeeded)}
      </>)}
      {detailGroup('Interpretation', <>
        {f.clinicalSignificance && detailSection('Clinical Significance', f.clinicalSignificance)}
        {(f.sensitivity != null || f.specificity != null) && detailSection('Diagnostic Accuracy',
          diagnosticAccuracy([
            ...(f.sensitivity != null ? [{ label: 'Sensitivity', value: `${(f.sensitivity * 100).toFixed(0)}%` }] : []),
            ...(f.specificity != null ? [{ label: 'Specificity', value: `${(f.specificity * 100).toFixed(0)}%` }] : []),
            ...(f.positiveLR != null ? [{ label: '+LR', value: f.positiveLR.toFixed(1) }] : []),
            ...(f.negativeLR != null ? [{ label: '−LR', value: f.negativeLR.toFixed(2) }] : []),
          ])
        )}
        {detailList('Positive Indicates', f.positiveIndicates)}
        {detailList('Negative Indicates', f.negativeIndicates)}
        {detailList('Differential For', f.differentialFor)}
      </>)}
      {f.howToDocument && detailSection('How to Document', f.howToDocument)}
    </div>
  ),
};

// ============================================================================
// 8. CLINICAL GUIDELINES
// ============================================================================

interface GuidelineItem {
  id: string; name: string; description?: string;
  clinicalContext?: string; maxScore?: number;
  components?: any; scoringMap?: any; vignettes?: any;
}

/** Render a JSON guideline components array into a readable list */
const renderGuidelineComponents = (components: any) => {
  if (!components) return null;
  const arr = Array.isArray(components) ? components : [];
  if (arr.length === 0) return null;
  return detailSection('Components', (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {arr.map((c: any, i: number) => (
        <div key={i} style={{ padding: '6px 10px', borderRadius: 6, background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', fontSize: 12 }}>
          <strong>{c.name || c.label || `Item ${i + 1}`}</strong>
          {c.points != null && <span style={{ marginLeft: 8, color: 'var(--color-text-secondary)' }}>({c.points} pts)</span>}
          {c.description && <div style={{ marginTop: 2, color: 'var(--color-text-secondary)' }}>{c.description}</div>}
          {c.options && Array.isArray(c.options) && (
            <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
              {c.options.map((opt: any, j: number) => (
                <li key={j} style={{ color: 'var(--color-text-secondary)' }}>
                  {typeof opt === 'string' ? opt : `${opt.label || opt.name || ''} ${opt.points != null ? `(${opt.points} pts)` : ''}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  ));
};

/** Render scoring map (score → interpretation) */
const renderScoringMap = (scoringMap: any) => {
  if (!scoringMap) return null;
  const entries = Array.isArray(scoringMap) ? scoringMap : Object.entries(scoringMap).map(([k, v]) => ({ range: k, interpretation: v }));
  if (entries.length === 0) return null;
  return detailSection('Scoring Interpretation', (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {entries.map((entry: any, i: number) => (
        <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '4px 0', borderBottom: i < entries.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
          <span style={{ fontWeight: 700, minWidth: 60, color: 'var(--color-text-primary)' }}>{entry.range || entry.score || entry.threshold || `Level ${i + 1}`}</span>
          <span style={{ color: 'var(--color-text-secondary)' }}>{entry.interpretation || entry.label || entry.meaning || (typeof entry === 'string' ? entry : JSON.stringify(entry))}</span>
        </div>
      ))}
    </div>
  ));
};

export const guidelinesConfig: ReferenceViewConfig<GuidelineItem> = {
  entityName: 'Clinical Guidelines',
  entityNameSingular: 'Guideline',
  entitySlug: 'guidelines',
  icon: BookOpen,
  accentColor: '#14b8a6',
  apiEndpoint: '/api/reference/guidelines',
  getId: (g) => g.id,
  getDisplayName: (g) => g.name,
  getSubtitle: (g) => g.clinicalContext,
  searchFields: [
    (g) => g.name, (g) => g.description, (g) => g.clinicalContext,
  ],
  cardRenderer: (g, expanded) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {cardTitle(g.name)}
        {g.maxScore != null && badge(`Max: ${g.maxScore}`, '#ccfbf1', '#115e59')}
        {g.components && Array.isArray(g.components) && badge(`${g.components.length} criteria`, '#ccfbf1', '#115e59')}
      </div>
      {!expanded && g.clinicalContext && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: FONT_BODY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.clinicalContext}</p>
      )}
    </div>
  ),
  detailRenderer: (g) => (
    <div>
      {g.description && detailSection('Description', g.description)}
      {g.clinicalContext && detailSection('Clinical Context', g.clinicalContext)}
      {renderGuidelineComponents(g.components)}
      {renderScoringMap(g.scoringMap)}
      {g.vignettes && Array.isArray(g.vignettes) && g.vignettes.length > 0 && detailSection('Clinical Vignettes',
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {g.vignettes.map((v: any, i: number) => (
            <div key={i} style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', fontSize: 12 }}>
              {v.scenario && <div style={{ fontWeight: 600, marginBottom: 4 }}>{v.scenario}</div>}
              {v.answer && <div style={{ color: 'var(--color-text-secondary)' }}>{v.answer}</div>}
              {typeof v === 'string' && <div>{v}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  ),
};

// ============================================================================
// 9. HISTORY COMPONENTS
// ============================================================================

interface HistoryItem {
  id: string; name: string; displayName?: string;
  category?: string; system?: string; description?: string;
  isHighYield?: boolean; panceYield?: number;
  elements?: string[]; frameworkName?: string;
  rosCategory?: string; documentationTips?: string;
  positiveIndicators?: string[]; negativeIndicators?: string[];
  redFlagResponses?: string[]; reassuringResponses?: string[];
  clinicalPearls?: string[]; testQuestionTips?: string[];
  commonMistakes?: string[]; mnemonics?: string[]; boardYieldFacts?: string[];
}

export const historyConfig: ReferenceViewConfig<HistoryItem> = {
  entityName: 'History Components',
  entityNameSingular: 'History Component',
  entitySlug: 'history-components',
  icon: ClipboardList,
  accentColor: '#f97316',
  apiEndpoint: '/api/reference/history-components',
  getId: (h) => h.id,
  getDisplayName: (h) => h.displayName || h.name,
  getSubtitle: (h) => h.category,
  isHighYield: (h) => !!h.isHighYield,
  getPanceYield: (h) => h.panceYield,
  searchFields: [
    (h) => h.name, (h) => h.displayName, (h) => h.description,
    (h) => h.category, (h) => h.system, (h) => h.frameworkName,
  ],
  filters: [
    { key: 'category', label: 'Categories', autoDerive: true, accessor: (h: HistoryItem) => h.category },
    { key: 'system', label: 'Systems', autoDerive: true, accessor: (h: HistoryItem) => h.system },
  ],
  cardRenderer: (h, expanded) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {cardTitle(h.displayName || h.name)}
        {h.isHighYield && highYieldBadge()}
        {h.category && badge(h.category, '#ffedd5', '#9a3412')}
      </div>
      {!expanded && h.frameworkName && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: FONT_BODY }}>Framework: {h.frameworkName}</p>
      )}
    </div>
  ),
  detailRenderer: (h) => (
    <div>
      {studyPanel(h.clinicalPearls, h.testQuestionTips, h.commonMistakes, h.mnemonics, h.boardYieldFacts, '#f97316')}
      {h.description && detailSection('Description', h.description)}
      {h.frameworkName && detailSection('Framework', h.frameworkName)}
      {detailList('Elements', h.elements)}
      {h.documentationTips && detailSection('Documentation Tips', h.documentationTips)}
      {detailList('Positive Indicators', h.positiveIndicators)}
      {detailList('Negative Indicators', h.negativeIndicators)}
      {detailListCritical('Red Flag Responses', h.redFlagResponses)}
      {detailList('Reassuring Responses', h.reassuringResponses)}
    </div>
  ),
};

// ============================================================================
// 10. LAB TESTS
// ============================================================================

interface LabTestItem {
  id: string; name: string; category?: string;
  typicalUse?: string; sampleType?: string; collectionTube?: string;
  conventionalRange?: string; siRange?: string; siUnits?: string;
  increaseIndicates?: string; decreaseIndicates?: string;
  criticalValues?: any; falsePosNeg?: string;
  isHighYield?: boolean; panceYield?: number;
  relatedTests?: string[]; followUpTests?: string[];
  clinicalPearls?: string[]; testQuestionTips?: string[];
  commonMistakes?: string[]; mnemonics?: string[]; boardYieldFacts?: string[];
}

export const labTestConfig: ReferenceViewConfig<LabTestItem> = {
  entityName: 'Lab Tests',
  entityNameSingular: 'Lab Test',
  entitySlug: 'labs',
  icon: FlaskConical,
  accentColor: '#0ea5e9',
  apiEndpoint: '/api/reference/labs',
  getId: (l) => l.id,
  getDisplayName: (l) => l.name,
  getSubtitle: (l) => l.category,
  isHighYield: (l) => !!l.isHighYield,
  getPanceYield: (l) => l.panceYield,
  searchFields: [
    (l) => l.name, (l) => l.category, (l) => l.typicalUse,
    (l) => l.increaseIndicates, (l) => l.decreaseIndicates,
  ],
  filters: [
    { key: 'category', label: 'Categories', autoDerive: true, accessor: (l: LabTestItem) => l.category },
  ],
  cardRenderer: (l, expanded) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {cardTitle(l.name)}
        {l.isHighYield && highYieldBadge()}
        {l.category && badge(l.category, '#e0f2fe', '#0369a1')}
      </div>
      {!expanded && l.conventionalRange && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: FONT_MONO, fontVariantNumeric: 'tabular-nums' as React.CSSProperties }}>
          Normal: {l.conventionalRange} {l.siUnits || ''}
        </p>
      )}
    </div>
  ),
  detailRenderer: (l) => (
    <div>
      {studyPanel(l.clinicalPearls, l.testQuestionTips, l.commonMistakes, l.mnemonics, l.boardYieldFacts, '#0ea5e9')}
      {l.typicalUse && detailSection('Typical Use', l.typicalUse)}
      {l.conventionalRange && detailSection('Reference Range', clinicalData(`${l.conventionalRange}${l.siUnits ? ` ${l.siUnits}` : ''}`))}
      {l.siRange && detailSection('SI Range', clinicalData(l.siRange))}
      {l.sampleType && detailSection('Sample Type', l.sampleType)}
      {l.collectionTube && detailSection('Collection Tube', l.collectionTube)}
      {l.increaseIndicates && detailSection('Increased In', l.increaseIndicates)}
      {l.decreaseIndicates && detailSection('Decreased In', l.decreaseIndicates)}
      {l.falsePosNeg && detailSection('False Positives/Negatives', l.falsePosNeg)}
      {l.criticalValues && detailSectionCritical('Critical Values', typeof l.criticalValues === 'string' ? l.criticalValues : JSON.stringify(l.criticalValues))}
      {detailList('Related Tests', l.relatedTests)}
      {detailList('Follow-Up Tests', l.followUpTests)}
      {crossRefHint('For pocket-card reference ranges, see Toolkit → Quick Reference → Normal Lab Values')}
    </div>
  ),
};

// ============================================================================
// 11. SCORING SYSTEMS
// ============================================================================

interface ScoringSystemItem {
  id: string; name: string; displayName?: string;
  category?: string; condition?: string;
  clinicalContext?: string; whenToUse?: string; whenNotToUse?: string;
  maxScore?: number; minScore?: number;
  sensitivity?: number; specificity?: number;
  isHighYield?: boolean; panceYield?: number;
  components?: any; interpretation?: any; actionThresholds?: any;
  limitations?: string;
  clinicalPearls?: string[]; testQuestionTips?: string[];
  commonMistakes?: string[]; mnemonics?: string[]; boardYieldFacts?: string[];
  ScoringSystemConditionLink?: { condition: { canonicalName: string; system: string } }[];
}

export const scoringSystemConfig: ReferenceViewConfig<ScoringSystemItem> = {
  entityName: 'Scoring Systems',
  entityNameSingular: 'Scoring System',
  entitySlug: 'scoring-systems',
  icon: Calculator,
  accentColor: '#8b5cf6',
  apiEndpoint: '/api/reference/scoring-systems',
  getId: (s) => s.id,
  getDisplayName: (s) => s.displayName || s.name,
  getSubtitle: (s) => s.condition || s.category,
  isHighYield: (s) => !!s.isHighYield,
  getPanceYield: (s) => s.panceYield,
  searchFields: [
    (s) => s.name, (s) => s.displayName, (s) => s.condition,
    (s) => s.category, (s) => s.clinicalContext, (s) => s.whenToUse,
  ],
  filters: [
    { key: 'category', label: 'Categories', autoDerive: true, accessor: (s: ScoringSystemItem) => s.category },
  ],
  cardRenderer: (s, expanded) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {cardTitle(s.displayName || s.name)}
        {s.isHighYield && highYieldBadge()}
        {s.category && badge(s.category, '#ede9fe', '#5b21b6')}
      </div>
      {!expanded && (
        <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: FONT_BODY }}>
          {s.condition && <span>{s.condition}</span>}
          {s.maxScore != null && <span style={{ fontFamily: FONT_MONO }}>Max: {s.maxScore}</span>}
          {s.sensitivity != null && <span style={{ fontFamily: FONT_MONO }}>Sn: {(s.sensitivity * 100).toFixed(0)}%</span>}
        </div>
      )}
    </div>
  ),
  detailRenderer: (s) => (
    <div>
      {studyPanel(s.clinicalPearls, s.testQuestionTips, s.commonMistakes, s.mnemonics, s.boardYieldFacts, '#8b5cf6')}
      {s.clinicalContext && detailSection('Clinical Context', s.clinicalContext)}
      {s.whenToUse && detailSection('When to Use', s.whenToUse)}
      {s.whenNotToUse && detailSectionCritical('When NOT to Use', s.whenNotToUse)}
      {(s.sensitivity != null || s.specificity != null) && detailSection('Diagnostic Accuracy',
        diagnosticAccuracy([
          ...(s.sensitivity != null ? [{ label: 'Sensitivity', value: `${(s.sensitivity * 100).toFixed(0)}%` }] : []),
          ...(s.specificity != null ? [{ label: 'Specificity', value: `${(s.specificity * 100).toFixed(0)}%` }] : []),
          ...(s.maxScore != null ? [{ label: 'Max Score', value: String(s.maxScore) }] : []),
        ])
      )}
      {s.components && detailSection('Components',
        <div style={{ fontSize: 12 }}>
          {Array.isArray(s.components) ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {s.components.map((c: any, i: number) => (
                <li key={i}>{typeof c === 'string' ? c : (c.name || c.label || JSON.stringify(c))}</li>
              ))}
            </ul>
          ) : typeof s.components === 'object' ? (
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 11 }}>{JSON.stringify(s.components, null, 2)}</pre>
          ) : String(s.components)}
        </div>
      )}
      {s.interpretation && detailSection('Interpretation',
        <div style={{ fontSize: 12 }}>
          {Array.isArray(s.interpretation) ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {s.interpretation.map((interp: any, i: number) => (
                <li key={i}>{typeof interp === 'string' ? interp : `${interp.range || interp.score || ''}: ${interp.label || interp.meaning || JSON.stringify(interp)}`}</li>
              ))}
            </ul>
          ) : typeof s.interpretation === 'object' ? (
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 11 }}>{JSON.stringify(s.interpretation, null, 2)}</pre>
          ) : String(s.interpretation)}
        </div>
      )}
      {s.limitations && detailSection('Limitations', s.limitations)}
      {s.ScoringSystemConditionLink?.length ? detailSection('Associated Conditions',
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {s.ScoringSystemConditionLink.map((link, i) => (
            <span key={i}>{badge(link.condition.canonicalName, '#f3e8ff', '#7c3aed')}</span>
          ))}
        </div>
      ) : null}
      {studyPanel(s.clinicalPearls, s.testQuestionTips, s.commonMistakes, s.mnemonics, s.boardYieldFacts)}
      {crossRefHint('Interactive calculators for this and other scoring systems are available in Toolkit → Calculators', <Calculator size={13} />)}
    </div>
  ),
};

// ============================================================================
// ALL CONFIGS EXPORT
// ============================================================================

export const allReferenceConfigs = [
  procedureConfig,
  imagingConfig,
  ecgConfig,
  anatomyConfig,
  specialTestConfig,
  physiologyConfig,
  findingsConfig,
  guidelinesConfig,
  historyConfig,
  labTestConfig,
  scoringSystemConfig,
] as const;
