/**
 * Learner-Stage-Aware Blueprint Resolver
 *
 * Determines which ExamBlueprintSystem weights to use based on the user's
 * training phase, current rotation, and exam dates. Supports:
 *
 *   - DIDACTIC students: cumulative content up to their current semester
 *   - CLINICAL students: blended EOR rotation + PANCE baseline
 *   - PANCE prep: full PANCE blueprint
 *   - PANRE: dedicated PANRE blueprint
 *
 * Key design principle: The student always has PANCE-baseline access, but the
 * system weights are shifted toward what's most relevant RIGHT NOW. This prevents
 * the "exam tunnel vision" problem where a student on Psych rotation forgets
 * everything about Cardio.
 */

import type { PrismaClient } from '@prisma/client';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Exam blueprint types matching the ExamBlueprintSystem.examType column */
export type ExamType =
  | 'PANCE'
  | 'PANRE'
  | 'EOR_IM'
  | 'EOR_SURG'
  | 'EOR_PEDS'
  | 'EOR_WH'
  | 'EOR_PSYCH'
  | 'EOR_EM'
  | 'EOR_FM';
/** Learner stages that determine blueprint resolution */
export type LearnerStage =
  | 'didactic_early'    // Semester 1-2: foundational systems only
  | 'didactic_late'     // Semester 3-4: all systems, lower complexity
  | 'clinical_rotation' // On an EOR rotation: blended EOR + PANCE
  | 'pance_prep'        // Dedicated PANCE study period
  | 'panre'             // Practicing PA recertification
  | 'general';          // Fallback: full PANCE blueprint

/** Resolved blueprint ready for the question selector */
export interface ResolvedBlueprint {
  /** The exam type(s) driving this blueprint */
  examTypes: ExamType[];
  /** The learner's current stage */
  stage: LearnerStage;
  /** Final blended weights by system (sum ≈ 1.0) */
  weights: Record<string, number>;
  /** Systems the learner has NOT yet been exposed to (didactic gating) */
  gatedSystems: string[];
  /** Days until the relevant exam (null if no date set) */
  daysToExam: number | null;
  /** Human-readable label for the UI */
  label: string;
  /**
   * Exam urgency multiplier (0.5–2.0). Higher = closer to exam.
   * Used by the session generator to increase session sizes and
   * by FSRS to tighten review intervals when an exam is imminent.
   */
  urgencyMultiplier: number;
}
/**
 * Didactic curriculum gating: which systems are introduced by semester.
 * Students only see questions for systems they've been taught.
 * Semesters are approximate — schools vary, but this covers the common pattern.
 */
const DIDACTIC_SEMESTER_SYSTEMS: Record<number, string[]> = {
  1: [
    'Cardiovascular', 'Pulmonary', 'Gastrointestinal', 'Musculoskeletal',
    'HEENT', 'Dermatology',
  ],
  2: [
    'Cardiovascular', 'Pulmonary', 'Gastrointestinal', 'Musculoskeletal',
    'HEENT', 'Dermatology', 'Neurological', 'Endocrine', 'Psychiatry',
    'Hematology',
  ],
  3: [
    'Cardiovascular', 'Pulmonary', 'Gastrointestinal', 'Musculoskeletal',
    'HEENT', 'Dermatology', 'Neurological', 'Endocrine', 'Psychiatry',
    'Hematology', 'Infectious Disease', 'Reproductive', 'Nephrology',
    'Genitourinary',
  ],
  // Semester 4+ = all systems
};

/** All 15 canonical systems */
const ALL_SYSTEMS = [
  'Cardiovascular', 'Pulmonary', 'Gastrointestinal', 'Musculoskeletal',
  'HEENT', 'Reproductive', 'Neurological', 'Psychiatry', 'Endocrine',
  'Dermatology', 'Genitourinary', 'Hematology', 'Infectious Disease',
  'Nephrology', 'Emergency Medicine',
];
// ─── Rotation Mapping ────────────────────────────────────────────────────────

