/**
 * AppLayout - Shared layout wrapper for React Router routes
 * Provides header, NavRail, and main content area structure
 */

import React, { Suspense } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Settings, X, Shield, HelpCircle } from 'lucide-react';
import { AppBrand } from './AppBrand';
import { NavRail } from './NavRail';
import { ROUTES } from '@/config/routes';
import { Loader } from '@/components/loading';
import { useUser } from '@clerk/clerk-react';
import ThemeToggleButton from '@/components/ui/ThemeToggleButton';
import { MasteryHeatmapToggle } from '@/components/ui/MasteryHeatmapToggle';
import { OfflineSyncIndicator } from '@/components/offline/OfflineSyncIndicator';

interface AppLayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
  showNavRail?: boolean;
  onSettingsClick?: () => void;
  onHelpClick?: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  showHeader = true,
  showNavRail = true,
  onSettingsClick,
  onHelpClick,
}) => {
  const navigate = useNavigate();
  const { user } = useUser();
  const settingsButtonRef = React.useRef<HTMLButtonElement>(null);

  return (
    <>
      {/* Skip to Main Content */}
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-4 focus-visible:left-4 focus-visible:z-[100] focus-visible:px-4 focus-visible:py-2 focus-visible:bg-[var(--color-accent)] focus-visible:text-[var(--color-text-inverse)] focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-accent)]"
      >
        Skip to main content
      </a>

      {/* Header */}
      {showHeader && (
        <header
          className="sticky top-0 z-50 h-16 shrink-0 bg-[var(--color-bg-primary)] border-b border-[var(--color-border)] transition-all duration-300 shadow-sm backdrop-blur-md bg-opacity-95 dark:bg-opacity-95"
          style={{ height: 'var(--header-height, 4rem)' }}
        >
          <div className="h-full w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between max-w-[100vw]">
            <AppBrand
              size="sm"
              asLink
              onClick={() => {
                navigate(ROUTES.STUDY);
              }}
            >
              <OfflineSyncIndicator />
              {user?.publicMetadata?.role === 'admin' && (
                <Link
                  to={ROUTES.ADMIN}
                  className="p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-700 hover:text-slate-900 bg-[var(--color-bg-secondary)] hover:bg-slate-100 dark:text-[var(--color-text-secondary)] dark:hover:bg-[var(--color-bg-tertiary)] dark:hover:text-[var(--color-text-primary)] border border-[var(--color-border)] dark:border-transparent dark:hover:border-[var(--color-border)] transition-colors duration-200 shadow-sm"
                  aria-label="Admin Dashboard"
                >
                  <Shield className="w-5 h-5" />
                </Link>
              )}
              {onSettingsClick && (
                <motion.button
                  ref={settingsButtonRef}
                  onClick={onSettingsClick}
                  className="p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-700 hover:text-slate-900 bg-[var(--color-bg-secondary)] hover:bg-slate-100 dark:text-[var(--color-text-secondary)] dark:hover:bg-[var(--color-bg-tertiary)] dark:hover:text-[var(--color-text-primary)] border border-[var(--color-border)] dark:border-transparent dark:hover:border-[var(--color-border)] transition-colors duration-200 shadow-sm"
                  aria-label="Settings and Stats"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Settings className="w-5 h-5" />
                </motion.button>
              )}
              <MasteryHeatmapToggle compact className="hidden sm:inline-flex" />
              {onHelpClick && (
                <button
                  type="button"
                  onClick={onHelpClick}
                  className="p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-700 hover:text-slate-900 bg-[var(--color-bg-secondary)] hover:bg-slate-100 dark:text-[var(--color-text-secondary)] dark:hover:bg-[var(--color-bg-tertiary)] dark:hover:text-[var(--color-text-primary)] border border-[var(--color-border)] dark:border-transparent dark:hover:border-[var(--color-border)] transition-colors duration-200 shadow-sm"
                  aria-label="Help and getting started"
                >
                  <HelpCircle className="w-5 h-5" />
                </button>
              )}
              <ThemeToggleButton />
            </AppBrand>
          </div>
        </header>
      )}

      {/* NavRail */}
      {showNavRail && <NavRail />}

      {/* Main Content */}
      <main
        id="main-content"
        className="main-content-area min-h-screen min-w-0 max-w-full overflow-visible transition-all duration-300"
        style={{
          marginLeft: showNavRail ? 'var(--nav-rail-width, 56px)' : '0',
          paddingTop: showHeader ? 'var(--header-height, 4rem)' : '0',
        }}
      >
        <div
          className="mx-auto min-w-0 max-w-full overflow-x-hidden px-4 sm:px-6 lg:px-8"
          style={{ maxWidth: 'var(--content-max-width, 72rem)' }}
        >
          {children}
        </div>
      </main>
    </>
  );
};
