/**
 * Calibration Quadrant Widget
 *
 * Metacognition / "Illusion of Competence" — distinct from AI calibration.
 * Shows Confidence vs. Accuracy quadrants:
 * - Mastered: High confidence + Right
 * - Dangerous Misconception: High confidence + Wrong (critical for PA students)
 * - Lucky Guess: Low confidence + Right (needs review)
 * - Unconfident Wrong: Low confidence + Wrong
 *
 * Data from GET /api/analytics/calibration (QuestionAttempt.implicitConfidence).
 */

import React from 'react';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { useAuth } from '@clerk/clerk-react';
import { Brain, CheckCircle, AlertTriangle, HelpCircle, XCircle } from 'lucide-react';
import { getQuadrantLabel, type CalibrationQuadrant } from '@/lib/calibrationQuadrants';
import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';

function keyToQuadrantType(key: keyof CalibrationQuadrantData): CalibrationQuadrant {
  switch (key) {
    case 'dangerousMisconception':
      return 'dangerous_misconception';
    case 'luckyGuess':
      return 'lucky_guess';
    case 'unconfidentWrong':
      return 'unconfident_wrong';
    default:
      return 'mastered';
  }
}

export interface CalibrationQuadrantData {
  mastered: number;
  dangerousMisconception: number;
  luckyGuess: number;
  unconfidentWrong: number;
  total: number;
}

interface CalibrationApiResponse {
  calibration: CalibrationQuadrantData;
  days: number;
}

function makeCalibrationFetcher(getToken: () => Promise<string | null>) {
  return async (url: string): Promise<CalibrationApiResponse> => {
    const token = await getToken();
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Failed to fetch calibration');
    const json = await res.json();
    return json as CalibrationApiResponse;
  };
}

const quadrants: Array<{
  key: keyof CalibrationQuadrantData;
  icon: typeof CheckCircle;
  bgClass: string;
  borderClass: string;
  textClass: string;
}> = [
  {
    key: 'mastered',
    icon: CheckCircle,
    bgClass: 'bg-[var(--color-data-pass)]/10',
    borderClass: 'border-[var(--color-data-pass)]/40',
    textClass: 'text-[var(--color-data-pass)]',
  },
  {
    key: 'dangerousMisconception',
    icon: AlertTriangle,
    bgClass: 'bg-[var(--color-data-fail)]/10',
    borderClass: 'border-[var(--color-data-fail)]/40',
    textClass: 'text-[var(--color-data-fail)]',
  },
  {
    key: 'luckyGuess',
    icon: HelpCircle,
    bgClass: 'bg-[var(--color-data-provisional)]/10',
    borderClass: 'border-[var(--color-data-provisional)]/40',
    textClass: 'text-[var(--color-data-provisional)]',
  },
  {
    key: 'unconfidentWrong',
    icon: XCircle,
    bgClass: 'bg-slate-100 dark:bg-slate-800',
    borderClass: 'border-slate-200 dark:border-slate-600',
    textClass: 'text-slate-600 dark:text-slate-400',
  },
];

const CALIBRATION_URL = `${getApiEndpoint(API_ENDPOINTS.ANALYTICS_CALIBRATION)}?days=90`;

export function CalibrationQuadrantWidget({ className = '' }: Readonly<{ className?: string }>) {
  const { getToken } = useAuth();
  const fetcher = React.useMemo(() => makeCalibrationFetcher(getToken), [getToken]);
  const { data, error, isLoading } = useSWR<CalibrationApiResponse>(CALIBRATION_URL, fetcher, {
    revalidateOnFocus: false,
  });

  if (error) {
    return (
      <div
        className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-6 ${className}`}
      >
        <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm">
          <Brain className="w-4 h-4" />
          <span className="font-medium">Calibration</span>
        </div>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Unable to load. Complete questions in study sessions to see confidence vs. accuracy.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-6 animate-pulse ${className}`}
      >
        <div className="h-5 w-32 bg-[var(--color-bg-secondary)] rounded mb-4" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-[var(--color-bg-secondary)] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const cal = data?.calibration;
  const total = cal?.total ?? 0;

  if (!cal || total === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-6 ${className}`}
      >
        <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm mb-2">
          <Brain className="w-4 h-4" />
          <span className="font-medium">Calibration</span>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Not yet assessed. Confidence vs. accuracy will appear after you complete questions in
          study or drill sessions.
        </p>
        <button
          type="button"
          onClick={() => window.location.assign('/study/main-session')}
          className="px-4 py-2.5 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Take a 10-question diagnostic quiz to unlock this graph
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-6 ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm">
          <Brain className="w-4 h-4" />
          <span className="font-medium">Calibration</span>
        </div>
        <span className="text-xs text-[var(--color-text-muted)]">Last 90 days</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {quadrants.map(({ key, icon: Icon, bgClass, borderClass, textClass }) => {
          const count = cal[key];
          const quadrantType = keyToQuadrantType(key);
          const label = getQuadrantLabel(quadrantType);
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={key} className={`rounded-xl border p-3 ${bgClass} ${borderClass}`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 shrink-0 ${textClass}`} />
                <span className={`text-xs font-medium ${textClass}`}>{label.short}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-[var(--color-text-primary)]">{count}</span>
                <span className="text-xs text-[var(--color-text-muted)]">({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>

      {cal.dangerousMisconception > 0 && (
        <p className="mt-3 text-xs text-[var(--color-data-fail)]">
          High confidence + wrong = dangerous misconception — prioritize reviewing those topics.
        </p>
      )}
    </motion.div>
  );
}

export default CalibrationQuadrantWidget;
