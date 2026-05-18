import React from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PremiumCTAButtonProps extends Omit<ButtonProps, 'variant'> {
  variant?: 'primary' | 'secondary';
  scannerAccent?: boolean;
}

export const PremiumCTAButton = React.forwardRef<HTMLButtonElement, PremiumCTAButtonProps>(
  ({ variant = 'primary', scannerAccent = false, className, children, icon, iconRight, ...props }, ref) => {
    const isPrimary = variant === 'primary';
    const renderIcon = (value: React.ReactNode | React.ComponentType | undefined) => {
      if (!value) {
        return null;
      }

      if (React.isValidElement(value)) {
        return value;
      }

      if (typeof value === 'function') {
        return React.createElement(value);
      }

      return value;
    };

    return (
      <Button
        ref={ref}
        variant={isPrimary ? 'primary' : 'secondary'}
        className={cn(
          'atlas-focus-ring atlas-reduced-motion-safe relative overflow-hidden rounded-xl border px-5 py-3',
          'transition-[border-color,box-shadow,transform,background-color,color] duration-200',
          isPrimary
            ? 'border-atlas-cyan bg-atlas-cyan text-atlas-background shadow-[0_0_28px_-14px_var(--atlas-accent-cyan)] hover:bg-atlas-white hover:border-atlas-white'
            : 'border-atlas-border bg-atlas-glass text-atlas-white hover:border-atlas-border-glow hover:bg-atlas-elevated',
          scannerAccent && 'atlas-scanner-line',
          className,
        )}
        {...props}
      >
        <span className="relative z-10 inline-flex items-center gap-2">
          {icon ? <span aria-hidden="true">{renderIcon(icon)}</span> : null}
          <span>{children}</span>
          {iconRight ? <span aria-hidden="true">{renderIcon(iconRight)}</span> : null}
        </span>
      </Button>
    );
  },
);

PremiumCTAButton.displayName = 'PremiumCTAButton';
