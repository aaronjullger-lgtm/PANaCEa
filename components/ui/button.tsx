import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost';
  children: React.ReactNode;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'default',
  children,
  loading = false,
  disabled,
  className = '',
  ...props
}) => {
  const isDisabled = disabled || loading;
  const baseStyles =
    'px-4 py-2 rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2';

  const variantStyles = {
    default:
      'bg-muted-amber-500 text-[var(--color-text-inverse)] shadow-md hover:brightness-90 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.95]',
    outline:
      'border-2 border-[var(--color-navy,#0F172A)] dark:border-[var(--color-text-secondary)] bg-transparent text-[var(--color-navy,#0F172A)] dark:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]',
    ghost:
      'bg-transparent text-[var(--color-navy,#0F172A)] dark:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] border-2 border-transparent hover:border-[var(--color-navy,#0F172A)] dark:hover:border-[var(--color-border)]',
  };

  return (
    <button
      disabled={isDisabled}
      aria-busy={loading}
      className={`${baseStyles} ${variantStyles[variant]} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />}
      {children}
    </button>
  );
};
