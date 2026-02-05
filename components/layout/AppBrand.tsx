/**
 * AppBrand – Shared logo + "PANaCEa" for headers (Landing, App shell).
 * Single source for logo paths, alt text, and brand typography.
 */

import React from 'react';
import { motion } from 'framer-motion';

const LOGO_LIGHT = '/Favicon.svg';
const LOGO_DARK = '/favicondarkmodeTP.svg';
const BRAND_ALT = 'PANaCEa Icon';

export type AppBrandSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<AppBrandSize, { wrapper: string; text: string }> = {
  sm: { wrapper: 'h-10 sm:h-12', text: 'text-2xl sm:text-3xl' },
  md: { wrapper: 'h-11 sm:h-12', text: 'text-2xl sm:text-3xl' },
  lg: { wrapper: 'h-12 sm:h-14', text: 'text-3xl sm:text-4xl' },
};

export interface AppBrandProps {
  /** Size of logo and text */
  size?: AppBrandSize;
  /** When true, brand is clickable (e.g. App: navigate home). Caller provides onClick. */
  asLink?: boolean;
  /** Called when brand is clicked (used when asLink is true) */
  onClick?: () => void;
  /** Right-side slot: theme toggle, Sign In button, or App header actions */
  children?: React.ReactNode;
  /** Optional class for the outer wrapper (e.g. header inner flex container) */
  className?: string;
  /** Optional motion for logo (Landing uses initial/animate) */
  animate?: boolean;
}

export const AppBrand: React.FC<AppBrandProps> = ({
  size = 'md',
  asLink = false,
  onClick,
  children,
  className = '',
  animate = false,
}) => {
  const { wrapper: logoClass, text: textClass } = sizeClasses[size];

  const brandContent = (
    <>
      <img
        src={LOGO_LIGHT}
        alt={BRAND_ALT}
        className={`${logoClass} w-auto dark:hidden`}
      />
      <img
        src={LOGO_DARK}
        alt={BRAND_ALT}
        className={`${logoClass} w-auto hidden dark:block`}
      />
      <span
        className={`font-bold text-[var(--color-text-primary)] font-poppins ${textClass}`}
      >
        PANaCEa
      </span>
    </>
  );

  const Wrapper = asLink ? motion.button : motion.div;
  const baseClass = `flex items-center gap-3 ${className}`.trim();
  const wrapperProps = asLink
    ? {
        onClick,
        type: 'button' as const,
        className: `${baseClass} hover:opacity-80 transition-opacity cursor-pointer`,
        whileHover: { scale: 1.02 },
        whileTap: { scale: 0.98 },
        'aria-label': 'Return to Dashboard' as const,
      }
    : {
        className: baseClass,
        ...(animate && {
          initial: { opacity: 0, x: -20 },
          animate: { opacity: 1, x: 0 },
          transition: { duration: 0.2 },
        }),
      };

  return (
    <div className="flex items-center justify-between w-full">
      <Wrapper {...(wrapperProps as object)}>{brandContent}</Wrapper>
      {children != null && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
};

export default AppBrand;
