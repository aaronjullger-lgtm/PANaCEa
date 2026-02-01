export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost';

export const buttonVariantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent)] text-[var(--color-text-inverse)] hover:from-[var(--color-accent)]/90 hover:to-[var(--color-accent)]/90 shadow-sm',
  secondary:
    'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] border-2 border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-secondary)] shadow-sm',
  success:
    'bg-gradient-to-r from-[var(--color-data-pass)] to-[var(--color-data-pass)] text-[var(--color-text-inverse)] hover:from-[var(--color-data-pass)]/90 hover:to-[var(--color-data-pass)]/90 shadow-sm',
  warning:
    'bg-gradient-to-r from-[var(--color-data-provisional)] to-[var(--color-data-provisional)] text-[var(--color-text-inverse)] hover:from-[var(--color-data-provisional)]/90 hover:to-[var(--color-data-provisional)]/90 shadow-sm',
  danger:
    'bg-gradient-to-r from-[var(--color-data-fail)] to-[var(--color-data-fail)] text-[var(--color-text-inverse)] hover:from-[var(--color-data-fail)]/90 hover:to-[var(--color-data-fail)]/90 shadow-sm',
  ghost: 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]',
};
