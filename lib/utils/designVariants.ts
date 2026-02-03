export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost';

export const buttonVariantStyles: Record<ButtonVariant, string> = {
  /* Primary: Muted Gold, white text, 12px radius, hover darken 10% */
  primary:
    'bg-[#B09B73] text-white shadow-sm hover:brightness-90 dark:bg-[#B09B73] dark:text-white dark:hover:brightness-90',
  /* Secondary: Deep Navy border, transparent bg */
  secondary:
    'bg-transparent text-[#0F172A] dark:text-[var(--color-text-primary)] border-2 border-[#0F172A] dark:border-[var(--color-border)] hover:bg-slate-100 dark:hover:bg-[var(--color-bg-secondary)] hover:border-[#0F172A] dark:hover:border-[var(--color-accent)] shadow-sm',
  success:
    'bg-gradient-to-r from-[var(--color-data-pass)] to-[var(--color-data-pass)] text-[var(--color-text-inverse)] hover:from-[var(--color-data-pass)]/90 hover:to-[var(--color-data-pass)]/90 shadow-sm',
  warning:
    'bg-gradient-to-r from-[var(--color-data-provisional)] to-[var(--color-data-provisional)] text-[var(--color-text-inverse)] hover:from-[var(--color-data-provisional)]/90 hover:to-[var(--color-data-provisional)]/90 shadow-sm',
  danger:
    'bg-gradient-to-r from-[var(--color-data-fail)] to-[var(--color-data-fail)] text-[var(--color-text-inverse)] hover:from-[var(--color-data-fail)]/90 hover:to-[var(--color-data-fail)]/90 shadow-sm',
  ghost:
    'bg-transparent text-[#0F172A] dark:text-[var(--color-text-secondary)] border-2 border-transparent hover:border-[#0F172A] dark:hover:border-[var(--color-border)] hover:bg-slate-100 dark:hover:bg-[var(--color-bg-secondary)]',
};
