/**
 * AppLayout - Shared layout wrapper for React Router routes
 * Provides header, NavRail, and main content area structure
 */

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Activity, Bell, BrainCircuit, CalendarClock, Search, Settings, Shield, UserCircle } from 'lucide-react';
import { NavRail } from './NavRail';
import { ROUTES } from '@/config/routes';
import { useUser } from '@clerk/clerk-react';
import ThemeToggleButton from '@/components/ui/ThemeToggleButton';
import { OfflineSyncIndicator } from '@/components/offline/OfflineSyncIndicator';
import { useStreakAutoFreeze } from '@/hooks/useStreakAutoFreeze';
import { useUserProfile } from '@/hooks/useUserProfile';
import { toast } from '@/lib/toast';
import { clinicalConsoleDemoData } from '@/components/clinical-console/studyDemoData';

interface AppLayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
  showNavRail?: boolean;
  onSettingsClick?: () => void;
  onSearchClick?: () => void;
  onHelpClick?: () => void;
  contentMaxWidth?: string;
  contentClassName?: string;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  showHeader = true,
  showNavRail = true,
  onSettingsClick,
  onSearchClick,
  contentMaxWidth = '72rem',
  contentClassName,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const { user } = useUser();
  const { profile } = useUserProfile();
  const settingsButtonRef = React.useRef<HTMLButtonElement>(null);
  const chromeSurface =
    'linear-gradient(180deg, color-mix(in srgb, var(--color-bg-secondary) 92%, var(--color-bg-primary) 8%), color-mix(in srgb, var(--color-bg-secondary) 82%, transparent))';
  const chromeBorder = 'color-mix(in srgb, var(--color-text-primary) 10%, transparent)';
  const chromeShadow =
    'inset 0 -1px 0 color-mix(in srgb, var(--color-accent) 14%, transparent), 0 16px 48px -44px rgba(0,0,0,0.9)';
  const appCanvasBackground =
    'radial-gradient(circle at 8% 8%, color-mix(in srgb, var(--color-accent) 9%, transparent), transparent 28%), radial-gradient(circle at 84% 0%, rgba(167,139,250,0.08), transparent 30%), linear-gradient(180deg, var(--color-bg-primary) 0%, color-mix(in srgb, var(--color-bg-primary) 95%, var(--color-bg-secondary) 5%) 100%)';
  const headerActionClass =
    'flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border p-2 text-[var(--color-text-muted)] transition-all duration-200 ease-premium hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]';
  const openSearch = () => {
    if (onSearchClick) {
      onSearchClick();
      return;
    }
    window.dispatchEvent(new Event('panacea:open-command-palette'));
  };
  const examCountdown = React.useMemo(() => {
    const sourceDate = profile?.eorTestDate ?? profile?.examDate;
    const label = profile?.eorTestDate ? 'EOR' : 'PANCE';
    if (!sourceDate) return `${label} planning`;

    const examDate = new Date(sourceDate);
    if (Number.isNaN(examDate.getTime())) return `${label} planning`;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    examDate.setHours(0, 0, 0, 0);
    const days = Math.ceil((examDate.getTime() - today.getTime()) / 86_400_000);

    if (days < 0) return `${label} date passed`;
    if (days === 0) return `${label} today`;
    return `${label} in ${days} day${days === 1 ? '' : 's'}`;
  }, [profile?.eorTestDate, profile?.examDate]);
  const profileName =
    user?.firstName ||
    user?.fullName ||
    user?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
    'Profile';
  const profileInitial = profileName.charAt(0).toUpperCase();

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

      {/* Header — restrained clinical chrome with search, exam timing, sync, and profile. */}
      {showHeader && (
        <header
          className="sticky top-0 z-50 shrink-0"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            height: 'var(--header-height, 4rem)',
            marginLeft: showNavRail ? 'var(--nav-rail-width, 248px)' : '0',
            width: showNavRail ? 'calc(100% - var(--nav-rail-width, 248px))' : '100%',
            background: chromeSurface,
            borderBottom: `1px solid ${chromeBorder}`,
            boxShadow: chromeShadow,
          }}
        >
          <div
            className="h-full w-full max-w-[100vw] items-center gap-3 px-3 sm:px-4 lg:px-6"
            style={{
              height: '100%',
              width: '100%',
              display: 'grid',
              gridTemplateColumns: 'minmax(12rem, 1fr) minmax(12rem, 34rem) auto',
              alignItems: 'center',
            }}
          >
            <div className="hidden min-w-0 items-center gap-3 md:flex">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
                style={{
                  borderColor: 'color-mix(in srgb, var(--color-accent) 26%, transparent)',
                  background: 'color-mix(in srgb, var(--color-accent) 11%, transparent)',
                }}
                aria-hidden="true"
              >
                <Activity className="h-4 w-4 text-[var(--color-accent)]" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                  Clinical Study Console
                </p>
                <p className="truncate text-xs text-[var(--color-text-muted)]">
                  {clinicalConsoleDemoData.student.goal}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openSearch}
              className="hidden min-h-[42px] min-w-0 items-center gap-2 rounded-lg border px-3 text-left text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] sm:flex"
              style={{
                borderColor: chromeBorder,
                background:
                  'color-mix(in srgb, var(--color-bg-primary) 50%, var(--color-bg-secondary) 50%)',
              }}
              aria-label="Search conditions, drugs, labs, procedures"
            >
              <Search className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" aria-hidden />
              <span className="truncate">Search conditions, drugs, labs, procedures...</span>
              <span className="ml-auto hidden rounded-md border px-1.5 py-0.5 text-[0.68rem] font-medium text-[var(--color-text-muted)] md:inline-flex" style={{ borderColor: chromeBorder }}>
                Cmd K
              </span>
            </button>
            <div className="flex min-w-0 items-center justify-end gap-2">
              <button
                type="button"
                onClick={openSearch}
                className={`${headerActionClass} sm:hidden`}
                style={{ borderColor: chromeBorder }}
                aria-label="Search"
                title="Search"
              >
                <Search className="h-4 w-4" />
              </button>
              <div
                className="hidden min-h-[40px] items-center gap-2 rounded-lg border px-3 text-xs font-medium text-[var(--color-text-secondary)] lg:flex"
                style={{
                  borderColor: chromeBorder,
                  background:
                    'color-mix(in srgb, var(--color-bg-secondary) 74%, var(--color-bg-primary) 26%)',
                }}
                aria-label={examCountdown}
              >
                <CalendarClock className="h-4 w-4 text-[var(--color-accent)]" aria-hidden />
                <span>{examCountdown}</span>
              </div>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event('panacea:open-command-palette'))}
                className="hidden min-h-[40px] items-center gap-2 rounded-lg border px-3 text-xs font-semibold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/10 md:flex"
                style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 24%, transparent)' }}
                aria-label="Open tutor"
                title="Tutor"
              >
                <BrainCircuit className="h-4 w-4" aria-hidden />
                <span>Tutor</span>
              </button>
              <button
                type="button"
                className={headerActionClass}
                style={{ borderColor: chromeBorder }}
                aria-label="Notifications"
                title="Notifications"
              >
                <Bell className="h-4 w-4" />
              </button>
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
              <ThemeToggleButton />
              <button
                type="button"
                onClick={onSettingsClick}
                disabled={!onSettingsClick}
                className="hidden min-h-[40px] items-center gap-2 rounded-lg border px-2.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-[var(--color-text-secondary)] md:flex"
                style={{ borderColor: chromeBorder }}
                aria-label={`Profile: ${profileName}`}
                title={profileName}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent)]/12 text-xs font-semibold text-[var(--color-accent)]">
                  {profileInitial || <UserCircle className="h-4 w-4" />}
                </span>
                <span className="max-w-[8rem] truncate">{profileName}</span>
              </button>
            </div>
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
