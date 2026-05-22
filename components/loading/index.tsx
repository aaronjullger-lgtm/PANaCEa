/**
 * CANONICAL Loading System
 *
 * Centralized exports for all loading/skeleton components.
 * This is THE ONLY place to import loaders and skeletons from.
 *
 * Cinematic design: gold-tinted shimmer, staggered spring entrances,
 * blur-dissolve transitions, Disney 12-principles animation.
 *
 * All other loading/skeleton implementations are deprecated.
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  springs,
  skeletonLineVariants,
  skeletonShimmer,
  contentRevealVariants,
  contentAppearVariants,
  easings,
} from '@/config/appViews';
import { getClinicalLoadingMessage } from '@/lib/systemStateCopy';

// ============================================================================
// Shared Shimmer Overlay — Gold-tinted cinematic sweep
// ============================================================================

/**
 * Animated shimmer overlay with warm gold highlight.
 * Uses a diagonal gradient sweep for premium feel.
 */
export const ShimmerOverlay: React.FC<{ intensity?: 'subtle' | 'medium' | 'strong' }> = ({
  intensity = 'medium',
}) => {
  const opacityMap = { subtle: 0.06, medium: 0.1, strong: 0.15 };
  const goldOpacity = opacityMap[intensity];

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
      initial="initial"
      animate="animate"
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(
            105deg,
            transparent 35%,
            rgba(196, 183, 138, ${goldOpacity}) 45%,
            rgba(230, 217, 181, ${goldOpacity * 1.2}) 50%,
            rgba(196, 183, 138, ${goldOpacity}) 55%,
            transparent 65%
          )`,
          width: '200%',
          left: '-50%',
        }}
        variants={skeletonShimmer}
      />
    </motion.div>
  );
};

// ============================================================================
// Loader Component
// ============================================================================

export type LoaderVariant = 'spinner' | 'skeleton' | 'progress' | 'clinical';

export interface LoaderProps {
  variant?: LoaderVariant;
  message?: string;
  forceDark?: boolean;
}

/**
 * CANONICAL Loader - unified loading spinner with spring-animated dots
 */
export const Loader: React.FC<LoaderProps> = ({
  variant = 'spinner',
  message = getClinicalLoadingMessage(0),
  forceDark = false,
}) => {
  // Prevent scrolling behind overlay
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const bgClass = forceDark
    ? 'bg-[#020711]/95'
    : 'bg-[var(--color-bg-primary)]/80';

  const dotClass = forceDark
    ? 'bg-[var(--color-bg-primary)]'
    : 'bg-[var(--color-accent)]';

  const textClass = forceDark
    ? 'text-[var(--color-text-inverse)]'
    : 'text-[var(--color-text-primary)]';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: easings.snap }}
      className={`fixed inset-0 ${bgClass} flex flex-col items-center justify-center z-50`}
      style={{ backdropFilter: 'blur(16px) saturate(1.2)', WebkitBackdropFilter: 'blur(16px) saturate(1.2)' }}
    >
      {/* Spinner variant (default) — bouncing dots with squash & stretch */}
      {variant === 'spinner' && (
        <>
          <div className="flex space-x-3">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className={`w-2.5 h-2.5 ${dotClass} rounded-full`}
                animate={{
                  y: [-8, 2, -8],
                  scaleY: [1, 1.3, 1],
                  scaleX: [1, 0.85, 1],
                }}
                transition={{
                  duration: 0.65,
                  repeat: Infinity,
                  delay: i * 0.12,
                  ease: easings.snap,
                  times: [0, 0.5, 1],
                }}
              />
            ))}
          </div>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, ...springs.gentle }}
            className={`mt-5 ${textClass} text-body font-semibold tracking-tight`}
            role="status"
            aria-live="polite"
          >
            {message}
          </motion.p>
        </>
      )}

      {/* Progress variant — sweeping bar with gold gradient */}
      {variant === 'progress' && (
        <>
          <div className="w-56 h-1.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden relative">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 70%, #e6d9b5))',
              }}
              initial={{ width: 0, opacity: 0.7 }}
              animate={{ width: '100%', opacity: 1 }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: easings.linear,
              }}
            />
            {/* Glow trailing the progress */}
            <motion.div
              className="absolute top-0 h-full w-8 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(196,183,138,0.4) 0%, transparent 70%)',
                filter: 'blur(4px)',
              }}
              initial={{ left: '-10%' }}
              animate={{ left: '100%' }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: easings.linear,
              }}
            />
          </div>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, ...springs.gentle }}
            className={`mt-5 ${textClass} text-body font-semibold tracking-tight`}
            role="status"
            aria-live="polite"
          >
            {message}
          </motion.p>
        </>
      )}
    </motion.div>
  );
};

// ============================================================================
// InlineSpinner — Scoped ring spinner (buttons, inline status text, container overlays)
// ============================================================================

export type InlineSpinnerSize = 'sm' | 'md' | 'lg' | 'xl';

export interface InlineSpinnerProps {
  /**
   * Size variant — maps to Tailwind `w-{n} h-{n}`:
   *   - `sm` = w-4 h-4 (icon-next-to-text small buttons, 14–16 px glyphs)
   *   - `md` = w-5 h-5 (primary/wide buttons, 18–20 px inline labels) — default
   *   - `lg` = w-8 h-8 (container-centered overlays, ~32 px)
   *   - `xl` = w-12 h-12 (large full-container "loading page" overlays, ~48 px)
   */
  size?: InlineSpinnerSize;
  /** Extra Tailwind classes appended to the ring (color overrides, margin helpers, etc.). */
  className?: string;
}

/**
 * CANONICAL InlineSpinner - compact ring spinner for:
 *   1. Disabled-during-submit buttons (pair with label text for a11y).
 *   2. Inline status rows ("Searching…" + spinner next to text).
 *   3. Container-centered loading overlays (e.g. absolute inset-0 flex-center).
 *
 * - Inherits `currentColor` via SVG `stroke="currentColor"` so it adapts to any
 *   surrounding text color without a prop. Track ring at `opacity=0.3`, animated
 *   head at full opacity.
 * - SVG is chosen over CSS border tricks because `border-current/30` relies on
 *   `color-mix(... currentColor ...)` support which is uneven across supported
 *   browsers; SVG's `stroke-opacity` is universal.
 * - Animation is Tailwind's `animate-spin`, which respects `prefers-reduced-motion`
 *   via the user's media query.
 * - `aria-hidden="true"` + `focusable="false"` — surrounding text (or parent's
 *   `role="status"` / `aria-live`) announces the state; the spinner itself is
 *   purely visual.
 *
 * For multi-line skeleton blocks prefer `ClinicalSkeleton`; for full-viewport
 * overlays prefer `Loader`; for drill question layouts prefer `DrillLoadingState`.
 */
export const InlineSpinner: React.FC<InlineSpinnerProps> = ({
  size = 'md',
  className = '',
}) => {
  const sizeClass =
    size === 'sm' ? 'w-4 h-4'
    : size === 'lg' ? 'w-8 h-8'
    : size === 'xl' ? 'w-12 h-12'
    : 'w-5 h-5';
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${sizeClass} inline-block animate-spin ${className}`}
    >
      {/* Track ring — low opacity, full circle */}
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity={0.3}
        strokeWidth={3}
      />
      {/* Animated head — one-quarter arc at full opacity */}
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </svg>
  );
};

