import React from 'react';
import { cn } from '@/lib/utils';

type SectionHeaderAlign = 'left' | 'center' | 'right';
type SectionHeaderTitleAs = 'h1' | 'h2' | 'h3';

export interface SectionHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: SectionHeaderAlign;
  titleAs?: SectionHeaderTitleAs;
  titleId?: string;
}

const alignClass: Record<SectionHeaderAlign, string> = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = 'left',
  titleAs: Title = 'h2',
  titleId,
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <header className={cn('flex max-w-3xl flex-col gap-3', alignClass[align], className)} {...props}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-atlas-cyan">{eyebrow}</p>
      ) : null}
      <Title id={titleId} className="font-poppins text-2xl font-semibold leading-tight text-atlas-white sm:text-3xl">
        {title}
      </Title>
      {description ? (
        <p className="max-w-2xl text-sm leading-6 text-atlas-muted sm:text-base">{description}</p>
      ) : null}
    </header>
  );
}
