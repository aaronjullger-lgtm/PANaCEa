/**
 * FSRS Workload Simulator
 * Phase 4: Neuro-Symbolic Integrity - Milestone 4
 *
 * Implements CMRR (Compute Minimum Recommended Retention) simulation
 * to help users understand the workload implications of their retention targets.
 *
 * Based on: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Optimal-Retention
 */

import { FSRS, type FSRSParameters, type FSRSCard, Rating } from '../fsrs';

export interface WorkloadSimulation {
  retention: number; // Target retention (0.8 - 0.95)
  dailyNewCards: number; // Cards introduced per day
  projectedDailyReviews: number; // Estimated reviews per day at equilibrium
  timeInvestmentMinutes: number; // Estimated time per day (assuming 30s/card)
  sustainabilityScore: number; // 0-100, higher is more sustainable
}

export interface SimulationParams {
  /** Current FSRS parameters (21 weights) */
  fsrsParams: FSRSParameters;
  /** Number of new cards learned per day */
  dailyNewCards: number;
  /** Days to simulate forward */
  simulationDays?: number;
  /** Average time per review in seconds */
  avgReviewTimeSeconds?: number;
}

/**
 * Simulate workload for multiple retention levels
 * Returns projections to help users choose optimal retention
 *
 * @example
 * ```ts
 * const results = simulateRetentionWorkload({
 *   fsrsParams: defaultParameters,
 *   dailyNewCards: 20
 * });
 *
 * // results = [
 * //   { retention: 0.80, dailyReviews: 45, timeMinutes: 22 },
 * //   { retention: 0.85, dailyReviews: 58, timeMinutes: 29 },
 * //   { retention: 0.90, dailyReviews: 78, timeMinutes: 39 },
 * //   { retention: 0.95, dailyReviews: 142, timeMinutes: 71 }
 * // ]
 * ```
 */
export function simulateRetentionWorkload(params: SimulationParams): WorkloadSimulation[] {
  const retentionLevels = [0.8, 0.85, 0.88, 0.9, 0.92, 0.95];
  const results: WorkloadSimulation[] = [];

  for (const retention of retentionLevels) {
    const simulation = simulateSingleRetention({
      ...params,
      targetRetention: retention,
    });
    results.push(simulation);
  }

  return results;
}

interface SingleSimulationParams extends SimulationParams {
  targetRetention: number;
}

/**
 * Simulate workload for a single retention target
 */
function simulateSingleRetention(params: SingleSimulationParams): WorkloadSimulation {
  const {
    fsrsParams,
    dailyNewCards,
    targetRetention,
    simulationDays = 365, // Simulate one year
    avgReviewTimeSeconds = 30,
  } = params;

  // Create FSRS instance with target retention
  const fsrs = new FSRS({
    ...fsrsParams,
    request_retention: targetRetention,
  });

  // Track card collection
  const cards: Array<{ card: FSRSCard; nextReview: Date }> = [];
  let totalReviews = 0;
  const dailyReviewCounts: number[] = [];

  const startDate = new Date();

  // Simulate each day
  for (let day = 0; day < simulationDays; day++) {
    const currentDate = new Date(startDate.getTime() + day * 86400000);
    let reviewsToday = 0;

    // Add new cards
    for (let i = 0; i < dailyNewCards; i++) {
      const newCard = fsrs.createEmptyCard();
      const scheduled = fsrs.schedule(newCard, currentDate);

      // Assume user rates "Good" on first exposure
      cards.push({
        card: scheduled[Rating.Good].card,
        nextReview: scheduled[Rating.Good].due,
      });
    }

    // Process reviews due today
    for (let i = cards.length - 1; i >= 0; i--) {
      const item = cards[i];
      if (!item || item.nextReview > currentDate) continue;

      reviewsToday++;
      totalReviews++;

      // Simulate rating distribution based on target retention
      const rating = simulateRating(targetRetention);
      const scheduled = fsrs.schedule(item.card, currentDate);

      // Update card
      cards[i] = {
        card: scheduled[rating].card,
        nextReview: scheduled[rating].due,
      };
    }

    dailyReviewCounts.push(reviewsToday);
  }

  // Calculate steady-state daily reviews (last 90 days average)
  const steadyStateDays = dailyReviewCounts.slice(-90);
  const avgDailyReviews =
    steadyStateDays.reduce((sum, count) => sum + count, 0) / steadyStateDays.length;

  // Calculate time investment
  const timeInvestmentMinutes = (avgDailyReviews * avgReviewTimeSeconds) / 60;

  // Calculate sustainability score (inverse of workload pressure)
  // 100 = very sustainable (< 30 min/day), 0 = unsustainable (> 120 min/day)
  const sustainabilityScore = Math.max(0, Math.min(100, 100 - (timeInvestmentMinutes - 30) * 1.4));

  return {
    retention: targetRetention,
    dailyNewCards,
    projectedDailyReviews: Math.round(avgDailyReviews),
    timeInvestmentMinutes: Math.round(timeInvestmentMinutes),
    sustainabilityScore: Math.round(sustainabilityScore),
  };
}

