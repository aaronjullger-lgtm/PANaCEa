/**
 * AppBrand – Shared logo + "PANaCEa" for headers (Landing, App shell).
 * Single source for logo paths, alt text, and brand typography.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useThemeContext } from '@/contexts/ThemeContext';

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
  // Use theme context for reliable dark/light logo swap — avoids dependence on
  // Tailwind's `hidden` / `dark:block` utilities which can be unreliable if the
  // CSS bundle is partially cached or utilities are purged unexpectedly.
  const { theme } = useThemeContext();
  const isDark = theme === 'dark';

  const brandContent = (
    <>
      <img
        key="logo"
        src={isDark ? LOGO_DARK : LOGO_LIGHT}
        alt={BRAND_ALT}
        className={`${logoClass} w-auto`}
      />
      <span
        key="brand-text"
        className={`font-bold font-poppins ${textClass}`}
        style={{
          background: 'linear-gradient(135deg, #c4b78a 0%, #e6d9b5 50%, #c4b78a 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        PANaCEa
      </span>
    </>
  );

  const Wrapper = asLink ? motion.button : motion.div;
  const baseClass = `flex items-center gap-3 ${className}`.trim();
  const brandFlexStyle = { display: 'flex', alignItems: 'center', gap: '0.75rem' };
  const wrapperProps = asLink
    ? {
        onClick,
        type: 'button' as const,
        className: `${baseClass} hover:opacity-80 transition-opacity cursor-pointer`,
        style: brandFlexStyle,
        whileHover: { scale: 1.02 },
        whileTap: { scale: 0.98 },
        'aria-label': 'Return to Dashboard' as const,
      }
    : {
        className: baseClass,
        style: brandFlexStyle,
        ...(animate && {
          initial: { x: -20 },
          animate: { x: 0 },
          transition: { duration: 0.2 },
        }),
      };

  return (
    <div className="flex items-center justify-between w-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <Wrapper {...(wrapperProps as object)}>{brandContent}</Wrapper>
      {children != null && <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>{children}</div>}
    </div>
  );
};

export default AppBrand;
