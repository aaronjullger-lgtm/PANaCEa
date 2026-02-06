/**
 * PageContainer – Shared max-width + horizontal padding for sections and pages.
 * Use in LandingPage sections, footers, CommandCenterPage, and dashboards for consistency.
 */

import React from 'react';
import { cn } from '@/lib/utils';

export type PageContainerMaxWidth = '4xl' | '6xl' | '7xl' | 'full';

const maxWidthClasses: Record<PageContainerMaxWidth, string> = {
  '4xl': 'max-w-4xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
  'full': 'max-w-full',
};

const defaultPadding = 'px-4 sm:px-6 lg:px-8';

export interface PageContainerProps {
  children: React.ReactNode;
  /** Max width of content */
  maxWidth?: PageContainerMaxWidth;
  /** Additional padding (e.g. py-4). Default is horizontal only. */
  className?: string;
  /** Element to render (default: div) */
  as?: 'div' | 'section' | 'main' | 'footer';
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  maxWidth = '7xl',
  className = '',
  as: Component = 'div',
}) => {
  return (
    <Component
      className={cn(
        'mx-auto',
        maxWidthClasses[maxWidth],
        defaultPadding,
        className
      )}
    >
      {children}
    </Component>
  );
};

export default PageContainer;
