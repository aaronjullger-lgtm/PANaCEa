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
  'inline-flex items-center justify-center gap-2 rounded-xl border font-medium tracking-[-0.01em] transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] active:scale-[0.985] motion-reduce:active:scale-100 motion-reduce:transition-colors',
  {
    variants: {
      variant: {
        primary:
          'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-text-inverse)] shadow-[0_18px_36px_-24px_color-mix(in_srgb,var(--color-accent)_80%,transparent)] hover:border-[color-mix(in_srgb,var(--color-accent)_78%,white)] hover:bg-[color-mix(in_srgb,var(--color-accent)_92%,white_8%)]',
        secondary:
          'border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] shadow-[0_10px_24px_-20px_rgba(15,23,42,0.48)] hover:border-[var(--color-accent)]/18 hover:bg-[var(--color-bg-tertiary)]',
        danger:
          'border-[var(--color-data-fail)]/35 bg-[var(--color-data-fail)]/14 text-[var(--color-data-fail)] hover:border-[var(--color-data-fail)]/55 hover:bg-[var(--color-data-fail)]/18',
        ghost:
          'border-transparent bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]',
        outline:
          'border-[var(--color-border)] bg-transparent text-[var(--color-text-primary)] hover:border-[var(--color-accent)]/18 hover:bg-[var(--color-bg-secondary)]',
        warning:
          'border-[var(--color-data-provisional)]/35 bg-[var(--color-data-provisional)]/14 text-[var(--color-data-provisional)] hover:border-[var(--color-data-provisional)]/55 hover:bg-[var(--color-data-provisional)]/18',
        accent:
          'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/12 text-[var(--color-accent)] hover:border-[var(--color-accent)]/45 hover:bg-[var(--color-accent)]/18',
        success:
          'border-[var(--color-data-pass)] bg-[var(--color-data-pass)] text-[var(--color-text-inverse)] shadow-[0_18px_36px_-24px_color-mix(in_srgb,var(--color-data-pass)_80%,transparent)] hover:border-[var(--color-data-pass)]/80 hover:bg-[color-mix(in_srgb,var(--color-data-pass)_92%,white_8%)]',
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
