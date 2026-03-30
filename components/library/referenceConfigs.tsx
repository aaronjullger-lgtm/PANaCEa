/**
 * referenceConfigs.tsx
 *
 * ReferenceViewConfig definitions for all 9 entity types that plug into
 * GenericReferenceView. Each config provides API endpoint, filters, card
 * renderer, detail renderer, and search fields.
 */

import React from 'react';
import type { ReferenceViewConfig, FilterField } from './GenericReferenceView';
import {
  Scissors, Scan, Activity, Bone, TestTube2,
  Brain, Stethoscope, BookOpen, ClipboardList,
  Star, AlertTriangle, Zap, MapPin,
  FlaskConical, Calculator,
} from 'lucide-react';

// ============================================================================
// SHARED HELPERS
// ============================================================================

const badge = (text: string, bg: string, color: string) => (
  <span style={{
    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999,
    background: bg, color, whiteSpace: 'nowrap',
  }}>{text}</span>
);

const highYieldBadge = () => badge('★ High Yield', '#fef3c7', '#92400e');

const arrayPreview = (arr: string[] | undefined, max = 3) => {
  if (!arr?.length) return null;
  const shown = arr.slice(0, max);
  const more = arr.length - max;
  return (
    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
      {shown.join(' · ')}{more > 0 ? ` +${more} more` : ''}
    </span>
  );
};

