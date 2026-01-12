/**
 * EnhancedConditionCard - Rich preview card for Clinical Reference Library
 * 
 * Features:
 * - Context-aware primary display (buzzwords OR classic patient OR triad)
 * - Yield badge with color gradient
 * - Quick-hit Gold Standard Dx + First-line Rx badges
 * - Overview snippet for conditions without classic patient
 * - Clinical pearls preview
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { FlaskConical, Pill, Lightbulb, AlertTriangle, Stethoscope, BookOpen } from 'lucide-react';
import { YieldBadge } from '@/components/ui/badges';
import { parseTextField, parseListField } from '@/lib/utils/normalization';
import type { MedicalContentDisplay } from '@/types/medical-content';

interface EnhancedConditionCardProps {
  condition: Partial<MedicalContentDisplay>;
  onClick: () => void;
  isSelected?: boolean;
  className?: string;
}

// Determine what content to show as primary feature
interface DisplayFeature {
  type: 'classic_triad' | 'buzzwords' | 'classic_patient' | 'overview' | 'none';
  content: string | string[];
  icon: React.ElementType;
  label: string;
}

function determineDisplayFeature(condition: Partial<MedicalContentDisplay>): DisplayFeature {
  // Check for classic triad (highest priority if exists)
  const classicTriad = parseListField(condition.classic_triad);
  if (classicTriad.length >= 2) {
    return {
      type: 'classic_triad',
      content: classicTriad,
      icon: AlertTriangle,
      label: 'Classic Triad',
    };
  }

  // Check for distinctive buzzwords
  const buzzwords = parseListField(condition.buzzwords);
  if (buzzwords.length >= 2) {
    return {
      type: 'buzzwords',
      content: buzzwords.slice(0, 4),
      icon: Lightbulb,
      label: 'Key Buzzwords',
    };
  }

  // Classic patient description
  const classicPatient = parseTextField(condition.classic_patient);
  if (classicPatient && classicPatient.length > 20) {
    return {
      type: 'classic_patient',
      content: classicPatient,
      icon: BookOpen,
      label: 'Classic Patient',
    };
  }

  // Fallback to overview snippet
  const overview = parseTextField(condition.overview);
  if (overview && overview.length > 20) {
    return {
      type: 'overview',
      content: overview,
      icon: Stethoscope,
      label: 'Overview',
    };
  }

  return { type: 'none', content: '', icon: Stethoscope, label: '' };
}

/**
 * EnhancedConditionCard - Vertical stacking card with context-aware display
 */
export const EnhancedConditionCard: React.FC<EnhancedConditionCardProps> = ({
  condition,
  onClick,
  isSelected = false,
  className = '',
}) => {
  // Parse fields safely
  const displayFeature = useMemo(() => determineDisplayFeature(condition), [condition]);

  const goldStandard = useMemo(() => 
    parseTextField(condition.gold_standard_dx),
  [condition.gold_standard_dx]);

  const firstLineRx = useMemo(() => 
    parseTextField(condition.first_line_rx),
  [condition.first_line_rx]);

  const bestInitialTest = useMemo(() =>
    parseTextField((condition as Record<string, unknown>).best_initial_test),
  [condition]);

  const clinicalPearls = useMemo(() =>
    parseListField(condition.clinical_pearls).slice(0, 1),
  [condition.clinical_pearls]);

  const hasQuickInfo = goldStandard || firstLineRx || bestInitialTest;
  const Icon = displayFeature.icon;

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.01, y: -2 }}
      whileTap={{ scale: 0.99 }}
      className={`
        w-full text-left rounded-xl overflow-hidden
        bg-[var(--color-glass-bg)] backdrop-blur-lg
        border transition-all duration-200
        ${isSelected
          ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30 shadow-lg shadow-[var(--color-accent)]/10'
          : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/60 hover:shadow-lg'
        }
        ${className}
      `}
    >
      {/* Vertical Layout Container */}
      <div className="flex flex-col">
        
        {/* HEADER: Condition Name + Yield Badge */}
        <div className="flex items-start justify-between gap-2 p-4 pb-2">
          <h3 className="font-semibold text-base text-[var(--color-text-primary)] leading-tight line-clamp-2 flex-1">
            {condition.condition || 'Untitled'}
          </h3>
          <YieldBadge yield={condition.pance_yield ?? null} size="sm" />
        </div>

        {/* PRIMARY FEATURE - Context-aware display */}
        {displayFeature.type !== 'none' && (
          <div className="px-4 pb-3">
            {displayFeature.type === 'classic_triad' && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-rose-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold uppercase tracking-wide">Classic Triad</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(displayFeature.content as string[]).map((item, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium"
                    >
                      {idx + 1}. {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {displayFeature.type === 'buzzwords' && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[var(--color-accent)]">
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold uppercase tracking-wide">Key Buzzwords</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(displayFeature.content as string[]).map((word, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 rounded-md bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30 text-[var(--color-accent)] text-xs font-medium"
                    >
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(displayFeature.type === 'classic_patient' || displayFeature.type === 'overview') && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold uppercase tracking-wide">{displayFeature.label}</span>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed">
                  {displayFeature.content as string}
                </p>
              </div>
            )}
          </div>
        )}

        {/* CLINICAL PEARL (if no primary feature or as supplement) */}
        {clinicalPearls.length > 0 && displayFeature.type === 'none' && (
          <div className="px-4 pb-3">
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border)]/50">
              <Lightbulb className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed">
                {clinicalPearls[0]}
              </p>
            </div>
          </div>
        )}

        {/* QUICK INFO FOOTER: Diagnostic badges */}
        {hasQuickInfo && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-4 pt-1 border-t border-[var(--color-border)]/30 mt-auto">
            {goldStandard && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-medium">
                <FlaskConical className="w-3 h-3" />
                <span className="truncate max-w-[100px]">{goldStandard}</span>
              </span>
            )}
            {firstLineRx && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium">
                <Pill className="w-3 h-3" />
                <span className="truncate max-w-[100px]">{firstLineRx}</span>
              </span>
            )}
            {bestInitialTest && !goldStandard && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-medium">
                <FlaskConical className="w-3 h-3" />
                <span className="truncate max-w-[100px]">{bestInitialTest}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </motion.button>
  );
};

export default EnhancedConditionCard;
