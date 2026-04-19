/**
 * Clinical Safety Tier Tokens — canonical
 *
 * Three-tier visual hierarchy for clinical content. Every piece of
 * clinical information falls into exactly one tier. Consumers should
 * import these tokens instead of hardcoding red/amber/blue safety colors.
 *
 * Tier 1 — CRITICAL (safety-bearing)
 *   Red left-border + warning background. Content where missing it could harm
 *   a patient: contraindications, critical lab values, emergency management,
 *   red-flag responses.
 *
 * Tier 2 — CLINICAL (standard)
 *   Clean label + body, no special border. Workhorse tier for descriptions,
 *   mechanisms, indications, technique, interpretation.
 *
 * Tier 3 — STUDY (board yield)
 *   Collapsible accordion with entity accent color border. Pearls, test tips,
 *   common mistakes, mnemonics.
 *
 * EXCEPTION: This is the ONLY file in the token layer allowed to contain raw
 * hex values. The three safety-red hexes are pinned by clinical intent — they
 * must be visually identifiable as "danger" across every theme and therefore
 * do not follow the accent/theme system.
 */

/* ---------- Tier 1: CRITICAL safety reds (pinned by intent) ---------- */

export const safetyRed = {
  /** 3px left border on critical panels */
  border: '#ef4444',
  /** Label text color (uppercase heading inside critical panel) */
  label:  '#dc2626',
  /** Background tint — blended with --color-bg-secondary via color-mix */
  tint:   '#fef2f2',
} as const;

/* ---------- Tier 2: CLINICAL (no raw colors — uses theme vars) ---------- */

export const safetyClinical = {
  labelColor: 'var(--color-text-secondary)',
  bodyColor:  'var(--color-text-primary)',
  border:     'var(--color-border)',
} as const;

/* ---------- Tier 3: STUDY (entity-accent border, theme body) ---------- */

export const safetyStudy = {
  /** Border accent is the entity accent color — passed in by the caller. */
  defaultBorder: 'var(--color-border)',
  background:    'var(--color-bg-secondary)',
  labelColor:    'var(--color-text-primary)',
  bodyColor:     'var(--color-text-secondary)',
} as const;

/* ---------- Style-object helpers (drop into inline `style={...}`) ---------- */

import type { CSSProperties } from 'react';

/**
 * Build the inline style for a Tier-1 critical panel wrapper.
 * Consumers still supply their own padding/margin.
 */
export function criticalPanelStyle(): CSSProperties {
  return {
    borderLeft: `3px solid ${safetyRed.border}`,
    background: `color-mix(in srgb, var(--color-bg-secondary) 80%, ${safetyRed.tint} 20%)`,
    borderRadius: 8,
  };
}

/** Build the inline style for a Tier-1 critical label row. */
export function criticalLabelStyle(): CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: safetyRed.label,
  };
}

/* ---------- Tailwind class shortcuts ---------- */

export const safetyClass = {
  critical: {
    border:     'border-l-[3px] border-l-[#ef4444]',
    background: 'bg-[color-mix(in_srgb,_var(--color-bg-secondary)_80%,_#fef2f2_20%)]',
    label:      'text-[#dc2626] uppercase tracking-[0.05em] font-bold text-xs',
  },
  clinical: {
    label: 'text-[var(--color-text-secondary)] uppercase tracking-[0.05em] font-bold text-xs',
    body:  'text-[var(--color-text-primary)] text-sm leading-relaxed',
  },
  study: {
    wrapper: 'rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden',
  },
} as const;

/* ---------- Tier type ---------- */

export type SafetyTier = 'critical' | 'clinical' | 'study';
