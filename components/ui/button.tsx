/**
 * Stormy Slate Button System
 * 
 * Strict design system enforcement:
 * - Primary: bg-slate-100 text-slate-900 (high contrast)
 * - Secondary: bg-slate-800 text-slate-300 (muted)
 * - Danger: bg-red-900/30 text-red-300 border-red-800
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
  primary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300',
  secondary: 'bg-slate-800 text-slate-300 hover:bg-slate-700 active:bg-slate-600 border border-slate-700',
  danger: 'bg-red-900/30 text-red-300 hover:bg-red-900/40 border border-red-800',
  ghost: 'bg-transparent text-slate-300 hover:bg-slate-800/50',
  outline: 'bg-transparent text-slate-300 hover:bg-slate-800/50 border border-slate-700',
  warning: 'bg-yellow-900/30 text-yellow-300 hover:bg-yellow-900/40 border border-yellow-800',
  accent: 'bg-slate-600 text-slate-100 hover:bg-slate-500 active:bg-slate-400',
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
  const renderedIcon = React.isValidElement(icon)
    ? icon
    : typeof icon === 'function'
      ? React.createElement(icon)
      : icon;

  const renderedIconRight = React.isValidElement(iconRight)
    ? iconRight
    : typeof iconRight === 'function'
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
