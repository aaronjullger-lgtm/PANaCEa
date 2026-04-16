import type { CSSProperties } from 'react';

export const pageContainerPaddingClass = 'px-4 sm:px-6 lg:px-8';

export const surfaceBaseClass =
  'rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-bg-secondary)]';
export const surfaceInteractiveClass =
  'transition-[background-color,border-color,box-shadow,transform] duration-200';
export const surfacePaddingClass = 'p-5 sm:p-6';
export const surfaceCompactPaddingClass = 'p-4 sm:p-5';

export const surfaceShadowStyle: CSSProperties = {
  boxShadow:
    '0 0 0 1px color-mix(in srgb, var(--color-text-primary) 4%, transparent), 0 20px 42px -30px rgba(15,23,42,0.58), 0 8px 16px -12px rgba(15,23,42,0.36)',
};

export const surfaceRaisedStyle: CSSProperties = {
  boxShadow:
    '0 0 0 1px color-mix(in srgb, var(--color-text-primary) 4%, transparent), 0 26px 54px -32px rgba(15,23,42,0.64), 0 10px 18px -12px rgba(15,23,42,0.42)',
};

export const sectionTitleClass =
  'text-xl font-semibold tracking-[-0.03em] text-[var(--color-text-primary)] sm:text-2xl';
export const sectionHeadingClass =
  'text-lg font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]';
export const sectionSubtitleClass =
  'text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base';
export const bodySupportClass = 'text-sm leading-6 text-[var(--color-text-secondary)]';
export const mutedCopyClass = 'text-sm text-[var(--color-text-muted)]';
export const sectionHeaderRowClass = 'flex items-start justify-between gap-4';
export const iconTileClass =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]';
export const emptyStateSurfaceClass =
  'mx-auto flex w-full max-w-2xl flex-col items-center justify-center rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-center';
export const emptyStateIconWrapClass =
  'flex items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]';

export const badgeBaseClass =
  'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap tracking-[-0.01em]';
export const badgeSizeClasses = {
  sm: 'px-2 py-0.5 text-[11px] min-h-[22px]',
  md: 'px-2.5 py-1 text-xs min-h-[26px]',
  lg: 'px-3 py-1.5 text-sm min-h-[32px]',
} as const;

export const fieldBaseClass =
  'w-full rounded-xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-secondary)_84%,var(--color-bg-primary))] text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] disabled:cursor-not-allowed disabled:opacity-50';
export const fieldLabelClass =
  'mb-1.5 block text-sm font-medium tracking-[-0.01em] text-[var(--color-text-primary)]';
export const fieldHintClass = 'mt-1.5 text-sm leading-6 text-[var(--color-text-muted)]';
export const fieldErrorClass = 'mt-1.5 text-sm leading-6 text-[var(--color-data-fail)]';

export const tableRowClass =
  'group grid items-center border-b border-[var(--color-border)] transition-colors duration-150 hover:bg-[var(--color-bg-secondary)]/55';
