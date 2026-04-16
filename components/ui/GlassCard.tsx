import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { springs } from '@/config/appViews';
import { Badge } from '@/components/ui/Badge';
import {
  bodySupportClass,
  iconTileClass,
  sectionHeadingClass,
  surfaceBaseClass,
  surfaceInteractiveClass,
  surfacePaddingClass,
  surfaceRaisedStyle,
  surfaceShadowStyle,
} from '@/components/ui/system';

/**
 * GlassCard - Elevated card component with semantic variant system
 *
 * Design principles (synthesized from Linear, Vercel, Notion):
 * - Ring-shadow elevation for neutral variant (consistent with Card primitive)
 * - Whisper borders with subtle tint for colored variants
 * - Accent tint only when meaningful (primary CTA, status)
 * - No backdrop-blur on inner elements (reserved for overlays only)
 *
 * NOTE: Sub-components are prefixed "GlassCard*" to avoid collision with
 * the base Card primitive's compound exports (CardHeader, CardContent, etc.).
 */

export type CardVariant =
  | 'primary' // Accent-tinted glow — primary actions
  | 'success' // Green glow — positive outcomes
  | 'warning' // Amber glow — attention
  | 'info' // Cyan glow — informational
  | 'neutral'; // Clean surface — ring-shadow, no glow

interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  variant?: CardVariant;
  children: React.ReactNode;
  hoverable?: boolean;
  noPadding?: boolean;
}

const variantStyles: Record<CardVariant, { bg: string; border: string; glow: string; useShadow: boolean }> = {
  primary: {
    bg: 'bg-gradient-to-br from-[var(--color-accent)]/10 via-[var(--color-bg-secondary)] to-[var(--color-accent)]/6',
    border: 'border-[var(--color-accent)]/16 hover:border-[var(--color-accent)]/28',
    glow: 'bg-[var(--color-accent)]/8',
    useShadow: false,
  },
  success: {
    bg: 'bg-gradient-to-br from-[var(--color-data-pass)]/10 via-[var(--color-bg-secondary)] to-[var(--color-data-pass)]/6',
    border: 'border-[var(--color-data-pass)]/16 hover:border-[var(--color-data-pass)]/28',
    glow: 'bg-[var(--color-data-pass)]/8',
    useShadow: false,
  },
  warning: {
    bg: 'bg-gradient-to-br from-[var(--color-data-provisional)]/10 via-[var(--color-bg-secondary)] to-[var(--color-data-provisional)]/6',
    border: 'border-[var(--color-data-provisional)]/16 hover:border-[var(--color-data-provisional)]/28',
    glow: 'bg-[var(--color-data-provisional)]/8',
    useShadow: false,
  },
  info: {
    bg: 'bg-gradient-to-br from-[var(--color-accent-secondary)]/10 via-[var(--color-bg-secondary)] to-[var(--color-accent-secondary)]/6',
    border: 'border-[var(--color-accent-secondary)]/16 hover:border-[var(--color-accent-secondary)]/28',
    glow: 'bg-[var(--color-accent-secondary)]/8',
    useShadow: false,
  },
  neutral: {
    bg: 'bg-[var(--color-bg-secondary)]',
    border: '', // ring-shadow replaces border for neutral
    glow: '',
    useShadow: true,
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
  const prefersReducedMotion = useReducedMotion();
  const styles = variantStyles[variant];

  const hoverStyles = hoverable
    ? 'transition-colors duration-150 hover:bg-[var(--color-bg-tertiary)]/40'
    : '';

  return (
    <motion.div
      // Fixed: removed initial opacity:0 which caused invisible-card stall in StrictMode
      // Uses blur-dissolve + spring for cinematic entrance without opacity risk
      initial={prefersReducedMotion ? false : { y: 12, filter: 'blur(4px)' }}
      animate={{ y: 0, filter: 'blur(0px)' }}
      whileHover={hoverable && !prefersReducedMotion ? { y: -2, transition: springs.snappy } : undefined}
      transition={prefersReducedMotion ? { duration: 0 } : springs.snappy}
      className={`
        relative overflow-hidden rounded-[1.25rem]
        ${surfaceBaseClass}
        ${surfaceInteractiveClass}
        ${styles.bg}
        ${styles.border}
        ${noPadding ? '' : surfacePaddingClass}
        ${hoverStyles}
        ${className}
      `}
      style={styles.useShadow ? surfaceShadowStyle : surfaceRaisedStyle}
      {...props}
    >
      {/* Subtle background glow — only for colored variants */}
      {variant !== 'neutral' && (
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none" aria-hidden="true">
          <div className={`w-full h-full ${styles.glow}`} />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};

/**
 * GlassCardHeader - Card header with icon, title, and optional badge
 *
 * Prefixed to avoid collision with the base Card's CardHeader export.
 */
interface GlassCardHeaderProps {
  icon: LucideIcon;
  iconColor?: string;
  title: string;
  subtitle?: string;
  badge?: {
    text: string;
    color?: string;
  };
}

export const GlassCardHeader: React.FC<GlassCardHeaderProps> = ({
  icon: Icon,
  iconColor = 'text-[var(--color-text-secondary)]',
  title,
  subtitle,
  badge,
}) => {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className={iconTileClass}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className={sectionHeadingClass}>{title}</h3>
          {badge && (
            <Badge
              size="sm"
              variant="secondary"
              className={badge.color}
            >
              {badge.text}
            </Badge>
          )}
        </div>
        {subtitle && <p className={bodySupportClass}>{subtitle}</p>}
      </div>
    </div>
  );
};

/**
 * GlassCardStats - Horizontal stat badges for card footers
 *
 * Prefixed to avoid collision with future Card compound exports.
 */
interface StatBadge {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color?: string;
}

interface GlassCardStatsProps {
  stats: StatBadge[];
}

export const GlassCardStats: React.FC<GlassCardStatsProps> = ({ stats }) => {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-4">
      {stats.map((stat) => (
        <div
          key={`${stat.label}-${stat.value}`}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${stat.color || 'border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'}`}
        >
          <stat.icon className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          <span className="font-medium">
            {stat.value} {stat.label}
          </span>
        </div>
      ))}
    </div>
  );
};

/** @deprecated Use GlassCardHeader instead — kept for backwards compatibility */
export const CardHeader = GlassCardHeader;
/** @deprecated Use GlassCardStats instead — kept for backwards compatibility */
export const CardStats = GlassCardStats;
