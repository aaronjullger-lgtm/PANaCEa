/**
 * useTelemetry - Passive Engagement Telemetry Hook
 *
 * Tracks reading behavior to predict encoding quality:
 * - Scroll depth (0-100%)
 * - Dwell time per content segment
 * - Skimming detection
 *
 * Used to adjust initial stability (S₀) for new content.
 * Research: Deeper engagement correlates with better encoding (Kintsch, 1998)
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Telemetry data for a single content view session
 */
export interface EngagementTelemetry {
  /** Maximum scroll depth reached (0-100) */
  scrollDepth: number;
  /** Total time spent viewing content (ms) */
  dwellTimeMs: number;
  /** Time spent at each scroll quartile (ms) */
  quartileDwells: [number, number, number, number];
  /** Whether skimming behavior was detected */
  skimmingDetected: boolean;
  /** Engagement quality score (0-1) */
  engagementScore: number;
  /** Timestamps for analysis */
  startTime: number;
  endTime: number | null;
  /** Content identifier being tracked */
  contentId: string | null;
}

/**
 * Skimming detection thresholds
 */
const SKIMMING_THRESHOLDS = {
  /** Minimum dwell time per quartile to count as "read" (ms) */
  MIN_QUARTILE_DWELL: 3000,
  /** Maximum scroll speed to count as "reading" (% per second) */
  MAX_READ_SCROLL_SPEED: 20,
  /** Minimum total dwell for engagement (ms) */
  MIN_TOTAL_DWELL: 10000,
  /** Scroll depth threshold for skimming check */
  SCROLL_DEPTH_THRESHOLD: 75,
};

/**
 * Calculate engagement score from telemetry
 *
 * Factors:
 * - Scroll depth coverage (0-40 points)
 * - Quartile dwell time balance (0-30 points)
 * - Total dwell time (0-30 points)
 */
function calculateEngagementScore(telemetry: EngagementTelemetry): number {
  let score = 0;

  // Scroll depth: 40 points max
  // Full coverage = 40, partial = proportional
  score += (telemetry.scrollDepth / 100) * 40;

  // Quartile balance: 30 points max
  // Reward spending time on each section, not just top/bottom
  const avgQuartileDwell = telemetry.quartileDwells.reduce((a, b) => a + b, 0) / 4;
  const quartileVariance =
    telemetry.quartileDwells.reduce(
      (sum, dwell) => sum + Math.pow(dwell - avgQuartileDwell, 2),
      0
    ) / 4;
  const quartileStdDev = Math.sqrt(quartileVariance);
  const quartileBalanceRatio =
    avgQuartileDwell > 0 ? Math.max(0, 1 - quartileStdDev / avgQuartileDwell) : 0;

  // Only count quartile balance if they actually spent time
  const minQuartileDwell = Math.min(...telemetry.quartileDwells);
  if (minQuartileDwell > SKIMMING_THRESHOLDS.MIN_QUARTILE_DWELL / 2) {
    score += quartileBalanceRatio * 30;
  }

  // Total dwell time: 30 points max
  // Cap at 60 seconds for max points
  const dwellScore = Math.min(telemetry.dwellTimeMs / 60000, 1) * 30;
  score += dwellScore;

  // Normalize to 0-1
  return Math.min(1, score / 100);
}

/**
 * Detect skimming behavior
 */
function detectSkimming(telemetry: EngagementTelemetry): boolean {
  // Pattern: High scroll depth but low dwell time
  if (
    telemetry.scrollDepth > SKIMMING_THRESHOLDS.SCROLL_DEPTH_THRESHOLD &&
    telemetry.dwellTimeMs < SKIMMING_THRESHOLDS.MIN_TOTAL_DWELL
  ) {
    return true;
  }

  // Pattern: Most time spent only at top or bottom
  const [q1, q2, q3, q4] = telemetry.quartileDwells;
  const middleDwell = q2 + q3;
  const edgeDwell = q1 + q4;

  if (middleDwell < edgeDwell * 0.3 && telemetry.scrollDepth > 50) {
    return true; // Skipped the middle
  }

  return false;
}

/**
 * Calculate S₀ adjustment factor based on engagement
 *
 * Returns multiplier for initial stability:
 * - 0.7 for skimming (30% penalty)
 * - 1.0-1.15 for engaged reading (0-15% bonus)
 */
export function calculateS0Adjustment(telemetry: EngagementTelemetry): number {
  if (telemetry.skimmingDetected) {
    return 0.7; // 30% penalty for skimming
  }

  // Scale bonus based on engagement score
  // Score 0.0 = 1.0 multiplier
  // Score 0.5 = 1.075 multiplier
  // Score 1.0 = 1.15 multiplier
  const bonus = telemetry.engagementScore * 0.15;
  return 1.0 + bonus;
}

/**
 * Hook return type
 */
export interface UseTelemetryReturn {
  /** Current telemetry data */
  telemetry: EngagementTelemetry;
  /** Start tracking a new content view */
  startTracking: (contentId: string) => void;
  /** Stop tracking and finalize telemetry */
  stopTracking: () => EngagementTelemetry;
  /** Reset telemetry to initial state */
  reset: () => void;
  /** Whether tracking is currently active */
  isTracking: boolean;
  /** Get S₀ adjustment multiplier */
  getS0Adjustment: () => number;
}

/**
 * Initial telemetry state
 */
function createInitialTelemetry(): EngagementTelemetry {
  return {
    scrollDepth: 0,
    dwellTimeMs: 0,
    quartileDwells: [0, 0, 0, 0],
    skimmingDetected: false,
    engagementScore: 0,
    startTime: Date.now(),
    endTime: null,
    contentId: null,
  };
}

