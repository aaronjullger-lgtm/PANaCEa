/**
 * Decision Speed benchmarks for contextualizing "64s avg" as good/bad.
 * - Recall (first-order): target <60s
 * - Clinical reasoning (vignette/third-order): target <90s
 * - Overall (mixed): target <60s for display when type is unknown
 */

/** Target for recall-style questions (e.g. "Drug of choice for X?") in seconds */
export const RECALL_TARGET_SEC = 60;

/** Target for clinical reasoning / vignette questions in seconds */
export const CLINICAL_REASONING_TARGET_SEC = 90;

/** Target for overall speed when type is not split (peer-like benchmark) */
export const OVERALL_TARGET_SEC = 60;

export type SpeedBenchmarkStatus = 'on_target' | 'above_target' | 'below_target';

/**
 * Get benchmark status for a given avg time (ms) vs target (sec).
 */
export function getSpeedBenchmarkStatus(
  avgTimeMs: number | null | undefined,
  targetSec: number = OVERALL_TARGET_SEC
): SpeedBenchmarkStatus | null {
  if (avgTimeMs == null || avgTimeMs <= 0) return null;
  const sec = avgTimeMs / 1000;
  if (sec <= targetSec * 0.9) return 'below_target'; // faster than target
  if (sec <= targetSec) return 'on_target';
  return 'above_target';
}

/**
 * Format decision speed with benchmark label for UI.
 * e.g. "64s (Target: <60s)" or "45s (On target)"
 */
export function getSpeedBenchmarkLabel(
  avgTimeMs: number | null | undefined,
  options?: {
    targetSec?: number;
    showPeerAvg?: boolean;
    peerAvgSec?: number;
  }
): { primary: string; benchmark: string; status: SpeedBenchmarkStatus | null } {
  const targetSec = options?.targetSec ?? OVERALL_TARGET_SEC;
  if (avgTimeMs == null || avgTimeMs <= 0) {
    return { primary: '—', benchmark: '', status: null };
  }
  const sec = Math.round(avgTimeMs / 1000);
  const primary = `${sec}s`;
  const status = getSpeedBenchmarkStatus(avgTimeMs, targetSec);

  if (options?.showPeerAvg && options.peerAvgSec != null) {
    const diff = sec - options.peerAvgSec;
    const benchmark =
      diff <= 0
        ? `Peer avg: ${options.peerAvgSec}s`
        : `Peer avg: ${options.peerAvgSec}s (+${diff}s)`;
    return { primary, benchmark, status };
  }

  let benchmark: string;
  if (status === 'on_target') benchmark = `Target: <${targetSec}s`;
  else if (status === 'below_target') benchmark = `Target: <${targetSec}s (faster)`;
  else benchmark = `Target: <${targetSec}s`;
  return { primary, benchmark, status };
}