/** Maps common rotation names (from User.currentRotation) to EOR exam types */
const ROTATION_TO_EOR: Record<string, ExamType> = {
  'internal medicine': 'EOR_IM',
  'internal med': 'EOR_IM',
  'im': 'EOR_IM',
  'medicine': 'EOR_IM',
  'surgery': 'EOR_SURG',
  'general surgery': 'EOR_SURG',
  'surg': 'EOR_SURG',
  'pediatrics': 'EOR_PEDS',
  'peds': 'EOR_PEDS',
  "women's health": 'EOR_WH',
  'ob/gyn': 'EOR_WH',
  'obgyn': 'EOR_WH',
  'ob-gyn': 'EOR_WH',
  'womens health': 'EOR_WH',
  'psychiatry': 'EOR_PSYCH',
  'psych': 'EOR_PSYCH',
  'behavioral medicine': 'EOR_PSYCH',
  'behavioral health': 'EOR_PSYCH',
  'emergency medicine': 'EOR_EM',
  'em': 'EOR_EM',
  'emergency': 'EOR_EM',
  'family medicine': 'EOR_FM',
  'family med': 'EOR_FM',
  'fm': 'EOR_FM',
  'primary care': 'EOR_FM',
};
// ─── Core Resolver ───────────────────────────────────────────────────────────

/**
 * Resolve the active exam blueprint based on the user's profile.
 *
 * Resolution order:
 * 1. If lifecycleRole === 'PRACTICING_PA' → PANRE
 * 2. If trainingPhase === 'CLINICAL' && currentRotation set → blended EOR + PANCE
 * 3. If trainingPhase === 'DIDACTIC' → gated PANCE by semester
 * 4. Fallback → full PANCE
 *
 * The blending formula for clinical students:
 *   weight[system] = (EOR_BLEND * eorWeight) + ((1 - EOR_BLEND) * panceWeight)
 *
 * This ensures they're studying rotation-heavy content while maintaining
 * PANCE breadth. The blend factor increases as the EOR approaches.
 */
