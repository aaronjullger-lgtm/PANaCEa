export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost';

export const buttonVariantStyles: Record<ButtonVariant, string> = {
  /* Primary: Solid blue in light mode (main page CTAs), gold in dark; hex so Tailwind always includes. */
  primary:
    'bg-[#2563EB] text-white shadow-md border border-[#1D4ED8] hover:bg-[#1D4ED8] hover:brightness-110 dark:bg-[#7B6C4F] dark:text-white dark:border-[#6B5C3F] dark:hover:brightness-110',
  /* Secondary: High-contrast border and text for visibility */
  secondary:
    'bg-transparent text-[var(--color-text-primary)] border-2 border-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] dark:text-[var(--color-text-primary)] dark:border-[var(--color-text-secondary)] dark:hover:bg-[var(--color-bg-secondary)] dark:hover:border-[var(--color-accent)] shadow-sm',
  success:
    'bg-[#0d7a6f] text-white hover:brightness-110 shadow-sm dark:bg-[#0d7a6f]',
  warning:
    'bg-[#92610a] text-white hover:brightness-110 shadow-sm dark:bg-[#92610a]',
  danger:
    'bg-[#b91c1c] text-white hover:brightness-110 shadow-sm dark:bg-[#b91c1c]',
  ghost:
    'bg-transparent text-[var(--color-text-primary)] dark:text-[var(--color-text-secondary)] border-2 border-transparent hover:border-[var(--color-text-primary)] dark:hover:border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] dark:hover:bg-[var(--color-bg-secondary)]',
};
