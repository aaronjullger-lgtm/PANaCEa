import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

/**
 * GlassCard - Standardized card component with glassmorphism design
 *
 * Design System Standards:
 * - Subtle gradient backgrounds with colored glows
 * - Consistent border radius: 16px (rounded-2xl)
 * - Backdrop blur for depth
 * - Hover effects: border color change, shadow enhancement
 */

export type CardVariant =
  | 'primary' // Blue glow
  | 'success' // Green glow
  | 'warning' // Amber glow
  | 'info' // Cyan glow
  | 'neutral'; // Slate/no glow

interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  variant?: CardVariant;
  children: React.ReactNode;
  hoverable?: boolean;
  noPadding?: boolean;
}

const variantStyles: Record<CardVariant, { bg: string; border: string; glow: string }> = {
  primary: {
    bg: 'bg-gradient-to-br from-action-blue/10 via-deep-plum-400/5 to-deep-plum-300/10',
    border: 'border-action-blue/20 hover:border-action-blue/40',
    glow: 'bg-action-blue/10',
  },
  success: {
    bg: 'bg-gradient-to-br from-sage-500/10 via-sage-400/5 to-sage-600/10',
    border: 'border-sage-500/20 hover:border-sage-500/40',
    glow: 'bg-sage-500/10',
  },
  warning: {
    bg: 'bg-gradient-to-br from-muted-amber/10 via-muted-amber/5 to-muted-amber/10',
    border: 'border-muted-amber/20 hover:border-muted-amber/40',
    glow: 'bg-muted-amber/10',
  },
  info: {
    bg: 'bg-gradient-to-br from-steel-blue-400/10 via-steel-blue-500/5 to-action-blue/10',
    border: 'border-steel-blue-400/20 hover:border-steel-blue-400/40',
    glow: 'bg-steel-blue-400/10',
  },
  neutral: {
    bg: 'bg-[var(--color-bg-secondary)]',
    border: 'border-[var(--color-border)] hover:border-[var(--color-accent)]',
    glow: 'bg-[var(--color-border)]/50',
  },
};

export const GlassCard: React.FC<GlassCardProps> = ({
  variant = 'neutral',
  children,
  hoverable = false,
  noPadding = false,
  className = '',
  ...props
}) => {
  const styles = variantStyles[variant];
  const baseLift = 'shadow-md dark:shadow-none';
  const hoverStyles = hoverable
    ? `${baseLift} hover:shadow-lg dark:hover:shadow-black/20 transition-all duration-300`
    : baseLift;
  const paddingStyles = noPadding ? '' : 'p-6';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`
        relative overflow-hidden rounded-2xl
        ${styles.bg}
        backdrop-blur-sm
        border ${styles.border}
        ${paddingStyles}
        ${hoverStyles}
        ${className}
      `}
      {...props}
    >
      {/* Subtle background glow - only for non-neutral variants */}
      {variant !== 'neutral' && (
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-30 pointer-events-none">
          <div className={`w-full h-full ${styles.glow}`} />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};

/**
 * CardHeader - Standardized card header with icon, title, and badges
 */
interface CardHeaderProps {
  icon: LucideIcon;
  iconColor?: string;
  title: string;
  subtitle?: string;
  badge?: {
    text: string;
    color?: string;
  };
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  icon: Icon,
  iconColor = 'text-action-blue',
  title,
  subtitle,
  badge,
}) => {
  return (
    <div className="flex items-start gap-4 mb-4">
      <div
        className={`p-3 rounded-xl bg-white/10 dark:bg-white/5 backdrop-blur-sm border border-white/20`}
      >
        <Icon className={`w-7 h-7 ${iconColor}`} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-xl font-bold text-[var(--color-text-primary)]">{title}</h3>
          {badge && (
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge.color || 'bg-action-blue/10 text-action-blue border border-action-blue/20'}`}
            >
              {badge.text}
            </span>
          )}
        </div>
        {subtitle && <p className="text-sm text-[var(--color-text-secondary)]">{subtitle}</p>}
      </div>
    </div>
  );
};

/**
 * CardStats - Horizontal stat badges for card footers
 */
interface StatBadge {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color?: string;
}

interface CardStatsProps {
  stats: StatBadge[];
}

export const CardStats: React.FC<CardStatsProps> = ({ stats }) => {
  return (
    <div className="flex flex-wrap items-center gap-3 mt-4">
      {stats.map((stat) => (
        <div
          key={`${stat.label}-${stat.value}`}
          className={`flex items-center gap-2 px-4 py-2 backdrop-blur-sm rounded-lg border ${stat.color || 'bg-action-blue/10 border-action-blue/20'}`}
        >
          <stat.icon className="w-4 h-4" />
          <span className="text-sm font-medium">
            {stat.value} {stat.label}
          </span>
        </div>
      ))}
    </div>
  );
};