/**
 * Passive engagement telemetry hook
 *
 * @param containerRef - Ref to the scrollable container
 * @param contentHeight - Total height of content (for scroll depth calculation)
 */
export function useTelemetry(
  containerRef?: React.RefObject<HTMLElement>,
  contentHeight?: number
): UseTelemetryReturn {
  const [telemetry, setTelemetry] = useState<EngagementTelemetry>(createInitialTelemetry);
  const [isTracking, setIsTracking] = useState(false);

  const lastScrollPosition = useRef(0);
  const lastQuartile = useRef(0);
  const quartileStartTime = useRef(Date.now());
  const dwellInterval = useRef<NodeJS.Timeout | null>(null);

  /**
   * Start tracking engagement for content
   */
  const startTracking = useCallback((contentId: string) => {
    const now = Date.now();
    setTelemetry({
      ...createInitialTelemetry(),
      startTime: now,
      contentId,
    });
    setIsTracking(true);
    lastScrollPosition.current = 0;
    lastQuartile.current = 0;
    quartileStartTime.current = now;
  }, []);

  /**
   * Stop tracking and return final telemetry
   */
  const stopTracking = useCallback((): EngagementTelemetry => {
    setIsTracking(false);

    const finalTelemetry = { ...telemetry };
    finalTelemetry.endTime = Date.now();
    finalTelemetry.dwellTimeMs = finalTelemetry.endTime - finalTelemetry.startTime;

    // Final quartile dwell update
    const currentQuartile = lastQuartile.current ?? -1;
    const startTime = quartileStartTime.current;
    if (currentQuartile >= 0 && currentQuartile < 4 && typeof startTime === 'number') {
      const quartileDwell = Date.now() - startTime;
      const arr = finalTelemetry.quartileDwells;
      const current = arr[currentQuartile];
      if (typeof current === 'number') arr[currentQuartile] = current + quartileDwell;
    }

    // Calculate final metrics
    finalTelemetry.skimmingDetected = detectSkimming(finalTelemetry);
    finalTelemetry.engagementScore = calculateEngagementScore(finalTelemetry);

    setTelemetry(finalTelemetry);
    return finalTelemetry;
  }, [telemetry]);

  /**
   * Reset telemetry
   */
  const reset = useCallback(() => {
    setTelemetry(createInitialTelemetry());
    setIsTracking(false);
    lastScrollPosition.current = 0;
    lastQuartile.current = 0;
  }, []);

  /**
   * Get S₀ adjustment
   */
  const getS0Adjustment = useCallback(() => {
    return calculateS0Adjustment(telemetry);
  }, [telemetry]);

  /**
   * Handle scroll events
   */
  useEffect(() => {
    if (!isTracking || !containerRef?.current) return;

    const container = containerRef.current;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const scrollHeight = contentHeight || container.scrollHeight;
      const clientHeight = container.clientHeight;

      // Calculate scroll depth percentage
      const maxScroll = scrollHeight - clientHeight;
      const newScrollDepth = maxScroll > 0 ? Math.round((scrollTop / maxScroll) * 100) : 0;

      // Calculate current quartile (0-3)
      const newQuartile = Math.min(3, Math.floor(newScrollDepth / 25));

      // Update quartile dwell time if quartile changed
      if (newQuartile !== lastQuartile.current) {
        const now = Date.now();
        const prevQuartile = lastQuartile.current;
        const quartileDwell = now - quartileStartTime.current;

        setTelemetry((prev) => {
          const newQuartileDwells: [number, number, number, number] = [
            prev.quartileDwells[0],
            prev.quartileDwells[1],
            prev.quartileDwells[2],
            prev.quartileDwells[3],
          ];
          if (prevQuartile >= 0 && prevQuartile < 4) {
            const idx = prevQuartile as 0 | 1 | 2 | 3;
            newQuartileDwells[idx] = newQuartileDwells[idx] + quartileDwell;
          }
          return {
            ...prev,
            quartileDwells: newQuartileDwells,
            scrollDepth: Math.max(prev.scrollDepth, newScrollDepth),
          };
        });

        lastQuartile.current = newQuartile;
        quartileStartTime.current = now;
      } else {
        // Just update max scroll depth
        setTelemetry((prev) => ({
          ...prev,
          scrollDepth: Math.max(prev.scrollDepth, newScrollDepth),
        }));
      }

      lastScrollPosition.current = scrollTop;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [isTracking, containerRef, contentHeight]);

  /**
   * Update dwell time periodically
   */
  useEffect(() => {
    if (!isTracking) {
      if (dwellInterval.current) {
        clearInterval(dwellInterval.current);
        dwellInterval.current = null;
      }
      return;
    }

    dwellInterval.current = setInterval(() => {
      setTelemetry((prev) => ({
        ...prev,
        dwellTimeMs: Date.now() - prev.startTime,
      }));
    }, 1000);

    return () => {
      if (dwellInterval.current) {
        clearInterval(dwellInterval.current);
      }
    };
  }, [isTracking]);

  return {
    telemetry,
    startTracking,
    stopTracking,
    reset,
    isTracking,
    getS0Adjustment,
  };
}

/**
 * Serialize telemetry for storage
 */
export function serializeTelemetry(telemetry: EngagementTelemetry): Record<string, unknown> {
  return {
    scrollDepth: telemetry.scrollDepth,
    dwellMs: telemetry.dwellTimeMs,
    quartileDwells: telemetry.quartileDwells,
    skimming: telemetry.skimmingDetected,
    score: telemetry.engagementScore,
    contentId: telemetry.contentId,
  };
}

export default useTelemetry;
