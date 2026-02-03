import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'default',
  children,
  className = '',
  ...props
}) => {
  const baseStyles =
    'px-4 py-2 rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2';

  const variantStyles = {
    default: 'bg-muted-amber-500 text-white hover:brightness-90 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.95]',
    outline:
      'border-2 border-[#0F172A] dark:border-[var(--color-border)] bg-transparent text-[#0F172A] dark:text-[var(--color-text-primary)] hover:bg-slate-100 dark:hover:bg-[var(--color-bg-secondary)]',
    ghost: 'bg-transparent text-[#0F172A] dark:text-[var(--color-text-secondary)] hover:bg-slate-100 dark:hover:bg-[var(--color-bg-secondary)] border-2 border-transparent hover:border-[#0F172A] dark:hover:border-[var(--color-border)]',
  };

  return (
    <button className={`${baseStyles} ${variantStyles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};
