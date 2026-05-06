import type { VisualBudget } from './widgetTypes';

export type VisualTone =
  | 'safe'
  | 'watch'
  | 'act'
  | 'critical'
  | 'forecast'
  | 'neutral'
  | 'recovery'
  | 'baseline';

export type TexturePattern =
  | 'none'
  | 'clinical-grid'
  | 'ekg-paper'
  | 'alveolar'
  | 'vascular-branch'
  | 'nephron-loop'
  | 'synaptic'
  | 'histology-dots'
  | 'mucosal-fold'
  | 'bone-lattice'
  | 'contour'
  | 'split-contrast';

export type MedicalMotif =
  | 'lungs'
  | 'alveoli'
  | 'heart'
  | 'vascular'
  | 'kidney'
  | 'nephron'
  | 'brain'
  | 'synapse'
  | 'gi-folds'
  | 'bone-lattice'
  | 'blood-smear'
  | 'skin-layers'
  | 'endocrine-axis'
  | 'shield'
  | 'target'
  | 'none';

export type VisualToken = {
  tone: VisualTone;
  motif: MedicalMotif;
  texture: TexturePattern;
  density: 'quiet' | 'standard' | 'rich';
  elevation: 'flat' | 'raised' | 'command';
  motion: 'none' | 'enter' | 'draw-line' | 'pulse-once';
};

export const standardVisualBudget: VisualBudget = {
  maxAboveFoldWidgets: 5,
  maxInsightCards: 3,
  maxPrimaryActions: 1,
  maxRedSurfaces: 1,
  maxChartsAboveFold: 2,
  maxAnimatedElements: 1,
  maxTotalMedicalMotifs: 3,
};

export const quietVisualBudget: VisualBudget = {
  ...standardVisualBudget,
  maxAboveFoldWidgets: 4,
  maxInsightCards: 2,
  maxChartsAboveFold: 1,
  maxAnimatedElements: 1,
  maxTotalMedicalMotifs: 3,
};

export const baselineVisualToken: VisualToken = {
  tone: 'baseline',
  motif: 'target',
  texture: 'contour',
  density: 'quiet',
  elevation: 'flat',
  motion: 'none',
};

export function getToneClass(tone: VisualTone): string {
  switch (tone) {
    case 'safe':
      return 'border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-text)]';
    case 'watch':
      return 'border-[var(--color-risk-border)] bg-[var(--color-risk-bg)] text-[var(--color-risk-text)]';
    case 'act':
      return 'border-[var(--color-accent-border)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]';
    case 'critical':
      return 'border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]';
    case 'forecast':
      return 'border-[var(--color-accent-border)] bg-[var(--color-accent)]/8 text-[var(--color-text-primary)]';
    case 'recovery':
      return 'border-[var(--color-risk-border)] bg-[var(--color-risk-bg)] text-[var(--color-risk-text)]';
    case 'baseline':
      return 'border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]';
    case 'neutral':
    default:
      return 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]';
  }
}

export function visualTokenForSignal(signal: string, density: VisualToken['density'] = 'standard'): VisualToken {
  switch (signal) {
    case 'retention_protection':
      return { tone: 'safe', motif: 'shield', texture: 'clinical-grid', density, elevation: 'raised', motion: 'none' };
    case 'pulmonary_repair':
      return { tone: 'act', motif: 'lungs', texture: 'alveolar', density, elevation: 'command', motion: 'enter' };
    case 'renal_decay':
      return { tone: 'watch', motif: 'nephron', texture: 'nephron-loop', density, elevation: 'raised', motion: 'none' };
    case 'cardio_transfer':
      return { tone: 'watch', motif: 'heart', texture: 'vascular-branch', density, elevation: 'raised', motion: 'none' };
    case 'confusion_pair':
      return { tone: 'act', motif: 'target', texture: 'split-contrast', density, elevation: 'raised', motion: 'none' };
    case 'readiness_forecast':
      return { tone: 'forecast', motif: 'target', texture: 'contour', density, elevation: 'flat', motion: 'draw-line' };
    case 'load_guardrail':
      return { tone: 'recovery', motif: 'shield', texture: 'clinical-grid', density: 'quiet', elevation: 'raised', motion: 'none' };
    case 'low_data':
      return baselineVisualToken;
    case 'maintenance':
      return { tone: 'safe', motif: 'shield', texture: 'clinical-grid', density: 'quiet', elevation: 'flat', motion: 'none' };
    default:
      return { tone: 'neutral', motif: 'none', texture: 'clinical-grid', density, elevation: 'flat', motion: 'none' };
  }
}
