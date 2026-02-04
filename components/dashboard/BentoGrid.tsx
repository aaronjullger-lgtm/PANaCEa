/**
 * Bento grid layout (Pillar III)
 * 12-column modular grid with consistent gutters and card cells.
 * Use BentoGrid as wrapper and BentoCell for each card; optional BentoCard for typed content.
 */

import React from 'react';

const BENTO_GAP = 'gap-5'; /* 20px */
const BENTO_RADIUS = 'rounded-2xl';

interface BentoGridProps {
  children: React.ReactNode;
  className?: string;
}

export function BentoGrid({ children, className = '' }: Readonly<BentoGridProps>) {
  return (
    <div className={`grid grid-cols-12 ${BENTO_GAP} ${className}`}>
      {children}
    </div>
  );
}

type BentoCellSpan = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

interface BentoCellProps {
  children: React.ReactNode;
  /** Column span on lg (default 12 = full width) */
  span?: BentoCellSpan;
  /** Column span on md (optional) */
  spanMd?: BentoCellSpan;
  /** Column span on sm (optional; default 12 for stack) */
  spanSm?: BentoCellSpan;
  className?: string;
  /** If true, render as card (border, bg, padding). Default true. */
  asCard?: boolean;
}

const colMap: Record<number, string> = {
    1: 'col-span-1',
    2: 'col-span-2',
    3: 'col-span-3',
    4: 'col-span-4',
    5: 'col-span-5',
    6: 'col-span-6',
    7: 'col-span-7',
    8: 'col-span-8',
    9: 'col-span-9',
    10: 'col-span-10',
    11: 'col-span-11',
    12: 'col-span-12',
  };
const mdMap: Record<number, string> = {
    1: 'md:col-span-1',
    2: 'md:col-span-2',
    3: 'md:col-span-3',
    4: 'md:col-span-4',
    5: 'md:col-span-5',
    6: 'md:col-span-6',
    7: 'md:col-span-7',
    8: 'md:col-span-8',
    9: 'md:col-span-9',
    10: 'md:col-span-10',
    11: 'md:col-span-11',
    12: 'md:col-span-12',
  };
const smMap: Record<number, string> = {
    1: 'sm:col-span-1',
    2: 'sm:col-span-2',
    3: 'sm:col-span-3',
    4: 'sm:col-span-4',
    5: 'sm:col-span-5',
    6: 'sm:col-span-6',
    7: 'sm:col-span-7',
    8: 'sm:col-span-8',
    9: 'sm:col-span-9',
    10: 'sm:col-span-10',
    11: 'sm:col-span-11',
    12: 'sm:col-span-12',
  };

export function BentoCell({
  children,
  span = 12,
  spanMd,
  spanSm = 12,
  className = '',
  asCard = true,
}: Readonly<BentoCellProps>) {
  const colClass = `${colMap[span]} ${mdMap[spanMd ?? span]} ${smMap[spanSm]}`;

  if (!asCard) {
    return <div className={`${colClass} ${className}`}>{children}</div>;
  }

  return (
    <div
      className={`${colClass} ${BENTO_RADIUS} border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 min-h-0 ${className}`}
    >
      {children}
    </div>
  );
}
