import React, { useEffect } from 'react';
import { X, Check, Clock, Target, TrendingUp, Zap, Calendar } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { toast } from 'sonner';
import type { StudyPlan } from '@/types';

// ============================================================================
// Plan Alternatives Modal Component
// ============================================================================

interface PlanAlternativesModalProps {
  isOpen: boolean;
  onClose: () => void;
  alternatives: StudyPlan[];
  currentPlan: StudyPlan;
}

const PlanAlternativesModal: React.FC<PlanAlternativesModalProps> = ({
  isOpen,
  onClose,
  alternatives,
  currentPlan,
}) => {
  const { getToken } = useAuth();
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectAlternative = async (planId: string) => {
    try {
      const token = await getToken?.();
      const res = await fetch(`/api/study-path/accept`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ planId }),
      });
      if (!res.ok) throw new Error('Failed to select plan');
      toast.success('Study plan updated.');
      onClose();
    } catch {
      toast.error('Could not select plan. Please try again.');
    }
  };

  const formatDate = (date: Date) => new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const planMetrics = (plan: StudyPlan) => ({
    totalMinutes: plan.totalEstimatedMinutes,
    sessionCount: plan.sessions.length,
    confidence: plan.confidence,
    fatigueRisk: plan.metadata.fatigueRisk,
    retentionIncrease: plan.metadata.projectedRetentionIncrease,
    blueprintCoverage: (Object.values(plan.metadata.blueprintCoverage) as number[]).reduce((sum, val) => sum + val, 0),
    startDate: plan.sessions.length > 0 ? new Date(Math.min(...plan.sessions.map(s => s.date.getTime()))) : null,
    endDate: plan.sessions.length > 0 ? new Date(Math.max(...plan.sessions.map(s => s.date.getTime()))) : null,
  });

  const currentMetrics = planMetrics(currentPlan);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-overlay)] backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-label="Plan alternatives" className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-[var(--color-bg-card)] rounded-2xl shadow-2xl border border-[var(--color-border)]">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-[var(--color-border)] bg-[var(--color-bg-card)]">
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Plan Alternatives</h2>
            <p className="text-[var(--color-text-secondary)] mt-1">
              Compare different study paths tailored to your constraints.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Current Plan Summary */}
        <div className="p-6 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            Current Recommended Plan
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[var(--color-bg-card)] rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[var(--color-accent)]/10">
                  <Clock className="w-5 h-5 text-[var(--color-accent)]" />
                </div>
                <div>
                  <p className="text-sm text-[var(--color-text-secondary)]">Total Time</p>
                  <p className="text-xl font-bold text-[var(--color-text-primary)]">
                    {Math.round(currentMetrics.totalMinutes / 60)}h
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-[var(--color-bg-card)] rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[var(--color-success)]/10">
                  <TrendingUp className="w-5 h-5 text-[var(--color-success)]" />
                </div>
                <div>
                  <p className="text-sm text-[var(--color-text-secondary)]">Retention Increase</p>
                  <p className="text-xl font-bold text-[var(--color-text-primary)]">
                    +{(currentMetrics.retentionIncrease * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-[var(--color-bg-card)] rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[var(--color-warning)]/10">
                  <Zap className="w-5 h-5 text-[var(--color-warning)]" />
                </div>
                <div>
                  <p className="text-sm text-[var(--color-text-secondary)]">Confidence</p>
                  <p className="text-xl font-bold text-[var(--color-text-primary)]">
                    {(currentMetrics.confidence * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-[var(--color-bg-card)] rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[var(--color-info)]/10">
                  <Target className="w-5 h-5 text-[var(--color-info)]" />
                </div>
                <div>
                  <p className="text-sm text-[var(--color-text-secondary)]">Blueprint Coverage</p>
                  <p className="text-xl font-bold text-[var(--color-text-primary)]">
                    {currentMetrics.blueprintCoverage.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Alternatives Grid */}
        <div className="p-6">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-6">
            {alternatives.length} Alternative Plan{alternatives.length !== 1 ? 's' : ''}
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {alternatives.map((plan, idx) => {
              const metrics = planMetrics(plan);
              const isMoreIntensive = metrics.totalMinutes > currentMetrics.totalMinutes;
              const isShorter = metrics.totalMinutes < currentMetrics.totalMinutes;
              const isHigherConfidence = metrics.confidence > currentMetrics.confidence;
              const days = metrics.startDate && metrics.endDate
                ? Math.ceil((metrics.endDate.getTime() - metrics.startDate.getTime()) / (1000 * 60 * 60 * 24))
                : 0;

              return (
                <div
                  key={plan.id}
                  className="border border-[var(--color-border)] rounded-xl p-6 hover:border-[var(--color-accent)] transition-colors bg-[var(--color-bg-card)]"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="text-xl font-bold text-[var(--color-text-primary)]">
                        Alternative {idx + 1}
                      </h4>
                      <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                        {metrics.sessionCount} sessions over {days} days
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isMoreIntensive && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-warning)]/20 text-[var(--color-warning)]">
                          More Intensive
                        </span>
                      )}
                      {isShorter && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-success)]/20 text-[var(--color-success)]">
                          Shorter
                        </span>
                      )}
                      {isHigherConfidence && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-info)]/20 text-[var(--color-info)]">
                          Higher Confidence
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-[var(--color-text-muted)]" />
                      <div>
                        <p className="text-sm text-[var(--color-text-secondary)]">Total Time</p>
                        <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                          {Math.round(metrics.totalMinutes / 60)}h
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-5 h-5 text-[var(--color-text-muted)]" />
                      <div>
                        <p className="text-sm text-[var(--color-text-secondary)]">Retention Increase</p>
                        <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                          +{(metrics.retentionIncrease * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Zap className="w-5 h-5 text-[var(--color-text-muted)]" />
                      <div>
                        <p className="text-sm text-[var(--color-text-secondary)]">Confidence</p>
                        <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                          {(metrics.confidence * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Target className="w-5 h-5 text-[var(--color-text-muted)]" />
                      <div>
                        <p className="text-sm text-[var(--color-text-secondary)]">Coverage</p>
                        <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                          {metrics.blueprintCoverage.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <p className="text-sm text-[var(--color-text-secondary)] mb-2">Schedule Preview</p>
                    <div className="flex flex-wrap gap-2">
                      {plan.sessions.slice(0, 5).map((session, i) => (
                        <div
                          key={session.id}
                          className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] text-xs"
                          title={`${formatDate(session.date)} - ${session.topics.length} topics`}
                        >
                          Day {i + 1}
                        </div>
                      ))}
                      {plan.sessions.length > 5 && (
                        <div className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] text-xs">
                          +{plan.sessions.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => handleSelectAlternative(plan.id)}
                      className="px-5 py-2.5 bg-[var(--color-accent)] text-white rounded-xl font-semibold hover:opacity-90 flex items-center gap-2"
                    >
                      <Check className="w-5 h-5" />
                      Select This Plan
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty state */}
          {alternatives.length === 0 && (
            <div className="text-center py-12">
              <Target className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <h4 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
                No alternatives available
              </h4>
              <p className="text-[var(--color-text-secondary)] max-w-md mx-auto">
                The optimizer could not generate alternative plans with the current constraints.
                Try adjusting your daily limit, exam date, or focus areas.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-[var(--color-border)] p-6 bg-[var(--color-bg-card)]">
          <div className="flex justify-between items-center">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Each plan is optimized for different trade‑offs (time vs. confidence vs. coverage).
            </p>
            <button
              onClick={onClose}
              className="px-5 py-2.5 border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-xl font-semibold hover:bg-[var(--color-bg-secondary)]"
            >
              Keep Current Plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanAlternativesModal;