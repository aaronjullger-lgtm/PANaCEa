export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost';

export const buttonVariantStyles: Record<ButtonVariant, string> = {
  /* Primary: Solid blue in light mode (main page CTAs), gold in dark; hex so Tailwind always includes. */
  primary:
    'bg-action-blue-600 text-white shadow-md border border-action-blue-700 hover:bg-action-blue-700 hover:brightness-110 dark:bg-[var(--color-accent)] dark:text-white dark:border-[var(--color-accent-hover)] dark:hover:brightness-110',
  /* Secondary: High-contrast border and text for visibility */
  secondary:
    'bg-transparent text-[var(--color-text-primary)] border-2 border-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] dark:text-[var(--color-text-primary)] dark:border-[var(--color-text-secondary)] dark:hover:bg-[var(--color-bg-secondary)] dark:hover:border-[var(--color-accent)] shadow-sm',
  success: 'bg-data-pass text-white hover:brightness-110 shadow-sm dark:bg-data-pass',
  warning: 'bg-data-provisional text-white hover:brightness-110 shadow-sm dark:bg-data-provisional',
  danger: 'bg-data-fail text-white hover:brightness-110 shadow-sm dark:bg-data-fail',
  ghost:
    'bg-transparent text-[var(--color-text-primary)] dark:text-[var(--color-text-secondary)] border-2 border-transparent hover:border-[var(--color-text-primary)] dark:hover:border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] dark:hover:bg-[var(--color-bg-secondary)]',
};
