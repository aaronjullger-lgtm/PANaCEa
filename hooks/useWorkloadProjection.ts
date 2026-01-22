/**
 * Workload Projection Hook (Phase 5: Self-Optimizing Engine)
 * 
 * Provides real-time workload simulation for different retention targets.
 * Visualizes the cost of high retention and highlights the CMRR point
 * (Compute Minimum Recommended Retention - optimal workload/knowledge ratio).
 * 
 * Reference: FSRS Paper - Users often set retention too high (95%+)
 * without understanding the exponential workload cost.
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  simulateRetentionWorkload, 
  calculateRecommendedRetention,
  generateWorkloadChart,
  type WorkloadSimulation 
} from '../lib/fsrs/simulator';
import { defaultParameters } from '../lib/fsrs';

export interface WorkloadProjectionConfig {
  dailyNewCards: number;
  availableTimeMinutes: number;
  currentCardCount?: number;
  customParameters?: number[];
}

export interface WorkloadProjectionResult {
  simulations: WorkloadSimulation[];
  recommended: WorkloadSimulation | null;
  chartData: Array<{
    retention: number;
    dailyReviews: number;
    timeMinutes: number;
    sustainability: number;
    isCMRR: boolean;
  }>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for real-time workload projection
 * 
 * @param config - Simulation configuration
 * @param autoRun - Whether to run simulation immediately
 * @returns Projection results with CMRR highlighting
 */
export function useWorkloadProjection(
  config: WorkloadProjectionConfig,
  autoRun: boolean = true
): WorkloadProjectionResult & { runSimulation: () => void } {
  const [simulations, setSimulations] = useState<WorkloadSimulation[]>([]);
  const [recommended, setRecommended] = useState<WorkloadSimulation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoize parameters to avoid unnecessary recalculations
  const fsrsParams = useMemo(
    () => config.customParameters || defaultParameters,
    [config.customParameters]
  );

  const runSimulation = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Run simulation for multiple retention levels
      const results = simulateRetentionWorkload({
        dailyNewCards: config.dailyNewCards,
        currentCardCount: config.currentCardCount || 0,
        fsrsParameters: fsrsParams
      });

      setSimulations(results);

      // Find recommended retention based on available time
      const recommendedResult = calculateRecommendedRetention(
        results,
        config.availableTimeMinutes
      );

      setRecommended(recommendedResult);

    } catch (err) {
      console.error('Workload simulation failed:', err);
      setError(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-run on config change
  useEffect(() => {
    if (autoRun) {
      runSimulation();
    }
  }, [
    config.dailyNewCards,
    config.availableTimeMinutes,
    config.currentCardCount,
    fsrsParams,
    autoRun
  ]);

  // Generate chart data with CMRR highlighting
  const chartData = useMemo(() => {
    if (simulations.length === 0) return [];

    const data = generateWorkloadChart(simulations);

    // Find CMRR point (minimum workload/knowledge ratio)
    let cmrrRetention = 0.85; // Default fallback
    let minRatio = Infinity;

    for (const point of data) {
      // Ratio = timeMinutes / (retention * 100)
      // Lower is better (less time per % retention)
      const ratio = point.timeMinutes / (point.retention * 100);
      if (ratio < minRatio) {
        minRatio = ratio;
        cmrrRetention = point.retention;
      }
    }

    // Mark CMRR point
    return data.map(point => ({
      ...point,
      isCMRR: Math.abs(point.retention - cmrrRetention) < 0.01
    }));
  }, [simulations]);

  return {
    simulations,
    recommended,
    chartData,
    isLoading,
    error,
    runSimulation
  };
}

/**
 * Hook for comparing current vs. optimized parameters
 * 
 * Shows side-by-side workload projections to demonstrate
 * the efficiency gains from personalized parameters.
 */
export function useParameterComparison(
  config: WorkloadProjectionConfig,
  optimizedParameters?: number[]
): {
  defaultProjection: WorkloadProjectionResult;
  optimizedProjection: WorkloadProjectionResult;
  efficiencyGain: number; // Percentage reduction in daily reviews
} {
  const defaultProjection = useWorkloadProjection(
    { ...config, customParameters: defaultParameters.w },
    !!optimizedParameters
  );

  const optimizedProjection = useWorkloadProjection(
    { ...config, customParameters: optimizedParameters },
    !!optimizedParameters
  );

  // Calculate efficiency gain at target retention
  const efficiencyGain = useMemo(() => {
    if (!optimizedParameters || 
        defaultProjection.simulations.length === 0 || 
        optimizedProjection.simulations.length === 0) {
      return 0;
    }

    // Compare at recommended retention (typically ~85%)
    const targetRetention = 0.85;
    
    const defaultSim = defaultProjection.simulations.find(
      s => Math.abs(s.retention - targetRetention) < 0.01
    );
    
    const optimizedSim = optimizedProjection.simulations.find(
      s => Math.abs(s.retention - targetRetention) < 0.01
    );

    if (!defaultSim || !optimizedSim) return 0;

    const reduction = (defaultSim.dailyReviews - optimizedSim.dailyReviews) / defaultSim.dailyReviews;
    return reduction * 100;
  }, [defaultProjection.simulations, optimizedProjection.simulations, optimizedParameters]);

  return {
    defaultProjection,
    optimizedProjection,
    efficiencyGain
  };
}

/**
 * Hook for live workload monitoring
 * 
 * Tracks current workload and warns if retention target
 * is unsustainable based on actual study time.
 */
export function useWorkloadMonitor(
  targetRetention: number,
  dailyNewCards: number
): {
  currentWorkload: number; // Daily reviews
  isExcessive: boolean; // > 2 hours/day
  isUnsustainable: boolean; // > 3 hours/day
  timeToSteadyState: number; // Days until workload stabilizes
  recommendation: string;
} {
  const projection = useWorkloadProjection({
    dailyNewCards,
    availableTimeMinutes: 120, // 2 hour threshold
    customParameters: undefined
  });

  const currentSimulation = useMemo(() => {
    return projection.simulations.find(
      s => Math.abs(s.retention - targetRetention) < 0.01
    );
  }, [projection.simulations, targetRetention]);

  const currentWorkload = currentSimulation?.dailyReviews || 0;
  const timeMinutes = currentSimulation?.timeMinutes || 0;
  const sustainability = currentSimulation?.sustainabilityScore || 100;

  const isExcessive = timeMinutes > 120; // > 2 hours
  const isUnsustainable = sustainability < 30; // Critical threshold

  // Estimate time to steady state (typically 90-120 days)
  const timeToSteadyState = 90;

  let recommendation = 'Your current retention target is sustainable.';
  
  if (isUnsustainable) {
    const suggestedRetention = projection.recommended?.retention || 0.85;
    recommendation = `⚠️ Your workload is unsustainable (${timeMinutes.toFixed(0)} min/day). ` +
      `Consider lowering retention to ${(suggestedRetention * 100).toFixed(0)}% ` +
      `to maintain ${projection.recommended?.timeMinutes.toFixed(0)} min/day.`;
  } else if (isExcessive) {
    recommendation = `Your workload is high (${timeMinutes.toFixed(0)} min/day). ` +
      `Monitor your burnout risk and consider reducing new cards if needed.`;
  }

  return {
    currentWorkload,
    isExcessive,
    isUnsustainable,
    timeToSteadyState,
    recommendation
  };
}
