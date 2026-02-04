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
    default: 'bg-muted-amber-500 text-[var(--color-text-inverse)] shadow-md hover:brightness-90 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.95]',
    outline:
      'border-2 border-[var(--color-navy,#0F172A)] dark:border-[var(--color-text-secondary)] bg-transparent text-[var(--color-navy,#0F172A)] dark:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]',
    ghost: 'bg-transparent text-[var(--color-navy,#0F172A)] dark:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] border-2 border-transparent hover:border-[var(--color-navy,#0F172A)] dark:hover:border-[var(--color-border)]',
  };

  return (
    <button className={`${baseStyles} ${variantStyles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};
