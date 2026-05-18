/**
 * useCausalChain — React hook for causal chain generation lifecycle
 *
 * Manages the async generation of mechanistic causal reasoning chains
 * via the /api/causal-chain/generate edge function. Handles:
 * - Triggering generation after answer reveal
 * - Loading and error states
 * - In-memory caching (same question → same chain within session)
 * - Expertise-adaptive display level mapping
 *
 * Research basis (tier1.md Item 4):
 * - Woods, Brooks & Norman (2005): Causal mechanism explanations
 *   outperform controls for diagnostic reasoning transfer
 * - Kalyuga (2003), Salden et al. (2010): Expertise reversal —
 *   fading scaffolding as learner advances
 *
 * @module hooks/useCausalChain
 * Sprint: Tier 1 Research Implementation — Item 4
 */

import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { CausalChain, CausalChainDisplayLevel } from '@/types/causalChain';
import { getApiEnvelopeError, unwrapApiEnvelope } from '@/lib/utils/apiEnvelope';

// ─── Types ─────────────────────────────────────────────────────────

interface CausalChainRequest {
  questionId: string;
  questionText: string;
  correctAnswer: string;
  condition: string;
  studentAnswer?: string;
  system?: string;
}

export interface UseCausalChainResult {
  /** The generated causal chain, or null if not yet generated */
  chain: CausalChain | null;
  /** Whether generation is in progress */
  isLoading: boolean;
  /** Error message if generation failed */
  error: string | null;
  /** Trigger chain generation for a question */
  generate: (request: CausalChainRequest) => void;
  /** Reset state (e.g., when moving to next question) */
  reset: () => void;
}

// ─── Display Level Mapping ─────────────────────────────────────────

/**
 * Maps scaffolding levels from the cognitive load optimizer to causal chain
 * display levels. Two scaffolding systems exist in PANaCEa:
 *
 * cognitiveLoadOptimizer: 'none' | 'light' | 'moderate' | 'heavy'
 * desirableDifficulties:  'none' | 'minimal' | 'moderate' | 'high'
 *
 * This function accepts either system's output and maps to display levels:
 * - EXPERT  (none)     → 'pearl':     One-line clinical correlation
 * - COMPETENT (light/minimal) → 'skeleton': Entity → Consequence flow
 * - DEVELOPING (moderate)     → 'collapsed': Click to expand mechanisms
 * - NOVICE (heavy/high)       → 'full':      All mechanisms visible
 *
 * Research: Kalyuga (2003) expertise reversal effect — redundant scaffolding
 * actively harms learning for advanced students.
 */
export function scaffoldingToDisplayLevel(
  scaffolding: 'none' | 'light' | 'minimal' | 'moderate' | 'heavy' | 'high'
): CausalChainDisplayLevel {
  switch (scaffolding) {
    case 'none':
      return 'pearl';
    case 'light':
    case 'minimal':
      return 'skeleton';
    case 'moderate':
      return 'collapsed';
    case 'heavy':
    case 'high':
      return 'full';
    default:
      return 'collapsed';
  }
}

/**
 * Maps a numeric expertise score (0-1) directly to a display level.
 * Useful when you have the raw expertise value but not the scaffolding label.
 *
 * Thresholds match cognitiveLoadOptimizer.ts:
 * - > 0.7 → pearl (expert, minimal display)
 * - > 0.5 → skeleton (competent, entity flow only)
 * - > 0.3 → collapsed (developing, click to expand)
 * - ≤ 0.3 → full (novice, everything visible)
 */
export function expertiseToDisplayLevel(expertise: number): CausalChainDisplayLevel {
  if (expertise > 0.7) return 'pearl';
  if (expertise > 0.5) return 'skeleton';
  if (expertise > 0.3) return 'collapsed';
  return 'full';
}

// ─── Hook ──────────────────────────────────────────────────────────

/**
 * React hook for managing causal chain generation lifecycle.
 *
 * Usage:
 * ```tsx
 * const { chain, isLoading, error, generate, reset } = useCausalChain();
 *
 * // After answer is revealed:
 * generate({
 *   questionId: question.id,
 *   questionText: question.text,
 *   correctAnswer: question.options[question.correctAnswerIndex],
 *   condition: question.condition,
 *   studentAnswer: question.options[selectedAnswerIndex],
 * });
 *
 * // When moving to next question:
 * reset();
 * ```
 */
export function useCausalChain(): UseCausalChainResult {
  const { getToken } = useAuth();
  const [chain, setChain] = useState<CausalChain | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Session-level cache: questionId → CausalChain
  const cacheRef = useRef<Map<string, CausalChain>>(new Map());

  // Track in-flight request to prevent duplicates
  const inflightRef = useRef<string | null>(null);

  const generate = useCallback(
    async (request: CausalChainRequest) => {
      // Check session cache first
      const cached = cacheRef.current.get(request.questionId);
      if (cached) {
        setChain(cached);
        setError(null);
        setIsLoading(false);
        return;
      }

      // Prevent duplicate requests for the same question
      if (inflightRef.current === request.questionId) return;
      inflightRef.current = request.questionId;

      setIsLoading(true);
      setError(null);
      setChain(null);

      try {
        const token = await getToken();
        if (!token) {
          setError('Authentication required');
          return;
        }

        const response = await fetch('/api/causal-chain/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const msg = getApiEnvelopeError(body, `Server error (${response.status})`);
          setError(msg);
          return;
        }

        const generatedChain = unwrapApiEnvelope<CausalChain | undefined>(await response.json());

        if (!generatedChain) {
          setError('Invalid response from server');
          return;
        }

        // Cache and set
        cacheRef.current.set(request.questionId, generatedChain);
        setChain(generatedChain);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to generate causal chain';
        setError(msg);
      } finally {
        setIsLoading(false);
        inflightRef.current = null;
      }
    },
    [getToken]
  );

  const reset = useCallback(() => {
    setChain(null);
    setIsLoading(false);
    setError(null);
  }, []);

  return { chain, isLoading, error, generate, reset };
}

export default useCausalChain;
