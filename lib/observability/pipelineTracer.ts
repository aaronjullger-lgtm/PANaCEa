/**
 * Pipeline Tracer — Structured observability for multi-step server pipelines.
 *
 * Designed for the FSRS drill review submission pipeline, but generic enough
 * for any multi-step server flow (question generation, sync, etc.).
 *
 * Features:
 *   - Correlation: requestId + userId + questionId travel with every log line
 *   - Decision trail: `decision()` records why a branch was taken (e.g. "FSRS skipped: rapid guess")
 *   - Sub-step timing: `startSpan()` / `endSpan()` for granular performance visibility
 *   - Throttled warnings: `warnThrottled()` deduplicates noisy non-fatal errors
 *   - Structured summary: `getSummary()` returns the full trace for attachLogMeta / response body
 *
 * All output goes through `console.log(JSON.stringify(...))` for Cloudflare Workers Logs
 * indexing. No external dependencies.
 *
 * @example
 *   const tracer = createPipelineTracer({
 *     pipeline: 'drill_review',
 *     requestId: 'abc-123',
 *     userId: 'user_xyz',
 *     questionId: 'q_456',
 *   });
 *
 *   tracer.step('correctness_resolved', { isCorrect: true, method: 'exactMatch' });
 *   tracer.decision('fsrs_gate', 'proceed', 'sessionType=main, not rapid guess');
 *
 *   const span = tracer.startSpan('confidence_pipeline');
 *   // ... work ...
 *   span.end({ stepsRun: 8 });
 *
 *   tracer.warnThrottled('db_upsert_fail', 'UserQuestionSeen upsert failed', { error: '...' });
 *
 *   const summary = tracer.getSummary();
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Minimal logger interface compatible with SecureLogger from secureLogger.ts.
 * Passing a SecureLogger instance ensures pipeline traces flow through the
 * same sensitive-data redaction layer as endpoint logs.
 */
export interface TracerLogger {
  debug?: (message: string, context?: Record<string, unknown>) => void;
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  /** Matches SecureLogger.error(message, error?, context?) signature */
  error: (message: string, errorObj?: unknown, context?: Record<string, unknown>) => void;
}

export interface TracerContext {
  pipeline: string;
  requestId?: string;
  userId?: string;
  questionId?: string;
  sessionType?: string;
  /** Extra context fields attached to every log line */
  extra?: Record<string, unknown>;
  /**
   * Optional structured logger (e.g. SecureLogger from secureLogger.ts).
   * When provided, tracer output flows through the logger's redaction layer
   * rather than being written directly via console.log(JSON.stringify(...)).
   */
  logger?: TracerLogger;
}

export interface TraceStep {
  name: string;
  ts: number;
  data?: Record<string, unknown>;
}

export interface TraceDecision {
  gate: string;
  outcome: string;
  reason: string;
  ts: number;
}

export interface TraceSpanResult {
  name: string;
  durationMs: number;
  meta?: Record<string, unknown>;
}

export interface TraceSpan {
  /** End the span. Returns timing result. */
  end: (meta?: Record<string, unknown>) => TraceSpanResult;
}

export interface TraceSummary {
  pipeline: string;
  requestId?: string;
  userId?: string;
  questionId?: string;
  sessionType?: string;
  totalDurationMs: number;
  steps: TraceStep[];
  decisions: TraceDecision[];
  spans: TraceSpanResult[];
  warnings: Array<{ key: string; message: string; count: number }>;
}

export interface PipelineTracer {
  /** Record a processing step with optional structured data. */
  step(name: string, data?: Record<string, unknown>): void;

  /** Record a decision/gate outcome with a human-readable reason. */
  decision(gate: string, outcome: string, reason: string): void;

  /** Start a timed span for a sub-operation. Call `.end()` when done. */
  startSpan(name: string): TraceSpan;

  /**
   * Emit a warning that is deduplicated by `key`.
   * First occurrence logs immediately; subsequent occurrences within the
   * same pipeline run are counted but not re-logged.
   */
  warnThrottled(key: string, message: string, data?: Record<string, unknown>): void;

  /** Get the full trace summary (for attachLogMeta or response body). */
  getSummary(): TraceSummary;

  /** Add extra context fields that will appear on all subsequent log lines. */
  addContext(fields: Record<string, unknown>): void;
}

// ─── Throttle state (module-level, per-worker isolate) ──────────────────────

const THROTTLE_WINDOW_MS = 60_000; // 1 minute
const throttleMap = new Map<string, { count: number; firstSeen: number }>();

function shouldEmitWarning(key: string): boolean {
  const now = Date.now();
  const entry = throttleMap.get(key);

  if (!entry || now - entry.firstSeen > THROTTLE_WINDOW_MS) {
    throttleMap.set(key, { count: 1, firstSeen: now });
    return true;
  }

  entry.count++;
  return false;
}

