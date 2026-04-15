import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PrimaryButton } from '../ui/PrimaryButton';
import { Lightbulb, X, Check, ArrowRight, RefreshCw, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../hooks/useAuth';
import { logger } from "@/lib/simple-logger";
import { useReducedMotion } from '@/hooks/useReducedMotion';
const recommendationLogger = logger.scope('RecommendationFeed');

// Cache configuration: Only fetch fresh data if user returns after 6+ hours
const CACHE_KEY = 'panceai_recommendations';
const TIMESTAMP_KEY = 'panceai_recommendations_ts';
const SIX_HOURS_MS = 1000 * 60 * 60 * 6;

// Simple relative time formatter (no date-fns dependency)
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
}

interface StudyRecommendation {
  id: string;
  type: string;
  topic: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  data: any;
}

interface RecommendationFeedProps {
  onNavigateToDrill: (mode: string, settings?: any) => void;
  className?: string;
}

export const RecommendationFeed: React.FC<RecommendationFeedProps> = ({
  onNavigateToDrill,
  className,
}) => {
  const { getToken, isLoading, isSignedIn, user } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const [recommendations, setRecommendations] = useState<StudyRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const fetchRecommendations = async (forceRefresh = false) => {
    try {
      // Check localStorage cache first (unless forcing refresh)
      if (!forceRefresh) {
        const cached = localStorage.getItem(CACHE_KEY);
        const cachedTs = localStorage.getItem(TIMESTAMP_KEY);
        const cachedTimestamp = cachedTs ? parseInt(cachedTs, 10) : null;
        const isFresh = cachedTimestamp && Date.now() - cachedTimestamp < SIX_HOURS_MS;

        if (cached && isFresh) {
          try {
            const cachedData = JSON.parse(cached);
            if (Array.isArray(cachedData)) {
              setRecommendations(cachedData);
              setLastUpdated(cachedTimestamp);
              setLoading(false);
              return; // Skip API call - cache is fresh
            }
          } catch {
            // Invalid cache, continue to fetch
          }
        }
      }

      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch('/api/recommendations', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API error (${res.status}): ${errorText}`);
      }

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(
          `Expected JSON but received ${contentType || 'unknown content type'}. Server may have returned HTML (404/500 error).`
        );
      }

      const data = (await res.json()) as unknown[] | { data?: unknown[] };

      // Handle both shapes: Cloudflare list returns { data }, legacy may return array at root
      const list = (
        Array.isArray(data)
          ? data
          : data && typeof data === 'object' && 'data' in data && data.data
            ? data.data
            : []
      ) as StudyRecommendation[];
      const now = Date.now();
      setRecommendations(list);
      setLastUpdated(now);
      localStorage.setItem(CACHE_KEY, JSON.stringify(list));
      localStorage.setItem(TIMESTAMP_KEY, now.toString());
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      recommendationLogger.warn('Failed to fetch recommendations', { errorMsg });
      toast.error('Failed to load recommendations. Please try again.', { id: 'recommendations-error' });
      setRecommendations([]); // Clear on error
    } finally {
      setLoading(false);
    }
  };

  const generateRecommendations = async () => {
    setGenerating(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Authentication required');
        setGenerating(false);
        return;
      }

      const res = await fetch('/api/recommendations/generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Generate API error (${res.status}): ${errorText}`);
      }

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Expected JSON but received ${contentType || 'unknown content type'}`);
      }

      const data = (await res.json()) as {
        data?: { recommendations?: unknown[] };
        recommendations?: unknown[];
      };

      // Handle response structure from generate endpoint: { data: { success, count, recommendations } }
      const payload = data?.data ?? data;
      const newRecs = Array.isArray(payload?.recommendations) ? payload.recommendations : [];

      if (newRecs.length > 0) {
        toast.success(
          `Found ${newRecs.length} new recommendation${newRecs.length > 1 ? 's' : ''}!`
        );
        await fetchRecommendations(true); // Refresh list - bypass cache
      } else {
        // Only show "all caught up" if generation succeeded but found nothing
        toast.info("You're all caught up! No new recommendations.");
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      recommendationLogger.warn('Failed to generate recommendations', { errorMsg });
      toast.error('Failed to analyze progress. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    // Guard: Only fetch when Clerk has loaded AND user is authenticated
    if (!isLoading && isSignedIn && user) {
      fetchRecommendations();
    }
    // Note: Auto-generation removed to reduce API load.
    // User can manually trigger via Refresh button.
  }, [isLoading, isSignedIn, user?.id]);

  const handleAction = async (id: string, action: 'complete' | 'dismiss') => {
    // Optimistic update
    setRecommendations((prev) => prev.filter((r) => r.id !== id));

    try {
      const token = await getToken();
      if (!token) {
        toast.error('Please sign in to manage recommendations.', { id: 'recommendations-auth' });
        fetchRecommendations(); // Revert
        return;
      }

      // Use the action endpoint with body containing recommendationId and action
      const res = await fetch('/api/recommendations/action', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recommendationId: id, action }),
      });

      if (!res.ok) {
        throw new Error('Failed to update recommendation');
      }

      if (action === 'complete') {
        toast.success('Marked as complete!');
      }
    } catch (e) {
      toast.error('Failed to update status.', { id: 'recommendations-status-error' });
      fetchRecommendations(); // Revert
    }
  };

  const handleStart = (rec: StudyRecommendation) => {
    if (rec.type === 'review') {
      // Navigate to review session for this topic
      // Assuming 'custom_practice' or similar can take topic/conditionId
      onNavigateToDrill('custom_practice', {
        conditionId: rec.data?.conditionId,
        mode: 'tutor',
      });
    } else if (rec.type === 'drill_session') {
      onNavigateToDrill('core_adaptive', { focus: 'due' });
    }

    // Auto-complete or just leave pending?
    // Usually user clicks start, we don't know if they finish.
    // Leaving pending is safer. They can mark "Done" in feed or we track it later.
    // Let's dismiss it from feed so it doesn't clutter? No, keep it until action.
  };

  if (loading) return (
    <div className={`mb-8 ${className}`} aria-busy="true">
      <div className="h-6 w-48 rounded bg-[var(--color-bg-secondary)] animate-pulse mb-4" />
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-[var(--color-bg-secondary)] animate-pulse" />
        ))}
      </div>
    </div>
  );

  if (recommendations.length === 0 && !generating) return (
    <div className={`mb-8 ${className}`}>
      <h3 className="text-lg font-bold flex items-center gap-2 text-[var(--color-text-primary)] mb-3">
        <Sparkles className="w-5 h-5 text-[var(--color-data-provisional)]" />
        Smart Recommendations
      </h3>
      <p className="text-sm text-[var(--color-text-muted)]">
        Complete a few more practice questions to unlock personalized study recommendations.
      </p>
    </div>
  );

  return (
    <div className={`mb-8 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2 text-[var(--color-text-primary)]">
          <Sparkles className="w-5 h-5 text-[var(--color-data-provisional)]" />
          Smart Recommendations
        </h3>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-[var(--color-text-muted)]">
              Updated {formatRelativeTime(lastUpdated)}
            </span>
          )}
          <button
            onClick={generateRecommendations}
            disabled={generating}
            className="p-2 rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh Analysis"
            aria-label="Refresh recommendations"
          >
            <RefreshCw
              className={`w-4 h-4 text-[var(--color-text-muted)] ${generating ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      <div className="w-full grid gap-4 md:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {recommendations.map((rec, index) => (
            <motion.div
              key={rec.id || `rec-${index}-${rec.topic}-${rec.type}`}
              layout={!prefersReducedMotion}
              initial={prefersReducedMotion ? false : { scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={prefersReducedMotion ? undefined : { scale: 0.95 }}
              className="relative p-5 rounded-xl bg-[var(--color-bg-secondary)] shadow-sm group transition-all duration-200"
            >
              {/* Priority Indicator */}
              {rec.priority === 'high' && (
                <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[var(--color-data-fail)] shadow-[0_0_8px_var(--color-data-fail)]" />
              )}

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="p-3 rounded-lg bg-[var(--color-data-provisional)]/10 text-[var(--color-data-provisional)]">
                    <Lightbulb className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-[var(--color-text-primary)] line-clamp-1" title={rec.topic}>
                      {rec.topic}
                    </h4>
                    <p className="text-sm text-[var(--color-text-muted)] mt-0.5 line-clamp-2" title={rec.reason}>
                      {rec.reason}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleAction(rec.id, 'dismiss')}
                    className="h-10 w-10 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
                    title="Dismiss"
                    aria-label="Dismiss"
                  >
                    <X className="w-4 h-4 mx-auto" aria-hidden="true" />
                  </button>

                  <button
                    onClick={() => handleAction(rec.id, 'complete')}
                    className="h-10 w-10 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-data-pass)] hover:bg-[var(--color-data-pass)]/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
                    title="Mark as Done"
                    aria-label="Mark as done"
                  >
                    <Check className="w-4 h-4 mx-auto" aria-hidden="true" />
                  </button>

                  <PrimaryButton
                    variant="primary"
                    size="md"
                    onClick={() => handleStart(rec)}
                    iconRight={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
                    className="text-sm w-full sm:w-auto"
                  >
                    Start
                  </PrimaryButton>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {generating && recommendations.length === 0 && (
          <div className="col-span-full py-8 flex flex-col items-center justify-center text-[var(--color-text-muted)]">
            <Loader2 className="w-8 h-8 animate-spin mb-2 text-[var(--color-accent)]" />
            <p>Analyzing your learning profile...</p>
          </div>
        )}
      </div>
    </div>
  );
};
