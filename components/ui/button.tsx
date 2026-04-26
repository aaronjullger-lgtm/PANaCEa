/**
 * Semantic Button System - CVA + forwardRef + cn()
 *
 * Uses Class Variance Authority for type-safe variant definitions,
 * cn() for safe Tailwind class composition, and React.forwardRef
 * for composition with Radix primitives (Tooltip triggers, Dialog triggers, etc.).
 *
 * Theming via CSS custom properties:
 * - Primary: muted brass with high-contrast foreground
 * - Secondary: quiet surface/outline treatment
 * - Ghost: minimal chrome
 * - Destructive: reserved for destructive actions only
 */

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { InlineSpinner } from '@/components/loading';
import { cn } from '@/lib/utils';

/* ---------- CVA variant definitions ---------- */

const buttonVariants = cva(
  // Base classes applied to every button
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] active:scale-[0.98] motion-reduce:active:scale-100 motion-reduce:transition-colors',
  {
    variants: {
      variant: {
        primary:
          'border border-[var(--color-gold-dark)] bg-[var(--color-gold-dark)] text-[var(--color-gold-text)] shadow-[var(--shadow-surface)] hover:bg-[var(--color-gold-dark-hover)] hover:border-[var(--color-gold-dark-hover)]',
        secondary:
          'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-surface)] hover:bg-[var(--color-bg-tertiary)]',
        destructive:
          'border border-[var(--color-danger)] bg-[var(--color-danger)] text-[var(--color-text-inverse)] hover:brightness-95',
        danger:
          'border border-[var(--color-danger)]/35 bg-[var(--color-danger)]/10 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/15',
        ghost: 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]',
        outline:
          'border border-[var(--color-border)] bg-transparent text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]',
        warning:
          'border border-[var(--color-risk)]/35 bg-[var(--color-risk)]/10 text-[var(--color-risk)] hover:bg-[var(--color-risk)]/15',
        accent:
          'border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15',
        success:
          'border border-[var(--color-success)] bg-[var(--color-success)] text-[var(--color-text-inverse)] hover:brightness-95',
      },
      size: {
        xs: 'px-2.5 py-1 text-xs min-h-[32px]',
        sm: 'px-3.5 py-2 text-sm min-h-[38px]',
        md: 'px-4 py-2.5 text-sm min-h-[44px]',
        lg: 'px-5 py-3 text-base min-h-[48px]',
        xl: 'px-7 py-4 text-lg min-h-[52px]',
        icon: 'p-0 min-h-[44px] min-w-[44px]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

/* ---------- Types ---------- */

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;
type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>['size']>;

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  icon?: React.ReactNode | React.ComponentType;
  iconRight?: React.ReactNode | React.ComponentType;
}

/* ---------- Button component ---------- */

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, loading = false, icon, iconRight, disabled, children, className, ...props }, ref) => {
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
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2" role="status" aria-live="polite">
            <InlineSpinner size="sm" />
            {children}
          </span>
        ) : (
          <>
            {renderedIcon && <span aria-hidden="true">{renderedIcon}</span>}
            {children}
            {renderedIconRight && <span aria-hidden="true">{renderedIconRight}</span>}
          </>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';

/* ---------- Convenience exports (backward compatible) ---------- */

const PrimaryButton = (props: Omit<ButtonProps, 'variant'>) => <Button variant="primary" {...props} />;
const SecondaryButton = (props: Omit<ButtonProps, 'variant'>) => <Button variant="secondary" {...props} />;
const DangerButton = (props: Omit<ButtonProps, 'variant'>) => <Button variant="danger" {...props} />;
const DestructiveButton = (props: Omit<ButtonProps, 'variant'>) => <Button variant="destructive" {...props} />;
const OutlineButton = (props: Omit<ButtonProps, 'variant'>) => <Button variant="outline" {...props} />;
const WarningButton = (props: Omit<ButtonProps, 'variant'>) => <Button variant="warning" {...props} />;
const SuccessButton = (props: Omit<ButtonProps, 'variant'>) => <Button variant="success" {...props} />;

/* ---------- SemanticButton (extended props for Rolling360 dashboard) ---------- */

interface SemanticButtonProps extends Omit<ButtonProps, 'loading' | 'icon' | 'iconRight'> {
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Rendered as the HTML id attribute on the underlying button element. */
  buttonId?: string;
  /** When true, adds w-full to make the button span its container. */
  fullWidth?: boolean;
}

const SemanticButton = ({
  isLoading,
  leftIcon,
  rightIcon,
  buttonId,
  fullWidth,
  className,
  ...rest
}: SemanticButtonProps) => (
  <Button
    id={buttonId}
    loading={isLoading}
    icon={leftIcon}
    iconRight={rightIcon}
    className={cn(fullWidth && 'w-full', className)}
    {...rest}
  />
);

/** Factory that creates a SemanticButton pre-bound to a specific variant. */
const makeVariantButton =
  (fixedVariant: ButtonVariant) =>
  ({ variant: _variant, ...rest }: SemanticButtonProps) =>
    <SemanticButton variant={fixedVariant} {...rest} />;

const StartSessionButton = makeVariantButton('primary');
const ActionButton = makeVariantButton('secondary');
const GhostButton = makeVariantButton('ghost');

/* ---------- Exports ---------- */

export {
  Button,
  buttonVariants,
  PrimaryButton,
  SecondaryButton,
  DangerButton,
  DestructiveButton,
  OutlineButton,
  WarningButton,
  SuccessButton,
  SemanticButton,
  StartSessionButton,
  ActionButton,
  GhostButton,
  makeVariantButton,
};

export type { ButtonVariant, ButtonSize, ButtonProps, SemanticButtonProps };