/**
 * Backward-compat alias. Existing call sites that reference `InlineButtonSpinner`
 * keep working; new call sites should prefer the broader `InlineSpinner` name.
 */
export const InlineButtonSpinner = InlineSpinner;
export type InlineButtonSpinnerSize = InlineSpinnerSize;
export type InlineButtonSpinnerProps = InlineSpinnerProps;

// ============================================================================
// Skeleton Component — Base with gold shimmer
// ============================================================================

export interface SkeletonProps {
  className?: string;
  shimmer?: boolean;
}

/**
 * CANONICAL Skeleton - Generic content placeholder with cinematic shimmer
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  shimmer = true,
}) => {
  return (
    <div
      className={`
        bg-[var(--color-bg-tertiary)]
        relative
        overflow-hidden
        rounded-xl
        ${className}
      `}
      aria-label="Preparing content..."
      aria-busy="true"
      aria-live="polite"
    >
      {/* Subtle pulse underneath */}
      <motion.div
        className="absolute inset-0 rounded-xl"
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ background: 'inherit' }}
      />
      {shimmer && <ShimmerOverlay intensity="subtle" />}
    </div>
  );
};

// ============================================================================
// ClinicalSkeleton Component — Multi-line with staggered spring entrance
// ============================================================================

export interface ClinicalSkeletonProps {
  variant?: 'default' | 'compact';
  lines?: number;
  className?: string;
}

