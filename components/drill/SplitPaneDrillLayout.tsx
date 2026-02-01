/**
 * SplitPaneDrillLayout - Clinical vignette left, question/explanation right
 *
 * Residency Cockpit: Left pane shows vignette (static); right pane shows
 * question + options, then slides to explanation on submit. Vignette stays visible.
 */

import React from 'react';

interface SplitPaneDrillLayoutProps {
  /** Left pane: Clinical vignette (static, scrollable). When provided, enables split layout. */
  vignette?: string | null;
  /** Main content (question, options, explanation) - rendered in right pane when vignette exists */
  children: React.ReactNode;
  className?: string;
}

export function SplitPaneDrillLayout({
  vignette,
  children,
  className = '',
}: SplitPaneDrillLayoutProps) {
  const hasVignette = Boolean(vignette && vignette.trim());

  if (!hasVignette) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={`flex flex-col lg:flex-row gap-4 ${className}`}>
      {/* Left: Vignette - hidden on small screens */}
      <div className="hidden lg:flex lg:w-[38%] lg:min-w-[260px] lg:max-w-[380px] flex-shrink-0">
        <div className="w-full overflow-y-auto rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
            Clinical Scenario
          </h3>
          <div className="text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
            {vignette}
          </div>
        </div>
      </div>

      {/* Right: Question/options/explanation */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
