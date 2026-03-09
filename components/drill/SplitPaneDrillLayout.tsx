/**
 * SplitPaneDrillLayout - Clinical vignette left, question/explanation right.
 * Uses draggable SplitPane when vignette exists (Reference + Practice workflow).
 */

import React, { useState, useCallback } from 'react';
import { SplitPane } from '@/components/ui/SplitPane';
import { StorageKeys } from '@/lib/storage/storageRegistry';

interface SplitPaneDrillLayoutProps {
  /** Left pane: Clinical vignette (static, scrollable). When provided, enables split layout. */
  vignette?: string | null;
  /** Main content (question, options, explanation) - rendered in right pane when vignette exists */
  children: React.ReactNode;
  className?: string;
}

const DEFAULT_LEFT_PERCENT = 38;

function getStoredLeftPercent(): number {
  if (globalThis.localStorage == null) return DEFAULT_LEFT_PERCENT;
  const v = globalThis.localStorage.getItem(StorageKeys.SPLIT_VIGNETTE_PERCENT);
  const n = v ? Number.parseInt(v, 10) : Number.NaN;
  return Number.isFinite(n) && n >= 30 && n <= 70 ? n : DEFAULT_LEFT_PERCENT;
}

export function SplitPaneDrillLayout({
  vignette,
  children,
  className = '',
}: Readonly<SplitPaneDrillLayoutProps>) {
  const hasVignette = Boolean(vignette?.trim());
  const [leftPercent, setLeftPercent] = useState(getStoredLeftPercent);

  const handleSplitChange = useCallback((percent: number) => {
    setLeftPercent(percent);
    try {
      globalThis.localStorage.setItem(StorageKeys.SPLIT_VIGNETTE_PERCENT, String(percent));
    } catch {
      /* ignore */
    }
  }, []);

  if (!hasVignette) {
    return <div className={className}>{children}</div>;
  }

  const vignetteBlock = (
    <div className="overflow-y-auto rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-5">
      <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
        Clinical Scenario
      </h3>
      <div className="text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
        {vignette}
      </div>
    </div>
  );

  const leftPane = <div className="h-full">{vignetteBlock}</div>;
  const rightPane = <div className="min-h-0 flex-1">{children}</div>;

  return (
    <div className={className}>
      {/* Mobile/tablet: vignette above, then content */}
      <div className="flex flex-col gap-4 lg:hidden">
        {vignetteBlock}
        <div className="min-w-0">{children}</div>
      </div>
      {/* Desktop: draggable split */}
      <div className="hidden lg:block h-full min-h-[400px]">
        <SplitPane
          left={leftPane}
          right={rightPane}
          defaultLeftPercent={leftPercent}
          minLeftPercent={30}
          maxLeftPercent={70}
          onSplitChange={handleSplitChange}
        />
      </div>
    </div>
  );
}
