/**
 * AppLayout - Shared layout wrapper for React Router routes
 * Provides header, NavRail, and main content area structure
 */

import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Settings, Shield, HelpCircle } from 'lucide-react';
import { AppBrand } from './AppBrand';
import { NavRail } from './NavRail';
import { ROUTES } from '@/config/routes';
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
  const prefersReducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const { user } = useUser();
  const settingsButtonRef = React.useRef<HTMLButtonElement>(null);
  const chromeSurface = 'color-mix(in srgb, var(--color-bg-secondary) 82%, transparent)';
  const chromeBorder = 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)';
  const chromeShadow =
    '0 10px 32px rgba(15, 23, 42, 0.14), inset 0 -1px 0 color-mix(in srgb, var(--color-text-primary) 4%, transparent)';
  const appCanvasBackground =
    'radial-gradient(circle at 8% 0%, color-mix(in srgb, var(--color-accent) 10%, transparent), transparent 26%), radial-gradient(circle at 92% 4%, color-mix(in srgb, var(--color-accent-secondary) 12%, transparent), transparent 30%), linear-gradient(180deg, color-mix(in srgb, var(--color-bg-primary) 96%, transparent) 0%, color-mix(in srgb, var(--color-bg-primary) 90%, var(--color-accent) 10%) 56%, color-mix(in srgb, var(--color-bg-primary) 97%, transparent) 100%)';
  const headerActionClass =
    'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[12px] border p-2 text-[var(--color-text-muted)] transition-all duration-200 ease-premium hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]';

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
            background: chromeSurface,
            backdropFilter: 'blur(24px) saturate(160%)',
            WebkitBackdropFilter: 'blur(24px) saturate(160%)',
            borderBottom: `1px solid ${chromeBorder}`,
            boxShadow: chromeShadow,
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
                  className={headerActionClass}
                  style={{ borderColor: chromeBorder }}
                  aria-label="Admin Dashboard"
                  title="Admin dashboard"
                >
                  <Shield className="w-5 h-5" />
                </Link>
              )}
              {onSettingsClick && (
                <motion.button
                  ref={settingsButtonRef}
                  onClick={onSettingsClick}
                  className={headerActionClass}
                  style={{ borderColor: chromeBorder }}
                  aria-label="Settings and Stats"
                  title="Settings and stats"
                  whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                >
                  <Settings className="w-5 h-5" />
                </motion.button>
              )}
              <MasteryHeatmapToggle compact className="hidden sm:inline-flex" />
              {onHelpClick && (
                <button
                  type="button"
                  onClick={onHelpClick}
                  className={headerActionClass}
                  style={{ borderColor: chromeBorder }}
                  aria-label="Help and getting started"
                  title="Help and getting started"
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
          background: appCanvasBackground,
        }}
      >
        <motion.div
          className={`mx-auto min-w-0 max-w-full overflow-x-hidden px-4 pb-6 pt-4 sm:px-6 lg:px-8 ${contentClassName ?? ''}`}
          style={{ maxWidth: `var(--content-max-width, ${contentMaxWidth})` }}
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      </main>
    </>
  );
};
