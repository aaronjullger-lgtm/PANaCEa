/**
 * Semantic Button System
 *
 * Uses CSS custom properties for consistent theming:
 * - Primary: --color-accent text-white (high contrast)
 * - Secondary: --color-bg-secondary text-primary (muted)
 * - Danger: --color-data-fail (error state)
 * - Warning: --color-data-provisional (warning state)
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'warning' | 'accent';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--color-accent)] text-white hover:opacity-90 active:opacity-80',
  secondary: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]',
  danger: 'bg-[var(--color-data-fail)]/20 text-[var(--color-data-fail)] hover:bg-[var(--color-data-fail)]/30 border border-[var(--color-data-fail)]/40',
  ghost: 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]',
  outline: 'bg-transparent text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] border border-[var(--color-border)]',
  warning: 'bg-[var(--color-data-provisional)]/20 text-[var(--color-data-provisional)] hover:bg-[var(--color-data-provisional)]/30 border border-[var(--color-data-provisional)]/40',
  accent: 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/30 border border-[var(--color-accent)]/30',
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'px-2 py-1 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const isComponent = (v: unknown): v is React.ComponentType =>
    typeof v === 'function' || (v != null && typeof v === 'object' && '$$typeof' in (v as object));

  const renderedIcon = React.isValidElement(icon)
    ? icon
    : isComponent(icon)
      ? React.createElement(icon)
      : icon;

  const renderedIconRight = React.isValidElement(iconRight)
    ? iconRight
    : isComponent(iconRight)
      ? React.createElement(iconRight)
      : iconRight;

  return (
    <button
      disabled={disabled || loading}
      className={`
        rounded-lg font-medium transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {children}
        </span>
      ) : (
        <span className="flex items-center gap-2">
          {renderedIcon}
          {children}
          {renderedIconRight}
        </span>
      )}
    </button>
  );
}

// Convenience exports for backward compatibility
export const PrimaryButton = (props: Omit<ButtonProps, 'variant'>) => <Button variant="primary" {...props} />;
export const SecondaryButton = (props: Omit<ButtonProps, 'variant'>) => <Button variant="secondary" {...props} />;
export const DangerButton = (props: Omit<ButtonProps, 'variant'>) => <Button variant="danger" {...props} />;
export const OutlineButton = (props: Omit<ButtonProps, 'variant'>) => <Button variant="outline" {...props} />;
export const WarningButton = (props: Omit<ButtonProps, 'variant'>) => <Button variant="warning" {...props} />;
export const SuccessButton = (props: Omit<ButtonProps, 'variant'>) => <Button variant="primary" {...props} />;

export type { ButtonVariant, ButtonSize, ButtonProps };