/**
 * Simulate a realistic rating based on target retention
 * Higher retention targets mean more "Again" ratings needed to maintain stability
 */
function simulateRating(targetRetention: number): Rating {
  const rand = Math.random();

  // Model: Higher retention = more conservative rating distribution
  if (targetRetention >= 0.95) {
    // Very high retention - stricter ratings
    if (rand < 0.1) return Rating.Again; // 10% fail
    if (rand < 0.35) return Rating.Hard; // 25% hard
    if (rand < 0.8) return Rating.Good; // 45% good
    return Rating.Easy; // 20% easy
  } else if (targetRetention >= 0.9) {
    // High retention
    if (rand < 0.08) return Rating.Again; // 8% fail
    if (rand < 0.28) return Rating.Hard; // 20% hard
    if (rand < 0.78) return Rating.Good; // 50% good
    return Rating.Easy; // 22% easy
  } else if (targetRetention >= 0.85) {
    // Moderate-high retention
    if (rand < 0.12) return Rating.Again; // 12% fail
    if (rand < 0.32) return Rating.Hard; // 20% hard
    if (rand < 0.8) return Rating.Good; // 48% good
    return Rating.Easy; // 20% easy
  } else {
    // Lower retention (80-85%)
    if (rand < 0.18) return Rating.Again; // 18% fail
    if (rand < 0.38) return Rating.Hard; // 20% hard
    if (rand < 0.83) return Rating.Good; // 45% good
    return Rating.Easy; // 17% easy
  }
}

/**
 * Calculate recommended retention based on available study time
 *
 * @param dailyTimeAvailableMinutes - How many minutes per day user can study
 * @param dailyNewCards - How many new cards per day
 * @param fsrsParams - User's FSRS parameters
 * @returns Recommended retention target
 */
export function calculateRecommendedRetention(
  dailyTimeAvailableMinutes: number,
  dailyNewCards: number,
  fsrsParams: FSRSParameters
): {
  recommendedRetention: number;
  explanation: string;
} {
  const simulations = simulateRetentionWorkload({
    fsrsParams,
    dailyNewCards,
  });

  // Find highest retention that fits within time budget
  for (let i = simulations.length - 1; i >= 0; i--) {
    const sim = simulations[i];
    if (sim.timeInvestmentMinutes <= dailyTimeAvailableMinutes) {
      return {
        recommendedRetention: sim.retention,
        explanation: `With ${dailyTimeAvailableMinutes} min/day available and ${dailyNewCards} new cards/day, ${(sim.retention * 100).toFixed(0)}% retention is sustainable (requires ~${sim.timeInvestmentMinutes} min/day).`,
      };
    }
  }

  // If even lowest retention exceeds budget, recommend reducing new cards
  return {
    recommendedRetention: 0.8,
    explanation: `Your current pace (${dailyNewCards} new cards/day) exceeds ${dailyTimeAvailableMinutes} min/day even at 80% retention. Consider reducing new cards to ${Math.floor(dailyNewCards * 0.7)}/day.`,
  };
}

/**
 * Generate workload comparison data for UI visualization
 * Returns data suitable for a line chart
 */
export function generateWorkloadChart(
  params: SimulationParams
): Array<{ retention: number; reviews: number; minutes: number }> {
  const simulations = simulateRetentionWorkload(params);

  return simulations.map((sim) => ({
    retention: sim.retention,
    reviews: sim.projectedDailyReviews,
    minutes: sim.timeInvestmentMinutes,
  }));
}
