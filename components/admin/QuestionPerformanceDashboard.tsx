import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart3,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Filter,
  Flag,
  Clock,
  Target,
  Zap,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { VirtualizedTableBody } from '@/components/ui/VirtualizedTableBody';
import { InlineSpinner } from '@/components/loading';

interface QuestionPerformance {
  questionId: string;
  questionText: string;
  system: string;
  conditionId: string | null;
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number;
  avgTimeMs: number | null;
  flagCount: number;
  qualityScore: number;
}

interface PerformanceSummary {
  totalQuestionsAnalyzed: number;
  avgAccuracy: number;
  lowAccuracyCount: number;
  highFlagCount: number;
  needsReviewCount: number;
}

const getQualityColor = (score: number) => {
  if (score >= 70) return 'text-[var(--color-data-pass)]';
  if (score >= 50) return 'text-[var(--color-data-provisional)]';
  return 'text-[var(--color-data-fail)]';
};

const getQualityBg = (score: number) => {
  if (score >= 70) return 'bg-[var(--color-data-pass)]/10';
  if (score >= 50) return 'bg-[var(--color-data-provisional)]/10';
  return 'bg-[var(--color-data-fail)]/10';
};

const getAccuracyColor = (accuracy: number) => {
  if (accuracy >= 70) return 'text-[var(--color-data-pass)]';
  if (accuracy >= 50) return 'text-[var(--color-data-provisional)]';
  return 'text-[var(--color-data-fail)]';
};

/** Grid columns for header and virtualized rows (DOM bloat audit: only visible rows in DOM). */
const TABLE_GRID_COLUMNS = 'minmax(12rem,1fr) 5rem 4rem 5rem 4rem 5rem 4rem';