/**
 * CANONICAL ClinicalSkeleton - Medical/professional loading state
 *
 * Features:
 * - Staggered line entrance with spring physics
 * - Gold-tinted shimmer sweep
 * - Varied line widths for natural text appearance
 * - Blur-dissolve on each line
 */
export const ClinicalSkeleton: React.FC<ClinicalSkeletonProps> = React.memo(({
  variant = 'default',
  lines = 3,
  className = '',
}) => {
  const isCompact = variant === 'compact';

  // Deterministic varied widths for natural text appearance
  const SKELETON_WIDTHS = [85, 92, 78, 88, 75, 90, 82, 95, 70, 87] as const;
  const lineWidths = Array.from({ length: lines }, (_, i) => {
    const base = SKELETON_WIDTHS[i % SKELETON_WIDTHS.length] ?? SKELETON_WIDTHS[0];
    return i === lines - 1 ? Math.round(base * 0.65) : base;
  });

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      className={`
        relative overflow-hidden
        ${isCompact ? 'p-4 rounded-lg' : 'rounded-xl p-6'}
        bg-[var(--color-card-bg)]
        ${className}
      `}
      role="status"
      aria-label="Loading content"
    >
      {/* Gold shimmer overlay */}
      <ShimmerOverlay intensity="medium" />

      <div className="space-y-3 relative z-[1]">
        {lineWidths.map((width, index) => (
          <motion.div
            key={index}
            custom={index}
            variants={skeletonLineVariants}
            style={{ width: `${width}%` }}
            className={`
              ${isCompact ? 'h-3.5' : 'h-4'}
              bg-gradient-to-r from-[var(--color-bg-tertiary)] via-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)]
              rounded-md
            `}
          >
            {/* Inner pulse — secondary action */}
            <motion.div
              className="w-full h-full rounded-md"
              animate={{ opacity: [0.5, 0.8, 0.5] }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                delay: index * 0.15,
                ease: 'easeInOut',
              }}
              style={{ background: 'inherit' }}
            />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
});
ClinicalSkeleton.displayName = 'ClinicalSkeleton';

/**
 * StreamingSkeleton - Skeleton that morphs into content (blur dissolve)
 */
export const StreamingSkeleton: React.FC<{
  isStreaming: boolean;
  children: React.ReactNode;
  lines?: number;
}> = ({ isStreaming, children, lines = 3 }) => {
  return (
    <AnimatePresence mode="wait">
      {isStreaming ? (
        <motion.div
          key="skeleton"
          variants={contentRevealVariants}
          initial="skeleton"
          exit="revealing"
        >
          <ClinicalSkeleton lines={lines} />
        </motion.div>
      ) : (
        <motion.div
          key="content"
          variants={contentAppearVariants}
          initial="hidden"
          animate="visible"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ============================================================================
// DrillLoadingState Component — Structured drill skeleton with cinematic treatment
// ============================================================================

export interface DrillLoadingStateProps {
  optionCount?: number;
  showTimer?: boolean;
  showProgress?: boolean;
  message?: string;
  variant?: 'question' | 'image' | 'lab' | 'encounter';
}

/**
 * CANONICAL DrillLoadingState - Cinematic drill mode loading skeleton
 *
 * Features:
 * - Staggered option card entrances with spring physics
 * - Gold shimmer on question area
 * - Animated progress bar
 * - Blur-dissolve entrance for header elements
 */
export const DrillLoadingState: React.FC<DrillLoadingStateProps> = ({
  optionCount = 4,
  showTimer = true,
  showProgress = true,
  message = getClinicalLoadingMessage(0),
  variant = 'question',
}) => {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      className="min-h-[500px] bg-[var(--color-bg-primary)] p-6"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="max-w-3xl mx-auto">
        {/* Header skeleton — blur dissolve entrance */}
        <motion.div
          custom={0}
          variants={skeletonLineVariants}
          className="flex items-center justify-between mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-bg-tertiary)] relative overflow-hidden">
              <ShimmerOverlay intensity="subtle" />
            </div>
            <div>
              <div className="w-32 h-5 bg-[var(--color-bg-tertiary)] rounded-md mb-1 relative overflow-hidden">
                <ShimmerOverlay intensity="subtle" />
              </div>
              <div className="w-24 h-3.5 bg-[var(--color-bg-tertiary)] rounded-md relative overflow-hidden">
                <ShimmerOverlay intensity="subtle" />
              </div>
            </div>
          </div>

          {showTimer && (
            <div className="w-12 h-12 rounded-lg bg-[var(--color-bg-tertiary)] relative overflow-hidden">
              <ShimmerOverlay intensity="subtle" />
            </div>
          )}
        </motion.div>

        {/* Animated progress bar */}
        {showProgress && (
          <motion.div
            custom={1}
            variants={skeletonLineVariants}
            className="mb-6 h-1.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden relative"
          >
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                background: 'linear-gradient(90deg, rgba(196,183,138,0.2), rgba(196,183,138,0.08))',
              }}
              animate={{ width: ['0%', '65%', '40%', '80%', '60%'] }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </motion.div>
        )}

        {/* Question skeleton — cinematic card with shimmer */}
        <motion.div
          custom={2}
          variants={skeletonLineVariants}
          className="card-cinematic mb-8 p-6 relative overflow-hidden"
        >
          <ShimmerOverlay intensity="medium" />
          <div className="relative z-[1] space-y-4">
            <div className="w-3/4 h-6 bg-[var(--color-bg-tertiary)] rounded-md" />
            <div className="w-full h-4 bg-[var(--color-bg-tertiary)] rounded-md" />
            <div className="w-5/6 h-4 bg-[var(--color-bg-tertiary)] rounded-md" />
            {variant === 'image' && (
              <div className="w-full h-48 bg-[var(--color-bg-tertiary)] rounded-lg mt-2 relative overflow-hidden">
                <ShimmerOverlay intensity="strong" />
              </div>
            )}
          </div>
        </motion.div>

        {/* Options skeleton — staggered spring entrance */}
        <div className="space-y-3">
          {Array.from({ length: optionCount }).map((_, i) => (
            <motion.div
              key={i}
              custom={i + 3}
              variants={skeletonLineVariants}
              className="p-4 rounded-xl bg-[var(--color-card-bg)] flex items-center gap-3 relative overflow-hidden"
              style={{
                boxShadow: '0 0 0 1px rgba(196, 183, 138, 0.04), 0 1px 3px -1px rgba(0, 0, 0, 0.06)',
              }}
            >
              <ShimmerOverlay intensity="subtle" />
              <div className="w-6 h-6 rounded-full bg-[var(--color-bg-tertiary)] flex-shrink-0 relative z-[1]" />
              <div
                className="h-4 bg-[var(--color-bg-tertiary)] rounded-md relative z-[1]"
                style={{ width: `${60 + (i % 3) * 12}%` }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

// ============================================================================
// Specialized Loading Components
// ============================================================================

/**
 * LoadingProgress - Top-of-page progress bar with gold gradient + glow
 */
export interface LoadingProgressProps {
  isLoading: boolean;
  duration?: number;
}

export const LoadingProgress: React.FC<LoadingProgressProps> = ({
  isLoading,
  duration = 2000,
}) => {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (isLoading) {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev < 90) {
            return prev + 90 / (duration / 50);
          }
          if (prev < 95) {
            return prev + 0.1;
          }
          return prev;
        });
      }, 50);
      return () => clearInterval(interval);
    } else {
      setProgress(100);
      const timeout = setTimeout(() => setProgress(0), 500);
      return () => clearTimeout(timeout);
    }
  }, [isLoading, duration]);

  return (
    <AnimatePresence>
      {(isLoading || progress > 0) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed top-0 left-0 right-0 z-50 h-1"
        >
          <motion.div
            className="h-full relative"
            style={{
              background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 70%, #e6d9b5))',
            }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {/* Glow dot at leading edge */}
            <motion.div
              className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-4 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(196,183,138,0.6) 0%, transparent 70%)',
                filter: 'blur(3px)',
              }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * CommandCenterSkeleton - Dashboard-shaped skeleton with cinematic treatment.
 *
 * Layout mirrors the real CommandCenterHub above-the-fold content:
 *   1. Greeting heading + subtitle
 *   2. Status chip row
 *   3. Quick stats bar (2-col mobile, 4-col desktop)
 *   4. Hero action card
 */
export const CommandCenterSkeleton: React.FC<{ message?: string }> = ({
  message = 'Loading dashboard...',
}) => (
  <motion.div
    initial="hidden"
    animate="visible"
    className="pt-6 space-y-6"
    role="status"
    aria-label={message}
  >
    {/* Greeting skeleton */}
    <motion.div custom={0} variants={skeletonLineVariants}>
      <div className="h-8 w-56 bg-[var(--color-bg-tertiary)] rounded-lg relative overflow-hidden">
        <ShimmerOverlay intensity="medium" />
      </div>
      <div className="flex gap-2 mt-3">
        <div className="h-7 w-16 bg-[var(--color-bg-tertiary)] rounded-full relative overflow-hidden">
          <ShimmerOverlay intensity="subtle" />
        </div>
        <div className="h-7 w-20 bg-[var(--color-bg-tertiary)] rounded-full relative overflow-hidden">
          <ShimmerOverlay intensity="subtle" />
        </div>
      </div>
      <div className="h-4 w-64 bg-[var(--color-bg-tertiary)] rounded mt-3 relative overflow-hidden">
        <ShimmerOverlay intensity="subtle" />
      </div>
    </motion.div>

    {/* Quick stats bar skeleton — staggered cards */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <motion.div
          key={i}
          custom={i + 1}
          variants={skeletonLineVariants}
          className="card-stat flex items-center gap-3 p-3.5 relative overflow-hidden"
        >
          <ShimmerOverlay intensity="subtle" />
          <div className="w-9 h-9 rounded-xl bg-[var(--color-bg-tertiary)] shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-5 w-10 bg-[var(--color-bg-tertiary)] rounded" />
            <div className="h-3 w-16 bg-[var(--color-bg-tertiary)] rounded" />
          </div>
        </motion.div>
      ))}
    </div>

    {/* Hero card skeleton — large cinematic card */}
    <motion.div
      custom={5}
      variants={skeletonLineVariants}
      className="card-cinematic h-40 relative overflow-hidden"
    >
      <ShimmerOverlay intensity="strong" />
    </motion.div>

    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
      className="text-sm text-[var(--color-text-muted)]"
      aria-live="polite"
    >
      {message}
    </motion.p>
  </motion.div>
);

/**
 * QuickStatsBarSkeleton - Skeleton for stats bar with staggered entrance
 */
export const QuickStatsBarSkeleton: React.FC = () => (
  <motion.div
    initial="hidden"
    animate="visible"
    className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
    role="status"
    aria-label="Loading stats"
  >
    {Array.from({ length: 4 }).map((_, i) => (
      <motion.div
        key={i}
        custom={i}
        variants={skeletonLineVariants}
        className="card-stat flex items-center gap-3 p-3.5 relative overflow-hidden"
      >
        <ShimmerOverlay intensity="subtle" />
        <div className="w-9 h-9 rounded-xl bg-[var(--color-bg-tertiary)] shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-5 w-10 bg-[var(--color-bg-tertiary)] rounded" />
          <div className="h-3 w-16 bg-[var(--color-bg-tertiary)] rounded" />
        </div>
      </motion.div>
    ))}
  </motion.div>
);

// ============================================================================
// Specialized Question & Chat Skeletons
// ============================================================================

/**
 * QuestionSkeleton - Loading state for quiz/drill questions with stagger
 */
export const QuestionSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <motion.div
    initial="hidden"
    animate="visible"
    className={`space-y-4 ${className}`}
  >
    <motion.div custom={0} variants={skeletonLineVariants}>
      <div className="h-6 bg-[var(--color-bg-tertiary)] rounded-lg w-3/4 relative overflow-hidden">
        <ShimmerOverlay intensity="medium" />
      </div>
    </motion.div>
    <motion.div custom={1} variants={skeletonLineVariants} className="space-y-2">
      <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-full relative overflow-hidden">
        <ShimmerOverlay intensity="subtle" />
      </div>
      <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-5/6 relative overflow-hidden">
        <ShimmerOverlay intensity="subtle" />
      </div>
    </motion.div>
    <div className="space-y-2 pt-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <motion.div
          key={i}
          custom={i + 2}
          variants={skeletonLineVariants}
          className="h-12 bg-[var(--color-bg-tertiary)] rounded-lg relative overflow-hidden"
        >
          <ShimmerOverlay intensity="subtle" />
        </motion.div>
      ))}
    </div>
  </motion.div>
);

