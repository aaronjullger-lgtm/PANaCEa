import { describe, expect, it } from 'vitest';
import { assertTransition, isTerminal } from '@/lib/builder-agent/state/transitions';
import { createEvent, type BuilderEventType } from '@/lib/builder-agent/observability/events';
import { createToolRateLimiter, ToolRateLimitError } from '@/lib/builder-agent/tools/guard';

describe('BuilderAgent cancellation', () => {
  it('allows cancel from non-terminal active states', () => {
    for (const from of [
      'intake',
      'analyzing',
      'awaiting_plan_approval',
      'approved',
      'executing',
      'testing',
      'awaiting_pr_review',
      'revising',
      'awaiting_merge_approval',
    ] as const) {
      expect(() => assertTransition(from, 'canceled')).not.toThrow();
    }
  });

  it('marks canceled as terminal', () => {
    expect(isTerminal('canceled')).toBe(true);
  });
});

describe('BuilderAgent agent lifecycle events', () => {
  const lifecycleTypes: BuilderEventType[] = [
    'agent.connected',
    'run.created',
    'run.canceled',
    'workflow.phase',
  ];

  it('defines observability events for connect and disconnect flows', () => {
    for (const type of lifecycleTypes) {
      const event = createEvent(type, 'corr_test', {}, { runId: 'run_test' });
      expect(event.type).toBe(type);
      expect(event.correlationId).toBe('corr_test');
    }
  });
});

describe('BuilderAgent tool rate limiting', () => {
  it('enforces per-tool call limits within a window', () => {
    const limiter = createToolRateLimiter(2, 60_000);
    limiter.check('github');
    limiter.check('github');
    expect(() => limiter.check('github')).toThrow(ToolRateLimitError);
    limiter.reset('github');
    expect(() => limiter.check('github')).not.toThrow();
  });
});
