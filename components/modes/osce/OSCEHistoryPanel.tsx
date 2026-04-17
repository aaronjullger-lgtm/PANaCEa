import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { History, TrendingUp, Award, MessageSquare, AlertTriangle, Stethoscope } from 'lucide-react';
import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';
import { InlineSpinner } from '@/components/loading';

interface StatsData {
  totalEncounters: number;
  passRate: number;
  averageScore: number;
  averageClinicalReasoningScore: number;
  averageCommunicationScore: number | null;
  averageDifferentialScore: number | null;
  totalDangerousActions: number;
  trend: Array<{
    sessionId: string;
    date: string;
    score: number;
    clinicalReasoningScore: number;
    communicationScore: number | null;
    differentialScore: number | null;
    dangerousActionCount: number;
  }>;
}

interface OSCEHistoryPanelProps {
  token: string | null;
  onSelectSession?: (sessionId: string) => void;
}

const OSCEHistoryPanel: React.FC<OSCEHistoryPanelProps> = ({
  token,
  onSelectSession,
}) => {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(getApiEndpoint(API_ENDPOINTS.OSCE_STATS), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch OSCE stats');
        }

        // Middleware strips `{ data: ... }` at the HTTP layer, so stats
        // live at the top level. Prior code read `json.data`, which was
        // always undefined — the OSCE history panel showed "no data" for
        // every user. Accept both shapes defensively.
        const json: any = await response.json();
        const payload =
          json && typeof json === 'object' && 'totalEncounters' in json
            ? json
            : json?.data ?? null;
        setStats(payload);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [token]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-[var(--color-data-pass)]';
    if (score >= 60) return 'text-[var(--color-data-provisional)]';
    return 'text-[var(--color-data-fail)]';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-[var(--color-data-pass)]/30';
    if (score >= 60) return 'bg-[var(--color-data-provisional)]/30';
    return 'bg-[var(--color-data-fail)]/30';
  };

  if (loading) {
    return (
      <div className="w-full max-w-2xl bg-data-neutral-bg border border-data-neutral rounded-lg p-6">
        <div className="flex items-center gap-2 mb-6" role="status" aria-live="polite">
          <InlineSpinner size="md" className="text-data-neutral" />
          <h2 className="text-lg font-semibold text-data-neutral">
            Loading history...
          </h2>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 bg-data-neutral/10 rounded animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-2xl bg-data-neutral-bg border border-[var(--color-data-fail)]/30 rounded-lg p-6">
        <p className="text-[var(--color-data-fail)]">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="w-full max-w-2xl bg-data-neutral-bg border border-data-neutral rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-data-neutral" />
          <h2 className="text-lg font-semibold text-data-neutral">
            OSCE History
          </h2>
        </div>
        <p className="text-data-neutral/60">No encounters yet</p>
      </div>
    );
  }

  const sortedSessions = [...stats.trend].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-2xl bg-data-neutral-bg border border-data-neutral rounded-lg p-6"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <History className="w-5 h-5 text-data-neutral" />
        <h2 className="text-lg font-semibold text-data-neutral">OSCE History</h2>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-data-neutral/5 border border-data-neutral/30 rounded p-4"
        >
          <p className="text-data-neutral/60 text-sm mb-1">Total Encounters</p>
          <p className="text-2xl font-bold text-data-neutral">
            {stats.totalEncounters}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="bg-data-neutral/5 border border-data-neutral/30 rounded p-4"
        >
          <p className="text-data-neutral/60 text-sm mb-1">Pass Rate</p>
          <p className="text-2xl font-bold text-[var(--color-data-pass)]">
            {Math.round(stats.passRate)}%
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-data-neutral/5 border border-data-neutral/30 rounded p-4"
        >
          <p className="text-data-neutral/60 text-sm mb-1">Avg Score</p>
          <p className="text-2xl font-bold text-data-neutral">
            {stats.averageScore.toFixed(1)}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="bg-data-neutral/5 border border-data-neutral/30 rounded p-4"
        >
          <p className="text-data-neutral/60 text-sm mb-1">Avg Clinical Reasoning</p>
          <p className="text-2xl font-bold text-data-neutral">
            {stats.averageClinicalReasoningScore.toFixed(1)}
          </p>
        </motion.div>

        {stats.averageCommunicationScore != null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-data-neutral/5 border border-data-neutral/30 rounded p-4"
          >
            <p className="text-data-neutral/60 text-sm mb-1 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> Avg Communication
            </p>
            <p className={`text-2xl font-bold ${
              stats.averageCommunicationScore >= 80 ? 'text-[var(--color-data-pass)]' :
              stats.averageCommunicationScore >= 60 ? 'text-[var(--color-data-provisional)]' : 'text-[var(--color-data-fail)]'
            }`}>
              {stats.averageCommunicationScore.toFixed(1)}
            </p>
          </motion.div>
        )}

        {stats.averageDifferentialScore != null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="bg-data-neutral/5 border border-data-neutral/30 rounded p-4"
          >
            <p className="text-data-neutral/60 text-sm mb-1 flex items-center gap-1">
              <Stethoscope className="w-3 h-3" /> Avg Differentials
            </p>
            <p className={`text-2xl font-bold ${
              stats.averageDifferentialScore >= 80 ? 'text-[var(--color-data-pass)]' :
              stats.averageDifferentialScore >= 60 ? 'text-[var(--color-data-provisional)]' : 'text-[var(--color-data-fail)]'
            }`}>
              {stats.averageDifferentialScore.toFixed(1)}
            </p>
          </motion.div>
        )}

        {stats.totalDangerousActions > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-[var(--color-data-fail)]/10 border border-[var(--color-data-fail)]/30 rounded p-4"
          >
            <p className="text-[var(--color-data-fail)]/80 text-sm mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Safety Alerts
            </p>
            <p className="text-2xl font-bold text-[var(--color-data-fail)]">
              {stats.totalDangerousActions}
            </p>
          </motion.div>
        )}
      </div>

      {/* Session List */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-data-neutral/60" />
          <h3 className="text-sm font-semibold text-data-neutral/80">
            Recent Sessions
          </h3>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {sortedSessions.length === 0 ? (
            <p className="text-data-neutral/60 text-sm py-4">No sessions yet</p>
          ) : (
            sortedSessions.map((session, idx) => {
              const isPassed = session.score >= 80;
              return (
                <motion.button
                  key={session.sessionId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => onSelectSession?.(session.sessionId)}
                  className={`w-full text-left p-4 rounded border transition-colors ${getScoreBgColor(
                    session.score
                  )} border-data-neutral/20 hover:border-data-neutral/40 cursor-pointer`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-sm text-data-neutral/60">
                          {formatDate(session.date)}
                        </p>
                        {isPassed && (
                          <Award className="w-4 h-4 text-[var(--color-data-pass)]" />
                        )}
                      </div>
                      <p className="text-xs text-data-neutral/50">
                        Clinical Reasoning: {session.clinicalReasoningScore.toFixed(1)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-lg font-bold ${getScoreColor(
                          session.score
                        )}`}
                      >
                        {session.score}%
                      </p>
                      <p className="text-xs text-data-neutral/60">
                        {isPassed ? 'Pass' : 'Fail'}
                      </p>
                    </div>
                  </div>
                </motion.button>
              );
            })
          )}
        </div>
      </div>
    </motion.div>
  );
};

export { OSCEHistoryPanel };
export default OSCEHistoryPanel;
