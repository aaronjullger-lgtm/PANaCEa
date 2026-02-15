import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, X } from 'lucide-react';

export interface DrillShellProps {
  /** Title of the drill mode displayed in header */
  title: string;

  /** Optional subtitle/breadcrumb (e.g., "Visual Diagnosis > ECG") */
  subtitle?: string;

  /** Optional right-side action slot (e.g., Settings icon, Timer component) */
  rightAction?: React.ReactNode;

  /** Exit handler - navigates back to dashboard */
  onExit: () => void;

  /** Main content area */
  children: React.ReactNode;

  /**
   * If true, content takes full width without max-width constraints.
   * Use for immersive modes like Photo Drill.
   * @default false
   */
  fullWidth?: boolean;

  /**
   * If true, removes padding to allow content to touch edges.
   * Use with fullWidth for truly immersive experiences.
   * @default false
   */
  noPadding?: boolean;

  /**
   * If true, uses fixed positioning to fill entire viewport.
   * Use for full-screen drill modes that need to escape normal document flow.
   * @default false
   */
  fullScreen?: boolean;

  /**
   * Background color override for special modes (e.g., dark mode for imaging)
   * @default undefined (uses theme default)
   */
  backgroundColor?: string;

  /**
   * Custom class name for the content wrapper
   */
  contentClassName?: string;
}

/**
 * DrillShell - Standardized layout wrapper for all drill modes
 *
 * Provides:
 * - Consistent glass header with back button and title
 * - Optional subtitle/breadcrumb area
 * - Optional right action slot (settings, timer, etc.)
 * - Responsive container with configurable width
 * - Full-screen mode for immersive experiences
 *
 * @example
 * // Standard drill with max-width container
 * <DrillShell
 *   title="Rapid Recall"
 *   subtitle="Buzzword Recognition"
 *   onExit={() => navigate('/dashboard')}
 * >
 *   <DrillContent />
 * </DrillShell>
 *
 * @example
 * // Full-width immersive drill
 * <DrillShell
 *   title="Photo Drill"
 *   subtitle="ECG Interpretation"
 *   fullWidth
 *   noPadding
 *   fullScreen
 *   rightAction={<TimerDisplay />}
 *   onExit={() => navigate('/dashboard')}
 * >
 *   <PhotoContent />
 * </DrillShell>
 */
export const DrillShell: React.FC<DrillShellProps> = ({
  title,
  subtitle,
  rightAction,
  onExit,
  children,
  fullWidth = false,
  noPadding = false,
  fullScreen = false,
  backgroundColor,
  contentClassName = '',
}) => {
  const containerClasses = fullScreen
    ? 'fixed inset-0 z-50 flex flex-col'
    : 'min-h-screen flex flex-col';

  const bgColor = backgroundColor || 'bg-[var(--color-bg-primary)]';

  return (
    <div
      className={`${containerClasses} ${bgColor} text-[var(--color-text-primary)] transition-colors duration-300`}
    >
      {/* Premium Glass Header - Matches App.tsx styling */}
      <header
        className="sticky z-30 bg-[var(--color-bg-primary)]/85 backdrop-blur-xl border-b border-[var(--color-border)] transition-all duration-300 shadow-sm"
        style={fullScreen ? {} : { top: 0 }}
      >
        <div
          className={`${fullWidth ? 'w-full' : 'max-w-5xl mx-auto'} px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2`}
        >
          {/* Left: Back Button */}
          <motion.button
            onClick={onExit}
            className="flex items-center gap-1.5 sm:gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] min-h-[44px] group"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            aria-label="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" />
            <span className="text-sm font-medium hidden sm:inline">Dashboard</span>
          </motion.button>

          {/* Center: Title & Subtitle */}
          <div className="flex-1 flex flex-col items-start sm:items-center min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-[var(--color-text-primary)] truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs sm:text-sm text-[var(--color-text-muted)] truncate">
                {subtitle}
              </p>
            )}
          </div>

          {/* Right: Optional Action Slot */}
          <div className="flex items-center gap-2">{rightAction}</div>
        </div>
      </header>

      {/* Content Area */}
      <main
        className={`
          flex-1 
          ${!noPadding ? 'px-3 sm:px-4 py-4 sm:py-6' : ''} 
          ${!fullWidth ? 'max-w-5xl mx-auto w-full' : ''}
          ${contentClassName}
        `}
      >
        {children}
      </main>
    </div>
  );
};

/**
 * DrillShellCompact - Variant without the subtitle for simpler layouts
 */
export const DrillShellCompact: React.FC<Omit<DrillShellProps, 'subtitle'>> = (props) => {
  return <DrillShell {...props} />;
};

export default DrillShell;
