/**
 * AppLayout - Shared layout wrapper for React Router routes
 * Provides header, NavRail, and main content area structure
 */

import React, { Suspense, useEffect } from 'react';
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
import { useStreakAutoFreeze } from '@/hooks/useStreakAutoFreeze';
import { toast } from '@/lib/toast';

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

  // Auto-apply streak freezes on app mount (non-blocking)
  const autoFreezeResult = useStreakAutoFreeze();
  useEffect(() => {
    if (autoFreezeResult && autoFreezeResult.freezesApplied > 0) {
      const count = autoFreezeResult.freezesApplied;
      const remaining = autoFreezeResult.remainingFreezes;
      toast.info(
        `Streak saved! ${count} freeze${count > 1 ? 's' : ''} applied for missed day${count > 1 ? 's' : ''}. ${remaining} freeze${remaining !== 1 ? 's' : ''} remaining.`,
        { id: 'streak-auto-freeze', duration: 6000 }
      );
    }
  }, [autoFreezeResult]);

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
          style={{ position: 'sticky', top: 0, zIndex: 50, height: 'var(--header-height, 4rem)', backgroundColor: 'var(--color-bg-primary)', borderBottom: '1px solid var(--color-border)' }}
        >
          <div className="h-full w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between max-w-[100vw]" style={{ height: '100%', width: '100%', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppBrand
              size="sm"
              asLink
              onClick={() => {
                navigate(ROUTES.STUDY);
              }}
            >
              <OfflineSyncIndicator />
              {(user?.publicMetadata?.role === 'admin' || user?.publicMetadata?.role === 'superadmin') && (
                <Link
                  to={ROUTES.ADMIN}
                  className="p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] transition-colors duration-200 shadow-sm"
                  aria-label="Admin Dashboard"
                >
                  <Shield className="w-5 h-5" />
                </Link>
              )}
              {onSettingsClick && (
                <motion.button
                  ref={settingsButtonRef}
                  onClick={onSettingsClick}
                  className="p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] transition-colors duration-200 shadow-sm"
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
                  className="p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] transition-colors duration-200 shadow-sm"
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
