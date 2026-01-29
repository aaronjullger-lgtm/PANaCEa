export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'ghost';

export const buttonVariantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-sm',
  secondary:
    'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] border-2 border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-secondary)] shadow-sm',
  success:
    'bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:from-emerald-600 hover:to-green-700 shadow-sm',
  warning:
    'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-sm',
  danger:
    'bg-gradient-to-r from-red-500 to-rose-600 text-white hover:from-red-600 hover:to-rose-700 shadow-sm',
  ghost:
    'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]',
};
