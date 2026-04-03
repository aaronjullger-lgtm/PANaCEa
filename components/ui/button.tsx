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

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'warning' | 'accent' | 'success';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'icon';

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
  success: 'bg-[var(--color-data-pass)] text-white hover:opacity-90 active:opacity-80',
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1 text-xs min-h-[32px]',
  sm: 'px-3 py-1.5 text-sm min-h-[36px]',
  md: 'px-4 py-2 text-base min-h-[44px]',
  lg: 'px-6 py-3 text-lg min-h-[44px]',
  xl: 'px-8 py-4 text-xl min-h-[52px]',
  icon: 'p-2 min-h-[44px] min-w-[44px]',
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
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2" role="status" aria-live="polite">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          {children}
        </span>
      ) : (
        <span className="flex items-center gap-2">
          {renderedIcon && <span aria-hidden="true">{renderedIcon}</span>}
          {children}
          {renderedIconRight && <span aria-hidden="true">{renderedIconRight}</span>}
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
export const SuccessButton = (props: Omit<ButtonProps, 'variant'>) => <Button variant="success" {...props} />;

// Extended prop interface for SemanticButton / StartSessionButton used in Rolling360 dashboard.
// Supports alternative prop names (isLoading, leftIcon, rightIcon, buttonId, fullWidth)
// that match the design-system API expected by those components.
interface SemanticButtonProps extends Omit<ButtonProps, 'loading' | 'icon' | 'iconRight'> {
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Rendered as the HTML id attribute on the underlying button element. */
  buttonId?: string;
  /** When true, adds w-full to make the button span its container. */
  fullWidth?: boolean;
}

/**
 * SemanticButton — extended button with alternative prop names used across the
 * Rolling360 dashboard. Supports `isLoading`, `leftIcon`, `rightIcon`,
 * `buttonId`, `fullWidth`, and all standard ButtonProps.
 */
export const SemanticButton = ({
  isLoading,
  leftIcon,
  rightIcon,
  buttonId,
  fullWidth,
  className = '',
  ...rest
}: SemanticButtonProps) => (
  <Button
    id={buttonId}
    loading={isLoading}
    icon={leftIcon}
    iconRight={rightIcon}
    className={`${fullWidth ? 'w-full' : ''} ${className}`.trim()}
    {...rest}
  />
);

/** Factory that creates a SemanticButton pre-bound to a specific variant. */
const makeVariantButton =
  (fixedVariant: ButtonVariant) =>
  ({ variant: _variant, ...rest }: SemanticButtonProps) =>
    <SemanticButton variant={fixedVariant} {...rest} />;

/**
 * StartSessionButton — primary CTA for "Start / Continue Session" in Rolling360 dashboard.
 */
export const StartSessionButton = makeVariantButton('primary');

/** ActionButton — secondary-style button. */
export const ActionButton = makeVariantButton('secondary');

/** GhostButton — ghost-style button. */
export const GhostButton = makeVariantButton('ghost');

export type { ButtonVariant, ButtonSize, ButtonProps, SemanticButtonProps };
