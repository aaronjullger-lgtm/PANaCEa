import React from 'react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface SectionHeaderProps {
  title: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  variant?: 'brand' | 'accent';
  className?: string;
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
}) => {
  const iconColorClass =
    variant === 'brand'
      ? 'text-[var(--color-accent)]'
      : 'text-[var(--color-data-provisional)]';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`mt-8 mb-4 flex items-center justify-between ${className}`}
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={`flex-shrink-0 ${iconColorClass}`}>
            <Icon className="w-5 h-5" aria-hidden="true" />
          </div>
        )}
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
          {title}
        </h2>
      </div>
      
      {action && (
        <div className="flex-shrink-0">
          {action}
        </div>
      )}
    </motion.div>
  );
};

export default SectionHeader;
