/**
 * EnhancedConditionCard - Rich preview card for Clinical Reference Library
 * 
 * Features:
 * - Smart content-type detection (buzzwords vs clinical pearls vs triad)
 * - Yield badge with color gradient
 * - Quick-hit Gold Standard Dx + First-line Rx badges
 * - Consistent card sizing with min/max width
 * - Left accent bar based on content type
 * - Enhanced hover micro-interactions
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { FlaskConical, Pill, Lightbulb, AlertTriangle, Stethoscope, BookOpen, FileText } from 'lucide-react';
import { YieldBadge } from '@/components/ui/badges';
import { parseTextField, parseListField } from '@/lib/utils/normalization';
import type { MedicalContentDisplay } from '@/types/medical-content';

interface EnhancedConditionCardProps {
  condition: Partial<MedicalContentDisplay>;
  onClick: () => void;
  isSelected?: boolean;
  className?: string;
}

// Helper to check if content looks like buzzwords (short terms) vs clinical pearls (sentences)
function areActualBuzzwords(items: string[]): boolean {
  if (items.length === 0) return false;
  // Buzzwords should be short (< 50 chars), no full stops, typically 1-5 words
  const shortItems = items.filter(item => 
    item.length < 50 && 
    !item.includes('.') && 
    item.split(' ').length <= 6
  );
  // At least 60% should be short to consider them buzzwords
  return shortItems.length >= items.length * 0.6;
}

// Determine what content to show as primary feature
interface DisplayFeature {
  type: 'classic_triad' | 'buzzwords' | 'clinical_pearls' | 'classic_patient' | 'overview' | 'none';
  content: string | string[];
  icon: React.ElementType;
  label: string;
  accentColor: string;
  bgGradient: string;
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
      accentColor: 'rose',
      bgGradient: 'from-rose-500/5 to-transparent',
    };
  }

  // Check for distinctive buzzwords - but verify they're actually short terms
  const buzzwords = parseListField(condition.buzzwords);
  if (buzzwords.length >= 2 && areActualBuzzwords(buzzwords)) {
    return {
      type: 'buzzwords',
      content: buzzwords.slice(0, 4),
      icon: Lightbulb,
      label: 'Key Buzzwords',
      accentColor: 'cyan',
      bgGradient: 'from-cyan-500/5 to-transparent',
    };
  }

  // Check clinical pearls - show as pearls if buzzwords were long sentences
  const clinicalPearls = parseListField(condition.clinical_pearls);
  // Also treat long "buzzwords" as pearls
  const pearlsToShow = clinicalPearls.length > 0 
    ? clinicalPearls 
    : (buzzwords.length > 0 && !areActualBuzzwords(buzzwords) ? buzzwords : []);
  
  if (pearlsToShow.length > 0) {
    return {
      type: 'clinical_pearls',
      content: pearlsToShow.slice(0, 4),
      icon: Lightbulb,
      label: 'Key Buzzwords',
      accentColor: 'cyan',
      bgGradient: 'from-cyan-500/5 to-transparent',
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
      accentColor: 'violet',
      bgGradient: 'from-violet-500/5 to-transparent',
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
      accentColor: 'slate',
      bgGradient: 'from-slate-500/5 to-transparent',
    };
  }

  return { 
    type: 'none', 
    content: '', 
    icon: FileText, 
    label: '',
    accentColor: 'slate',
    bgGradient: 'from-slate-500/5 to-transparent',
  };
}

// Get accent border color class
function getAccentBorderClass(accentColor: string): string {
  const colorMap: Record<string, string> = {
    rose: 'border-l-rose-500',
    cyan: 'border-l-cyan-500',
    violet: 'border-l-violet-500',
    amber: 'border-l-amber-500',
    emerald: 'border-l-emerald-500',
    slate: 'border-l-slate-500',
  };
  return colorMap[accentColor] || 'border-l-slate-500';
}

// Get accent text color class
function getAccentTextClass(accentColor: string): string {
  const colorMap: Record<string, string> = {
    rose: 'text-rose-400',
    cyan: 'text-cyan-400',
    violet: 'text-violet-400',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    slate: 'text-slate-400',
  };
  return colorMap[accentColor] || 'text-slate-400';
}

// Get pill style classes
function getPillClasses(accentColor: string): string {
  const colorMap: Record<string, string> = {
    rose: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
    cyan: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300',
    violet: 'bg-violet-500/15 border-violet-500/30 text-violet-300',
    amber: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
    emerald: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
    slate: 'bg-slate-500/15 border-slate-500/30 text-slate-300',
  };
  return colorMap[accentColor] || 'bg-slate-500/15 border-slate-500/30 text-slate-300';
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

  const hasQuickInfo = goldStandard || firstLineRx || bestInitialTest;
  const accentBorderClass = getAccentBorderClass(displayFeature.accentColor);
  const accentTextClass = getAccentTextClass(displayFeature.accentColor);
  const pillClasses = getPillClasses(displayFeature.accentColor);

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02, y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`
        w-full text-left rounded-xl overflow-hidden
        bg-gradient-to-br ${displayFeature.bgGradient}
        bg-[var(--color-glass-bg)] backdrop-blur-lg
        border border-l-[3px] transition-all duration-300
        ${accentBorderClass}
        ${isSelected
          ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30 shadow-xl shadow-[var(--color-accent)]/15'
          : 'border-[var(--color-border)]/60 hover:border-[var(--color-border)] hover:shadow-xl hover:shadow-black/20'
        }
        ${className}
      `}
    >
      {/* Vertical Layout Container */}
      <div className="flex flex-col h-full min-h-[180px]">
        
        {/* HEADER: Condition Name + Yield Badge */}
        <div className="flex items-start justify-between gap-3 p-4 pb-2">
          <h3 className="font-bold text-base text-[var(--color-text-primary)] leading-snug line-clamp-2 flex-1">
            {condition.condition || 'Untitled'}
          </h3>
          <YieldBadge yield={condition.pance_yield ?? null} size="sm" />
        </div>

        {/* PRIMARY FEATURE - Context-aware display */}
        <div className="px-4 pb-3 flex-1">
          {/* CLASSIC TRIAD - Numbered pills */}
          {displayFeature.type === 'classic_triad' && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-xs font-semibold uppercase tracking-wide text-rose-400">Classic Triad</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {(displayFeature.content as string[]).map((item, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium leading-relaxed"
                  >
                    {idx + 1}. {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* BUZZWORDS - Short term pills */}
          {displayFeature.type === 'buzzwords' && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-semibold uppercase tracking-wide text-cyan-400">Key Buzzwords</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(displayFeature.content as string[]).map((word, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-medium"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* CLINICAL PEARLS - Stacked sentence cards */}
          {displayFeature.type === 'clinical_pearls' && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-semibold uppercase tracking-wide text-cyan-400">Key Buzzwords</span>
              </div>
              <div className="space-y-1.5">
                {(displayFeature.content as string[]).map((pearl, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-2 rounded-lg bg-cyan-500/8 border border-cyan-500/15 text-cyan-300 text-xs leading-relaxed"
                  >
                    {pearl}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CLASSIC PATIENT / OVERVIEW - Text block */}
          {(displayFeature.type === 'classic_patient' || displayFeature.type === 'overview') && (
            <div className="space-y-1.5">
              <div className={`flex items-center gap-1.5 ${accentTextClass}`}>
                {displayFeature.type === 'classic_patient' ? (
                  <BookOpen className="w-3.5 h-3.5" />
                ) : (
                  <Stethoscope className="w-3.5 h-3.5" />
                )}
                <span className="text-xs font-semibold uppercase tracking-wide">{displayFeature.label}</span>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] line-clamp-4 leading-relaxed">
                {displayFeature.content as string}
              </p>
            </div>
          )}

          {/* EMPTY STATE - Show condition name prominently when no features */}
          {displayFeature.type === 'none' && (
            <div className="flex items-center justify-center h-full min-h-[60px] text-center">
              <p className="text-xs text-[var(--color-text-muted)] italic">
                Select to view details →
              </p>
            </div>
          )}
        </div>

        {/* QUICK INFO FOOTER: Diagnostic badges */}
        {hasQuickInfo && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-4 pt-2 border-t border-[var(--color-border)]/20 mt-auto bg-gradient-to-t from-black/5 to-transparent">
            {goldStandard && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-medium">
                <FlaskConical className="w-3 h-3 flex-shrink-0" />
                <span className="truncate max-w-[120px]">{goldStandard}</span>
              </span>
            )}
            {firstLineRx && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium">
                <Pill className="w-3 h-3 flex-shrink-0" />
                <span className="truncate max-w-[120px]">{firstLineRx}</span>
              </span>
            )}
            {bestInitialTest && !goldStandard && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-medium">
                <FlaskConical className="w-3 h-3 flex-shrink-0" />
                <span className="truncate max-w-[120px]">{bestInitialTest}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </motion.button>
  );
};

export default EnhancedConditionCard;
