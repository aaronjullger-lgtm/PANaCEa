/**
 * Entity Accent Tokens — canonical
 *
 * Per-entity accent colors and badge color pairs used by the reference library
 * configs (procedures, imaging, ECG, anatomy, special tests, physiology,
 * findings, guidelines, history, lab tests, scoring systems).
 *
 * Why hex values are permitted here:
 *   Entity accents are pinned by clinical-navigation intent — each reference
 *   library entity type gets a distinct color stripe so users can orient
 *   instantly. They are documented in `.claude/skills/panacea-style-system`
 *   as an allowed hex-at-token-layer exception, alongside `safety.ts`.
 *
 * Consumers must NEVER hardcode these values inline. Import from
 * `@/lib/tokens` and reference by entity name.
 */

/* ---------- Shape ---------- */

/** A paired badge — background fill + text color, light mode only. */
export type BadgePair = { readonly bg: string; readonly text: string };

/** One entity accent: header stripe color + category/system badge pair. */
export type EntityAccent = {
  readonly accent: string;
  readonly badge: BadgePair;
};

/* ---------- 11 reference-library entity accents ---------- */

export const entityAccent = {
  procedure:     { accent: '#8b5cf6', badge: { bg: '#f3e8ff', text: '#7c3aed' } },
  imaging:       { accent: '#0ea5e9', badge: { bg: '#e0f2fe', text: '#0369a1' } },
  ecg:           { accent: '#ef4444', badge: { bg: '#fee2e2', text: '#dc2626' } },
  anatomy:       { accent: '#f59e0b', badge: { bg: '#fef3c7', text: '#92400e' } },
  specialTest:   { accent: '#10b981', badge: { bg: '#d1fae5', text: '#065f46' } },
  physiology:    { accent: '#6366f1', badge: { bg: '#e0e7ff', text: '#4338ca' } },
  findings:      { accent: '#ec4899', badge: { bg: '#fce7f3', text: '#9d174d' } },
  guideline:     { accent: '#14b8a6', badge: { bg: '#ccfbf1', text: '#115e59' } },
  history:       { accent: '#f97316', badge: { bg: '#ffedd5', text: '#9a3412' } },
  labTest:       { accent: '#0ea5e9', badge: { bg: '#e0f2fe', text: '#0369a1' } },
  scoringSystem: { accent: '#8b5cf6', badge: { bg: '#ede9fe', text: '#5b21b6' } },
} as const satisfies Record<string, EntityAccent>;

export type EntityKey = keyof typeof entityAccent;

/* ---------- Cross-cutting badge palettes (not tied to one entity) ---------- */

/** ★ High Yield badge — amber tint, amber text. Pairs with highYieldBadge(). */
export const highYieldBadgePair: BadgePair = { bg: '#fef3c7', text: '#92400e' };

/** ⚡ Emergency / ☢ Radiation warning — red tint, deep red text. */
export const warningBadgePair: BadgePair = { bg: '#fef2f2', text: '#991b1b' };

/** Fallback neutral badge — used when an entity config omits its category badge. */
export const neutralBadgePair: BadgePair = { bg: '#f3f4f6', text: '#374151' };

/* ---------- Convenience getter ---------- */

/**
 * Look up an entity accent by key. Falls back to a neutral theme-token
 * accent + neutral badge pair if the key is unknown — callers should not
 * depend on the fallback value.
 */
export function getEntityAccent(key: EntityKey | string | undefined): EntityAccent {
  if (key && key in entityAccent) {
    return entityAccent[key as EntityKey];
  }
  return { accent: 'var(--color-accent)', badge: neutralBadgePair };
}
