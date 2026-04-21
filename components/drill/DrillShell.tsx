import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from '@/components/ui/icons';
import { BackLink } from '@/components/navigation/BackLink';
import { DrillErrorBoundary } from '@/components/error/DrillErrorBoundary';
import { ROUTES } from '@/config/routes';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface DrillShellProps {
  /** Title of the current drill */
  title: string;
  /** Breadcrumb path (e.g., "Diagnostic Drills > Visual Diagnostics > Photo Drill") */
  breadcrumb: string[];
  /** Main content of the drill */
  children: React.ReactNode;
  /** Handler to go back one level (in-flow, e.g. set picker → landing) */
  onBack?: () => void;
  /** Handler to return to main hub; used when backTo is not provided */
  onBackToHub: () => void;
  /**
   * When provided, use BackLink for hub navigation instead of onBackToHub.
   * Defaults to ROUTES.PRACTICE for drill modes.
   */
  backTo?: string;
  /** Optional header content (scores, streaks, etc.) */
  headerContent?: React.ReactNode;
  /** Optional class name for customization */
  className?: string;
  /** Whether to hide the breadcrumb (for full-screen immersive modes) */
  hideBreadcrumb?: boolean;
}

/**
 * DrillShell - Standardized wrapper for all diagnostic drill modes
 *
 * Provides:
 * - Consistent breadcrumb navigation
 * - Clear exit/back buttons
 * - Optional header content for scores/stats
 * - Responsive layout
 * - Dark cinematic visual treatment with glassmorphism and gold accents
 *
 * Usage:
 * ```tsx
 * <DrillShell
 *   title="Photo Drill"
 *   breadcrumb={['Diagnostic Drills', 'Visual Diagnostics', 'Photo Drill']}
 *   onBackToHub={() => navigate('hub')}
 *   onBack={() => navigate('visual-diagnostics')}
 * >
 *   {drillContent}
 * </DrillShell>
 * ```
 */
const DrillShell: React.FC<DrillShellProps> = ({
  title,
  breadcrumb,
  children,
  onBack,
  onBackToHub,
  backTo,
  headerContent,
  className = '',
  hideBreadcrumb = false,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const hubTarget = backTo ?? ROUTES.PRACTICE;

  return (
    <div
      className={`min-h-screen flex flex-col ${className}`}
      style={{
        background: 'linear-gradient(180deg, rgba(10,14,26,1) 0%, rgba(15,23,42,0.6) 100%)',
        backgroundAttachment: 'fixed',
        position: 'relative',
      }}
    >
      {/* Cinematic noise overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' seed='2'/%3E%3C/filter%3E%3Crect width='400' height='400' filter='url(%23noiseFilter)' /%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px',
          zIndex: 0,
        }}
      />

      {/* Header with Breadcrumb — dark cinematic glassmorphism */}
      {!hideBreadcrumb && (
        <motion.header
          initial={prefersReducedMotion ? false : { y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="sticky top-0 z-40 relative"
          style={{
            backdropFilter: 'blur(20px)',
            background: 'linear-gradient(180deg, rgba(20,27,47,0.95) 0%, rgba(15,23,42,0.85) 100%)',
            borderBottom: '1px solid rgba(196,183,138,0.15)',
            boxShadow: 'inset 0 1px 0 rgba(196,183,138,0.1), 0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
            {/* Breadcrumb Navigation */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-caption text-[var(--color-text-muted)] mb-3">
              {backTo !== undefined ? (
                <BackLink
                  to={hubTarget}
                  label="Back to Practice"
                  className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors duration-200"
                />
              ) : (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={onBackToHub}
                  icon={<Home className="w-3.5 h-3.5" />}
                  aria-label="Back to hub"
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors duration-200"
                >
                  Hub
                </Button>
              )}
              {breadcrumb.map((crumb, index) => (
                <React.Fragment key={index}>
                  <span className="text-[var(--color-border)] mx-0.5" aria-hidden="true">/</span>
                  <span
                    className={
                      index === breadcrumb.length - 1
                        ? 'text-[var(--color-accent)] font-semibold drop-shadow-lg'
                        : 'text-[var(--color-text-muted)] transition-colors duration-150 hover:text-[var(--color-accent)]'
                    }
                    {...(index === breadcrumb.length - 1 ? { 'aria-current': 'page' as const } : {})}
                  >
                    {crumb}
                  </span>
                </React.Fragment>
              ))}
            </nav>

            {/* Title and Navigation */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {onBack && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onBack}
                    aria-label="Go back"
                    className="rounded-xl transition-colors duration-200 ease-premium text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bg-tertiary)]"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                )}
                <h1
                  className="text-h2 font-bold drop-shadow-xl"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-accent) 0%, color-mix(in srgb, var(--color-accent) 60%, white) 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {title}
                </h1>
              </div>

              {/* Header Content (Scores, Streaks, etc.) */}
              {headerContent && (
                <div className="flex items-center gap-3">
                  {headerContent}
                </div>
              )}
            </div>
          </div>
        </motion.header>
      )}

      {/* Main Content Area — aria-live announces question transitions to screen readers */}
      <main className="flex-1 relative scroll-mt-16 z-10" aria-live="polite" aria-atomic="false">
        <DrillErrorBoundary drillName={title}>
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.35, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            {children}
          </motion.div>
        </DrillErrorBoundary>
      </main>

      {/* Optional Footer - can be added by child components if needed */}
    </div>
  );
};

export default DrillShell;
