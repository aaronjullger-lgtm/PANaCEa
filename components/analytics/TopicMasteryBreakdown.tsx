import React from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import {
  Stethoscope,
  Pill,
  Microscope,
  ClipboardList,
  Shield,
  TrendingUp,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface TopicProgressProps {
  readonly conditionId: string;
  readonly conditionName?: string;
}

interface TaskProgress {
  taskType: string;
  label: string;
  stability: number;
  difficulty: number;
  state: number;
  reps: number;
  lapses: number;
  mastery: 'untested' | 'low' | 'medium' | 'high';
  lastReview: string | null;
  nextReview: string | null;
  variantsUsed?: number;
}

interface TopicProgressData {
  conditionId: string;
  conditionName: string;
  system: string;
  overallMastery: string;
  avgStability: number;
  taskProgress: TaskProgress[];
}

const TASK_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  diagnosis: Stethoscope,
  treatment: Pill,
  mechanism: Microscope,
  workup: ClipboardList,
  prevention: Shield,
  prognosis: TrendingUp,
  complication: AlertTriangle,
};

const DEFAULT_MASTERY_COLORS = {
  bg: 'bg-slate-100 dark:bg-slate-800',
  text: 'text-slate-500',
  bar: 'bg-slate-300 dark:bg-slate-600',
} as const;

const MASTERY_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  untested: { ...DEFAULT_MASTERY_COLORS },
  low: {
    bg: 'bg-rose-50 dark:bg-rose-900/20',
    text: 'text-rose-600 dark:text-rose-400',
    bar: 'bg-rose-500',
  },
  medium: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-600 dark:text-amber-400',
    bar: 'bg-amber-500',
  },
  high: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    bar: 'bg-emerald-500',
  },
};

async function fetchTopicProgress(
  conditionId: string,
  token: string | null
): Promise<TopicProgressData> {
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(`/api/user/topic-progress/${conditionId}`, { headers });

  if (!response.ok) {
    throw new Error('Failed to fetch topic progress');
  }

  const data = await response.json();
  return data.data;
}

export function TopicMasteryBreakdown({ conditionId, conditionName }: TopicProgressProps) {
  const { getToken } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['topic-progress', conditionId],
    queryFn: async () => {
      const token = await getToken();
      return fetchTopicProgress(conditionId, token);
    },
    enabled: !!conditionId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading topic progress...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 p-4 text-rose-700 dark:text-rose-300">
        Unable to load topic progress
      </div>
    );
  }

  // Sort by mastery level (lowest first for focus)
  const sortedProgress = [...data.taskProgress].sort((a, b) => {
    const order = { untested: 0, low: 1, medium: 2, high: 3 };
    return order[a.mastery] - order[b.mastery];
  });

  // Find topics that need attention
  const weakTopics = sortedProgress.filter((tp) => tp.mastery === 'low');
  const untestedTopics = sortedProgress.filter((tp) => tp.mastery === 'untested');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {data.conditionName || conditionName}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Topic-level mastery breakdown
          </p>
        </div>
        <div
          className={`px-3 py-1.5 rounded-full text-sm font-medium ${MASTERY_COLORS[data.overallMastery]?.bg || 'bg-slate-100'} ${MASTERY_COLORS[data.overallMastery]?.text || 'text-slate-500'}`}
        >
          {(() => {
            const labels: Record<string, string> = {
              untested: 'Not Started',
              high: 'Mastered',
              medium: 'Progressing',
              low: 'Needs Work',
            };
            return labels[data.overallMastery] || 'Unknown';
          })()}
        </div>
      </div>

      {/* Attention Banner */}
      {(weakTopics.length > 0 || untestedTopics.length > 0) && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              {weakTopics.length > 0 && (
                <p className="text-amber-800 dark:text-amber-200">
                  <strong>
                    {weakTopics.length} topic{weakTopics.length > 1 ? 's' : ''}
                  </strong>{' '}
                  need focused practice: {weakTopics.map((t) => t.label).join(', ')}
                </p>
              )}
              {untestedTopics.length > 0 && (
                <p className="text-amber-700 dark:text-amber-300 mt-1">
                  {untestedTopics.length} topic{untestedTopics.length > 1 ? 's' : ''} not yet tested
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Topic Progress Grid */}
      <div className="grid gap-3">
        {sortedProgress.map((topic) => {
          const Icon = TASK_TYPE_ICONS[topic.taskType] || ClipboardList;
          const colors = MASTERY_COLORS[topic.mastery] ?? DEFAULT_MASTERY_COLORS;
          const stabilityPercent = Math.min((topic.stability / 15) * 100, 100);

          return (
            <div
              key={topic.taskType}
              className={`rounded-lg border p-4 ${colors.bg} border-slate-200 dark:border-slate-700`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${colors.text}`} />
                  <span className="font-medium text-[var(--color-text-primary)]">{topic.label}</span>
                </div>
                <span className={`text-sm ${colors.text}`}>
                  {topic.mastery === 'untested'
                    ? 'Not Started'
                    : `${Math.round(stabilityPercent)}%`}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${colors.bar} transition-all duration-300`}
                  style={{ width: `${stabilityPercent}%` }}
                />
              </div>

              {/* Stats Row */}
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{topic.reps} reviews</span>
                {topic.lapses > 0 && <span>{topic.lapses} lapses</span>}
                {topic.variantsUsed !== undefined && topic.variantsUsed > 0 && (
                  <span>{topic.variantsUsed} variants used</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TopicMasteryBreakdown;