/**
 * ChatSkeleton - Loading state for chat/conversation with staggered messages
 */
export const ChatSkeleton: React.FC<{
  messageCount?: number;
  className?: string;
}> = ({ messageCount = 3, className = '' }) => (
  <motion.div
    initial="hidden"
    animate="visible"
    className={`space-y-3 ${className}`}
  >
    {Array.from({ length: messageCount }).map((_, i) => (
      <motion.div
        key={i}
        custom={i}
        variants={skeletonLineVariants}
        className="flex gap-3"
      >
        <div className="w-8 h-8 bg-[var(--color-bg-tertiary)] rounded-full flex-shrink-0 relative overflow-hidden">
          <ShimmerOverlay intensity="subtle" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-1/3 relative overflow-hidden">
            <ShimmerOverlay intensity="subtle" />
          </div>
          <div className="space-y-1">
            <div className="h-3 bg-[var(--color-bg-tertiary)] rounded w-full relative overflow-hidden">
              <ShimmerOverlay intensity="subtle" />
            </div>
            <div className="h-3 bg-[var(--color-bg-tertiary)] rounded w-5/6 relative overflow-hidden">
              <ShimmerOverlay intensity="subtle" />
            </div>
          </div>
        </div>
      </motion.div>
    ))}
  </motion.div>
);

