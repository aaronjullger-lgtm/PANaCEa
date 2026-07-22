/**
 * Legacy class-string tokens. Re-exported from `@/lib/tokens` so existing
 * consumers (EmptyState, ContentGrid, GlassCard, SectorGrid) keep working.
 */
import type { CSSProperties } from 'react';
import { textClass } from '@/lib/tokens';
import { shadow } from '@/lib/tokens/spacing';

export const sectionTitleClass = textClass.pageTitle;
export const sectionHeadingClass = textClass.sectionTitle;
export const sectionSubtitleClass = textClass.sectionSubtitle;
export const bodySupportClass = textClass.bodySupport;

export const surfaceBaseClass = 'border border-transparent';
export const surfaceInteractiveClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2';
export const surfacePaddingClass = 'p-5';
export const surfaceCompactPaddingClass = 'p-4';
export const iconTileClass =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg-tertiary)]';
export const surfaceShadowStyle: CSSProperties = { boxShadow: shadow.card };
export const surfaceRaisedStyle: CSSProperties = { boxShadow: shadow.cardGlass };

export const tableRowClass =
  'grid items-center border-b border-[var(--color-border)] px-4 text-sm text-[var(--color-text-primary)]';

export const sectionHeaderRowClass =
  'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between';

export const emptyStateInlineClass =
  'flex flex-col items-center justify-center text-center';

export const emptyStateSurfaceClass =
  'mx-auto w-full max-w-md rounded-xl bg-[var(--color-bg-secondary)] shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]';

export const emptyStateIconWrapClass =
  'flex items-center justify-center rounded-full bg-[var(--color-bg-tertiary)]';