export const QuestionPerformanceDashboard: React.FC = () => {
  const { getToken } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [questions, setQuestions] = useState<QuestionPerformance[]>([]);
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'accuracy' | 'quality' | 'attempts' | 'flags'>('quality');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  const fetchPerformance = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const params = new URLSearchParams({
        sortBy,
        order,
        limit: '100',
      });

      const response = await fetch(`/api/questions/performance?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch performance data');
      }

      const result = (await response.json()) as {
        data?: { questions?: QuestionPerformance[]; summary?: PerformanceSummary | null };
      };
      setQuestions(result.data?.questions || []);
      setSummary(result.data?.summary ?? null);
    } catch (err) {
      console.error('Error fetching performance:', err);
      setError(err instanceof Error ? err.message : 'Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, [sortBy, order]);

  const formatTime = (ms: number | null) => {
    if (!ms) return '-';
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${minutes}m ${remaining}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[var(--color-accent)]/10 rounded-xl">
            <BarChart3 className="w-6 h-6 text-[var(--color-accent)]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
              Question Performance
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Identify and improve low-performing questions
            </p>
          </div>
        </div>
        <button
          onClick={fetchPerformance}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg hover:bg-[var(--color-accent)]/90 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-[var(--color-text-muted)]" />
              <span className="text-xs font-medium text-[var(--color-text-muted)]">Analyzed</span>
            </div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">
              {summary.totalQuestionsAnalyzed}
            </p>
          </div>
          <div className="bg-[var(--color-accent)]/10 rounded-xl p-4 border border-[var(--color-accent)]/20">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-[var(--color-accent)]" />
              <span className="text-xs font-medium text-[var(--color-accent)]">Avg Accuracy</span>
            </div>
            <p className="text-2xl font-bold text-[var(--color-accent)]">{summary.avgAccuracy}%</p>
          </div>
          <div className="bg-[var(--color-data-fail)]/10 rounded-xl p-4 border border-[var(--color-data-fail)]/20">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-[var(--color-data-fail)]" />
              <span className="text-xs font-medium text-[var(--color-data-fail)]">
                Low Accuracy
              </span>
            </div>
            <p className="text-2xl font-bold text-[var(--color-data-fail)]">
              {summary.lowAccuracyCount}
            </p>
          </div>
          <div className="bg-[var(--color-data-provisional)]/10 rounded-xl p-4 border border-[var(--color-data-provisional)]/20">
            <div className="flex items-center gap-2 mb-1">
              <Flag className="w-4 h-4 text-[var(--color-data-provisional)]" />
              <span className="text-xs font-medium text-[var(--color-data-provisional)]">
                Flagged
              </span>
            </div>
            <p className="text-2xl font-bold text-[var(--color-data-provisional)]">
              {summary.highFlagCount}
            </p>
          </div>
          <div className="bg-[var(--color-data-provisional)]/10 rounded-xl p-4 border border-[var(--color-data-provisional)]/20">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-[var(--color-data-provisional)]" />
              <span className="text-xs font-medium text-[var(--color-data-provisional)]">
                Needs Review
              </span>
            </div>
            <p className="text-2xl font-bold text-[var(--color-data-provisional)]">
              {summary.needsReviewCount}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center bg-[var(--color-bg-secondary)] rounded-xl p-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--color-text-muted)]" />
          <span className="text-sm font-medium text-[var(--color-text-secondary)]">Sort by:</span>
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] text-sm"
          aria-label="Sort by"
          title="Sort by"
        >
          <option value="quality">Quality Score</option>
          <option value="accuracy">Accuracy</option>
          <option value="attempts">Attempts</option>
          <option value="flags">Flag Count</option>
        </select>
        <select
          value={order}
          onChange={(e) => setOrder(e.target.value as typeof order)}
          className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] text-sm"
          aria-label="Sort order"
          title="Sort order"
        >
          <option value="asc">Worst First</option>
          <option value="desc">Best First</option>
        </select>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-[var(--color-data-fail)]/10 border border-[var(--color-data-fail)]/20 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-[var(--color-data-fail)]" />
          <span className="text-[var(--color-data-fail)]">{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Loading question performance"
          className="flex items-center justify-center py-12"
        >
          <InlineSpinner size="lg" className="text-[var(--color-accent)]" />
        </div>
      )}

      {/* Questions Table — virtualized body: only ~10–15 visible rows in DOM (DOM bloat audit) */}
      {!loading && !error && (
        <div
          className="bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] overflow-hidden"
          role="region"
          aria-label="Question performance table"
        >
          <div className="overflow-x-auto">
            {/* Header row with same grid as body for alignment */}
            <div
              className="grid bg-[var(--color-bg-secondary)] shrink-0 border-b border-[var(--color-border)]"
              style={{ gridTemplateColumns: TABLE_GRID_COLUMNS }}
            >
              <div className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                Question
              </div>
              <div className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                System
              </div>
              <div className="px-4 py-3 text-center text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                Quality
              </div>
              <div className="px-4 py-3 text-center text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                Accuracy
              </div>
              <div className="px-4 py-3 text-center text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                Attempts
              </div>
              <div className="px-4 py-3 text-center text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                Avg Time
              </div>
              <div className="px-4 py-3 text-center text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                Flags
              </div>
            </div>
            {/* Scroll container: only visible rows rendered (windowing) */}
            <div ref={scrollContainerRef} className="overflow-auto min-h-[200px] max-h-[60vh]">
              <VirtualizedTableBody
                items={questions}
                parentRef={scrollContainerRef}
                gridTemplateColumns={TABLE_GRID_COLUMNS}
                emptyMessage={
                  <>
                    No question performance data available yet.
                    <br />
                    <span className="text-sm">
                      Questions need at least 5 attempts to appear here.
                    </span>
                  </>
                }
                renderRow={(q) => (
                  <>
                    <div className="px-4 py-3">
                      <div className="max-w-xs truncate text-sm text-[var(--color-text-primary)]">
                        {q.questionText}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] font-mono">
                        {q.questionId.slice(0, 8)}...
                      </div>
                    </div>
                    <div className="px-4 py-3">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
                        {q.system}
                      </span>
                    </div>
                    <div className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-full ${getQualityBg(q.qualityScore)} ${getQualityColor(q.qualityScore)}`}
                      >
                        <Zap className="w-3 h-3" />
                        {q.qualityScore}
                      </span>
                    </div>
                    <div className="px-4 py-3 text-center">
                      <span className={`text-sm font-medium ${getAccuracyColor(q.accuracy)}`}>
                        {q.accuracy}%
                      </span>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {q.correctAttempts}/{q.totalAttempts}
                      </div>
                    </div>
                    <div className="px-4 py-3 text-center text-sm text-[var(--color-text-secondary)]">
                      {q.totalAttempts}
                    </div>
                    <div className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)]">
                        <Clock className="w-3 h-3" />
                        {formatTime(q.avgTimeMs)}
                      </span>
                    </div>
                    <div className="px-4 py-3 text-center">
                      {q.flagCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-[var(--color-data-fail)]/10 text-[var(--color-data-fail)]">
                          <Flag className="w-3 h-3" />
                          {q.flagCount}
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">-</span>
                      )}
                    </div>
                  </>
                )}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionPerformanceDashboard;
