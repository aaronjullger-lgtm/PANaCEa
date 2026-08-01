/**
 * Shared quality-gate service — the programmatic Dev↔QA loop.
 *
 * Every generated artifact (questions, condition content, OSCE cases) can be
 * routed through `runQualityGate` before it enters the reservoir/staging lake:
 *
 *   validator → PASS  ⇒ artifact proceeds
 *   validator → FAIL  ⇒ optional `improve` refinement, retry (budget ≤ 3)
 *   budget exhausted  ⇒ artifact is QUARANTINED (never reaches learners)
 *
 * This is the reusable, agent-agnostic core behind the CoVe pipeline in
 * `lib/cove-verification.ts` (question-specific) and the LLM validator factory
 * in `./llmValidator.ts`. The validator is injected so the gate is fully
 * deterministic in tests and trivially swappable per content type.
 *
 * Design notes (from the agent-orchestration research, §7 Phase 2):
 * - Structured PASS/FAIL + feedback, never free-text verdicts.
 * - Retry budget clamped to ≤ 3 to bound worst-case LLM spend.
 * - Quarantine is a distinct outcome — the caller decides what quarantine
 *   means for its pipeline (staging flag, skip write, review queue).
 *
 * @module lib/agents/quality/qualityGate
 */

import type { AgentContext } from '@/lib/agents/shared/types';

// ─── Verdict & validator contracts ──────────────────────────────────────────

export interface GateVerdict {
  /** true ⇒ artifact may proceed; false ⇒ refine/retry or quarantine. */
  passed: boolean;
  /** Human-readable feedback items — fed back to `improve` and kept for telemetry. */
  feedback: string[];
  /** Optional 0–1 quality score produced by the validator. */
  score?: number;
  /** true when the validator failed for infrastructure reasons (rate limit,
   *  gateway error) rather than content quality. Callers may treat this
   *  differently (e.g. do NOT quarantine on transient failures). */
  transient?: boolean;
}

export type GateValidator<T> = (
  artifact: T,
  ctx: AgentContext,
) => Promise<GateVerdict> | GateVerdict;

/** Refine the artifact between failed attempts, using the validator feedback. */
export type GateImprover<T> = (
  artifact: T,
  feedback: string[],
  attempt: number,
  ctx: AgentContext,
) => Promise<T> | T;

// ─── Options & result ───────────────────────────────────────────────────────

export interface QualityGateOptions<T> {
  /** Verdict source — injected for testability; LLM-backed via `llmValidator`. */
  validator: GateValidator<T>;
  /** Optional refinement step run between failed attempts. */
  improve?: GateImprover<T>;
  /** Retry budget AFTER the first attempt. Clamped to [0, 3]. Default: 2. */
  maxRetries?: number;
  /** Optional structured-logger hook (same shape as AgentContext.log). */
  log?: (level: 'info' | 'warn' | 'error', message: string, data?: unknown) => void;
}

/** Hard cap on the retry budget — bounds worst-case cost of the gate. */
export const MAX_GATE_RETRIES = 3;

export type QualityGateResult<T> =
  | {
      outcome: 'pass';
      artifact: T;
      attempts: number;
      /** Verdict of the final (passing) attempt. */
      verdict: GateVerdict;
      /** All feedback accumulated across attempts (empty on first-pass). */
      feedback: string[];
    }
  | {
      outcome: 'quarantine';
      artifact: T;
      attempts: number;
      /** Verdict of the final (still failing) attempt. */
      verdict: GateVerdict;
      /** All feedback accumulated across attempts. */
      feedback: string[];
    };

export interface QualityGateRun {
  <T>(artifact: T, options: QualityGateOptions<T>, ctx: AgentContext): Promise<QualityGateResult<T>>;
}

// ─── Core loop ──────────────────────────────────────────────────────────────

export function clampRetries(maxRetries: number | undefined): number {
  if (maxRetries === undefined) return 2;
  if (!Number.isFinite(maxRetries)) return 0;
  return Math.max(0, Math.min(MAX_GATE_RETRIES, Math.floor(maxRetries)));
}

/**
 * Run the validator loop. Never throws — validator exceptions are converted
 * into failing (transient) verdicts so one bad validator call cannot crash a
 * generation pipeline.
 */
export async function runQualityGate<T>(
  artifact: T,
  options: QualityGateOptions<T>,
  ctx: AgentContext,
): Promise<QualityGateResult<T>> {
  const { validator, improve, log } = options;
  const maxRetries = clampRetries(options.maxRetries);
  const feedback: string[] = [];

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    let verdict: GateVerdict;
    try {
      verdict = await validator(artifact, ctx);
    } catch (err) {
      verdict = {
        passed: false,
        transient: true,
        feedback: [
          `validator threw: ${err instanceof Error ? err.message : String(err)}`,
        ],
      };
    }

    if (verdict.feedback) feedback.push(...verdict.feedback);

    if (verdict.passed) {
      log?.('info', `[quality-gate] PASS on attempt ${attempt}`, { attempts: attempt });
      return { outcome: 'pass', artifact, attempts: attempt, verdict, feedback };
    }

    log?.('warn', `[quality-gate] FAIL on attempt ${attempt}/${maxRetries + 1}`, {
      transient: verdict.transient ?? false,
      feedbackCount: verdict.feedback.length,
    });

    const exhausted = attempt > maxRetries;
    // Retry when refinement exists (content may improve), or when the
    // failure was transient (infra may have recovered). A non-transient
    // FAIL with no improve step cannot be fixed by re-running — quarantine.
    const canRetry = !exhausted && (Boolean(improve) || verdict.transient === true);
    if (!canRetry) {
      return {
        outcome: 'quarantine',
        artifact,
        attempts: attempt,
        verdict,
        feedback,
      };
    }

    if (improve) {
      artifact = await improve(artifact, verdict.feedback, attempt, ctx);
    }
  }

  // Unreachable — the loop always returns inside. Kept for type narrowing.
  throw new Error('unreachable: quality gate loop terminated without a result');
}

/**
 * Convenience no-op gate used when quality checking is disabled (env-gated
 * wiring). Keeps call sites uniform: `const gate = qualityGateEnabled
 * ? runQualityGate : noOpQualityGate`.
 */
export const noOpQualityGate: QualityGateRun = async <T>(
  artifact: T,
): Promise<QualityGateResult<T>> => ({
  outcome: 'pass',
  artifact,
  attempts: 0,
  verdict: { passed: true, feedback: [] },
  feedback: [],
});
