/**
 * CompressedConditionCard - Minimal card component for library grid
 *
 * Displays:
 * - Condition name (Teko display font)
 * - Subcategory badge
 * - PANCE yield indicator
 *
 * Uses PANaCEa's glassmorphism design with hover effects
 */

import React from 'react';
import { motion } from 'framer-motion';
import { YieldBadge } from '@/components/ui/badges';

interface CompressedConditionCardProps {
  condition: string;
  panceYield: number | null;
  subcategory: string | null;
  onClick: () => void;
  className?: string;
}

export const CompressedConditionCard: React.FC<CompressedConditionCardProps> = ({
  condition,
  panceYield,
  subcategory,
  onClick,
  className = '',
}) => {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`
        w-full p-4 text-left rounded-xl
        bg-[var(--color-glass-bg)] backdrop-blur-lg
        border border-[var(--color-border)]
        hover:border-[var(--color-accent)] hover:shadow-lg
        transition-all duration-200
        ${className}
      `}
    >
      {/* Condition Name - Teko Display Font */}
      <h3
        className="font-bold text-xl text-[var(--color-text-primary)] mb-1 tracking-wide"
        style={{ fontFamily: "'Teko', 'Poppins', sans-serif" }}
      >
        {condition}
      </h3>

      {/* Subcategory Badge */}
      {subcategory && <p className="text-sm text-[var(--color-text-muted)] mb-2">{subcategory}</p>}

      {/* Yield Badge */}
      <div className="mt-2">
        <YieldBadge yield={panceYield} size="sm" />
      </div>
    </motion.button>
  );
};

export default CompressedConditionCard;
