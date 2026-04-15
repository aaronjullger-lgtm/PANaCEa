/**
 * Semantic Button System — CVA + forwardRef + cn()
 *
 * Uses Class Variance Authority for type-safe variant definitions,
 * cn() for safe Tailwind class composition, and React.forwardRef
 * for composition with Radix primitives (Tooltip triggers, Dialog triggers, etc.).
 *
 * Theming via CSS custom properties:
 * - Primary: --color-accent text-[var(--color-text-inverse)] (high contrast)
 * - Secondary: --color-bg-secondary text-primary (muted)
 * - Danger: --color-data-fail (error state)
 * - Warning: --color-data-provisional (warning state)
 */

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ---------- CVA variant definitions ---------- */

const buttonVariants = cva(
  // Base classes applied to every button
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[colors,transform,box-shadow] duration-150 ease-out disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 active:scale-[0.97] motion-reduce:active:scale-100 motion-reduce:transition-colors',
  {
    variants: {
      variant: {
        primary: 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:opacity-90 active:opacity-80',
        secondary:
          'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]',
        danger:
          'bg-[var(--color-data-fail)]/20 text-[var(--color-data-fail)] hover:bg-[var(--color-data-fail)]/30 border border-[var(--color-data-fail)]/40',
        ghost: 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]',
        outline:
          'bg-transparent text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] border border-[var(--color-border)]',
        warning:
          'bg-[var(--color-data-provisional)]/20 text-[var(--color-data-provisional)] hover:bg-[var(--color-data-provisional)]/30 border border-[var(--color-data-provisional)]/40',
        accent:
          'bg-[var(--color-accent)]/20 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/30 border border-[var(--color-accent)]/30',
        success: 'bg-[var(--color-data-pass)] text-[var(--color-text-inverse)] hover:opacity-90 active:opacity-80',
      },
      size: {
        xs: 'px-2.5 py-1 text-xs min-h-[32px]',
        sm: 'px-3 py-1.5 text-sm min-h-[36px]',
        md: 'px-4 py-2 text-base min-h-[44px]',
        lg: 'px-6 py-3 text-lg min-h-[44px]',
        xl: 'px-8 py-4 text-xl min-h-[52px]',
        icon: 'p-2 min-h-[44px] min-w-[44px]',
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
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
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
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2" role="status" aria-live="polite">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
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
