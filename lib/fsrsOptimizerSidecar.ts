/**
 * FSRS Optimizer Serverless Sidecar (Google Cloud Function)
 *
 * Fetches Main Session review history from ReviewLog, formats payload for the
 * Python fsrs-optimizer Cloud Function, and returns w[] + metadata for
 * persistence in PersonalizedFSRSParams.
 *
 * @module fsrsOptimizerSidecar
 */

// ============================================================================
// Types
// ============================================================================

/** One review row as returned from ReviewLog (real + MAIN only). */
export interface ReviewLogRow {
  id: string;
  questionFkId: string | null;
  reviewedAt: Date;
  grade: number;
  state: number;
  responseTimeMs: number | null;
}

/** Payload sent to the Python Cloud Function. */
export interface FSRSOptimizerPayload {
  reviews: Array<{
    card_id: string;
    review_time: number;
    review_rating: number;
    review_state: number;
    review_duration: number;
  }>;
  timezone: string;
  next_day_starts_at: number;
}

/** Response from the Python Cloud Function. */
export interface FSRSOptimizerResponse {
  success: boolean;
  w?: number[];
  sampleSize?: number;
  brierScore?: number;
  defaultBrierScore?: number;
  improvementOverDefault?: number;
  iterations?: number | null;
  error?: string;
  reviewsReceived?: number;
}

/** Result shape used to upsert PersonalizedFSRSParams. */
export interface SidecarOptimizationResult {
  w: number[];
  sampleSize: number;
  lastOptimizedAt: Date;
  improvementOverDefault: number;
  brierScore: number | null;
  defaultBrierScore: number | null;
  optimizationIterations: number | null;
}

export interface SidecarEnv {
  FSRS_OPTIMIZER_URL?: string;
  FSRS_OPTIMIZER_SECRET?: string;
  /** '1' or 'true' to use Python sidecar for optimization */
  FSRS_USE_SIDECAR?: string;
}

/** Prisma-like client with only the ReviewLog findMany we need. */
export interface ReviewLogClient {
  reviewLog: {
    findMany: (args: {
      where: { userId: string; review_type: string; sessionType: string };
      orderBy: { reviewedAt: 'asc' };
      select: {
        id: true;
        questionFkId: true;
        reviewedAt: true;
        grade: true;
        state: true;
        responseTimeMs: true;
      };
    }) => Promise<ReviewLogRow[]>;
  };
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TIMEZONE = 'UTC';
const DEFAULT_DAY_START = 0;
const MAX_REVIEWS_PAYLOAD = 50_000;
const SIDECAR_TIMEOUT_MS = 120_000; // 2 min for PyTorch run

// ============================================================================
// Helpers
// ============================================================================

function toOptimizerPayload(rows: ReviewLogRow[]): FSRSOptimizerPayload {
  return {
    reviews: rows.map((r) => ({
      card_id: r.questionFkId ?? r.id,
      review_time: r.reviewedAt.getTime(),
      review_rating: r.grade,
      review_state: r.state,
      review_duration: r.responseTimeMs ?? 0,
    })),
    timezone: DEFAULT_TIMEZONE,
    next_day_starts_at: DEFAULT_DAY_START,
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Fetch Main Session (real) review history from ReviewLog and call the
 * FSRS Optimizer Cloud Function. Returns result suitable for upserting
 * into PersonalizedFSRSParams.
 *
 * @param userId - User id (internal DB id); used only when reviews are fetched via prisma
 * @param prismaOrRows - Prisma client (with reviewLog.findMany) or pre-fetched ReviewLogRow[]
 * @param env - Env with FSRS_OPTIMIZER_URL and optionally FSRS_OPTIMIZER_SECRET
 * @returns SidecarOptimizationResult or throws on HTTP/parse errors
 */
export async function triggerFSRSOptimization(
  userId: string,
  prismaOrRows: ReviewLogClient | ReviewLogRow[],
  env: SidecarEnv
): Promise<SidecarOptimizationResult> {
  const url = env.FSRS_OPTIMIZER_URL;
  if (!url) {
    throw new Error('FSRS_OPTIMIZER_URL is not set');
  }

  const rows: ReviewLogRow[] = Array.isArray(prismaOrRows)
    ? prismaOrRows
    : await prismaOrRows.reviewLog.findMany({
        where: {
          userId,
          review_type: 'real',
          sessionType: 'MAIN',
        },
        orderBy: { review_date: 'asc' },
        select: {
          id: true,
          questionFkId: true,
          review_date: true,
          rating: true,
          state: true,
          duration: true,
        },
      });

  if (rows.length > MAX_REVIEWS_PAYLOAD) {
    rows.splice(MAX_REVIEWS_PAYLOAD);
  }

  const payload = toOptimizerPayload(rows);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SIDECAR_TIMEOUT_MS);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (env.FSRS_OPTIMIZER_SECRET) {
    headers['X-FSRS-Optimizer-Key'] = env.FSRS_OPTIMIZER_SECRET;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    let errBody: FSRSOptimizerResponse | undefined;
    try {
      errBody = (await res.json()) as FSRSOptimizerResponse;
    } catch {
      // ignore
    }
    const msg =
      errBody?.error ?? `FSRS Optimizer sidecar returned ${res.status}`;
    throw new Error(msg);
  }

  const data = (await res.json()) as FSRSOptimizerResponse;
  if (!data.success || !data.w || data.sampleSize == null) {
    throw new Error(data.error ?? 'FSRS Optimizer returned success=false');
  }

  const now = new Date();
  return {
    w: data.w,
    sampleSize: data.sampleSize,
    lastOptimizedAt: now,
    improvementOverDefault: data.improvementOverDefault ?? 0,
    brierScore: data.brierScore ?? null,
    defaultBrierScore: data.defaultBrierScore ?? null,
    optimizationIterations: data.iterations ?? null,
  };
}

/**
 * Whether to use the Python sidecar for optimization (env flag).
 * Named to avoid React hooks lint (not a hook).
 */
export function shouldUseSidecar(env: SidecarEnv): boolean {
  const v = env.FSRS_USE_SIDECAR;
  return v === '1' || v === 'true';
}
