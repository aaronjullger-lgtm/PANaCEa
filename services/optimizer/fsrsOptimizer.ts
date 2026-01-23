/**
 * FSRS Optimizer Service (Phase 5: Self-Optimizing Engine)
 *
 * Leverages the existing fsrs-params API endpoint which already implements
 * L-BFGS optimization on the server side. This provides a simpler integration
 * than client-side WASM while still delivering personalized parameters.
 *
 * Reference: FSRS Paper - Default parameters are 20-30% less efficient than
 * personalized parameters for mature users (20k+ user study).
 */

export interface ReviewRecord {
  id: string;
  userId: string;
  questionId: string;
  wasCorrect: boolean;
  createdAt: Date;
  durationMs?: number | null;
  telemetryJson?: any;
}

export interface OptimizationResult {
  parameters: number[]; // 21-parameter array
  metrics: {
    rmse?: number;
    logLoss?: number;
    recordCount: number;
    improvementVsDefault: number; // Percentage improvement
  };
  timestamp: Date;
}

export interface OptimizationProgress {
  stage: 'fetching' | 'computing' | 'validating' | 'complete';
  progress: number; // 0-100
  message: string;
}

/**
 * Main optimization function - triggers server-side optimization
 *
 * @param userId - User ID to optimize for
 * @param onProgress - Optional callback for progress updates
 * @returns OptimizationResult with new parameters and metrics
 */
export async function optimizeFSRSParameters(
  userId: string,
  onProgress?: (progress: OptimizationProgress) => void
): Promise<OptimizationResult> {
  try {
    // Stage 1: Trigger optimization
    onProgress?.({
      stage: 'fetching',
      progress: 10,
      message: 'Fetching your review history...',
    });

    // Stage 2: Compute parameters (server-side)
    onProgress?.({
      stage: 'computing',
      progress: 50,
      message: 'Running optimization (this may take 10-30 seconds)...',
    });

    const response = await fetch('/api/user/fsrs-params', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Optimization failed: ${response.statusText}`);
    }

    const data = await response.json();

    // Stage 3: Validate results
    onProgress?.({
      stage: 'validating',
      progress: 80,
      message: 'Validating optimized parameters...',
    });

    if (!data.params || !data.params.w || data.params.w.length !== 21) {
      throw new Error('Server returned invalid parameters');
    }

    // Calculate improvement
    const improvement = data.params.improvementOverDefault || 0;

    // Stage 4: Complete
    onProgress?.({
      stage: 'complete',
      progress: 100,
      message: `Optimization complete! ${improvement.toFixed(1)}% improvement over defaults.`,
    });

    return {
      parameters: data.params.w,
      metrics: {
        rmse: data.params.brierScore || undefined,
        logLoss: undefined,
        recordCount: data.params.sampleSize || 0,
        improvementVsDefault: improvement,
      },
      timestamp: new Date(),
    };
  } catch (error) {
    console.error('FSRS optimization failed:', error);
    throw error;
  }
}

/**
 * Save optimized parameters (handled by server endpoint)
 */
export async function saveOptimizedParameters(userId: string, parameters: number[]): Promise<void> {
  // Parameters are already saved by the POST endpoint
  // This is a no-op for API compatibility
  return Promise.resolve();
}

/**
 * Get current optimization status for user
 */
export async function getOptimizationStatus(userId: string): Promise<{
  isOptimized: boolean;
  lastOptimized?: Date;
  parameters?: number[];
  recordCount?: number;
}> {
  const response = await fetch(`/api/user/fsrs-params`);

  if (!response.ok) {
    throw new Error(`Failed to get optimization status: ${response.statusText}`);
  }

  const data = await response.json();

  return {
    isOptimized: !data.params.isDefault,
    lastOptimized: data.params.lastOptimizedAt ? new Date(data.params.lastOptimizedAt) : undefined,
    parameters: data.params.w,
    recordCount: data.params.sampleSize,
  };
}
