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
  contentMaxWidth?: string;
  contentClassName?: string;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  showHeader = true,
  showNavRail = true,
  onSettingsClick,
  onHelpClick,
  contentMaxWidth = '72rem',
  contentClassName,
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
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-4 focus-visible:left-4 focus-visible:z-[10] focus-visible:px-4 focus-visible:py-2 focus-visible:bg-[var(--color-accent)] focus-visible:text-[var(--color-text-inverse)] focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-accent)]"
      >
        Skip to main content
      </a>

      {/* Header — Glass morphism with premium depth */}
      {showHeader && (
        <header
          className="header-glass sticky top-0 z-50 shrink-0"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            height: 'var(--header-height, 4rem)',
            background: 'rgba(10, 14, 26, 0.88)',
            backdropFilter: 'blur(24px) saturate(160%)',
            WebkitBackdropFilter: 'blur(24px) saturate(160%)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2), inset 0 -1px 0 rgba(255, 255, 255, 0.04)',
          }}
        >
          <div className="h-full w-full flex items-center justify-between max-w-[100vw]" style={{ height: '100%', width: '100%', padding: '0 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                  className="p-2 rounded-[12px] min-w-[44px] min-h-[44px] flex items-center justify-center transition-all duration-200 ease-premium"
                  style={{
                    color: '#64748b',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                    (e.currentTarget as HTMLElement).style.color = '#f1f5f9';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = '#64748b';
                  }}
                  aria-label="Admin Dashboard"
                >
                  <Shield className="w-5 h-5" />
                </Link>
              )}
              {onSettingsClick && (
                <motion.button
                  ref={settingsButtonRef}
                  onClick={onSettingsClick}
                  className="p-2 rounded-[12px] min-w-[44px] min-h-[44px] flex items-center justify-center transition-all duration-200 ease-premium"
                  style={{
                    color: '#64748b',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                    (e.currentTarget as HTMLElement).style.color = '#f1f5f9';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = '#64748b';
                  }}
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
                  className="p-2 rounded-[12px] min-w-[44px] min-h-[44px] flex items-center justify-center transition-all duration-200 ease-premium"
                  style={{
                    color: '#64748b',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                    (e.currentTarget as HTMLElement).style.color = '#f1f5f9';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = '#64748b';
                  }}
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

      {/* Main Content — smooth margin transition for rail collapse */}
      <main
        id="main-content"
        className="main-content-area min-h-screen min-w-0 max-w-full overflow-visible transition-[margin] duration-300 ease-premium"
        style={{
          marginLeft: showNavRail ? 'var(--nav-rail-width, 56px)' : '0',
          paddingTop: showHeader ? 'var(--header-height, 4rem)' : '0',
          background: 'linear-gradient(180deg, rgba(10, 14, 26, 1) 0%, rgba(15, 23, 42, 0.5) 50%, rgba(10, 14, 26, 1) 100%)',
        }}
      >
        <motion.div
          className={`mx-auto min-w-0 max-w-full overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8 ${contentClassName ?? ''}`}
          style={{ maxWidth: `var(--content-max-width, ${contentMaxWidth})` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      </main>
    </>
  );
};
