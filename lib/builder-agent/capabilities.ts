/**
 * Honest capability boundary — what the Builder Agent actually does vs placeholders.
 *
 * v1 is a durable orchestration shell with mocked/stub phases for autonomous engineering.
 * Do NOT represent placeholder phases as a working autonomous builder.
 */

export const BUILDER_AGENT_CAPABILITIES = {
  /** Durable run state, FSM, approvals metadata, webhooks, HTTP API */
  orchestration: 'implemented' as const,

  /** Risk classification from objective text heuristics — not LLM-generated */
  specification: 'placeholder' as const,

  /** Static markdown template — not LLM-generated */
  planning: 'placeholder' as const,

  /** No code generation, patch application, or repo mutation in Worker */
  implementation: 'missing' as const,

  /** LocalDev simulates success in tests only; Worker fails closed without Sandbox */
  testing: 'partial' as const,

  /** Mocked in dry-run; unverified live GitHub API when token present */
  pullRequestCreation: 'partial' as const,

  /** No revision loop applying review feedback to code */
  revision: 'placeholder' as const,

  /** Merge/deploy/infra/credential execution blocked (501 or 403) */
  productionMutations: 'blocked' as const,
} as const;

export type CapabilityStatus =
  (typeof BUILDER_AGENT_CAPABILITIES)[keyof typeof BUILDER_AGENT_CAPABILITIES];

export function isPlaceholderCapability(
  key: keyof typeof BUILDER_AGENT_CAPABILITIES
): boolean {
  const status = BUILDER_AGENT_CAPABILITIES[key];
  return status === 'placeholder' || status === 'missing';
}

export const CAPABILITY_SUMMARY =
  'Builder Agent v1 is a durable intake/approval/phase-tracking orchestrator. ' +
  'Specification, planning, implementation, and revision are structured placeholders — ' +
  'not an autonomous code-writing agent. Execution in the Worker requires Cloudflare Sandbox.';
