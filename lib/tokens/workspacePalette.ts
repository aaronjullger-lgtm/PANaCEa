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
  gold:  '#f4c66b',
  steel: '#60a5fa',
  plum:  '#a78bfa',
  sage:  '#34d399',
  rose:  '#fb7185',
  amber: '#f59e0b',
} as const;

export type WorkspaceTone = keyof typeof workspaceAccent;

/* ---------- Badge style triples (bg, text, border) ----------
 * All designed for dark surfaces. bg/border use rgba transparency so the
 * card background shows through; text is a lighter tint of the accent.
 */

export type WorkspaceBadgeStyle = { readonly bg: string; readonly text: string; readonly border: string };

export const workspaceBadgeStyles: Record<WorkspaceTone, WorkspaceBadgeStyle> = {
  gold:  { bg: 'rgba(244, 198, 107, 0.12)', text: '#fde8a5', border: 'rgba(244, 198, 107, 0.28)' },
  steel: { bg: 'rgba(96, 165, 250, 0.13)', text: '#bfdbfe', border: 'rgba(96, 165, 250, 0.28)' },
  plum:  { bg: 'rgba(167, 139, 250, 0.13)', text: '#ddd6fe', border: 'rgba(167, 139, 250, 0.28)' },
  sage:  { bg: 'rgba(52, 211, 153, 0.12)', text: '#bbf7d0', border: 'rgba(52, 211, 153, 0.28)' },
  rose:  { bg: 'rgba(251, 113, 133, 0.12)', text: '#fecdd3', border: 'rgba(251, 113, 133, 0.28)' },
  amber: { bg: 'rgba(245, 158, 11, 0.12)', text: '#fcd34d', border: 'rgba(245, 158, 11, 0.28)' },
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
    'radial-gradient(circle at 12% 12%, rgba(103,232,249,0.12), transparent 24%), radial-gradient(circle at 86% 10%, rgba(96,165,250,0.15), transparent 28%), radial-gradient(circle at 70% 100%, rgba(167,139,250,0.12), transparent 30%)',
  launch:
    'radial-gradient(circle at 10% 14%, rgba(103,232,249,0.14), transparent 26%), radial-gradient(circle at 82% 8%, rgba(96,165,250,0.14), transparent 26%), linear-gradient(180deg, rgba(255,255,255,0.035), transparent 55%)',
  analytics:
    'radial-gradient(circle at 12% 14%, rgba(96,165,250,0.16), transparent 26%), radial-gradient(circle at 82% 10%, rgba(52,211,153,0.12), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0.03), transparent 55%)',
  reference:
    'radial-gradient(circle at 8% 16%, rgba(96,165,250,0.17), transparent 28%), radial-gradient(circle at 84% 10%, rgba(167,139,250,0.13), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0.03), transparent 62%)',
  toolkit:
    'radial-gradient(circle at 12% 16%, rgba(245,158,11,0.13), transparent 28%), radial-gradient(circle at 86% 10%, rgba(96,165,250,0.13), transparent 26%), linear-gradient(180deg, rgba(255,255,255,0.03), transparent 58%)',
  challenge:
    'radial-gradient(circle at 10% 12%, rgba(167,139,250,0.15), transparent 26%), radial-gradient(circle at 84% 8%, rgba(103,232,249,0.11), transparent 26%), linear-gradient(180deg, rgba(255,255,255,0.03), transparent 60%)',
  error:
    'radial-gradient(circle at 12% 14%, rgba(251,113,133,0.14), transparent 26%), radial-gradient(circle at 84% 12%, rgba(245,158,11,0.1), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.02), transparent 58%)',
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