export async function resolveBlueprint(
  prisma: PrismaClient,
  user: {
    id: string;
    trainingPhase?: string | null;
    lifecycleRole?: string | null;
    currentRotation?: string | null;
    rotationEndDate?: Date | null;
    eorTestDate?: Date | null;
    examDate?: Date | null;
    yearInProgram?: string | number | null;
  }
): Promise<ResolvedBlueprint> {  // ── 1. PANRE (practicing PA) ──
  if (user.lifecycleRole === 'PRACTICING_PA') {
    const weights = await loadBlueprintWeights(prisma, 'PANRE');
    const daysToExam = user.examDate ? daysUntil(user.examDate) : null;
    return {
      examTypes: ['PANRE'],
      stage: 'panre',
      weights,
      gatedSystems: [],
      daysToExam,
      label: 'PANRE Recertification',
      urgencyMultiplier: calculateUrgency(daysToExam),
    };
  }

  // ── 2. Clinical rotation → blended EOR + PANCE ──
  if (user.trainingPhase === 'CLINICAL' && user.currentRotation) {
    const eorType = resolveEorType(user.currentRotation);

    if (eorType) {
      const [eorWeights, panceWeights] = await Promise.all([
        loadBlueprintWeights(prisma, eorType),
        loadBlueprintWeights(prisma, 'PANCE'),
      ]);

      // Blend factor ramps as EOR approaches
      const daysToEor = user.eorTestDate
        ? daysUntil(user.eorTestDate)
        : user.rotationEndDate
          ? daysUntil(user.rotationEndDate)
          : null;
      let eorBlend: number;
      if (daysToEor !== null && daysToEor <= 7) {
        eorBlend = 0.85; // Last week: heaviest EOR emphasis
      } else if (daysToEor !== null && daysToEor <= 14) {
        eorBlend = 0.75; // Last 2 weeks: heavy EOR
      } else {
        eorBlend = 0.55; // Default: slight EOR tilt
      }

      const blended = blendWeights(eorWeights, panceWeights, eorBlend);

      return {
        examTypes: [eorType, 'PANCE'],
        stage: 'clinical_rotation',
        weights: blended,
        gatedSystems: [], // Clinical students have seen all systems
        daysToExam: daysToEor,
        label: `${formatRotationName(user.currentRotation)} EOR + PANCE`,
        urgencyMultiplier: calculateUrgency(daysToEor),
      };
    }
  }

  // ── 3. Dedicated PANCE prep (clinical phase, no active rotation) ──
  if (user.trainingPhase === 'CLINICAL' || user.trainingPhase === 'GRADUATED') {
    const weights = await loadBlueprintWeights(prisma, 'PANCE');
    const daysToExam = user.examDate ? daysUntil(user.examDate) : null;
    return {
      examTypes: ['PANCE'],
      stage: 'pance_prep',
      weights,
      gatedSystems: [],
      daysToExam,
      label: 'PANCE Preparation',
      urgencyMultiplier: calculateUrgency(daysToExam),
    };
  }
  // ── 4. Didactic student → gated PANCE ──
  if (user.trainingPhase === 'DIDACTIC') {
    // yearInProgram might be a string from Prisma — coerce to number
    const yearRaw = typeof user.yearInProgram === 'string'
      ? parseInt(user.yearInProgram, 10)
      : user.yearInProgram;
    const semester = yearRaw
      ? Math.min(yearRaw * 2, 4) // Convert year to semester (rough)
      : 2; // Default to semester 2

    const stage: LearnerStage = semester <= 2 ? 'didactic_early' : 'didactic_late';
    const allowedSystems = DIDACTIC_SEMESTER_SYSTEMS[semester] ?? ALL_SYSTEMS;
    const gatedSystems = ALL_SYSTEMS.filter(s => !allowedSystems.includes(s));

    // Load PANCE weights, then zero out gated systems and renormalize
    const rawWeights = await loadBlueprintWeights(prisma, 'PANCE');
    const gatedWeights = gateSystems(rawWeights, allowedSystems);

    const daysToExam = user.examDate ? daysUntil(user.examDate) : null;
    return {
      examTypes: ['PANCE'],
      stage,
      weights: gatedWeights,
      gatedSystems,
      daysToExam,
      label: `Didactic (Semester ${semester})`,
      urgencyMultiplier: calculateUrgency(daysToExam),
    };
  }

  // ── 5. Fallback → full PANCE ──
  const weights = await loadBlueprintWeights(prisma, 'PANCE');
  const daysToExam = user.examDate ? daysUntil(user.examDate) : null;
  return {
    examTypes: ['PANCE'],
    stage: 'general',
    weights,
    gatedSystems: [],
    daysToExam,
    label: 'Adaptive Study',
    urgencyMultiplier: calculateUrgency(daysToExam),
  };
}
// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Calculate exam urgency multiplier from days remaining.
 *
 * Returns a value between 0.5 (no exam / far away) and 2.0 (exam imminent).
 * Thresholds:
 *   <= 3 days  → 2.0  (cram mode)
 *   <= 7 days  → 1.7  (high urgency)
 *   <= 14 days → 1.4  (moderate urgency)
 *   <= 30 days → 1.2  (mild urgency)
 *   <= 60 days → 1.0  (normal)
 *   > 60 days  → 0.8  (relaxed)
 *   null       → 0.5  (no exam date set)
 */
function calculateUrgency(daysToExam: number | null): number {
  if (daysToExam === null) return 0.5;
  if (daysToExam <= 0) return 2.0;
  if (daysToExam <= 3) return 2.0;
  if (daysToExam <= 7) return 1.7;
  if (daysToExam <= 14) return 1.4;
  if (daysToExam <= 30) return 1.2;
  if (daysToExam <= 60) return 1.0;
  return 0.8;
}

