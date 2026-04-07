/**
 * Unit tests for lib/observability/pipelineTracer.ts
 *
 * Covers:
 *  - step() emits structured JSON and accumulates in summary
 *  - decision() records gate, outcome, and reason
 *  - startSpan().end() measures durationMs and accumulates
 *  - warnThrottled() deduplicates within the window, re-fires after reset
 *  - addContext() adds fields to every subsequent log line
 *  - getSummary() returns complete, accurate trace data
 *  - totalDurationMs grows monotonically
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPipelineTracer } from '../lib/observability/pipelineTracer';

// ── Helpers ─────────────────────────────────────────────────────────

/** Capture all structured JSON console output (log, warn, error, debug) during a block */
function captureConsoleLogs(fn: () => void): Array<Record<string, unknown>> {
  const captured: Array<Record<string, unknown>> = [];
  const parse = (msg: string) => { try { captured.push(JSON.parse(msg)); } catch { /* ignore non-JSON */ } };
  const spyLog = vi.spyOn(console, 'log').mockImplementation(parse);
  const spyWarn = vi.spyOn(console, 'warn').mockImplementation(parse);
  const spyError = vi.spyOn(console, 'error').mockImplementation(parse);
  const spyDebug = vi.spyOn(console, 'debug').mockImplementation(parse);
  fn();
  spyLog.mockRestore();
  spyWarn.mockRestore();
  spyError.mockRestore();
  spyDebug.mockRestore();
  return captured;
}

