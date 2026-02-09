export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost';

export const buttonVariantStyles: Record<ButtonVariant, string> = {
  /* Primary: Rich Gold, white text, WCAG AA contrast (≥4.5:1 with #fff) */
  primary:
    'bg-[#7B6C4F] text-white shadow-md border border-[#6B5C3F] hover:brightness-110 dark:bg-[#7B6C4F] dark:text-white dark:border-[#6B5C3F] dark:hover:brightness-110',
  /* Secondary: High-contrast border and text for visibility */
  secondary:
    'bg-transparent text-[#0F172A] dark:text-[var(--color-text-primary)] border-2 border-[#0F172A] dark:border-[var(--color-text-secondary)] hover:bg-slate-100 dark:hover:bg-[var(--color-bg-secondary)] hover:border-[#0F172A] dark:hover:border-[var(--color-accent)] shadow-sm',
  success:
    'bg-[#0d7a6f] text-white hover:brightness-110 shadow-sm dark:bg-[#0d7a6f]',
  warning:
    'bg-[#92610a] text-white hover:brightness-110 shadow-sm dark:bg-[#92610a]',
  danger:
    'bg-[#b91c1c] text-white hover:brightness-110 shadow-sm dark:bg-[#b91c1c]',
  ghost:
    'bg-transparent text-[#0F172A] dark:text-[var(--color-text-secondary)] border-2 border-transparent hover:border-[#0F172A] dark:hover:border-[var(--color-border)] hover:bg-slate-100 dark:hover:bg-[var(--color-bg-secondary)]',
};
