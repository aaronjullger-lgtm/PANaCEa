import React from 'react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  bodySupportClass,
  iconTileClass,
  sectionHeaderRowClass,
  sectionTitleClass,
} from '@/components/ui/system';

interface SectionHeaderProps {
  title: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  variant?: 'brand' | 'accent';
  className?: string;
  subtitle?: string;
}

/**
 * SectionHeader - Standardized section header component
 *
 * Design System:
 * - Consistent spacing: mt-8 mb-4
 * - Icon sizing: w-5 h-5
 * - Color variants: brand (indigo/purple) or accent (yellow/amber)
 * - Semantic tokens only (per .clinerules)
 *
 * @example
 * ```tsx
 * <SectionHeader
 *   title="Recommended Actions"
 *   icon={Lightbulb}
 *   variant="accent"
 *   action={<Button>View All</Button>}
 * />
 * ```
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  icon: Icon,
  action,
  variant = 'brand',
  className = '',
  subtitle,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const iconColorClass =
    variant === 'brand' ? 'text-[var(--color-accent)]' : 'text-[var(--color-data-provisional)]';

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
      className={cn('mb-5 mt-8', className)}
    >
      <div className={sectionHeaderRowClass}>
        <div className="flex items-start gap-3">
          {Icon && (
            <div className={cn(iconTileClass, iconColorClass)}>
              <Icon className="w-5 h-5" aria-hidden="true" />
            </div>
          )}
          <div className="space-y-1">
            <h2 className={sectionTitleClass}>{title}</h2>
            {subtitle && <p className={bodySupportClass}>{subtitle}</p>}
          </div>
        </div>

        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
    </motion.div>
  );
};

export default SectionHeader;
