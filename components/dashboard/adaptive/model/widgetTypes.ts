import type React from 'react';
import type { DashboardContext } from './DashboardContext';
import type { VisualToken } from './visualTokens';

export type WidgetClass =
  | 'command'
  | 'evidence'
  | 'protection'
  | 'forecast'
  | 'triage'
  | 'recovery'
  | 'context'
  | 'trust'
  | 'baseline';

export type DashboardSlot =
  | 'goal_context'
  | 'primary_command'
  | 'primary_evidence'
  | 'secondary_left'
  | 'secondary_right'
  | 'below_fold_primary'
  | 'below_fold_secondary'
  | 'drawer_only'
  | 'progress_tab_only';

export type DashboardMode =
  | 'pance'
  | 'eor'
  | 'didactic'
  | 'panre'
  | 'low_data'
  | 'overloaded'
  | 'behind'
  | 'ahead';

export type WidgetScore = {
  urgency: number;
  goalImpact: number;
  actionability: number;
  evidenceQuality: number;
  novelty: number;
  userStateFit: number;
  anxietyCost: number;
  redundancyPenalty: number;
  alreadyHandledPenalty: number;
  final: number;
};

export type WidgetCadence = {
  maxShowsPerWeek?: number;
  cooldownDays?: number;
  escalationThreshold?: number;
};

export type SelectedWidget<TData = unknown> = {
  id: string;
  class: WidgetClass;
  slot: DashboardSlot;
  score: WidgetScore;
  data: TData;
  visual: VisualToken;
  attribution: string;
  component: React.ComponentType<{ data: TData; visual: VisualToken }>;
  cadence?: WidgetCadence;
};

export type DashboardWidgetDefinition<TData = unknown> = {
  id: string;
  class: WidgetClass;
  allowedSlots: DashboardSlot[];
  eligible: (ctx: DashboardContext) => boolean;
  score: (ctx: DashboardContext) => WidgetScore;
  suppress?: (ctx: DashboardContext, selected: SelectedWidget[]) => boolean;
  build: (ctx: DashboardContext) => TData;
  visual: (data: TData, ctx: DashboardContext) => VisualToken;
  component: React.ComponentType<{ data: TData; visual: VisualToken }>;
  cadence?: WidgetCadence;
  attribution: (ctx: DashboardContext) => string;
};

export type VisualBudget = {
  maxAboveFoldWidgets: number;
  maxInsightCards: number;
  maxPrimaryActions: number;
  maxRedSurfaces: number;
  maxChartsAboveFold: number;
  maxAnimatedElements: number;
  maxTotalMedicalMotifs: number;
};

export type InsightActionState = 'in_plan' | 'needs_action' | 'monitor' | 'protected' | 'reassurance';

export type InsightMicroVisual =
  | { kind: 'segmented-bar'; covered: number; remaining: number; total: number }
  | { kind: 'weighted-meter'; label: string; value: number; target: number }
  | { kind: 'split-contrast'; left: string; right: string; handled: boolean }
  | { kind: 'countdown-rail'; current: number; total: number; label: string }
  | { kind: 'load-meter'; value: number; max: number }
  | { kind: 'calibration-ring'; value: number; label: string }
  | { kind: 'confidence-bars'; confidence: number; accuracy: number }
  | { kind: 'shield'; label: string; value: number };

export type DashboardInsightCandidate = {
  id: string;
  class: WidgetClass;
  signalId: string;
  title: string;
  explanation: string;
  attribution: string;
  actionState: InsightActionState;
  microVisual: InsightMicroVisual;
  urgency: number;
  goalImpact: number;
  actionability: number;
  evidenceQuality: number;
  novelty: number;
  userStateFit: number;
  anxietyCost: number;
  redundancyPenalty: number;
  alreadyHandledPenalty: number;
  /** Optional deep link to related clinical library content. */
  deepLink?: { href: string; label: string };
};

export type DashboardSlots = Partial<Record<DashboardSlot, SelectedWidget[]>>;

export const aboveFoldSlots: DashboardSlot[] = [
  'goal_context',
  'primary_command',
  'primary_evidence',
  'secondary_left',
  'secondary_right',
];

export function isAboveFoldSlot(slot: DashboardSlot): boolean {
  return aboveFoldSlots.includes(slot);
}
