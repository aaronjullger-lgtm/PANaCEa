/**
 * LLM-backed validator factory for the shared quality gate.
 *
 * `createLLMValidator` turns any criteria prompt into a `GateValidator` that
 * returns the structured `{ passed, feedback, score? }` verdict the gate
 * expects. It routes through the unified AI gateway (`gateway.callStructured`)
 * — the canonical production path — so edge endpoints get the same schema
 * repair, tiering, and telemetry as every other AI call.
 *
 * CoVe-style semantics (from `lib/cove-verification.ts` / generate-enhanced):
 * the validator is a *verification* step; failure is not an error — it is
 * feedback for the `improve` refinement of the gate loop.
 *
 * @module lib/agents/quality/llmValidator
 */

import { z } from 'zod';

import { gateway, GatewayError, toGatewayContext } from '@/lib/ai/aiGateway';
import type { GatewayTask, ModelTier } from '@/lib/ai/aiGateway';
import type { AgentContext } from '@/lib/agents/shared/types';
import type { GateValidator, GateVerdict } from './qualityGate';

// ─── Structured verdict schema ──────────────────────────────────────────────

export const GateVerdictSchema = z.object({
  passed: z.boolean(),
  feedback: z.array(z.string()).default([]),
  score: z.number().min(0).max(1).optional(),
});
export type GateVerdictData = z.infer<typeof GateVerdictSchema>;

// ─── Factory ────────────────────────────────────────────────────────────────

export interface LLMValidatorOptions {
  /** Telemetry label for the gateway call (e.g. '/api/questions/generate#quality-gate'). */
  endpoint: string;
  /** Criteria prompt — what "passing" means, plus feedback format guidance. */
  criteriaPrompt: string;
  /** Gateway task (model-tier selector). Default: 'grading' (balanced). */
  task?: GatewayTask;
  /** Explicit tier override. Default: 'balanced'. */
  tier?: ModelTier;
  /** Sampling temperature. Default: 0.1 (deterministic verdicts). */
  temperature?: number;
  /** Max output tokens. Default: 1024. */
  maxOutputTokens?: number;
}

/**
 * Build a `GateValidator` backed by the unified gateway. Never throws — every
 * failure mode (missing key, gateway error, schema repair exhaustion) is
 * returned as a failing `transient` verdict so the gate loop can decide.
 */
export function createLLMValidator(
  options: LLMValidatorOptions,
): GateValidator<unknown> {
  return async (artifact: unknown, ctx: AgentContext): Promise<GateVerdict> => {
    if (!ctx.env?.GEMINI_API_KEY) {
      return {
        passed: false,
        transient: true,
        feedback: ['GEMINI_API_KEY not provided — quality gate disabled'],
      };
    }

    const userPrompt = [
      options.criteriaPrompt,
      '',
      'ARTIFACT TO VERIFY (JSON):',
      JSON.stringify(artifact),
    ].join('\n');

    try {
      const result = await gateway.callStructured(
        toGatewayContext({
          env: ctx.env,
          auth: ctx.userId ? { userId: ctx.userId } : undefined,
        }),
        {
          mode: 'structured',
          task: options.task ?? 'grading',
          tier: options.tier ?? 'balanced',
          endpoint: options.endpoint,
          userPrompt,
          temperature: options.temperature ?? 0.1,
          maxOutputTokens: options.maxOutputTokens ?? 1024,
          schema: GateVerdictSchema,
          schemaDescription:
            'Quality-gate verdict: { passed: boolean, feedback: string[], score?: number }',
        },
      );
      return result.data;
    } catch (err) {
      const code = err instanceof GatewayError ? err.code : 'UNKNOWN';
      return {
        passed: false,
        transient: true,
        feedback: [`validator gateway error: ${code}`],
      };
    }
  };
}

// ─── Reusable criteria prompt (clinical tier) ───────────────────────────────

/**
 * Default criteria for clinical content (questions, condition content, OSCE
 * cases). Mirrors the panacea-clinical-validator concerns: medical accuracy,
 * patient safety, educational scope. Verifiers must NOT offer a diagnosis —
 * they only gate content.
 */
export const CLINICAL_CONTENT_CRITERIA = [
  'You are a clinical content QA verifier for a PA board-prep platform.',
  'Return a PASS verdict ONLY if ALL of the following hold:',
  '1. Medical facts are accurate per current standard-of-care guidance.',
  '2. No drug doses, labs, or scoring thresholds are unsafe or grossly wrong.',
  '3. The artifact is within educational scope (no diagnosis/treatment claims',
  '   directed at a specific patient).',
  '4. The artifact is structurally complete (no truncated or empty sections).',
  '5. The correct answer is unambiguous and matches the rationale.',
  'When FAILING, list each specific defect in `feedback` (one string per defect)',
  'so a refinement step can fix them. Keep feedback itemized and actionable.',
].join('\n');

/** Convenience factory for clinical question/content validation. */
export function createClinicalContentValidator(options: {
  endpoint: string;
  task?: GatewayTask;
  tier?: ModelTier;
}): GateValidator<unknown> {
  return createLLMValidator({
    endpoint: options.endpoint,
    criteriaPrompt: CLINICAL_CONTENT_CRITERIA,
    task: options.task ?? 'grading',
    tier: options.tier ?? 'balanced',
  });
}
