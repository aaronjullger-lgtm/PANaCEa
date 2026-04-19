/**
 * Data-Viz Tokens — canonical
 *
 * Palettes used by clinical data-visualization components: illness scripts,
 * knowledge graphs, confusion graphs, completeness rings, strength badges,
 * severity indicators, and section accents in the reference library.
 *
 * Why hex values are permitted here:
 *   These palettes are semantic — "pathognomonic" must always look pathognomonic,
 *   "critical severity" must always look critical. They do not follow the
 *   accent/theme rotation; they follow clinical meaning. Documented in
 *   `.claude/skills/panacea-style-system` as an allowed hex-at-token-layer
 *   exception, alongside `safety.ts` and `entityAccents.ts`.
 *
 * Consumers must NEVER hardcode these values inline. Import from
 * `@/lib/tokens` and reference by semantic key.
 */

/* ---------- Shape ---------- */

/** A strength/severity badge pair: tinted fill + solid text color. */
export type VizPair = { readonly bg: string; readonly text: string };

/* ---------- 5-level diagnostic strength ----------
 * Used by illness-script consequences, finding-strength badges, and
 * evidence-grade indicators. `{hex}20` / `{hex}15` suffix = alpha fill.
 */
export const diagnosticStrength = {
  pathognomonic: { bg: '#dc262620', text: '#ef4444' },
  strong:        { bg: '#f9731620', text: '#f97316' },
  moderate:      { bg: '#eab30820', text: '#eab308' },
  weak:          { bg: '#6b728020', text: '#9ca3af' },
  unknown:       { bg: '#6b728015', text: '#6b7280' },
} as const satisfies Record<string, VizPair>;

export type DiagnosticStrengthKey = keyof typeof diagnosticStrength;

/** Fallback pair used when a strength key is missing — mirrors `unknown`. */
export const diagnosticStrengthFallback: VizPair = { bg: '#6b728015', text: '#6b7280' };

/* ---------- 3-level severity (critical/moderate/minor) ----------
 * Used by gap lists, risk indicators, and flagged-issue widgets.
 * Solid text colors — no tinted backgrounds by default.
 */
export const severity = {
  critical: '#ef4444',
  moderate: '#f97316',
  minor:    '#6b7280',
} as const;

export type SeverityKey = keyof typeof severity;

/** Fallback color when a severity key is missing — mirrors `minor`. */
export const severityFallback = '#6b7280';

/* ---------- 3-tier completeness (ring / progress indicator) ----------
 * Green ≥80%, amber ≥50%, red <50%. Used by CompletenessRing and similar.
 */
export const completeness = {
  success: '#22c55e',
  warning: '#eab308',
  danger:  '#ef4444',
} as const;

/** Resolve a 0..1 completeness value to one of the three tiers. */
export function completenessColor(value: number): string {
  const pct = value * 100;
  if (pct >= 80) return completeness.success;
  if (pct >= 50) return completeness.warning;
  return completeness.danger;
}

/* ---------- Illness-script section accents ----------
 * Per-panel accent stripe color for the three-panel illness-script layout
 * plus its auxiliary panels (diagnostics, treatment, comparison, gaps).
 * These mirror clinical categorization, not entity type.
 */
export const illnessScriptAccent = {
  enabling:    '#f97316', // enabling conditions — orange (risk/exposure)
  fault:       '#8b5cf6', // pathophysiology — violet (mechanism)
  consequence: '#22c55e', // clinical consequences — green (manifestation)
  treatment:   '#06b6d4', // treatment — cyan (intervention)
  comparison:  '#ec4899', // DDx comparison — pink
  gap:         '#ef4444', // knowledge gaps — red (borrow severity.critical)
  classic:     '#f59e0b', // ★ classic finding / buzzword amber
} as const;

export type IllnessScriptAccentKey = keyof typeof illnessScriptAccent;

/* ---------- Soft tint helpers (alpha suffixes) ----------
 * Used for pill backgrounds and subtle borders around an accent color.
 * Always build strings via these helpers; never concatenate inline.
 */
export function tintBg(hex: string, alpha: '10' | '15' | '20' | '30' | '40' = '15'): string {
  return `${hex}${alpha}`;
}

/* ---------- Knowledge-graph node colors ----------
 * Node colors for the InteractiveGraphCanvas / knowledge graph view.
 * Chosen for discriminability against a neutral background and against
 * each other. Keys mirror GraphNode type enum.
 */
