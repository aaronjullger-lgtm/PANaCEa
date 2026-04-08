/**
 * QuestionReviewQueue — Phase 2.1 Admin UI
 *
 * Displays PreGeneratedQuestions awaiting review with approve/reject/needs_revision
 * actions, quality score display, batch auto-approve, and queue statistics.
 *
 * Reads from: GET /api/admin/question-review
 * Writes to:  POST /api/admin/question-review
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  X,
  AlertTriangle,
  RefreshCw,
  Filter,
  BarChart3,
  Zap,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReviewQuestion {
  id: string;
  system: string | null;
  conditionId: string | null;
  difficulty: string;
  questionType: string;
  qualityScore: number | null;
  validationStatus: string;
  validationNotes: string | null;
  validatedBy: string | null;
  validatedAt: string | null;
  flagCount: number;
  flagRate: number | null;
  timesServed: number;
  generatedAt: string;
  questionData: {
    question?: string;
    vignette?: string;
    options?: string[];
    correctAnswer?: string | number;
    explanation?: string;
    [key: string]: unknown;
  };
  condition?: { condition: string } | null;
}

interface QueueStats {
  pending: number;
  approved: number;
  rejected: number;
  needs_revision: number;
  total: number;
}

interface QuestionReviewQueueProps {
  readonly baseUrl?: string;
  readonly onError?: (message: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function qualityColor(score: number | null): string {
  if (score === null) return 'text-[var(--color-text-muted)]';
  if (score >= 0.9) return 'text-[var(--color-data-pass)]';
  if (score >= 0.7) return 'text-[var(--color-data-provisional)]';
  return 'text-[var(--color-data-fail)]';
}

function statusBadge(status: string): { bg: string; text: string; label: string } {
  switch (status) {
    case 'approved':
      return { bg: 'bg-[var(--color-data-pass)]/15', text: 'text-[var(--color-data-pass)]', label: 'Approved' };
    case 'rejected':
      return { bg: 'bg-[var(--color-data-fail)]/15', text: 'text-[var(--color-data-fail)]', label: 'Rejected' };
    case 'needs_revision':
      return { bg: 'bg-[var(--color-data-provisional)]/15', text: 'text-[var(--color-data-provisional)]', label: 'Needs Revision' };
    default:
      return { bg: 'bg-[var(--color-bg-tertiary)]/15', text: 'text-[var(--color-text-muted)]', label: 'Pending' };
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function QuestionReviewQueue({ baseUrl = '', onError }: QuestionReviewQueueProps) {
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [systemFilter, setSystemFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('qualityScore');
  const [sortOrder, setSortOrder] = useState<string>('asc');

  // ── Fetch queue stats ────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(
        `${baseUrl}/api/admin/question-review?action=stats`,
        { credentials: 'include' }
      );
      if (!res.ok) return;
      const data = await res.json();
      setStats(data?.data?.stats ?? data?.stats ?? null);
    } catch {
      // Stats are non-critical — fail silently
    }
  }, [baseUrl]);

  // ── Fetch questions ──────────────────────────────────────────────────────
  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        validationStatus: statusFilter,
        sortBy,
        sortOrder,
        limit: '50',
      });
      if (systemFilter) params.set('system', systemFilter);

      const res = await fetch(
        `${baseUrl}/api/admin/question-review?${params}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error(res.statusText || 'Failed to load');
      const data = await res.json();
      const list = data?.data?.questions ?? data?.questions ?? [];
      setQuestions(Array.isArray(list) ? list : []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load review queue';
      onError?.(msg);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, statusFilter, systemFilter, sortBy, sortOrder, onError]);

  useEffect(() => {
    fetchQuestions();
    fetchStats();
  }, [fetchQuestions, fetchStats]);

  // ── Review action ────────────────────────────────────────────────────────
  const handleReview = useCallback(
    async (questionId: string, newStatus: string) => {
      setActionLoading(questionId);
      try {
        const res = await fetch(`${baseUrl}/api/admin/question-review`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId,
            validationStatus: newStatus,
            validationNotes: reviewNote || undefined,
          }),
        });
        if (!res.ok) throw new Error('Review action failed');

        // Remove from list and refresh stats
        setQuestions((prev) => prev.filter((q) => q.id !== questionId));
        setExpandedId(null);
        setReviewNote('');
        fetchStats();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Review action failed';
        onError?.(msg);
      } finally {
        setActionLoading(null);
      }
    },
    [baseUrl, reviewNote, onError, fetchStats]
  );

  // ── Batch auto-approve ───────────────────────────────────────────────────
  const handleAutoApprove = useCallback(async () => {
    setActionLoading('batch');
    try {
      const res = await fetch(`${baseUrl}/api/admin/question-review?action=auto-approve`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Auto-approve failed');
      const data = await res.json();
      const count = data?.data?.approvedCount ?? data?.approvedCount ?? 0;
      // Refresh both lists
      fetchQuestions();
      fetchStats();
      if (count > 0) {
        // Could use toast here
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Auto-approve failed';
      onError?.(msg);
    } finally {
      setActionLoading(null);
    }
  }, [baseUrl, onError, fetchQuestions, fetchStats]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
            Question Review Queue
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Review AI-generated questions before they reach students
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAutoApprove}
            disabled={actionLoading === 'batch'}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-data-pass)]/15 text-[var(--color-data-pass)] hover:bg-[var(--color-data-pass)]/25 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Zap className="w-4 h-4" />
            Auto-Approve High Quality
          </button>
          <button
            onClick={() => { fetchQuestions(); fetchStats(); }}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            { label: 'Pending', value: stats.pending, color: 'text-[var(--color-text-muted)]' },
            { label: 'Approved', value: stats.approved, color: 'text-[var(--color-data-pass)]' },
            { label: 'Needs Revision', value: stats.needs_revision, color: 'text-[var(--color-data-provisional)]' },
            { label: 'Rejected', value: stats.rejected, color: 'text-[var(--color-data-fail)]' },
          ] as const).map(({ label, value, color }) => (
            <div
              key={label}
              className="p-3 rounded-lg bg-[var(--color-bg-secondary)]/40 border border-[var(--color-border)]/30"
            >
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-[var(--color-text-muted)]" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]/50 text-sm text-[var(--color-text-primary)]"
        >
          <option value="pending">Pending</option>
          <option value="needs_revision">Needs Revision</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <input
          type="text"
          placeholder="Filter by system..."
          value={systemFilter}
          onChange={(e) => setSystemFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]/50 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] w-40"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]/50 text-sm text-[var(--color-text-primary)]"
        >
          <option value="qualityScore">Quality Score</option>
          <option value="generatedAt">Date Generated</option>
          <option value="flagCount">Flag Count</option>
        </select>
        <button
          onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
          className="p-1.5 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]/50 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          {sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Question List */}
      {loading ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">Loading...</div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12">
          <ShieldCheck className="w-12 h-12 mx-auto text-[var(--color-data-pass)]/50 mb-3" />
          <p className="text-[var(--color-text-muted)]">
            No questions matching this filter. Queue is clear!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => {
            const isExpanded = expandedId === q.id;
            const badge = statusBadge(q.validationStatus);
            const qData = q.questionData || {};

            return (
              <div
                key={q.id}
                className="rounded-xl border border-[var(--color-border)]/40 bg-[var(--color-bg-secondary)]/30 overflow-hidden"
              >
                {/* Collapsed Row */}
                <button
                  onClick={() => { setExpandedId(isExpanded ? null : q.id); setReviewNote(''); }}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-[var(--color-bg-secondary)]/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--color-text-primary)] line-clamp-1 font-medium">
                      {qData.question || qData.vignette?.slice(0, 100) || 'No question text'}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-text-muted)]">
                      <span>{q.system || 'No system'}</span>
                      <span>{q.difficulty}</span>
                      <span>{q.questionType}</span>
                      {q.condition?.condition && (
                        <span className="truncate max-w-[150px]">{q.condition.condition}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-sm font-mono font-bold ${qualityColor(q.qualityScore)}`}>
                      {q.qualityScore !== null ? (q.qualityScore * 100).toFixed(0) + '%' : '—'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                    {q.flagCount > 0 && (
                      <span className="flex items-center gap-1 text-xs text-[var(--color-data-fail)]">
                        <AlertTriangle className="w-3 h-3" /> {q.flagCount}
                      </span>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-[var(--color-border)]/30 p-4 space-y-4">
                    {/* Vignette */}
                    {qData.vignette && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
                          Vignette
                        </h4>
                        <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
                          {qData.vignette}
                        </p>
                      </div>
                    )}

                    {/* Question */}
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
                        Question
                      </h4>
                      <p className="text-sm text-[var(--color-text-primary)] font-medium">
                        {qData.question || 'N/A'}
                      </p>
                    </div>

                    {/* Options */}
                    {Array.isArray(qData.options) && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
                          Options
                        </h4>
                        <div className="space-y-1">
                          {qData.options.map((opt: string, i: number) => (
                            <div
                              key={i}
                              className={`text-sm px-3 py-1.5 rounded-lg ${
                                String(qData.correctAnswer) === String(i) ||
                                String(qData.correctAnswer) === opt
                                  ? 'bg-[var(--color-data-pass)]/10 text-[var(--color-data-pass)] border border-[var(--color-data-pass)]/20'
                                  : 'bg-[var(--color-bg-secondary)]/40 text-[var(--color-text-secondary)]'
                              }`}
                            >
                              {String.fromCharCode(65 + i)}. {opt}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Explanation */}
                    {qData.explanation && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
                          Explanation
                        </h4>
                        <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
                          {qData.explanation}
                        </p>
                      </div>
                    )}

                    {/* Metrics */}
                    <div className="flex flex-wrap gap-4 text-xs text-[var(--color-text-muted)]">
                      <span>Served: {q.timesServed}x</span>
                      <span>Flags: {q.flagCount}</span>
                      <span>Generated: {new Date(q.generatedAt).toLocaleDateString()}</span>
                      {q.validatedBy && <span>Reviewed by: {q.validatedBy}</span>}
                    </div>

                    {/* Review Note */}
                    <textarea
                      placeholder="Optional review note..."
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)]/50 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none"
                      rows={2}
                    />

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReview(q.id, 'approved')}
                        disabled={actionLoading === q.id}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-data-pass)]/15 text-[var(--color-data-pass)] hover:bg-[var(--color-data-pass)]/25 text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" /> Approve
                      </button>
                      <button
                        onClick={() => handleReview(q.id, 'needs_revision')}
                        disabled={actionLoading === q.id}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-data-provisional)]/15 text-[var(--color-data-provisional)] hover:bg-[var(--color-data-provisional)]/25 text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        <AlertTriangle className="w-4 h-4" /> Needs Revision
                      </button>
                      <button
                        onClick={() => handleReview(q.id, 'rejected')}
                        disabled={actionLoading === q.id}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-data-fail)]/15 text-[var(--color-data-fail)] hover:bg-[var(--color-data-fail)]/25 text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        <X className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default QuestionReviewQueue;
