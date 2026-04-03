/**
 * SPECIAL TESTS CONFIG — Enhanced Example
 *
 * Demonstrates proper use of PANaCEa style system typography tokens,
 * visual hierarchy tiers, and shared component helpers for a clinical
 * entity that shows test names, categories, associated conditions,
 * and diagnostic interpretation.
 *
 * Key patterns:
 * - FONT_HEADING (Poppins) for cardTitle and section summaries
 * - FONT_BODY (Inter) for labels and clinical descriptions
 * - FONT_MONO for diagnostic accuracy percentages
 * - detailSection for clinical content (Tier 2)
 * - detailList for itemized content
 * - diagnosticAccuracy helper for sensitivity/specificity display
 * - Entity accent color (#10b981 — green/teal) throughout
 * - studyPanel for PANCE Focus at top of detail view
 * - Progressive disclosure via detailGroup for related sections
 */

import React from 'react';
import type { ReferenceViewConfig } from './GenericReferenceView';
import {
  TestTube2, ChevronRight, AlertTriangle, BookOpen,
} from 'lucide-react';

// ============================================================================
// TYPOGRAPHY TOKENS
// ============================================================================

const FONT_HEADING = "'Poppins', system-ui, sans-serif";
const FONT_BODY = "'Inter', system-ui, sans-serif";
const FONT_MONO = "'JetBrains Mono', 'Fira Code', monospace";

// ============================================================================
// SHARED HELPERS (would be defined in referenceConfigs.tsx)
// ============================================================================

const badge = (text: string, bg: string, color: string) => (
  <span style={{
    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999,
    background: bg, color, whiteSpace: 'nowrap', fontFamily: FONT_BODY,
  }}>{text}</span>
);

const highYieldBadge = () => badge('★ High Yield', '#fef3c7', '#92400e');

const cardTitle = (text: string) => (
  <span style={{
    fontWeight: 600, fontSize: 15, color: 'var(--color-text-primary)',
    fontFamily: FONT_HEADING,
  }}>
    {text}
  </span>
);

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

const detailList = (label: string, items: string[] | undefined) => {
  if (!items?.length) return null;
  return detailSection(label, (
    <ul style={{ margin: 0, paddingLeft: 18 }}>
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  ));
};

const diagnosticAccuracy = (vals: { label: string; value: string }[]) => (
  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
    {vals.map(({ label, value }) => (
      <span key={label} style={{ fontFamily: FONT_BODY, fontSize: 14 }}>
        {label}: <strong style={{
          fontFamily: FONT_MONO, fontVariantNumeric: 'tabular-nums',
        }}>{value}</strong>
      </span>
    ))}
  </div>
);

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

const studyPanel = (
  pearls?: string[],
  tips?: string[],
  mistakes?: string[],
  mnemonics?: string[],
  boardFacts?: string[],
  accentColor?: string
) => {
  const sections = [
    { label: 'Board Yield Facts', items: boardFacts, emoji: '🎯' },
    { label: 'Clinical Pearls', items: pearls, emoji: '💎' },
    { label: 'Test Question Tips', items: tips, emoji: '📝' },
    { label: 'Common Mistakes', items: mistakes, emoji: '⚠️' },
    { label: 'Mnemonics', items: mnemonics, emoji: '🧠' },
  ].filter(s => s.items?.length);

  if (!sections.length) return null;

  const counts = sections
    .map(s => `${s.items!.length} ${s.label.toLowerCase()
      .replace(/^board yield /, '')
      .replace(/^test question /, '')
      .replace(/^common /, '')}`
    )
    .join(' · ');

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
        <ChevronRight size={14} style={{
          color: 'var(--color-text-secondary)', transition: 'transform 0.15s',
        }} />
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
            <ul style={{
              margin: '4px 0 8px', paddingLeft: 18, fontSize: 14, lineHeight: 1.6,
              fontFamily: FONT_BODY, color: 'var(--color-text-primary)',
            }}>
              {items!.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </details>
        ))}
      </div>
    </details>
  );
};

// ============================================================================
// SPECIAL TESTS ENTITY CONFIG
// ============================================================================

interface SpecialTestItem {
  id: string;
  name: string;
  displayName?: string;
  category?: string;
  system?: string;
  region?: string;
  description?: string;
  associatedConditions?: string[];
  technique?: string;
  positiveTest?: string;
  interpretation?: string;
  sensitivity?: number;
  specificity?: number;
  limitations?: string[];
  clinicalPearls?: string[];
  testQuestionTips?: string[];
  commonMistakes?: string[];
  boardYieldFacts?: string[];
  isHighYield?: boolean;
  panceYield?: number;
}

