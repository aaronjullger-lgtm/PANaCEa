/**
 * Workspace Palette Tokens — canonical
 *
 * Six PANaCEa brand tones used for WorkspacePage badge treatments and
 * decorative radial-gradient backgrounds. Raw hex values are permitted here
 * (same exemption as entityAccents.ts — pinned by navigational intent so
 * each workspace mode is instantly recognisable across all themes).
 *
 * Consumers must import from `@/lib/tokens` and NEVER hardcode these inline.
 */

/* ---------- Six brand tone accents ---------- */

export const workspaceAccent = {
  gold:  '#c4b78a',
  steel: '#728ba6',
  plum:  '#9a7f9a',
  sage:  '#7a8f6e',
  rose:  '#a67f7f',
  amber: '#b39b6c',
} as const;

export type WorkspaceTone = keyof typeof workspaceAccent;

/* ---------- Badge style triples (bg, text, border) ----------
 * All designed for dark surfaces. bg/border use rgba transparency so the
 * card background shows through; text is a lighter tint of the accent.
 */

export type WorkspaceBadgeStyle = { readonly bg: string; readonly text: string; readonly border: string };

export const workspaceBadgeStyles: Record<WorkspaceTone, WorkspaceBadgeStyle> = {
  gold:  { bg: 'rgba(196, 183, 138, 0.12)', text: '#d8cca8', border: 'rgba(196, 183, 138, 0.28)' },
  steel: { bg: 'rgba(114, 139, 166, 0.12)', text: '#a8bfd8', border: 'rgba(114, 139, 166, 0.26)' },
  plum:  { bg: 'rgba(154, 127, 154, 0.12)', text: '#c8a9c8', border: 'rgba(154, 127, 154, 0.26)' },
  sage:  { bg: 'rgba(122, 143, 110, 0.12)', text: '#bfd0b2', border: 'rgba(122, 143, 110, 0.26)' },
  rose:  { bg: 'rgba(166, 127, 127, 0.12)', text: '#d8b0b0', border: 'rgba(166, 127, 127, 0.26)' },
  amber: { bg: 'rgba(179, 155, 108, 0.12)', text: '#d8c28e', border: 'rgba(179, 155, 108, 0.26)' },
} as const;

/* ---------- Page-mode radial gradient backgrounds ---------- */

export type WorkspacePageMode =
  | 'default'
  | 'launch'
  | 'analytics'
  | 'reference'
  | 'toolkit'
  | 'challenge'
  | 'error';

export const workspacePageModeBackground: Record<WorkspacePageMode, string> = {
  default:
    'radial-gradient(circle at 12% 12%, rgba(196,183,138,0.16), transparent 24%), radial-gradient(circle at 86% 10%, rgba(114,139,166,0.18), transparent 28%), radial-gradient(circle at 70% 100%, rgba(154,127,154,0.16), transparent 30%)',
  launch:
    'radial-gradient(circle at 10% 14%, rgba(196,183,138,0.22), transparent 26%), radial-gradient(circle at 82% 8%, rgba(114,139,166,0.18), transparent 26%), linear-gradient(180deg, rgba(255,255,255,0.02), transparent 55%)',
  analytics:
    'radial-gradient(circle at 12% 14%, rgba(114,139,166,0.2), transparent 26%), radial-gradient(circle at 82% 10%, rgba(122,143,110,0.16), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0.02), transparent 55%)',
  reference:
    'radial-gradient(circle at 8% 16%, rgba(114,139,166,0.22), transparent 28%), radial-gradient(circle at 84% 10%, rgba(154,127,154,0.18), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0.03), transparent 62%)',
  toolkit:
    'radial-gradient(circle at 12% 16%, rgba(179,155,108,0.24), transparent 28%), radial-gradient(circle at 86% 10%, rgba(114,139,166,0.16), transparent 26%), linear-gradient(180deg, rgba(255,255,255,0.02), transparent 58%)',
  challenge:
    'radial-gradient(circle at 10% 12%, rgba(154,127,154,0.22), transparent 26%), radial-gradient(circle at 84% 8%, rgba(196,183,138,0.18), transparent 26%), linear-gradient(180deg, rgba(255,255,255,0.02), transparent 60%)',
  error:
    'radial-gradient(circle at 12% 14%, rgba(166,127,127,0.22), transparent 26%), radial-gradient(circle at 84% 12%, rgba(179,155,108,0.12), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.015), transparent 58%)',
} as const;

/* ---------- Hero strip: tone → accent hex ---------- */

export const workspaceHeroAccent: Record<WorkspacePageMode, string> = {
  default:   'var(--color-accent)',
  launch:    workspaceAccent.gold,
  analytics: workspaceAccent.steel,
  reference: workspaceAccent.steel,
  toolkit:   workspaceAccent.amber,
  challenge: workspaceAccent.plum,
  error:     workspaceAccent.rose,
} as const;
