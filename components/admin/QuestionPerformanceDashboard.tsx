import React, { useState, useEffect } from 'react';
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
import { motion } from 'framer-motion';

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
  if (score >= 70) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
};

const getQualityBg = (score: number) => {
  if (score >= 70) return 'bg-green-100';
  if (score >= 50) return 'bg-yellow-100';
  return 'bg-red-100';
};

const getAccuracyColor = (accuracy: number) => {
  if (accuracy >= 70) return 'text-green-600';
  if (accuracy >= 50) return 'text-yellow-600';
  return 'text-red-600';
};

export const QuestionPerformanceDashboard: React.FC = () => {
  const { getToken } = useAuth();
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

      const result = await response.json();
      setQuestions(result.data?.questions || []);
      setSummary(result.data?.summary || null);
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
          <div className="p-2 bg-purple-100 rounded-xl">
            <BarChart3 className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
              Question Performance
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Identify and improve low-performing questions
            </p>
          </div>
        </div>
        <button
          onClick={fetchPerformance}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Analyzed
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">
              {summary.totalQuestionsAnalyzed}
            </p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                Avg Accuracy
              </span>
            </div>
            <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">
              {summary.avgAccuracy}%
            </p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <span className="text-xs font-medium text-red-600 dark:text-red-400">
                Low Accuracy
              </span>
            </div>
            <p className="text-2xl font-bold text-red-800 dark:text-red-300">
              {summary.lowAccuracyCount}
            </p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-2 mb-1">
              <Flag className="w-4 h-4 text-orange-600" />
              <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                Flagged
              </span>
            </div>
            <p className="text-2xl font-bold text-orange-800 dark:text-orange-300">
              {summary.highFlagCount}
            </p>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                Needs Review
              </span>
            </div>
            <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-300">
              {summary.needsReviewCount}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Sort by:</span>
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm"
        >
          <option value="quality">Quality Score</option>
          <option value="accuracy">Accuracy</option>
          <option value="attempts">Attempts</option>
          <option value="flags">Flag Count</option>
        </select>
        <select
          value={order}
          onChange={(e) => setOrder(e.target.value as typeof order)}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm"
        >
          <option value="asc">Worst First</option>
          <option value="desc">Best First</option>
        </select>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <span className="text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
        </div>
      )}

      {/* Questions Table */}
      {!loading && !error && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Question
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    System
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Quality
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Accuracy
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Attempts
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Avg Time
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Flags
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {questions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-slate-500 dark:text-slate-400"
                    >
                      No question performance data available yet.
                      <br />
                      <span className="text-sm">
                        Questions need at least 5 attempts to appear here.
                      </span>
                    </td>
                  </tr>
                ) : (
                  questions.map((q, index) => (
                    <motion.tr
                      key={q.questionId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    >
                      <td className="px-4 py-3">
                        <div className="max-w-xs truncate text-sm text-slate-800 dark:text-white">
                          {q.questionText}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          {q.questionId.slice(0, 8)}...
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {q.system}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-full ${getQualityBg(q.qualityScore)} ${getQualityColor(q.qualityScore)}`}
                        >
                          <Zap className="w-3 h-3" />
                          {q.qualityScore}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-medium ${getAccuracyColor(q.accuracy)}`}>
                          {q.accuracy}%
                        </span>
                        <div className="text-xs text-slate-400">
                          {q.correctAttempts}/{q.totalAttempts}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-slate-600 dark:text-slate-400">
                        {q.totalAttempts}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                          <Clock className="w-3 h-3" />
                          {formatTime(q.avgTimeMs)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {q.flagCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                            <Flag className="w-3 h-3" />
                            {q.flagCount}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionPerformanceDashboard;