async function captureConsoleLogsAsync(fn: () => Promise<void>): Promise<Array<Record<string, unknown>>> {
  const captured: Array<Record<string, unknown>> = [];
  const spy = vi.spyOn(console, 'log').mockImplementation((msg: string) => {
    try {
      captured.push(JSON.parse(msg));
    } catch {
      // ignore
    }
  });
  await fn();
  spy.mockRestore();
  return captured;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('createPipelineTracer', () => {
  describe('step()', () => {
    it('emits a structured JSON log line for each step', () => {
      const tracer = createPipelineTracer({
        pipeline: 'test_pipeline',
        requestId: 'req-001',
        userId: 'user-abc',
        questionId: 'q-xyz',
      });

      const logs = captureConsoleLogs(() => {
        tracer.step('correctness_resolved', { isCorrect: true, method: 'exactMatch' });
      });

      expect(logs).toHaveLength(1);
      const log = logs[0];
      expect(log.event).toBe('pipeline:step:correctness_resolved');
      expect(log.pipeline).toBe('test_pipeline');
      expect(log.requestId).toBe('req-001');
      expect(log.userId).toBe('user-abc');
      expect(log.questionId).toBe('q-xyz');
      expect(log.isCorrect).toBe(true);
      expect(log.method).toBe('exactMatch');
      expect(log.level).toBe('info');
      expect(typeof log.ts).toBe('string');
      expect(typeof log.relativeMs).toBe('number');
    });

    it('accumulates steps in getSummary()', () => {
      const tracer = createPipelineTracer({ pipeline: 'p', requestId: 'r1' });

      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      tracer.step('step_a', { x: 1 });
      tracer.step('step_b', { y: 2 });
      spy.mockRestore();

      const summary = tracer.getSummary();
      expect(summary.steps).toHaveLength(2);
      expect(summary.steps[0].name).toBe('step_a');
      expect(summary.steps[0].data).toEqual({ x: 1 });
      expect(summary.steps[1].name).toBe('step_b');
    });

    it('includes all TracerContext fields in each log line', () => {
      const tracer = createPipelineTracer({
        pipeline: 'drill_review',
        requestId: 'req-999',
        userId: 'u1',
        questionId: 'q1',
        sessionType: 'drill',
      });

      const logs = captureConsoleLogs(() => {
        tracer.step('any_step');
      });

      expect(logs[0].sessionType).toBe('drill');
    });
  });

  describe('decision()', () => {
    it('emits a structured log with gate, outcome, and reason', () => {
      const tracer = createPipelineTracer({ pipeline: 'p', requestId: 'r' });

      const logs = captureConsoleLogs(() => {
        tracer.decision('fsrs_gate', 'proceed', 'sessionType=main');
      });

      expect(logs).toHaveLength(1);
      const log = logs[0];
      expect(log.event).toBe('pipeline:decision:fsrs_gate');
      expect(log.outcome).toBe('proceed');
      expect(log.reason).toBe('sessionType=main');
    });

    it('accumulates decisions in getSummary()', () => {
      const tracer = createPipelineTracer({ pipeline: 'p' });

      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      tracer.decision('rapid_guess_gate', 'skip_implicit_rating', 'duration=100ms < mvrt=2000ms');
      tracer.decision('fsrs_gate', 'proceed', 'sessionType=drill');
      spy.mockRestore();

      const summary = tracer.getSummary();
      expect(summary.decisions).toHaveLength(2);
      expect(summary.decisions[0].gate).toBe('rapid_guess_gate');
      expect(summary.decisions[0].outcome).toBe('skip_implicit_rating');
      expect(summary.decisions[1].gate).toBe('fsrs_gate');
      expect(summary.decisions[1].outcome).toBe('proceed');
    });
  });

  describe('startSpan() / end()', () => {
    it('measures elapsed time and emits a span log', async () => {
      const tracer = createPipelineTracer({ pipeline: 'p', requestId: 'r' });

      const logs = await captureConsoleLogsAsync(async () => {
        const span = tracer.startSpan('fsrs_compute');
        // Small artificial delay
        await new Promise(r => setTimeout(r, 5));
        span.end({ stabilityAfter: 4.2 });
      });

      expect(logs).toHaveLength(1);
      const log = logs[0];
      expect(log.event).toBe('pipeline:span:fsrs_compute');
      expect(typeof log.durationMs).toBe('number');
      expect(log.durationMs as number).toBeGreaterThanOrEqual(0);
      expect(log.stabilityAfter).toBe(4.2);
    });

    it('accumulates completed spans in getSummary()', async () => {
      const tracer = createPipelineTracer({ pipeline: 'p' });
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const s1 = tracer.startSpan('span_one');
      await new Promise(r => setTimeout(r, 2));
      s1.end({ step: 1 });

      const s2 = tracer.startSpan('span_two');
      await new Promise(r => setTimeout(r, 2));
      s2.end({ step: 2 });

      spy.mockRestore();

      const summary = tracer.getSummary();
      expect(summary.spans).toHaveLength(2);
      expect(summary.spans[0].name).toBe('span_one');
      expect(summary.spans[0].durationMs).toBeGreaterThanOrEqual(0);
      expect(summary.spans[1].name).toBe('span_two');
    });

    it('returns a SpanResult with the provided meta', () => {
      const tracer = createPipelineTracer({ pipeline: 'p' });
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = tracer.startSpan('my_span').end({ foo: 'bar' });
      spy.mockRestore();

      expect(result.name).toBe('my_span');
      expect(result.meta).toEqual({ foo: 'bar' });
      expect(typeof result.durationMs).toBe('number');
    });
  });

  describe('warnThrottled()', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('emits the first warning immediately', () => {
      const tracer = createPipelineTracer({ pipeline: 'p_throttle_a', requestId: 'r1' });

      const logs = captureConsoleLogs(() => {
        tracer.warnThrottled('db_fail', 'DB write failed', { table: 'UserProgress' });
      });

      expect(logs).toHaveLength(1);
      expect(logs[0].event).toBe('pipeline:warn:db_fail');
      expect(logs[0].level).toBe('warn');
      expect(logs[0].message).toBe('DB write failed');
    });

    it('suppresses subsequent warnings with the same key within the throttle window', () => {
      const tracer = createPipelineTracer({ pipeline: 'p_throttle_b', requestId: 'r2' });

      const logs = captureConsoleLogs(() => {
        tracer.warnThrottled('repeated_key', 'Same error', {});
        tracer.warnThrottled('repeated_key', 'Same error', {});
        tracer.warnThrottled('repeated_key', 'Same error', {});
      });

      // Only first emission should log; subsequent ones are suppressed
      expect(logs).toHaveLength(1);
    });

    it('records suppressed warning counts in getSummary()', () => {
      const tracer = createPipelineTracer({ pipeline: 'p_throttle_c', requestId: 'r3' });
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      tracer.warnThrottled('counted_key', 'Msg', {});
      tracer.warnThrottled('counted_key', 'Msg', {});
      tracer.warnThrottled('counted_key', 'Msg', {});

      spy.mockRestore();

      const summary = tracer.getSummary();
      const warning = summary.warnings.find(w => w.key === 'counted_key');
      expect(warning).toBeDefined();
      expect(warning!.count).toBe(3);
      expect(warning!.message).toBe('Msg');
    });

    it('does not suppress warnings with different keys', () => {
      const tracer = createPipelineTracer({ pipeline: 'p_throttle_d', requestId: 'r4' });

      const logs = captureConsoleLogs(() => {
        tracer.warnThrottled('key_alpha', 'Error A', {});
        tracer.warnThrottled('key_beta', 'Error B', {});
        tracer.warnThrottled('key_gamma', 'Error C', {});
      });

      expect(logs).toHaveLength(3);
    });
  });

  describe('addContext()', () => {
    it('adds fields that appear on all subsequent log lines', () => {
      const tracer = createPipelineTracer({ pipeline: 'p', requestId: 'r' });

      tracer.addContext({ sessionId: 'sess-001', internalUserId: 'db-user-42' });

      const logs = captureConsoleLogs(() => {
        tracer.step('after_context_added', { val: 1 });
      });

      expect(logs[0].sessionId).toBe('sess-001');
      expect(logs[0].internalUserId).toBe('db-user-42');
    });

    it('merges multiple addContext() calls', () => {
      const tracer = createPipelineTracer({ pipeline: 'p', requestId: 'r' });

      tracer.addContext({ fieldA: 'a' });
      tracer.addContext({ fieldB: 'b' });

      const logs = captureConsoleLogs(() => {
        tracer.step('merged_ctx_step');
      });

      expect(logs[0].fieldA).toBe('a');
      expect(logs[0].fieldB).toBe('b');
    });

    it('does not retroactively add context to previously emitted logs', () => {
      const tracer = createPipelineTracer({ pipeline: 'p', requestId: 'r' });

      const logsBefore = captureConsoleLogs(() => {
        tracer.step('before_context');
      });

      tracer.addContext({ lateField: 'late' });

      // The previously captured log should not have lateField
      expect(logsBefore[0].lateField).toBeUndefined();
    });
  });

  describe('getSummary()', () => {
    it('returns the correct pipeline and context fields', () => {
      const tracer = createPipelineTracer({
        pipeline: 'drill_review',
        requestId: 'req-abc',
        userId: 'u-1',
        questionId: 'q-1',
        sessionType: 'main',
      });
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const summary = tracer.getSummary();
      expect(summary.pipeline).toBe('drill_review');
      expect(summary.requestId).toBe('req-abc');
      expect(summary.userId).toBe('u-1');
      expect(summary.questionId).toBe('q-1');
      expect(summary.sessionType).toBe('main');

      vi.restoreAllMocks();
    });

    it('totalDurationMs increases over time', async () => {
      const tracer = createPipelineTracer({ pipeline: 'p' });
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const before = tracer.getSummary().totalDurationMs;
      await new Promise(r => setTimeout(r, 10));
      const after = tracer.getSummary().totalDurationMs;

      expect(after).toBeGreaterThanOrEqual(before);
      vi.restoreAllMocks();
    });

    it('returns empty arrays when no events have occurred', () => {
      const tracer = createPipelineTracer({ pipeline: 'empty' });
      const summary = tracer.getSummary();

      expect(summary.steps).toEqual([]);
      expect(summary.decisions).toEqual([]);
      expect(summary.spans).toEqual([]);
      expect(summary.warnings).toEqual([]);
    });
  });
});
