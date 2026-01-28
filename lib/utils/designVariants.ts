export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'ghost';

export const buttonVariantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-action-blue-600 to-action-blue-700 text-white hover:from-action-blue-700 hover:to-action-blue-800 shadow-sm',
  secondary:
    'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] border-2 border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-secondary)] shadow-sm',
  success:
    'bg-gradient-to-r from-sage-500 to-sage-600 text-white hover:from-sage-600 hover:to-sage-700 shadow-sm',
  warning:
    'bg-gradient-to-r from-muted-amber-500 to-muted-amber-600 text-white hover:from-muted-amber-600 hover:to-muted-amber-700 shadow-sm',
  danger:
    'bg-gradient-to-r from-dusty-rose-500 to-dusty-rose-600 text-white hover:from-dusty-rose-600 hover:to-dusty-rose-700 shadow-sm',
  ghost:
    'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]',
};