// Periodically prune stale entries (runs at most once per window)
let lastPrune = 0;
function pruneThrottleMap(): void {
  const now = Date.now();
  if (now - lastPrune < THROTTLE_WINDOW_MS) return;
  lastPrune = now;

  throttleMap.forEach((entry, key) => {
    if (now - entry.firstSeen > THROTTLE_WINDOW_MS * 2) {
      throttleMap.delete(key);
    }
  });
}

// ─── Structured log emitter ─────────────────────────────────────────────────

function emit(
  level: 'info' | 'warn' | 'error' | 'debug',
  event: string,
  ctx: TracerContext,
  data?: Record<string, unknown>
): void {
  // Build structured context: correlation fields + pipeline data
  const context: Record<string, unknown> = {
    pipeline: ctx.pipeline,
    ...(ctx.requestId && { requestId: ctx.requestId }),
    ...(ctx.userId && { userId: ctx.userId }),
    ...(ctx.questionId && { questionId: ctx.questionId }),
    ...(ctx.sessionType && { sessionType: ctx.sessionType }),
    ...(ctx.extra && ctx.extra),
    ...data,
  };

  // If a structured logger is provided, route through it so the sensitive-data
  // redaction layer (SecureLogger) applies to all pipeline trace output.
  if (ctx.logger) {
    if (level === 'error') {
      ctx.logger.error(event, undefined, context);
    } else if (level === 'warn') {
      ctx.logger.warn(event, context);
    } else if (level === 'debug') {
      ctx.logger.debug?.(event, context);
    } else {
      ctx.logger.info(event, context);
    }
    return;
  }

  // Fallback: direct console output for Cloudflare Workers Logs (JSON indexed).
  // Use the appropriate console method per severity so Workers Logs can filter by level.
  const entry: Record<string, unknown> = {
    level,
    event,
    ts: new Date().toISOString(),
    ...context,
  };
  const serialized = JSON.stringify(entry);
  if (level === 'error') {
    console.error(serialized);
  } else if (level === 'warn') {
    console.warn(serialized);
  } else if (level === 'debug') {
    console.debug(serialized);
  } else {
    console.log(serialized);
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a PipelineTracer bound to a specific request/pipeline run.
 *
 * Lightweight, zero-dependency, Edge-compatible.
 */
export function createPipelineTracer(ctx: TracerContext): PipelineTracer {
  const startMs = Date.now();
  const steps: TraceStep[] = [];
  const decisions: TraceDecision[] = [];
  const completedSpans: TraceSpanResult[] = [];
  const warningCounts = new Map<string, { message: string; count: number }>();
  const context = { ...ctx };

  return {
    step(name: string, data?: Record<string, unknown>): void {
      const ts = Date.now() - startMs;
      steps.push({ name, ts, data });
      emit('info', `pipeline:step:${name}`, context, { relativeMs: ts, ...data });
    },

    decision(gate: string, outcome: string, reason: string): void {
      const ts = Date.now() - startMs;
      decisions.push({ gate, outcome, reason, ts });
      emit('info', `pipeline:decision:${gate}`, context, {
        outcome,
        reason,
        relativeMs: ts,
      });
    },

    startSpan(name: string): TraceSpan {
      const spanStart = Date.now();
      return {
        end(meta?: Record<string, unknown>): TraceSpanResult {
          const durationMs = Date.now() - spanStart;
          const result: TraceSpanResult = { name, durationMs, meta };
          completedSpans.push(result);
          emit('info', `pipeline:span:${name}`, context, {
            durationMs,
            ...meta,
          });
          return result;
        },
      };
    },

    warnThrottled(key: string, message: string, data?: Record<string, unknown>): void {
      pruneThrottleMap();

      const existing = warningCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        warningCounts.set(key, { message, count: 1 });
      }

      if (shouldEmitWarning(`${context.pipeline}:${key}`)) {
        emit('warn', `pipeline:warn:${key}`, context, { message, ...data });
      }
    },

    addContext(fields: Record<string, unknown>): void {
      context.extra = { ...(context.extra || {}), ...fields };
    },

    getSummary(): TraceSummary {
      return {
        pipeline: context.pipeline,
        requestId: context.requestId,
        userId: context.userId,
        questionId: context.questionId,
        sessionType: context.sessionType,
        totalDurationMs: Date.now() - startMs,
        steps,
        decisions,
        spans: completedSpans,
        warnings: Array.from(warningCounts.entries()).map(([key, v]) => ({
          key,
          message: v.message,
          count: v.count,
        })),
      };
    },
  };
}