/**
 * SPECIAL TESTS CONFIG
 *
 * Complete reference config demonstrating all style system patterns.
 * Shows test name (Poppins), category badges, diagnostic accuracy (mono),
 * associated conditions, and structured interpretation with PANCE Focus.
 */
export const specialTestConfig: ReferenceViewConfig<SpecialTestItem> = {
  entityName: 'Special Tests',
  entityNameSingular: 'Special Test',
  entitySlug: 'special-tests',
  icon: TestTube2,
  accentColor: '#10b981', // Teal/green for diagnostic tests
  apiEndpoint: '/api/reference/special-tests',

  // ---- Accessors ----
  getId: (t) => t.id,
  getDisplayName: (t) => t.displayName || t.name,
  getSubtitle: (t) => [t.category, t.system, t.region]
    .filter(Boolean)
    .join(' · '),
  isHighYield: (t) => !!t.isHighYield,
  getPanceYield: (t) => t.panceYield,

  // ---- Search Fields ----
  // Users can search by test name, description, conditions, or clinical content
  searchFields: [
    (t) => t.name,
    (t) => t.displayName,
    (t) => t.description,
    (t) => t.category,
    (t) => t.system,
    (t) => t.region,
    (t) => t.positiveTest,
    (t) => t.associatedConditions?.join(' '),
  ],

  // ---- Filters ----
  // Auto-derived from data: category, system, region
  filters: [
    {
      key: 'category',
      label: 'Categories',
      autoDerive: true,
      accessor: (t: SpecialTestItem) => t.category,
    },
    {
      key: 'system',
      label: 'Systems',
      autoDerive: true,
      accessor: (t: SpecialTestItem) => t.system,
    },
    {
      key: 'region',
      label: 'Regions',
      autoDerive: true,
      accessor: (t: SpecialTestItem) => t.region,
    },
  ],

  // ---- Card Renderer ----
  // Displays: test name (cardTitle), high yield badge, category badge,
  // and sensitivity/specificity in monospace for preview
  cardRenderer: (t, expanded) => (
    <div>
      {/* Title row with badges */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
      }}>
        {/* Test name using FONT_HEADING (Poppins) */}
        {cardTitle(t.displayName || t.name)}

        {/* High yield badge */}
        {t.isHighYield && highYieldBadge()}

        {/* Category badge — entity accent color derivative */}
        {t.category && badge(t.category, '#d1fae5', '#065f46')}
      </div>

      {/* Preview row (collapsed): diagnostic accuracy in monospace */}
      {!expanded && (
        <div style={{
          display: 'flex',
          gap: 12,
          marginTop: 4,
          fontSize: 12,
          color: 'var(--color-text-secondary)',
          fontFamily: FONT_MONO,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {t.sensitivity != null && (
            <span>Sn: {(t.sensitivity * 100).toFixed(0)}%</span>
          )}
          {t.specificity != null && (
            <span>Sp: {(t.specificity * 100).toFixed(0)}%</span>
          )}
        </div>
      )}
    </div>
  ),

  // ---- Detail Renderer ----
  // Full structured view with: PANCE Focus (top), description, conditions,
  // technique, interpretation, diagnostic accuracy, limitations
  detailRenderer: (t) => (
    <div>
      {/* Tier 3: PANCE Focus accordion at TOP with entity accent color */}
      {studyPanel(
        t.clinicalPearls,
        t.testQuestionTips,
        t.commonMistakes,
        undefined, // mnemonics not typically used for tests
        t.boardYieldFacts,
        '#10b981' // Entity accent color (teal)
      )}

      {/* Tier 2: CLINICAL — Standard content sections */}

      {/* Description */}
      {t.description && detailSection('Description', t.description)}

      {/* Associated Conditions — itemized list */}
      {detailList('Associated Conditions', t.associatedConditions)}

      {/* Technique & Interpretation section with progressive disclosure */}
      {(t.technique || t.positiveTest || t.interpretation) && detailGroup(
        'Clinical Application',
        <>
          {t.technique && detailSection('Technique', t.technique)}
          {t.positiveTest && detailSection('Positive Test Findings', t.positiveTest)}
          {t.interpretation && detailSection('Interpretation', t.interpretation)}
        </>
      )}

      {/* Diagnostic Accuracy section — uses FONT_MONO for percentages */}
      {(t.sensitivity != null || t.specificity != null) && detailSection(
        'Diagnostic Accuracy',
        diagnosticAccuracy([
          ...(t.sensitivity != null ? [
            { label: 'Sensitivity', value: `${(t.sensitivity * 100).toFixed(0)}%` },
          ] : []),
          ...(t.specificity != null ? [
            { label: 'Specificity', value: `${(t.specificity * 100).toFixed(0)}%` },
          ] : []),
        ])
      )}

      {/* Limitations — safety-relevant content section */}
      {detailList('Limitations', t.limitations)}
    </div>
  ),
};
