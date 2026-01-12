/**
 * EnhancedConditionCard - Rich preview card for Clinical Reference Library
 * 
 * Features:
 * - Condition name with yield badge
 * - Classic patient snippet (pattern recognition trigger)
 * - Top 3 buzzwords as memory anchors
 * - Gold standard Dx and First-line Rx icons with tooltips
 * - Hover effects with glassmorphism design
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { FlaskConical, Pill, User, Tag } from 'lucide-react';
import { YieldBadge } from '@/components/ui/badges';
import { parseListField, parseTextField } from '@/lib/utils/normalization';
import type { MedicalContentDisplay } from '@/types/medical-content';

interface EnhancedConditionCardProps {
  condition: Partial<MedicalContentDisplay>;
  onClick: () => void;
  isSelected?: boolean;
  className?: string;
}

/**
 * Tooltip component for quick-glance info
 */
const QuickInfoTooltip: React.FC<{
  icon: typeof FlaskConical;
  label: string;
  value: string | null;
  color: string;
}> = ({ icon: Icon, label, value, color }) => {
  if (!value) return null;
  
  return (
    <div className="group/tooltip relative">
      <div className={`
        p-1.5 rounded-md transition-all duration-200 cursor-help
        hover:bg-[var(--color-bg-secondary)] hover:scale-110
        ${color}
      `}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      {/* Tooltip */}
      <div className="
        absolute bottom-full left-1/2 -translate-x-1/2 mb-2
        px-3 py-2 rounded-lg shadow-xl
        bg-[var(--color-bg-primary)] border border-[var(--color-border)]
        opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible
        transition-all duration-200 z-50 min-w-[200px] max-w-[280px]
        pointer-events-none
      ">
        <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-1">{label}</p>
        <p className="text-sm text-[var(--color-text-primary)]">{value}</p>
        {/* Arrow */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--color-border)]" />
      </div>
    </div>
  );
};

/**
 * EnhancedConditionCard - Main component
 */
export const EnhancedConditionCard: React.FC<EnhancedConditionCardProps> = ({
  condition,
  onClick,
  isSelected = false,
  className = '',
}) => {
  // Parse fields safely
  const classicPatient = useMemo(() => 
    parseTextField(condition.classic_patient),
  [condition.classic_patient]);

  const buzzwords = useMemo(() => {
    const parsed = parseListField(condition.buzzwords);
    return parsed.slice(0, 3); // Only show first 3
  }, [condition.buzzwords]);

  const goldStandard = useMemo(() => 
    parseTextField(condition.gold_standard_dx),
  [condition.gold_standard_dx]);

  const firstLineRx = useMemo(() => 
    parseTextField(condition.first_line_rx),
  [condition.first_line_rx]);

  const hasQuickInfo = goldStandard || firstLineRx;

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`
        w-full text-left rounded-xl p-4
        bg-[var(--color-glass-bg)] backdrop-blur-lg
        border transition-all duration-200
        ${isSelected
          ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30 shadow-lg'
          : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/60 hover:shadow-lg'
        }
        ${className}
      `}
    >
      {/* Header: Condition Name + Yield */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 
          className="font-bold text-lg text-[var(--color-text-primary)] leading-tight tracking-wide line-clamp-2"
          style={{ fontFamily: "'Teko', 'Poppins', sans-serif" }}
        >
          {condition.condition || 'Untitled'}
        </h3>
        <YieldBadge yield={condition.pance_yield ?? null} size="sm" />
      </div>

      {/* Subcategory */}
      {condition.subcategory && (
        <p className="text-xs text-[var(--color-text-muted)] mb-3">
          {condition.subcategory}
        </p>
      )}

      {/* Divider */}
      <div className="h-px bg-[var(--color-border)] mb-3" />

      {/* Classic Patient */}
      {classicPatient && (
        <div className="flex items-start gap-2 mb-3">
          <User className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">
            {classicPatient}
          </p>
        </div>
      )}

      {/* Buzzwords */}
      {buzzwords.length > 0 && (
        <div className="flex items-start gap-2 mb-3">
          <Tag className="w-3.5 h-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
          <div className="flex flex-wrap gap-1.5">
            {buzzwords.map((word, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-md bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[10px] font-medium text-[var(--color-text-secondary)]"
              >
                {word}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Quick Info Icons (Gold Standard + First Line Rx) */}
      {hasQuickInfo && (
        <div className="flex items-center gap-1 pt-2 border-t border-[var(--color-border)]/50">
          <QuickInfoTooltip
            icon={FlaskConical}
            label="Gold Standard Diagnosis"
            value={goldStandard}
            color="text-amber-400"
          />
          <QuickInfoTooltip
            icon={Pill}
            label="First-Line Treatment"
            value={firstLineRx}
            color="text-emerald-400"
          />
        </div>
      )}
    </motion.button>
  );
};

export default EnhancedConditionCard;