// ============================================================================
// ContentTransition — Skeleton-to-content morphing wrapper
// ============================================================================

/**
 * ContentTransition wraps any content that loads asynchronously.
 * Shows a skeleton while loading, then morphs into the real content
 * with a blur-dissolve transition.
 */
export const ContentTransition: React.FC<{
  isLoading: boolean;
  skeleton?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ isLoading, skeleton, children, className = '' }) => (
  <AnimatePresence mode="wait">
    {isLoading ? (
      <motion.div
        key="skeleton-state"
        initial={{ opacity: 0, filter: 'blur(4px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, filter: 'blur(6px)', scale: 0.98 }}
        transition={{ duration: 0.25, ease: easings.exit }}
        className={className}
      >
        {skeleton || <ClinicalSkeleton lines={4} />}
      </motion.div>
    ) : (
      <motion.div
        key="content-state"
        initial={{ opacity: 0, filter: 'blur(8px)', y: 6 }}
        animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
        transition={{ ...springs.snappy, opacity: { duration: 0.3 } }}
        className={className}
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
);

// ============================================================================
// Re-exports for convenience
// ============================================================================

export default {
  Loader,
  Skeleton,
  ClinicalSkeleton,
  StreamingSkeleton,
  DrillLoadingState,
  LoadingProgress,
  CommandCenterSkeleton,
  QuickStatsBarSkeleton,
  QuestionSkeleton,
  ChatSkeleton,
  ContentTransition,
};

// Skeleton aliases for backwards compatibility
export const UserStatsOverviewSkeleton: React.FC = () => (
  <motion.div initial="hidden" animate="visible" className="space-y-4">
    <motion.div custom={0} variants={skeletonLineVariants}>
      <Skeleton className="h-20 w-full rounded-xl" />
    </motion.div>
    <div className="grid grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div key={i} custom={i + 1} variants={skeletonLineVariants}>
          <Skeleton className="h-16 w-full rounded-xl" />
        </motion.div>
      ))}
    </div>
  </motion.div>
);

export const StatCardSkeleton: React.FC = () => (
  <Skeleton className="h-24 w-full rounded-xl" />
);

export const SkeletonWidget: React.FC<{ className?: string }> = ({ className = '' }) => (
  <Skeleton className={`h-32 w-full rounded-xl ${className}`.trim()} />
);

export const SkeletonDrillCard: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
    transition={springs.snappy}
  >
    <Skeleton className="h-48 w-full rounded-xl" />
  </motion.div>
);

