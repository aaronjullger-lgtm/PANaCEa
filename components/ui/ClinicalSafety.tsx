/**
 * ClinicalSafety — Reusable UI primitives for clinical safety information
 *
 * Implements the 3-tier visual hierarchy for medical content:
 *   Tier 1 (Critical) — Red left-border, alert icon, tinted background
 *   Tier 2 (Clinical) — Standard section with label
 *   Tier 3 (Study)    — Collapsible accordion for board-prep material
 *
 * These components ensure safety-critical information (contraindications,
 * critical lab values, drug interactions, black box warnings) is always
 * visually distinct and never truncated.
 *
 * Usage:
 *   import { CriticalSection, CriticalList, ClinicalSection, StudyPanel } from '@/components/ui/ClinicalSafety';
 *
 *   <CriticalSection label="Contraindications">
 *     Absolute: pregnancy, severe hepatic impairment
 *   </CriticalSection>
 *
 *   <CriticalList label="Black Box Warnings" items={['Suicidal ideation in <25y', 'Hepatotoxicity']} />
 *
 * @module components/ui/ClinicalSafety
 */

import React, { useState } from 'react';
import { AlertTriangle, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

// ── Design tokens (from PANaCEa style system) ──────────────────────────────

const FONT_BODY = "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";

const CRITICAL_BORDER = 'var(--color-data-fail)';
const CRITICAL_LABEL_COLOR = 'var(--color-data-fail)';

// ── Tier 1: Critical (safety-critical content) ─────────────────────────────

interface CriticalSectionProps {
  /** Section label (e.g., "Contraindications", "Critical Values") */
  label: string;
  /** Content to display */
  children: React.ReactNode;
  /** Optional className for additional styling */
  className?: string;
}

/**
 * Tier 1: Safety-critical information.
 * Red left-border, alert icon, tinted background.
 * Use for: contraindications, critical lab values, emergency management,
 * black box warnings, life-threatening drug interactions, decompensation signs.
 */
export function CriticalSection({ label, children, className }: CriticalSectionProps) {
  return (
    <div
      role="alert"
      aria-label={`Critical: ${label}`}
      className={className}
      style={{
        marginBottom: 14,
        padding: '10px 12px',
        borderRadius: 8,
        borderLeft: `3px solid ${CRITICAL_BORDER}`,
        background: 'color-mix(in srgb, var(--color-bg-secondary) 80%, #fef2f2 20%)',
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          color: CRITICAL_LABEL_COLOR,
          marginBottom: 4,
          fontFamily: FONT_BODY,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <AlertTriangle size={12} aria-hidden="true" /> {label}
      </div>
      <div
        style={{
          fontSize: 14,
          color: 'var(--color-text-primary)',
          lineHeight: 1.6,
          fontFamily: FONT_BODY,
        }}
      >
        {children}
      </div>
    </div>
  );
}

interface CriticalListProps {
  /** Section label */
  label: string;
  /** List items to display */
  items: string[] | undefined;
  /** Optional className */
  className?: string;
}

/**
 * Tier 1 list variant: renders a bulleted list inside CriticalSection.
 * Returns null if items is empty/undefined.
 */
export function CriticalList({ label, items, className }: CriticalListProps) {
  if (!items?.length) return null;
  return (
    <CriticalSection label={label} className={className}>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </CriticalSection>
  );
}

// ── Tier 2: Clinical (standard medical information) ────────────────────────

interface ClinicalSectionProps {
  /** Section label (e.g., "Mechanism", "Indications") */
  label: string;
  /** Content to display */
  children: React.ReactNode;
  /** Optional className */
  className?: string;
}

/**
 * Tier 2: Standard clinical information.
 * Labeled section with standard styling.
 * Use for: descriptions, mechanisms, indications, procedure steps,
 * reference ranges, sensitivity/specificity, differential diagnosis.
 */
export function ClinicalSection({ label, children, className }: ClinicalSectionProps) {
  return (
    <div className={className} style={{ marginBottom: 14 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          color: 'var(--color-text-muted)',
          marginBottom: 4,
          fontFamily: FONT_BODY,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          color: 'var(--color-text-primary)',
          lineHeight: 1.6,
          fontFamily: FONT_BODY,
        }}
      >
        {children}
      </div>
    </div>
  );
}

interface ClinicalListProps {
  /** Section label */
  label: string;
  /** List items */
  items: string[] | undefined;
  /** Optional className */
  className?: string;
}

/**
 * Tier 2 list variant: renders a bulleted list inside ClinicalSection.
 * Returns null if items is empty/undefined.
 */
export function ClinicalList({ label, items, className }: ClinicalListProps) {
  if (!items?.length) return null;
  return (
    <ClinicalSection label={label} className={className}>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </ClinicalSection>
  );
}

// ── Tier 3: Study (board-prep, pearls, mnemonics) ──────────────────────────

interface StudyPanelProps {
  /** Panel label (e.g., "Board Yield", "Clinical Pearls") */
  label: string;
  /** Content to display when expanded */
  children: React.ReactNode;
  /** Start expanded? Defaults to false. */
  defaultOpen?: boolean;
  /** Optional className */
  className?: string;
}

/**
 * Tier 3: Board-prep material in a collapsible accordion.
 * Use for: board yield facts, clinical pearls, mnemonics,
 * test question tips, PANCE-specific study notes.
 */
export function StudyPanel({ label, children, defaultOpen = false, className }: StudyPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={className}
      style={{
        marginBottom: 14,
        borderRadius: 8,
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'var(--color-bg-secondary)',
          border: 'none',
          cursor: 'pointer',
          fontFamily: FONT_BODY,
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          color: 'var(--color-accent)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <BookOpen size={12} aria-hidden="true" /> {label}
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div
          style={{
            padding: '10px 12px',
            fontSize: 14,
            color: 'var(--color-text-primary)',
            lineHeight: 1.6,
            fontFamily: FONT_BODY,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
