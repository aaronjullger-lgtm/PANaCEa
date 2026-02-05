/**
 * Staging Lake Admin: view and drain AI-generated questions from StagingQuestion.
 * Displays vignette, question, aiGrade; Approve (move to live + delete), Reject, Edit explanation.
 */

import React, { useCallback, useState } from 'react';
import { Check, X, Pencil, RefreshCw } from 'lucide-react';

export interface StagingItem {
  id: string;
  system: string;
  difficulty: string;
  status: string;
  vignette: string;
  question: string;
  explanation: string;
  aiGrade?: {
    score?: number;
    isValid?: boolean;
    hasMedicalErrors?: boolean;
    explanationLength?: number;
    [key: string]: unknown;
  } | null;
  adminReview?: string | null;
  createdAt: string;
}

interface StagingLakeProps {
  readonly baseUrl?: string;
  readonly onError?: (message: string) => void;
}

export function StagingLake({ baseUrl = '', onError }: StagingLakeProps) {
  const [items, setItems] = useState<StagingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editExplanation, setEditExplanation] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${baseUrl}/api/admin/staging/list?status=${encodeURIComponent(statusFilter)}&limit=50`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error(res.statusText || 'Failed to load');
      const data = await res.json();
      const list = data?.data?.items ?? data?.items ?? [];
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load staging list';
      onError?.(msg);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, statusFilter, onError]);

  React.useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`${baseUrl}/api/admin/staging/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`${baseUrl}/api/admin/staging/reject`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Reject failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveEdit = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`${baseUrl}/api/admin/staging/update`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, explanation: editExplanation }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, explanation: editExplanation } : i))
      );
      setEditingId(null);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setActionLoading(null);
    }
  };

  const aiScore = (item: StagingItem) => {
    const g = item.aiGrade;
    if (!g || typeof g.score !== 'number') return null;
    return Math.round(g.score * 100);
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-[var(--color-bg-primary)] overflow-hidden">
      <div className="p-4 border-b border-slate-700 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Staging Lake
        </h2>
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-800 text-[var(--color-text-primary)] px-3 py-1.5 text-sm"
        >
          <option value="pending">Pending</option>
          <option value="graded">Graded</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
        <button
          type="button"
          onClick={() => fetchList()}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-[var(--color-text-primary)] hover:bg-slate-700 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="p-8 text-center text-[var(--color-text-muted)]">Loading…</div>
      )}
      {!loading && items.length === 0 && (
        <div className="p-8 text-center text-[var(--color-text-muted)]">
          No staging questions for status &quot;{statusFilter}&quot;.
        </div>
      )}
      {!loading && items.length > 0 && (
        <ul className="divide-y divide-slate-700">
          {items.map((item) => (
            <li key={item.id} className="p-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-slate-400">
                      {item.system} · {item.difficulty}
                    </span>
                    {item.aiGrade != null && (() => {
                      const score = aiScore(item) ?? 0;
                      let badgeClass = 'bg-red-500/20 text-red-400';
                      if (score >= 70) badgeClass = 'bg-emerald-500/20 text-emerald-400';
                      else if (score >= 40) badgeClass = 'bg-amber-500/20 text-amber-400';
                      return (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}
                        >
                          AI: {aiScore(item) ?? '—'}%
                        </span>
                      );
                    })()}
                  </div>
                  <div className="text-sm text-[var(--color-text-muted)] line-clamp-2">
                    {item.vignette}
                  </div>
                  <div className="text-[var(--color-text-primary)] font-medium">
                    {item.question}
                  </div>
                  {editingId === item.id ? (
                    <div className="space-y-2">
                      <textarea
                        aria-label="Edit explanation"
                        value={editExplanation}
                        onChange={(e) => setEditExplanation(e.target.value)}
                        rows={4}
                        placeholder="Explanation"
                        className="w-full rounded-lg border border-slate-600 bg-slate-800 p-2 text-sm text-[var(--color-text-primary)]"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(item.id)}
                          disabled={actionLoading === item.id}
                          className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          <Check size={14} />
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setEditExplanation('');
                          }}
                          className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-[var(--color-text-primary)]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-[var(--color-text-muted)] line-clamp-2">
                      {item.explanation}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {editingId !== item.id && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(item.id);
                          setEditExplanation(item.explanation);
                        }}
                        disabled={actionLoading != null}
                        className="rounded-lg border border-slate-600 p-2 text-slate-400 hover:bg-slate-700 hover:text-[var(--color-text-primary)] disabled:opacity-50"
                        title="Edit explanation"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApprove(item.id)}
                        disabled={actionLoading != null}
                        className="rounded-lg border border-emerald-600 bg-emerald-600/20 p-2 text-emerald-400 hover:bg-emerald-600/30 disabled:opacity-50"
                        title="Approve (move to live pool)"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(item.id)}
                        disabled={actionLoading != null}
                        className="rounded-lg border border-slate-600 p-2 text-slate-400 hover:bg-red-500/20 hover:text-red-400 disabled:opacity-50"
                        title="Reject"
                      >
                        <X size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default StagingLake;
