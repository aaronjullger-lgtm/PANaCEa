/**
 * FirstInstinctCard — "Trust Your Gut" widget
 *
 * Shows whether the student benefits from changing answers or should
 * stick with first instinct. Research shows most students hurt their
 * score by switching — this gives personalized, data-driven advice.
 *
 * @module components/dashboard/metacognitive/FirstInstinctCard
 */

import React from 'react';
import type { AnswerSwitchInsight } from '@/hooks/useMetacognitiveStats';

interface Props {
  insight: AnswerSwitchInsight;
}

export const FirstInstinctCard: React.FC<Props> = ({ insight }) => {
  const { totalSwitches, beneficialSwitches, harmfulSwitches, netBenefitRatio, switchRate, totalQuestions } = insight;

  if (totalQuestions < 20) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">First Instinct</h3>
        <p className="text-sm text-[var(--color-text-muted)]">
          Need at least 20 questions to analyze your answer-switching pattern.
        </p>
      </div>
    );
  }

  // Determine the advice
  const switchPct = Math.round(switchRate * 100);
  const isSwitchBeneficial = netBenefitRatio > 0.1;
  const isSwitchHarmful = netBenefitRatio < -0.1;

  let advice: string;
  let accentColor: string;
  if (isSwitchBeneficial) {
    advice = `Switching helps you — ${beneficialSwitches} answers improved vs ${harmfulSwitches} hurt. Your second instinct is reliable.`;
    accentColor = 'text-[var(--color-data-pass)]';
  } else if (isSwitchHarmful) {
    advice = `Your first instinct is stronger — ${harmfulSwitches} switches hurt you vs only ${beneficialSwitches} that helped. Trust your gut more.`;
    accentColor = 'text-[var(--color-data-provisional)]';
  } else {
    advice = `Answer changes are roughly neutral (${beneficialSwitches} helped, ${harmfulSwitches} hurt). Switch only when you spot a clear error.`;
    accentColor = 'text-[var(--color-text-secondary)]';
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">First Instinct</h3>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        You change your answer on {switchPct}% of questions ({totalSwitches} of {totalQuestions})
      </p>

      {/* Bar visual: beneficial vs harmful */}
      {totalSwitches > 0 && (
        <div className="flex items-center gap-1 mb-4 h-3 rounded-full overflow-hidden bg-[var(--color-bg-tertiary)]">
          <div
            className="h-full bg-[var(--color-data-pass)] rounded-l-full transition-all"
            style={{ width: `${(beneficialSwitches / totalSwitches) * 100}%` }}
          />
          <div
            className="h-full bg-[var(--color-data-provisional)] rounded-r-full transition-all"
            style={{ width: `${(harmfulSwitches / totalSwitches) * 100}%` }}
          />
        </div>
      )}

      {totalSwitches > 0 && (
        <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-3">
          <span className="text-[var(--color-data-pass)]">{beneficialSwitches} improved</span>
          <span className="text-[var(--color-data-provisional)]">{harmfulSwitches} hurt</span>
        </div>
      )}

      <p className={`text-sm leading-relaxed ${accentColor}`}>
        {advice}
      </p>
    </div>
  );
};

export default FirstInstinctCard;
