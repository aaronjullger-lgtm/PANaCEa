import React from 'react';
import { cn } from '@/lib/utils';

export interface ScannerFrameProps extends React.HTMLAttributes<HTMLDivElement> {
  scanLine?: boolean;
  label?: React.ReactNode;
  footer?: React.ReactNode;
}

export function ScannerFrame({
  scanLine = true,
  label,
  footer,
  className,
  children,
  role,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ...props
}: ScannerFrameProps) {
  const labelledGroupRole = role ?? (ariaLabel || ariaLabelledBy ? 'group' : undefined);

  return (
    <div
      role={labelledGroupRole}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={cn(
        'atlas-glass-card atlas-reduced-motion-safe relative rounded-3xl border-atlas-border p-3',
        scanLine && 'atlas-scanner-line',
        className,
      )}
      {...props}
    >
      <div className="relative z-10 overflow-hidden rounded-2xl border border-atlas-border bg-atlas-background-soft">
        {label ? (
          <div className="flex items-center justify-between border-b border-atlas-border px-4 py-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-atlas-cyan">
              {label}
            </span>
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-atlas-cyan shadow-[0_0_16px_var(--atlas-accent-cyan)]" />
          </div>
        ) : null}
        <div className="relative">{children}</div>
        {footer ? (
          <div className="border-t border-atlas-border px-4 py-2 text-xs text-atlas-muted">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
