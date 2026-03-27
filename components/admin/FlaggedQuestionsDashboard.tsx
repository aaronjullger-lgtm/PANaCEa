import React, { useState, useEffect } from 'react';
import {
  Flag,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  User,
  Calendar,
  Tag,
  BookOpen,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface QuestionFlag {
  id: string;
  userId: string;
  userEmail: string | null;
  userFirstName: string | null;
  questionId: string;
  questionText: string;
  correctAnswer: string | null;
  topic: string | null;
  system: string | null;
  flagType: string;
  description: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

interface FlagStats {
  total: number;
  pending: number;
  inReview: number;
  fixed: number;
  dismissed: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}

const FLAG_TYPE_LABELS: Record<string, string> = {
  incorrect_answer: 'Incorrect Answer',
  wrong_explanation: 'Wrong Explanation',
  typo: 'Typo/Grammar',
  outdated_content: 'Outdated Content',
  unclear_question: 'Unclear Question',
  duplicate: 'Duplicate Question',
  other: 'Other Issue',
};

const PRIORITY_CONFIG = {
  critical: {
    label: 'Critical',
    color: 'text-[var(--color-data-fail)]',
    bgColor: 'bg-[var(--color-bg-error)]',
  },
  high: {
    label: 'High',
    color: 'text-[var(--color-data-provisional)]',
    bgColor: 'bg-[var(--color-data-provisional)]/10',
  },
  medium: {
    label: 'Medium',
    color: 'text-[var(--color-data-provisional)]',
    bgColor: 'bg-[var(--color-data-provisional)]/10',
  },
  low: {
    label: 'Low',
    color: 'text-[var(--color-data-pass)]',
    bgColor: 'bg-[var(--color-data-pass)]/10',
  },
} as const;

type PriorityKey = keyof typeof PRIORITY_CONFIG;
const isPriorityKey = (key: string): key is PriorityKey => key in PRIORITY_CONFIG;

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'text-[var(--color-data-provisional)]', icon: Clock },
  in_review: { label: 'In Review', color: 'text-[var(--color-accent)]', icon: RefreshCw },
  fixed: { label: 'Fixed', color: 'text-[var(--color-data-pass)]', icon: CheckCircle2 },
  dismissed: { label: 'Dismissed', color: 'text-[var(--color-text-muted)]', icon: XCircle },
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;
const isStatusKey = (key: string): key is StatusKey => key in STATUS_CONFIG;

export const FlaggedQuestionsDashboard: React.FC = () => {
  const { getToken } = useAuth();
  const [flags, setFlags] = useState<QuestionFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [expandedFlags, setExpandedFlags] = useState<Set<string>>(new Set());
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolveAction, setResolveAction] = useState<'fixed' | 'dismissed'>('fixed');
  const [stats, setStats] = useState<FlagStats | null>(null);

  const fetchFlags = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);

      const response = await fetch(`/api/questions/flags?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch flags');
      }

      const data = (await response.json()) as { flags?: QuestionFlag[] };
      setFlags(data.flags || []);

      // Calculate stats from flags
      calculateStats(data.flags || []);
    } catch (err) {
      console.error('Error fetching flags:', err);
      setError(err instanceof Error ? err.message : 'Failed to load flagged questions');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (flagData: QuestionFlag[]) => {
    const newStats: FlagStats = {
      total: flagData.length,
      pending: 0,
      inReview: 0,
      fixed: 0,
      dismissed: 0,
      byType: {},
      byPriority: {},
    };

    flagData.forEach((flag) => {
      // Status counts
      if (flag.status === 'pending') newStats.pending++;
      else if (flag.status === 'in_review') newStats.inReview++;
      else if (flag.status === 'fixed') newStats.fixed++;
      else if (flag.status === 'dismissed') newStats.dismissed++;

      // Type counts
      newStats.byType[flag.flagType] = (newStats.byType[flag.flagType] || 0) + 1;

      // Priority counts
      newStats.byPriority[flag.priority] = (newStats.byPriority[flag.priority] || 0) + 1;
    });

    setStats(newStats);
  };

  const resolveFlag = async (flagId: string) => {
    if (!resolutionNote.trim()) {
      toast.warning('Please provide a resolution note.');
      return;
    }

    setResolving(flagId);

    try {
      const token = await getToken();
      const response = await fetch(`/api/questions/flag/${flagId}/resolve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reviewedBy: 'admin', // TODO: Get actual admin user ID
          resolutionNote: resolutionNote,
          status: resolveAction,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to resolve flag');
      }

      // Refresh flags after resolution
      await fetchFlags();
      setResolutionNote('');
      setExpandedFlags((prev) => {
        const next = new Set(prev);
        next.delete(flagId);
        return next;
      });
    } catch (err) {
      console.error('Error resolving flag:', err);
      toast.error('Failed to resolve flag. Please try again.');
    } finally {
      setResolving(null);
    }
  };

  const toggleExpanded = (flagId: string) => {
    setExpandedFlags((prev) => {
      const next = new Set(prev);
      if (next.has(flagId)) {
        next.delete(flagId);
      } else {
        next.add(flagId);
      }
      return next;
    });
  };

  useEffect(() => {
    fetchFlags();
  }, [statusFilter, priorityFilter]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[var(--color-bg-error)] rounded-xl">
            <Flag className="w-6 h-6 text-[var(--color-data-fail)]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
              Flagged Questions
            </h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Review and resolve user-reported issues
            </p>
          </div>
        </div>
        <button
          onClick={fetchFlags}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[var(--color-data-provisional)]/10 rounded-xl p-4 border border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[var(--color-data-provisional)]" />
              <span className="text-sm font-medium text-[var(--color-data-provisional)]">
                Pending
              </span>
            </div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
              {stats.pending}
            </p>
          </div>
          <div className="bg-[var(--color-accent)]/10 rounded-xl p-4 border border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-[var(--color-accent)]" />
              <span className="text-sm font-medium text-[var(--color-accent)]">In Review</span>
            </div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
              {stats.inReview}
            </p>
          </div>
          <div className="bg-[var(--color-data-pass)]/10 rounded-xl p-4 border border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[var(--color-data-pass)]" />
              <span className="text-sm font-medium text-[var(--color-data-pass)]">Fixed</span>
            </div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
              {stats.fixed}
            </p>
          </div>
          <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-[var(--color-text-muted)]" />
              <span className="text-sm font-medium text-[var(--color-text-muted)]">Dismissed</span>
            </div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
              {stats.dismissed}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center bg-[var(--color-bg-secondary)] rounded-xl p-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--color-text-muted)]" />
          <span className="text-sm font-medium text-[var(--color-text-secondary)]">Filters:</span>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] text-sm"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_review">In Review</option>
          <option value="fixed">Fixed</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] text-sm"
        >
          <option value="">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-[var(--color-bg-error)] border border-[var(--color-border-error)] rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-[var(--color-data-fail)]" />
          <span className="text-[var(--color-data-fail)]">{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-[var(--color-accent)] animate-spin" />
        </div>
      )}

      {/* Flags List */}
      {!loading && !error && (
        <div className="space-y-4">
          {flags.length === 0 ? (
            <div className="text-center py-12 bg-[var(--color-bg-secondary)] rounded-xl">
              <CheckCircle2 className="w-12 h-12 text-[var(--color-data-pass)] mx-auto mb-3" />
              <p className="text-lg font-medium text-[var(--color-text-secondary)]">
                No flagged questions
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                All clear! No issues match the current filters.
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {flags.map((flag) => {
                const isExpanded = expandedFlags.has(flag.id);
                // Use type guards for safe lookups with proper TypeScript narrowing
                const statusConfig = isStatusKey(flag.status)
                  ? STATUS_CONFIG[flag.status]
                  : STATUS_CONFIG.pending;
                const priorityConfig = isPriorityKey(flag.priority)
                  ? PRIORITY_CONFIG[flag.priority]
                  : PRIORITY_CONFIG.medium;
                const StatusIcon = statusConfig.icon;

                return (
                  <motion.div
                    key={flag.id}
                    initial={{ y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] overflow-hidden"
                  >
                    {/* Flag Header */}
                    <button
                      onClick={() => toggleExpanded(flag.id)}
                      className="w-full p-4 flex items-start gap-4 text-left hover:bg-[var(--color-bg-secondary)] transition-colors"
                    >
                      <div className={`p-2 rounded-lg ${priorityConfig.bgColor}`}>
                        <Flag className={`w-5 h-5 ${priorityConfig.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-full ${priorityConfig.bgColor} ${priorityConfig.color}`}
                          >
                            {priorityConfig.label}
                          </span>
                          <span className={`flex items-center gap-1 text-xs ${statusConfig.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig.label}
                          </span>
                          <span className="text-xs text-data-neutral dark:text-data-neutral">
                            {FLAG_TYPE_LABELS[flag.flagType] || flag.flagType}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--color-text-primary)] font-medium truncate">
                          {flag.questionText}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          Reported {formatDate(flag.createdAt)}
                          {flag.userFirstName && ` by ${flag.userFirstName}`}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-[var(--color-text-muted)]" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-[var(--color-text-muted)]" />
                      )}
                    </button>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="border-t border-[var(--color-border)]"
                        >
                          <div className="p-4 space-y-4">
                            {/* Question Details */}
                            <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4">
                              <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2 flex items-center gap-2">
                                <BookOpen className="w-4 h-4" />
                                Question Text
                              </h4>
                              <p className="text-sm text-[var(--color-text-secondary)]">
                                {flag.questionText}
                              </p>
                              {flag.correctAnswer && (
                                <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
                                  <span className="text-xs font-medium text-[var(--color-data-pass)]">
                                    Correct Answer:{' '}
                                  </span>
                                  <span className="text-sm text-[var(--color-text-secondary)]">
                                    {flag.correctAnswer}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* User's Report */}
                            <div className="bg-[var(--color-data-provisional)]/10 rounded-lg p-4">
                              <h4 className="text-sm font-medium text-[var(--color-data-provisional)] mb-2 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" />
                                User's Report
                              </h4>
                              <p className="text-sm text-[var(--color-data-provisional)]">
                                {flag.description}
                              </p>
                            </div>

                            {/* Metadata */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                              <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                                <User className="w-4 h-4" />
                                <span>{flag.userEmail || flag.userId}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                                <Tag className="w-4 h-4" />
                                <span>{flag.system || 'No system'}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                                <Calendar className="w-4 h-4" />
                                <span>{formatDate(flag.createdAt)}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                                <ExternalLink className="w-4 h-4" />
                                <span className="font-mono">{flag.questionId.slice(0, 8)}...</span>
                              </div>
                            </div>

                            {/* Resolution Section */}
                            {flag.status === 'pending' || flag.status === 'in_review' ? (
                              <div className="border-t border-[var(--color-border)] pt-4">
                                <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
                                  Resolve this flag
                                </h4>
                                <textarea
                                  value={resolutionNote}
                                  onChange={(e) => setResolutionNote(e.target.value)}
                                  placeholder="Enter resolution note..."
                                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] text-sm mb-3 resize-none"
                                  rows={3}
                                />
                                <div className="flex items-center gap-3">
                                  <select
                                    value={resolveAction}
                                    onChange={(e) =>
                                      setResolveAction(e.target.value as 'fixed' | 'dismissed')
                                    }
                                    className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] text-sm"
                                  >
                                    <option value="fixed">Mark as Fixed</option>
                                    <option value="dismissed">Dismiss</option>
                                  </select>
                                  <button
                                    onClick={() => resolveFlag(flag.id)}
                                    disabled={resolving === flag.id || !resolutionNote.trim()}
                                    className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
                                  >
                                    {resolving === flag.id ? (
                                      <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="w-4 h-4" />
                                    )}
                                    Resolve
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="border-t border-[var(--color-border)] pt-4">
                                <div className="bg-[var(--color-data-pass)]/10 rounded-lg p-3">
                                  <p className="text-sm text-[var(--color-data-pass)]">
                                    <strong>Resolved by:</strong> {flag.reviewedBy}
                                  </p>
                                  {flag.reviewedAt && (
                                    <p className="text-xs text-[var(--color-data-pass)] mt-1">
                                      {formatDate(flag.reviewedAt)}
                                    </p>
                                  )}
                                  {flag.resolutionNote && (
                                    <p className="text-sm text-[var(--color-data-pass)] mt-2">
                                      {flag.resolutionNote}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      )}
    </div>
  );
};

export default FlaggedQuestionsDashboard;