const detailSection = (label: string, content: React.ReactNode) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
      {label}
    </div>
    <div style={{ fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
      {content}
    </div>
  </div>
);

const detailList = (label: string, items: string[] | undefined) => {
  if (!items?.length) return null;
  return detailSection(label, (
    <ul style={{ margin: 0, paddingLeft: 18 }}>
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  ));
};

const studyPanel = (pearls?: string[], tips?: string[], mistakes?: string[], mnemonics?: string[], boardFacts?: string[]) => {
  const sections = [
    { label: 'Board Yield Facts', items: boardFacts },
    { label: 'Clinical Pearls', items: pearls },
    { label: 'Test Question Tips', items: tips },
    { label: 'Common Mistakes', items: mistakes },
    { label: 'Mnemonics', items: mnemonics },
  ].filter(s => s.items?.length);

  if (!sections.length) return null;
  return (
    <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8 }}>📚 PANCE Study Mode</div>
      {sections.map(({ label, items }) => detailList(label, items))}
    </div>
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
  cardRenderer: (p, expanded) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>{p.displayName || p.name}</span>
        {p.isHighYield && highYieldBadge()}
        {p.category && badge(p.category, '#f3e8ff', '#7c3aed')}
      </div>
      {!expanded && p.description && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</p>
      )}
    </div>
  ),
  detailRenderer: (p) => (
    <div>
      {p.description && detailSection('Description', p.description)}
      {p.technique && detailSection('Technique', p.technique)}
      {p.preparation && detailSection('Preparation', p.preparation)}
      {p.duration && detailSection('Duration', p.duration)}
      {detailList('Indications', p.indications)}
      {detailList('Absolute Contraindications', p.absoluteContraindications)}
      {detailList('Relative Contraindications', p.relativeContraindications)}
      {detailList('Equipment', p.equipment)}
      {detailList('Complications', p.complications)}
      {p.postProcedureCare && detailSection('Post-Procedure Care', p.postProcedureCare)}
      {studyPanel(p.clinicalPearls, p.testQuestionTips, p.commonMistakes, p.mnemonics, p.boardYieldFacts)}
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
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>{i.name}</span>
        {i.isHighYield && highYieldBadge()}
        {i.modality && badge(i.modality, '#e0f2fe', '#0369a1')}
        {i.usesRadiation && badge('☢ Radiation', '#fef2f2', '#991b1b')}
      </div>
      {!expanded && i.bodyRegion && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>{i.bodyRegion}</p>
      )}
    </div>
  ),
  detailRenderer: (i) => (
    <div>
      {i.description && detailSection('Description', i.description)}
      {detailList('Indications', i.indications)}
      {detailList('Classic Signs', i.classicSigns)}
      {detailList('First-Line For', i.firstLineFor)}
      {i.normalFindings && detailSection('Normal Findings', i.normalFindings)}
      {detailList('Contraindications', i.contraindications)}
      {detailList('Limitations', i.limitations)}
      {i.preparation && detailSection('Preparation', i.preparation)}
      {i.scanDuration && detailSection('Scan Duration', i.scanDuration)}
      {i.radiationDose && detailSection('Radiation Dose', i.radiationDose)}
      {studyPanel(i.clinicalPearls, i.testQuestionTips, i.commonMistakes, undefined, i.boardYieldFacts)}
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
  cardRenderer: (e, expanded) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>{e.displayName || e.name}</span>
        {e.isHighYield && highYieldBadge()}
        {e.isEmergency && badge('⚡ Emergency', '#fef2f2', '#991b1b')}
        {e.category && badge(e.category, '#fee2e2', '#dc2626')}
      </div>
      {!expanded && e.rhythm && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>Rhythm: {e.rhythm}</p>
      )}
    </div>
  ),
  detailRenderer: (e) => (
    <div>
      {e.pathognomonic && detailSection('Pathognomonic Finding', <strong>{e.pathognomonic}</strong>)}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {e.rate && detailSection('Rate', e.rate)}
        {e.rhythm && detailSection('Rhythm', e.rhythm)}
        {e.pWave && detailSection('P Wave', e.pWave)}
        {e.prInterval && detailSection('PR Interval', e.prInterval)}
        {e.qrsComplex && detailSection('QRS Complex', e.qrsComplex)}
        {e.stSegment && detailSection('ST Segment', e.stSegment)}
        {e.tWave && detailSection('T Wave', e.tWave)}
      </div>
      {detailList('Diagnostic Criteria', e.diagnosticCriteria)}
      {detailList('Etiology', e.etiology)}
      {detailList('Symptoms', e.symptoms)}
      {e.acuteManagement && detailSection('Acute Management', e.acuteManagement)}
      {detailList('Medications', e.medications)}
      {detailList('Mimics', e.mimics)}
      {studyPanel(e.clinicalPearls, e.testQuestionTips, e.commonMistakes, e.mnemonics, e.boardYieldFacts)}
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
  cardRenderer: (a, expanded) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>{a.name}</span>
        {a.isHighYield && highYieldBadge()}
        {a.system && badge(a.system, '#fef3c7', '#92400e')}
      </div>
      {!expanded && a.region && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>{a.region}{a.type ? ` · ${a.type}` : ''}</p>
      )}
    </div>
  ),
  detailRenderer: (a) => (
    <div>
      {a.description && detailSection('Description', a.description)}
      {a.function && detailSection('Function', a.function)}
      {a.innervation && detailSection('Innervation', a.innervation)}
      {a.bloodSupply && detailSection('Blood Supply', a.bloodSupply)}
      {a.origin && a.insertion && detailSection('Attachments', `Origin: ${a.origin} → Insertion: ${a.insertion}`)}
      {a.nerveRoots && detailSection('Nerve Roots', a.nerveRoots)}
      {a.dermatome && detailSection('Dermatome', a.dermatome)}
      {a.myotome && detailSection('Myotome', a.myotome)}
      {a.clinicalSignificance && detailSection('Clinical Significance', a.clinicalSignificance)}
      {detailList('Common Pathology', a.commonPathology)}
      {detailList('Surface Landmarks', a.surfaceLandmarks)}
      {studyPanel(a.clinicalPearls, a.testQuestionTips, a.commonMistakes, a.mnemonics, a.boardYieldFacts)}
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
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>{t.displayName || t.name}</span>
        {t.region && badge(t.region, '#d1fae5', '#065f46')}
      </div>
      {!expanded && (
        <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12, color: 'var(--color-text-secondary)' }}>
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
        <div style={{ display: 'flex', gap: 16 }}>
          {t.sensitivity != null && <span>Sensitivity: <strong>{(t.sensitivity * 100).toFixed(0)}%</strong></span>}
          {t.specificity != null && <span>Specificity: <strong>{(t.specificity * 100).toFixed(0)}%</strong></span>}
        </div>
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
  cardRenderer: (p, expanded) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>{p.displayName || p.name}</span>
        {p.isHighYield && highYieldBadge()}
        {p.system && badge(p.system, '#e0e7ff', '#4338ca')}
      </div>
      {!expanded && p.description && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</p>
      )}
    </div>
  ),
  detailRenderer: (p) => (
    <div>
      {p.description && detailSection('Description', p.description)}
      {p.mechanism && detailSection('Mechanism', p.mechanism)}
      {p.normalValues && detailSection('Normal Values', p.normalValues)}
      {p.pathophysiology && detailSection('Pathophysiology', p.pathophysiology)}
      {p.feedbackLoops && detailSection('Feedback Loops', p.feedbackLoops)}
      {p.clinicalSignificance && detailSection('Clinical Significance', p.clinicalSignificance)}
      {detailList('Related Conditions', p.relatedConditions)}
      {detailList('Related Drugs', p.relatedDrugs)}
      {detailList('Compensatory Mechanisms', p.compensatoryMechanisms)}
      {detailList('Decompensation Signs', p.decompensationSigns)}
      {studyPanel(p.clinicalPearls, p.testQuestionTips, p.commonMistakes, p.mnemonics, p.boardYieldFacts)}
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
  cardRenderer: (f, expanded) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>{f.name}</span>
        {f.isHighYield && highYieldBadge()}
        {f.system && badge(f.system, '#fce7f3', '#9d174d')}
        {f.eponymousName && <span style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>{f.eponymousName}</span>}
      </div>
      {!expanded && (
        <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {f.sensitivity != null && <span>Sn: {(f.sensitivity * 100).toFixed(0)}%</span>}
          {f.specificity != null && <span>Sp: {(f.specificity * 100).toFixed(0)}%</span>}
          {f.positiveLR != null && <span>+LR: {f.positiveLR.toFixed(1)}</span>}
        </div>
      )}
    </div>
  ),
  detailRenderer: (f) => (
    <div>
      {f.description && detailSection('Description', f.description)}
      {f.howToElicit && detailSection('How to Elicit', f.howToElicit)}
      {f.clinicalSignificance && detailSection('Clinical Significance', f.clinicalSignificance)}
      {(f.sensitivity != null || f.specificity != null) && detailSection('Diagnostic Accuracy',
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {f.sensitivity != null && <span>Sensitivity: <strong>{(f.sensitivity * 100).toFixed(0)}%</strong></span>}
          {f.specificity != null && <span>Specificity: <strong>{(f.specificity * 100).toFixed(0)}%</strong></span>}
          {f.positiveLR != null && <span>+LR: <strong>{f.positiveLR.toFixed(1)}</strong></span>}
          {f.negativeLR != null && <span>−LR: <strong>{f.negativeLR.toFixed(2)}</strong></span>}
        </div>
      )}
      {detailList('Positive Indicates', f.positiveIndicates)}
      {detailList('Negative Indicates', f.negativeIndicates)}
      {detailList('Differential For', f.differentialFor)}
      {detailList('Equipment Needed', f.equipmentNeeded)}
      {f.howToDocument && detailSection('How to Document', f.howToDocument)}
      {studyPanel(f.clinicalPearls, f.testQuestionTips, f.commonMistakes, f.mnemonics, f.boardYieldFacts)}
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
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>{g.name}</span>
        {g.maxScore != null && badge(`Max: ${g.maxScore}`, '#ccfbf1', '#115e59')}
        {g.components && Array.isArray(g.components) && badge(`${g.components.length} criteria`, '#ccfbf1', '#115e59')}
      </div>
      {!expanded && g.clinicalContext && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.clinicalContext}</p>
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
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>{h.displayName || h.name}</span>
        {h.isHighYield && highYieldBadge()}
        {h.category && badge(h.category, '#ffedd5', '#9a3412')}
      </div>
      {!expanded && h.frameworkName && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>Framework: {h.frameworkName}</p>
      )}
    </div>
  ),
  detailRenderer: (h) => (
    <div>
      {h.description && detailSection('Description', h.description)}
      {h.frameworkName && detailSection('Framework', h.frameworkName)}
      {detailList('Elements', h.elements)}
      {h.documentationTips && detailSection('Documentation Tips', h.documentationTips)}
      {detailList('Positive Indicators', h.positiveIndicators)}
      {detailList('Negative Indicators', h.negativeIndicators)}
      {detailList('Red Flag Responses', h.redFlagResponses)}
      {detailList('Reassuring Responses', h.reassuringResponses)}
      {studyPanel(h.clinicalPearls, h.testQuestionTips, h.commonMistakes, h.mnemonics, h.boardYieldFacts)}
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
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>{l.name}</span>
        {l.isHighYield && highYieldBadge()}
        {l.category && badge(l.category, '#e0f2fe', '#0369a1')}
      </div>
      {!expanded && l.conventionalRange && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
          Normal: {l.conventionalRange} {l.siUnits || ''}
        </p>
      )}
    </div>
  ),
  detailRenderer: (l) => (
    <div>
      {l.typicalUse && detailSection('Typical Use', l.typicalUse)}
      {l.conventionalRange && detailSection('Reference Range', `${l.conventionalRange}${l.siUnits ? ` ${l.siUnits}` : ''}`)}
      {l.siRange && detailSection('SI Range', l.siRange)}
      {l.sampleType && detailSection('Sample Type', l.sampleType)}
      {l.collectionTube && detailSection('Collection Tube', l.collectionTube)}
      {l.increaseIndicates && detailSection('Increased In', l.increaseIndicates)}
      {l.decreaseIndicates && detailSection('Decreased In', l.decreaseIndicates)}
      {l.falsePosNeg && detailSection('False Positives/Negatives', l.falsePosNeg)}
      {l.criticalValues && detailSection('Critical Values', typeof l.criticalValues === 'string' ? l.criticalValues : JSON.stringify(l.criticalValues))}
      {detailList('Related Tests', l.relatedTests)}
      {detailList('Follow-Up Tests', l.followUpTests)}
      {studyPanel(l.clinicalPearls, l.testQuestionTips, l.commonMistakes, l.mnemonics, l.boardYieldFacts)}
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
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>{s.displayName || s.name}</span>
        {s.isHighYield && highYieldBadge()}
        {s.category && badge(s.category, '#ede9fe', '#5b21b6')}
      </div>
      {!expanded && (
        <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {s.condition && <span>{s.condition}</span>}
          {s.maxScore != null && <span>Max: {s.maxScore}</span>}
          {s.sensitivity != null && <span>Sn: {(s.sensitivity * 100).toFixed(0)}%</span>}
        </div>
      )}
    </div>
  ),
  detailRenderer: (s) => (
    <div>
      {s.clinicalContext && detailSection('Clinical Context', s.clinicalContext)}
      {s.whenToUse && detailSection('When to Use', s.whenToUse)}
      {s.whenNotToUse && detailSection('When NOT to Use', s.whenNotToUse)}
      {(s.sensitivity != null || s.specificity != null) && detailSection('Diagnostic Accuracy',
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {s.sensitivity != null && <span>Sensitivity: <strong>{(s.sensitivity * 100).toFixed(0)}%</strong></span>}
          {s.specificity != null && <span>Specificity: <strong>{(s.specificity * 100).toFixed(0)}%</strong></span>}
          {s.maxScore != null && <span>Max Score: <strong>{s.maxScore}</strong></span>}
        </div>
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
