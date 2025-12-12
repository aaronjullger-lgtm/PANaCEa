import React, { ReactNode } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { LucideIcon } from 'lucide-react';

interface MiniModeLayoutProps {
  /** Children content */
  children: ReactNode;
  /** Mode title */
  title: string;
  /** Mode subtitle/description */
  subtitle: string;
  /** Icon component */
  icon: LucideIcon;
  /** Optional custom accent color (uses analytics-primary by default) */
  accentColor?: string;
  /** Skip the radiology exception (force inverted theme) */
  forceInvertedTheme?: boolean;
}

/**
 * MiniModeLayout - Standardized layout wrapper for all Mini Modes
 * 
 * Uses theme-aware CSS variables for consistent theming:
 * - var(--color-bg-primary) for backgrounds
 * - var(--color-text-primary) for text
 * - Respects global theme without hardcoded colors
 */
export const MiniModeLayout: React.FC<MiniModeLayoutProps> = ({
  children,
  title,
  subtitle,
  icon: Icon,
  accentColor,
  forceInvertedTheme = false,
}) => {
  const [theme] = useTheme();
  
  // Use CSS variables for theme-aware styling (consistent with CodeBlueSpeedMode)
  const containerBg = 'bg-[var(--color-bg-primary)]';
  const containerText = 'text-[var(--color-text-primary)]';
  const cardBg = 'bg-[var(--color-bg-secondary)]';
  const cardBorder = 'border-[var(--color-border)]';
  const subtleText = 'text-[var(--color-text-muted)]';
  
  // Get the accent color from CSS variables or use provided color
  const iconColor = accentColor || 'var(--color-accent)';
  
  return (
    <div className={`min-h-screen ${containerBg} ${containerText} transition-colors duration-300`}>
      {children}
    </div>
  );
};

interface MiniModeHeaderProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  onExit?: () => void;
  score?: { correct: number; total: number };
  onReset?: () => void;
  accentColor?: string;
}

/**
 * MiniModeHeader - Standardized header for Mini Modes
 */
export const MiniModeHeader: React.FC<MiniModeHeaderProps> = ({
  title,
  subtitle,
  icon: Icon,
  onExit,
  score,
  onReset,
  accentColor,
}) => {
  const [theme] = useTheme();
  
  // Use CSS variables for theme-aware styling
  const cardBg = 'bg-[var(--color-bg-secondary)]';
  const cardBorder = 'border-[var(--color-border)]';
  const containerText = 'text-[var(--color-text-primary)]';
  const subtleText = 'text-[var(--color-text-muted)]';
  const iconColor = accentColor || 'var(--color-accent)';
  
  return (
    <div className={`border-b ${cardBorder} ${cardBg} backdrop-blur-sm sticky top-0 z-10`}>
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className="w-8 h-8" style={{ color: iconColor }} />
          <div>
            <h1 className={`text-2xl font-bold ${containerText}`}>{title}</h1>
            <p className={`text-sm ${subtleText}`}>{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {score && (
            <div className="text-right">
              <p className={`text-sm ${subtleText}`}>Score</p>
              <p className={`text-xl font-bold ${containerText}`}>
                {score.correct}/{score.total}
                {score.total > 0 && (
                  <span className="text-sm ml-2 text-[var(--color-accent)]">
                    ({Math.round((score.correct / score.total) * 100)}%)
                  </span>
                )}
              </p>
            </div>
          )}
          {onReset && (
            <button
              onClick={onReset}
              className={`p-2 rounded-lg ${cardBg} hover:opacity-80 transition-colors border ${cardBorder}`}
              title="Reset"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          {onExit && (
            <button
              onClick={onExit}
              className={`p-2 rounded-lg ${cardBg} hover:opacity-80 transition-colors border ${cardBorder}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface MiniModeCardProps {
  children: ReactNode;
  className?: string;
}

/**
 * MiniModeCard - Standardized card component for Mini Modes
 */
export const MiniModeCard: React.FC<MiniModeCardProps> = ({ children, className = '' }) => {
  const [theme] = useTheme();
  
  // Use CSS variables for theme-aware styling
  const cardBg = 'bg-[var(--color-bg-secondary)]';
  const cardBorder = 'border-[var(--color-border)]';
  
  return (
    <div className={`${cardBg} backdrop-blur rounded-xl p-6 border ${cardBorder} ${className}`}>
      {children}
    </div>
  );
};