/** Load blueprint weights from ExamBlueprintSystem, falling back to hardcoded PANCE */
async function loadBlueprintWeights(
  prisma: PrismaClient,
  examType: ExamType
): Promise<Record<string, number>> {
  const rows = await prisma.examBlueprintSystem.findMany({
    where: { examType },
    select: { system: true, targetPercent: true },
  });

  if (rows.length === 0) {
    // Fallback to hardcoded PANCE blueprint
    const { NCCPA_2025_BLUEPRINT } = await import('../constants/blueprint');
    return { ...NCCPA_2025_BLUEPRINT };
  }

  const weights: Record<string, number> = {};
  for (const row of rows) {
    weights[row.system] = row.targetPercent;
  }
  return weights;
}
/** Blend two weight maps: result[s] = blend * a[s] + (1-blend) * b[s] */
function blendWeights(
  primary: Record<string, number>,
  secondary: Record<string, number>,
  blendFactor: number
): Record<string, number> {
  const allSystems = new Set([...Object.keys(primary), ...Object.keys(secondary)]);
  const result: Record<string, number> = {};
  let total = 0;

  for (const sys of allSystems) {
    const p = primary[sys] ?? 0;
    const s = secondary[sys] ?? 0;
    result[sys] = blendFactor * p + (1 - blendFactor) * s;
    total += result[sys];
  }

  // Renormalize to sum = 1.0
  if (total > 0) {
    for (const sys of Object.keys(result)) {
      result[sys] /= total;
    }
  }

  return result;
}

/** Zero out gated systems and renormalize remaining weights */
function gateSystems(
  weights: Record<string, number>,
  allowedSystems: string[]
): Record<string, number> {
  const result: Record<string, number> = {};
  let total = 0;

  for (const [sys, w] of Object.entries(weights)) {
    if (allowedSystems.includes(sys)) {
      result[sys] = w;
      total += w;
    }
  }

  // Renormalize
  if (total > 0) {
    for (const sys of Object.keys(result)) {
      result[sys] /= total;
    }
  }

  return result;
}
/** Resolve a rotation name string to its EOR exam type (exact + fuzzy match) */
function resolveEorType(rotation: string): ExamType | null {
  const normalized = rotation.toLowerCase().trim().replace(/[^a-z\s/]/g, '');

  // Exact match first
  if (ROTATION_TO_EOR[normalized]) return ROTATION_TO_EOR[normalized];

  // Fuzzy: check if any key is a substring of the input (or vice versa)
  for (const [key, eorType] of Object.entries(ROTATION_TO_EOR)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return eorType;
    }
  }

  return null;
}

/** Calculate days from now until a target date (never returns < 0 for urgency) */
function daysUntil(date: Date): number {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/** Safe days-until that floors at 0 (use for display/urgency, not transition logic) */
export function daysUntilSafe(date: Date): number {
  return Math.max(0, daysUntil(date));
}

/** Format rotation name for display */
function formatRotationName(rotation: string): string {
  return rotation
    .split(/[\s_-]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
/**
 * Check if a clinical rotation has ended and should transition to PANCE prep.
 * Returns a transition notice if the rotation end date is in the past,
 * so the UI can inform the user their study mode has shifted.
 */
export function checkRotationTransition(user: {
  trainingPhase?: string | null;
  currentRotation?: string | null;
  rotationEndDate?: Date | null;
  eorTestDate?: Date | null;
}): { shouldTransition: boolean; message: string | null } {
  if (user.trainingPhase !== 'CLINICAL' || !user.currentRotation) {
    return { shouldTransition: false, message: null };
  }

  const eorDate = user.eorTestDate ?? user.rotationEndDate;
  if (!eorDate) return { shouldTransition: false, message: null };

  const daysLeft = daysUntil(eorDate);

  if (daysLeft < -7) {
    // Rotation ended more than a week ago — nudge user to update profile
    return {
      shouldTransition: true,
      message: `Your ${formatRotationName(user.currentRotation)} rotation ended ${Math.abs(daysLeft)} days ago. Update your profile to switch to your next rotation or PANCE prep mode.`,
    };
  }

  if (daysLeft < 0) {
    // Rotation just ended — soft transition notice
    return {
      shouldTransition: true,
      message: `Your ${formatRotationName(user.currentRotation)} EOR has passed. Switching to PANCE prep mode. Update your profile when you start your next rotation.`,
    };
  }

  return { shouldTransition: false, message: null };
}

export default {
  resolveBlueprint,
  checkRotationTransition,
  calculateUrgency,
  daysUntilSafe,
  DIDACTIC_SEMESTER_SYSTEMS,
  ROTATION_TO_EOR,
  ALL_SYSTEMS,
};