export const graphNodeColor = {
  CONDITION:  '#dc2626',
  FINDING:    '#2563eb',
  DRUG:       '#16a34a',
  PROCEDURE:  '#d97706',
  SYSTEM:     '#7c3aed',
  ANATOMY:    '#64748b',
  LAB_TEST:   '#0891b2',
  IMAGING:    '#db2777',
  VITAL_SIGN: '#059669',
  OTHER:      '#6b7280',
} as const;

export type GraphNodeColorKey = keyof typeof graphNodeColor;

/** Fallback node color when a key is missing — mirrors `OTHER`. */
export const graphNodeColorFallback = '#6b7280';

/* ---------- Knowledge-graph edge colors + styles ----------
 * Each edge type has a line color and a dash style. Keys mirror the
 * GraphEdge relationship enum.
 */
export type LineStyle = 'solid' | 'dashed' | 'dotted';
export type EdgeStyle = { readonly lineColor: string; readonly lineStyle: LineStyle };

export const graphEdgeStyle = {
  HIERARCHICAL:  { lineColor: '#4b5563', lineStyle: 'solid'  },
  CO_OCCURRENCE: { lineColor: '#3b82f6', lineStyle: 'solid'  },
  SEMANTIC:      { lineColor: '#10b981', lineStyle: 'dashed' },
  EXPLICIT:      { lineColor: '#f59e0b', lineStyle: 'solid'  },
  ASSOCIATED:    { lineColor: '#8b5cf6', lineStyle: 'dotted' },
  TREATS:        { lineColor: '#ef4444', lineStyle: 'solid'  },
  CAUSES:        { lineColor: '#f97316', lineStyle: 'solid'  },
  MANIFESTS:     { lineColor: '#ec4899', lineStyle: 'dashed' },
  DIFFERENTIAL:  { lineColor: '#14b8a6', lineStyle: 'dotted' },
  COMPLICATES:   { lineColor: '#b91c1c', lineStyle: 'solid'  },
} as const satisfies Record<string, EdgeStyle>;

export type GraphEdgeStyleKey = keyof typeof graphEdgeStyle;

/** Fallback edge color for missing relationship types (muted grey). */
export const graphEdgeColorFallback = '#9ca3af';

/* ---------- Graph UI accents ---------- */

export const graphUI = {
  /** Highlight border around the currently-focused node. */
  focusBorder: '#fbbf24',
  /** Highlight line color for the focused edge/path. */
  focusLine:   '#f59e0b',
  /** Default white border drawn around every node. */
  nodeBorder:  '#ffffff',
  /** Default label text color painted inside node chips. */
  nodeLabel:   '#fff',
} as const;

/* ---------- Organ-system palette ----------
 * Colors per organ system used by the confusion graph, blueprint heatmap,
 * system-gap dashboards, and any component that categorizes clinical content
 * by organ system. Keys mirror the canonical NCCPA blueprint system names.
 * Both capitalized and multi-word keys are exact-match; consumers should
 * normalize input via `organSystemColorFor()` for case-insensitive lookup.
 */
export const organSystemColor = {
  Cardiovascular:         '#ef4444',
  Pulmonary:              '#3b82f6',
  Gastrointestinal:       '#f59e0b',
  Musculoskeletal:        '#8b5cf6',
  HEENT:                  '#06b6d4',
  Reproductive:           '#ec4899',
  Neurological:           '#6366f1',
  Psychiatry:             '#a78bfa',
  Endocrine:              '#14b8a6',
  Dermatology:            '#f97316',
  Genitourinary:          '#84cc16',
  Hematology:             '#dc2626',
  'Infectious Disease':   '#10b981',
  Nephrology:             '#0ea5e9',
  'Emergency Medicine':   '#e11d48',
  Pharmacology:           '#7c3aed',
} as const satisfies Record<string, string>;

export type OrganSystemKey = keyof typeof organSystemColor;

/** Fallback color when an organ-system key is missing (muted grey). */
export const organSystemColorFallback = '#6b7280';

/** Case-insensitive lookup — pass any user-facing system name. */
export function organSystemColorFor(system: string | null | undefined): string {
  if (!system) return organSystemColorFallback;
  const direct = (organSystemColor as Record<string, string>)[system];
  if (direct) return direct;
  const needle = system.toLowerCase();
  const match = (Object.keys(organSystemColor) as OrganSystemKey[])
    .find(k => k.toLowerCase() === needle);
  return match ? organSystemColor[match] : organSystemColorFallback;
}