export const SkeletonQuizQuestion: React.FC = () => (
  <motion.div initial="hidden" animate="visible" className="space-y-4">
    <motion.div custom={0} variants={skeletonLineVariants}>
      <Skeleton className="h-6 w-full rounded" />
    </motion.div>
    <motion.div custom={1} variants={skeletonLineVariants}>
      <Skeleton className="h-4 w-3/4 rounded" />
    </motion.div>
    {Array.from({ length: 4 }).map((_, i) => (
      <motion.div key={i} custom={i + 2} variants={skeletonLineVariants}>
        <Skeleton className="h-12 w-full rounded-lg" />
      </motion.div>
    ))}
  </motion.div>
);

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <motion.div initial="hidden" animate="visible" className="space-y-2">
    <motion.div custom={0} variants={skeletonLineVariants}>
      <Skeleton className="h-10 w-full rounded" />
    </motion.div>
    {Array.from({ length: rows }).map((_, i) => (
      <motion.div key={i} custom={i + 1} variants={skeletonLineVariants}>
        <Skeleton className="h-12 w-full rounded" />
      </motion.div>
    ))}
  </motion.div>
);

// SkeletonLoader — alias for backwards compatibility
export const SkeletonLoader: React.FC<{
  height?: string;
  width?: string;
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular';
}> = ({
  height,
  width,
  className = '',
  variant: _variant,
}) => (
  <Skeleton
    className={`${height ? `h-[${height}]` : ''} ${width ? `w-[${width}]` : 'w-full'} ${className}`.trim()}
  />
);

// SkeletonCard — alias for backwards compatibility
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <Skeleton className={`h-32 w-full rounded-xl ${className}`.trim()} />
);

/**
 * SkeletonText — multi-line text placeholder.
 */
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className = '',
}) => <ClinicalSkeleton variant="compact" lines={lines} className={className} />;
