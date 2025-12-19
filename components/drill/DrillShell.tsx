import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Home } from 'lucide-react';

interface DrillShellProps {
  /** Title of the current drill */
  title: string;
  /** Breadcrumb path (e.g., "Diagnostic Drills > Visual Diagnostics > Photo Drill") */
  breadcrumb: string[];
  /** Main content of the drill */
  children: React.ReactNode;
  /** Handler to go back one level */
  onBack?: () => void;
  /** Handler to return to main hub */
  onBackToHub: () => void;
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
  headerContent,
  className = '',
  hideBreadcrumb = false,
}) => {
  return (
    <div className={`min-h-screen bg-[var(--color-bg-primary)] flex flex-col ${className}`}>
      {/* Header with Breadcrumb */}
      {!hideBreadcrumb && (
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-40 bg-[var(--color-bg-primary)]/95 backdrop-blur-sm border-b border-[var(--color-border)]"
        >
          <div className="max-w-7xl mx-auto px-4 py-3">
            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] mb-2">
              <button
                onClick={onBackToHub}
                className="flex items-center gap-1 hover:text-[var(--color-accent)] transition-colors group"
                aria-label="Back to hub"
              >
                <Home className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                <span>Hub</span>
              </button>
              {breadcrumb.map((crumb, index) => (
                <React.Fragment key={index}>
                  <span className="text-[var(--color-border)]">/</span>
                  <span
                    className={
                      index === breadcrumb.length - 1
                        ? 'text-[var(--color-text-primary)] font-medium'
                        : ''
                    }
                  >
                    {crumb}
                  </span>
                </React.Fragment>
              ))}
            </div>

            {/* Title and Navigation */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {onBack && (
                  <button
                    onClick={onBack}
                    className="p-2 hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors group"
                    aria-label="Go back"
                  >
                    <ArrowLeft className="w-5 h-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] group-hover:-translate-x-1 transition-all" />
                  </button>
                )}
                <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">
                  {title}
                </h1>
              </div>

              {/* Header Content (Scores, Streaks, etc.) */}
              {headerContent && (
                <div className="flex items-center gap-4">
                  {headerContent}
                </div>
              )}
            </div>
          </div>
        </motion.header>
      )}

      {/* Main Content Area */}
      <main className="flex-1 relative">
        {children}
      </main>

      {/* Optional Footer - can be added by child components if needed */}
    </div>
  );
};

export default DrillShell;
