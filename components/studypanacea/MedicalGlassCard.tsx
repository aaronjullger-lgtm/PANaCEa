import React from 'react';
import { cn } from '@/lib/utils';

export interface MedicalGlassCardProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'aria-pressed'
> {
  active?: boolean;
  scannerAccent?: boolean;
  interactive?: boolean;
  /**
   * Adds toggle semantics for selectable card controls. Keep undefined for
   * ordinary clickable cards so screen readers do not announce a false toggle.
   */
  pressed?: boolean;
  'aria-pressed'?: boolean;
}

export const MedicalGlassCard = React.forwardRef<HTMLDivElement, MedicalGlassCardProps>(
  (
    {
      active = false,
      scannerAccent = false,
      interactive,
      className,
      children,
      onClick,
      onKeyDown,
      role,
      tabIndex,
      pressed,
      'aria-pressed': ariaPressed,
      ...props
    },
    ref
  ) => {
    const isInteractive = interactive || typeof onClick === 'function';
    const resolvedPressed = ariaPressed ?? pressed;

    const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
      onKeyDown?.(event);

      if (!isInteractive || event.defaultPrevented) {
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.currentTarget.click();
      }
    };

    return (
      <div
        ref={ref}
        role={role ?? (isInteractive ? 'button' : undefined)}
        tabIndex={tabIndex ?? (isInteractive ? 0 : undefined)}
        aria-pressed={
          isInteractive && typeof resolvedPressed === 'boolean' ? resolvedPressed : undefined
        }
        className={cn(
          'atlas-glass-card atlas-reduced-motion-safe rounded-lg p-5 text-atlas-white',
          'transition-[border-color,box-shadow,transform,background-color] duration-200',
          active && 'atlas-border-glow',
          scannerAccent && 'atlas-scanner-line',
          isInteractive &&
            'atlas-focus-ring cursor-pointer hover:-translate-y-0.5 hover:border-atlas-border-glow motion-reduce:hover:translate-y-0',
          className
        )}
        onClick={onClick}
        onKeyDown={isInteractive ? handleKeyDown : onKeyDown}
        {...props}
      >
        <div className="relative z-10">{children}</div>
      </div>
    );
  }
);

MedicalGlassCard.displayName = 'MedicalGlassCard';
