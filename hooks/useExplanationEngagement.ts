/**
 * Explanation Engagement Tracker Hook (Wave 3A — Client Side)
 *
 * Lightweight hook for tracking how deeply a learner engages with the
 * explanation panel after answer submission: dwell time, scroll depth,
 * and expanded "Why not X?" sections.
 *
 * Usage:
 * ```tsx
 * const { startTracking, recordScroll, recordExpand, finalize } = useExplanationEngagement();
 *
 * // When explanation panel is revealed:
 * startTracking();
 *
 * // When user scrolls the explanation:
 * recordScroll(scrollDepthFraction); // 0.0–1.0
 *
 * // When user expands a "Why not X?" section:
 * recordExpand();
 *
 * // When user clicks "Next Question":
 * const engagement = finalize(wasCorrect);
 * // → { viewedMs, scrollDepth, expandedSections, wasCorrect }
 * ```
 *
 * @see lib/services/explanationEngagementService.ts — server-side analysis
 * @see plans/behavioral-signals-implementation-plan.md — Feature 3A
 */

import { useCallback, useRef } from 'react';

// ── Types ──

export interface ExplanationEngagement {
  /** Time from explanation reveal to next-question click (ms) */
  viewedMs: number;
  /** Maximum scroll depth reached (0.0–1.0 fraction of content) */
  scrollDepth: number;
  /** Count of "Why not X?" or similar sections the user expanded */
  expandedSections: number;
  /** Context: was this after a correct or incorrect answer? */
  wasCorrect: boolean;
}

// ── Hook ──

export function useExplanationEngagement() {
  const startRef = useRef<number | null>(null);
  const scrollRef = useRef(0);
  const sectionsRef = useRef(0);

  /** Call when the explanation panel is revealed after answer submission. */
  const startTracking = useCallback(() => {
    startRef.current = performance.now();
    scrollRef.current = 0;
    sectionsRef.current = 0;
  }, []);

  /**
   * Record the user's scroll position in the explanation panel.
   * Call on scroll events with the fraction of content scrolled (0.0–1.0).
   * Only the maximum depth is retained.
   */
  const recordScroll = useCallback((depth: number) => {
    scrollRef.current = Math.max(scrollRef.current, Math.min(1, depth));
  }, []);

  /** Record a section expansion (e.g. "Why not B?" accordion opened). */
  const recordExpand = useCallback(() => {
    sectionsRef.current++;
  }, []);

  /**
   * Finalize and return engagement data. Call when the user advances to the next question.
   * @param wasCorrect - Whether the user answered the question correctly
   */
  const finalize = useCallback((wasCorrect: boolean): ExplanationEngagement => ({
    viewedMs: startRef.current != null ? Math.round(performance.now() - startRef.current) : 0,
    scrollDepth: Math.round(scrollRef.current * 1000) / 1000,
    expandedSections: sectionsRef.current,
    wasCorrect,
  }), []);

  return { startTracking, recordScroll, recordExpand, finalize };
}
