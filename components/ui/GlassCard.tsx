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
  | 'primary'   // Blue glow
  | 'success'   // Green glow
  | 'warning'   // Amber glow
  | 'info'      // Cyan glow
  | 'neutral';  // Slate/no glow

interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  variant?: CardVariant;
  children: React.ReactNode;
  hoverable?: boolean;
  noPadding?: boolean;
}

const variantStyles: Record<CardVariant, { bg: string; border: string; glow: string }> = {
  primary: {
    bg: 'bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/10',
    border: 'border-blue-500/20 hover:border-blue-500/40',
    glow: 'bg-blue-500/10',
  },
  success: {
    bg: 'bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-teal-500/10',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
    glow: 'bg-emerald-500/10',
  },
  warning: {
    bg: 'bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-yellow-500/10',
    border: 'border-amber-500/20 hover:border-amber-500/40',
    glow: 'bg-amber-500/10',
  },
  info: {
    bg: 'bg-gradient-to-br from-cyan-500/10 via-teal-500/5 to-blue-500/10',
    border: 'border-cyan-500/20 hover:border-cyan-500/40',
    glow: 'bg-cyan-500/10',
  },
  neutral: {
    bg: 'bg-[var(--color-bg-secondary)]',
    border: 'border-[var(--color-border)] hover:border-[var(--color-accent)]',
    glow: 'bg-slate-500/5',
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
  const hoverStyles = hoverable ? 'hover:shadow-lg transition-all duration-300' : '';
  const paddingStyles = noPadding ? '' : 'p-6';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        relative overflow-hidden rounded-2xl
        ${styles.bg}
        border ${styles.border}
        ${paddingStyles}
        ${hoverStyles}
        ${className}
      `}
      {...props}
    >
      {/* Subtle background glow */}
      <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-30 pointer-events-none">
        <div className={styles.glow} />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
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
  iconColor = 'text-blue-500',
  title,
  subtitle,
  badge,
}) => {
  return (
    <div className="flex items-start gap-4 mb-4">
      <div className={`p-3 rounded-xl bg-white/10 dark:bg-white/5 backdrop-blur-sm border border-white/20`}>
        <Icon className={`w-7 h-7 ${iconColor}`} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-xl font-bold text-[var(--color-text-primary)]">{title}</h3>
          {badge && (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge.color || 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'}`}>
              {badge.text}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-sm text-[var(--color-text-secondary)]">{subtitle}</p>
        )}
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
      {stats.map((stat, index) => (
        <div
          key={index}
          className={`flex items-center gap-2 px-4 py-2 backdrop-blur-sm rounded-lg border ${stat.color || 'bg-blue-500/10 border-blue-400/20'}`}
        >
          <stat.icon className="w-4 h-4" />
          <span className="text-sm font-medium">{stat.value} {stat.label}</span>
        </div>
      ))}
    </div>
  );
};
