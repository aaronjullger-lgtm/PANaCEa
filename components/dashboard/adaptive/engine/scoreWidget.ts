import type { WidgetScore } from '../model/widgetTypes';

export type WidgetScoreInput = Omit<WidgetScore, 'final'>;

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function scoreWidget(input: WidgetScoreInput): WidgetScore {
  const urgency = clamp01(input.urgency);
  const goalImpact = clamp01(input.goalImpact);
  const actionability = clamp01(input.actionability);
  const evidenceQuality = clamp01(input.evidenceQuality);
  const novelty = clamp01(input.novelty);
  const userStateFit = clamp01(input.userStateFit);
  const anxietyCost = clamp01(input.anxietyCost);
  const redundancyPenalty = clamp01(input.redundancyPenalty);
  const alreadyHandledPenalty = clamp01(input.alreadyHandledPenalty);

  const final =
    0.24 * goalImpact +
    0.20 * urgency +
    0.18 * actionability +
    0.12 * evidenceQuality +
    0.08 * userStateFit +
    0.06 * novelty -
    0.14 * anxietyCost -
    0.14 * redundancyPenalty -
    0.16 * alreadyHandledPenalty;

  return {
    urgency,
    goalImpact,
    actionability,
    evidenceQuality,
    novelty,
    userStateFit,
    anxietyCost,
    redundancyPenalty,
    alreadyHandledPenalty,
    final: Math.round(final * 1000) / 1000,
  };
}

export function scoreInsight(input: WidgetScoreInput): WidgetScore {
  return scoreWidget(input);
}
