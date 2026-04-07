// components/modes/osce/ScoreReport.tsx
// Comprehensive OSCE Score Report Display

import React from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  AlertTriangle,
  Award,
  Target,
  BookOpen,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Shield,
} from 'lucide-react';
import type {
  OSCEScoreReport,
  CompetencyScore,
  CriticalAction,
  CriticalActionCategory,
  TimelineEntry,
  LearningGap,
} from '@/types/osce-enhanced';

interface ScoreReportProps {
  report: OSCEScoreReport;
  onClose?: () => void;
  onRetry?: () => void;
}

export const ScoreReport: React.FC<ScoreReportProps> = ({ report, onClose, onRetry }) => {
  const [expandedSection, setExpandedSection] = React.useState<string | null>('overview');

  const getGradeColor = (score: number) => {
    if (score >= 90) return 'text-data-pass';
    if (score >= 75) return 'text-[var(--color-category-practice)]';
    if (score >= 60) return 'text-data-provisional';
    return 'text-data-fail';
  };

  const getGradeBg = (score: number) => {
    if (score >= 90) return 'bg-data-pass/10 border-data-pass/30';
    if (score >= 75) return 'bg-[color-mix(in_srgb,var(--color-category-practice)_10%,transparent)] border-[color-mix(in_srgb,var(--color-category-practice)_30%,transparent)]';
    if (score >= 60) return 'bg-data-provisional/10 border-data-provisional/30';
    return 'bg-data-fail/10 border-data-fail/30';
  };

  const getMilestoneLabel = (level: number) => {
    const labels = ['Novice', 'Advanced Beginner', 'Competent', 'Proficient', 'Expert'];
    return labels[level - 1] || 'Unknown';
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="max-w-4xl mx-auto bg-[var(--color-bg-secondary)] rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className={`p-6 ${getGradeBg(report.overallScore)} border-b`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
              Quick Preview
            </h2>
            <p className="text-data-neutral mt-1">Estimated from detected actions</p>
          </div>
          <div className="text-center">
            <div className={`text-5xl font-bold ${getGradeColor(report.overallScore)}`}>
              {report.overallScore}%
            </div>
            <div className="text-sm text-data-neutral mt-1">Overall Score</div>
          </div>
        </div>

        {/* ACGME Milestone */}
        {report.acgmeMilestoneLevel && (
          <div className="mt-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-data-provisional" />
            <span className="text-data-neutral">
              ACGME Milestone Level: <strong>{report.acgmeMilestoneLevel}</strong> -{' '}
              {getMilestoneLabel(report.acgmeMilestoneLevel)}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {/* Overview Section */}
        <CollapsibleSection
          title="Competency Breakdown"
          icon={<Target className="w-5 h-5" />}
          isExpanded={expandedSection === 'overview'}
          onToggle={() => toggleSection('overview')}
        >
          <CompetencyRadar scores={report.competencyScores} />
        </CollapsibleSection>

        {/* Critical Actions */}
        <CollapsibleSection
          title="Critical Actions"
          icon={<CheckCircle className="w-5 h-5" />}
          isExpanded={expandedSection === 'critical'}
          onToggle={() => toggleSection('critical')}
          badge={`${report.criticalActions.filter((a) => a.triggered).length}/${report.criticalActions.length}`}
        >
          <CriticalActionsList actions={report.criticalActions} />
        </CollapsibleSection>

        {/* Communication & Differential Scores */}
        {(report.communicationScore != null || report.differentialScore != null) && (
          <CollapsibleSection
            title="Scoring Dimensions"
            icon={<MessageSquare className="w-5 h-5" />}
            isExpanded={expandedSection === 'dimensions'}
            onToggle={() => toggleSection('dimensions')}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {report.communicationScore != null && (
                <div className={`rounded-xl p-4 border ${getGradeBg(report.communicationScore)}`}>
                  <p className="text-xs uppercase tracking-wider text-data-neutral mb-1">Communication</p>
                  <p className={`text-3xl font-bold ${getGradeColor(report.communicationScore)}`}>
                    {report.communicationScore}%
                  </p>
                  <p className="text-xs text-data-neutral mt-1">Empathy, clarity, patient-centered approach</p>
                </div>
              )}
              {report.differentialScore != null && (
                <div className={`rounded-xl p-4 border ${getGradeBg(report.differentialScore)}`}>
                  <p className="text-xs uppercase tracking-wider text-data-neutral mb-1">Differential Diagnosis</p>
                  <p className={`text-3xl font-bold ${getGradeColor(report.differentialScore)}`}>
                    {report.differentialScore}%
                  </p>
                  <p className="text-xs text-data-neutral mt-1">Breadth, accuracy, cannot-miss diagnoses</p>
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Dangerous Actions */}
        {report.dangerousActionsDetected && report.dangerousActionsDetected.length > 0 && (
          <CollapsibleSection
            title="Patient Safety Alerts"
            icon={<Shield className="w-5 h-5 text-data-fail" />}
            isExpanded={expandedSection === 'safety'}
            onToggle={() => toggleSection('safety')}
            badge={`${report.dangerousActionsDetected.length} alert${report.dangerousActionsDetected.length > 1 ? 's' : ''}`}
          >
            <div className="space-y-2">
              {report.dangerousActionsDetected.map((action, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-data-fail/10 border border-data-fail/30 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-data-fail flex-shrink-0" />
                    <span className="text-sm text-[var(--color-text-primary)]">{action.description}</span>
                  </div>
                  <span className="text-sm font-bold text-data-fail whitespace-nowrap ml-3">
                    -{action.penalty} pts
                  </span>
                </div>
              ))}
              <p className="text-xs text-data-neutral mt-2 italic">
                Dangerous actions represent clinical decisions that could harm the patient. Review these carefully.
              </p>
            </div>
          </CollapsibleSection>
        )}

        {/* Timeline */}
        <CollapsibleSection
          title="Encounter Timeline"
          icon={<Clock className="w-5 h-5" />}
          isExpanded={expandedSection === 'timeline'}
          onToggle={() => toggleSection('timeline')}
        >
          <TimelineView entries={report.timeline.slice(0, 20)} />
        </CollapsibleSection>

        {/* Learning Gaps */}
        {report.learningGaps.length > 0 && (
          <CollapsibleSection
            title="Areas for Growth"
            icon={<TrendingUp className="w-5 h-5" />}
            isExpanded={expandedSection === 'gaps'}
            onToggle={() => toggleSection('gaps')}
          >
            <LearningGapsList gaps={report.learningGaps} />
          </CollapsibleSection>
        )}

        {/* Strengths & Improvements */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {report.strengths.length > 0 && (
            <div className="bg-data-pass/20 rounded-xl p-4">
              <h4 className="font-semibold text-data-pass flex items-center gap-2 mb-3">
                <CheckCircle className="w-4 h-4" /> Strengths
              </h4>
              <ul className="space-y-2">
                {report.strengths.map((s, i) => (
                  <li
                    key={i}
                    className="text-sm text-data-pass flex items-start gap-2"
                  >
                    <span className="mt-1">•</span> {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.areasForImprovement.length > 0 && (
            <div className="bg-data-provisional/20 rounded-xl p-4">
              <h4 className="font-semibold text-data-provisional flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4" /> Areas for Improvement
              </h4>
              <ul className="space-y-2">
                {report.areasForImprovement.map((a, i) => (
                  <li
                    key={i}
                    className="text-sm text-data-provisional flex items-start gap-2"
                  >
                    <span className="mt-1">•</span> {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-data-neutral flex justify-end gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 text-[var(--color-category-practice)] hover:bg-[color-mix(in_srgb,var(--color-category-practice)_20%,transparent)] rounded-lg transition"
          >
            Try Another Case
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--color-category-practice)] text-[var(--color-text-inverse)] rounded-lg hover:bg-[var(--color-category-practice)] transition"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
};

// Collapsible Section Component
const CollapsibleSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
}> = ({ title, icon, isExpanded, onToggle, badge, children }) => (
  <div className="border border-data-neutral rounded-xl overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 hover:bg-data-neutral transition"
    >
      <div className="flex items-center gap-3">
        <span className="text-data-neutral">{icon}</span>
        <span className="font-medium text-data-neutral">{title}</span>
        {badge && (
          <span className="px-2 py-0.5 text-xs bg-data-neutral text-data-neutral rounded-full">
            {badge}
          </span>
        )}
      </div>
      {isExpanded ? (
        <ChevronUp className="w-5 h-5 text-data-neutral" />
      ) : (
        <ChevronDown className="w-5 h-5 text-data-neutral" />
      )}
    </button>
    {isExpanded && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="border-t border-data-neutral p-4"
      >
        {children}
      </motion.div>
    )}
  </div>
);

// Competency Radar/Bar Chart
const CompetencyRadar: React.FC<{ scores: CompetencyScore }> = ({ scores }) => {
  const categories = [
    { key: 'history', label: 'History Taking', score: scores.history },
    { key: 'physicalExam', label: 'Physical Exam', score: scores.physicalExam },
    {
      key: 'diagnosticReasoning',
      label: 'Diagnostic Reasoning',
      score: scores.diagnosticReasoning,
    },
    { key: 'treatment', label: 'Treatment', score: scores.treatment },
    { key: 'communication', label: 'Communication', score: scores.communication },
    { key: 'efficiency', label: 'Efficiency', score: scores.efficiency },
  ];

  return (
    <div className="space-y-3">
      {categories.map(({ key, label, score }) => (
        <div key={key} className="flex items-center gap-3">
          <span className="w-36 text-sm text-data-neutral">{label}</span>
          <div className="flex-1 h-3 bg-data-neutral rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className={`h-full rounded-full ${
                score >= 80
                  ? 'bg-data-pass'
                  : score >= 60
                    ? 'bg-[var(--color-category-practice)]'
                    : score >= 40
                      ? 'bg-data-provisional'
                      : 'bg-data-fail'
              }`}
            />
          </div>
          <span className="w-12 text-right text-sm font-medium text-data-neutral">
            {Math.round(score)}%
          </span>
        </div>
      ))}
    </div>
  );
};

// Critical Actions List — grouped by category with condition-specific context
const CriticalActionsList: React.FC<{ actions: CriticalAction[] }> = ({ actions }) => {
  // Group by category
  const grouped = actions.reduce<Record<string, CriticalAction[]>>((acc, action) => {
    const cat = action.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(action);
    return acc;
  }, {});

  const categoryOrder: CriticalActionCategory[] = ['safety', 'diagnosis', 'procedure', 'communication'];
  const categoryLabels: Record<string, string> = {
    safety: 'Patient Safety',
    diagnosis: 'Diagnostic Actions',
    procedure: 'Procedures',
    communication: 'Communication',
    other: 'Other',
  };
  const categoryIcons: Record<string, React.ReactNode> = {
    safety: <AlertTriangle className="w-4 h-4" />,
    diagnosis: <Target className="w-4 h-4" />,
    procedure: <CheckCircle className="w-4 h-4" />,
    communication: <BookOpen className="w-4 h-4" />,
    other: <CheckCircle className="w-4 h-4" />,
  };

  const sortedCategories = [...categoryOrder, 'other'].filter(cat => grouped[cat]?.length);

  // Summary stats
  const completed = actions.filter(a => a.triggered).length;
  const safetyMissed = (grouped['safety'] || []).filter(a => !a.triggered);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between p-3 bg-data-neutral-bg rounded-lg border border-data-neutral">
        <div className="text-sm text-data-neutral">
          Completed <span className="font-bold text-[var(--color-text-inverse)]">{completed}/{actions.length}</span> critical actions
        </div>
        {safetyMissed.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-data-fail font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            {safetyMissed.length} safety action{safetyMissed.length > 1 ? 's' : ''} missed
          </div>
        )}
      </div>

      {/* Grouped actions */}
      {sortedCategories.map(cat => (
        <div key={cat}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-data-neutral">{categoryIcons[cat]}</span>
            <h5 className="text-sm font-semibold text-data-neutral uppercase tracking-wider">
              {categoryLabels[cat] || cat}
            </h5>
            <span className="text-xs text-data-neutral ml-auto">
              {(grouped[cat] ?? []).filter(a => a.triggered).length}/{(grouped[cat] ?? []).length}
            </span>
          </div>
          <div className="space-y-1.5">
            {(grouped[cat] ?? []).map((action) => (
              <div
                key={action.id}
                className={`flex items-center gap-3 p-2.5 rounded-lg ${
                  action.triggered ? 'bg-data-pass/20' : 'bg-data-fail/20'
                }`}
              >
                {action.triggered ? (
                  <CheckCircle className="w-4.5 h-4.5 text-data-pass flex-shrink-0" />
                ) : (
                  <XCircle className="w-4.5 h-4.5 text-data-fail flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-sm ${
                      action.triggered ? 'text-data-pass' : 'text-data-fail'
                    }`}
                  >
                    {action.description}
                  </span>
                  {action.context && (
                    <span className="block text-xs text-data-neutral mt-0.5">{action.context}</span>
                  )}
                </div>
                {!action.triggered && action.missedPenalty > 0 && (
                  <span className="text-xs text-data-fail font-medium whitespace-nowrap">
                    -{action.missedPenalty} pts
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// Timeline View
const TimelineView: React.FC<{ entries: TimelineEntry[] }> = ({ entries }) => (
  <div className="relative space-y-2 pl-4 border-l-2 border-data-neutral">
    {entries.map((entry, i) => (
      <div key={i} className="relative pl-4">
        <div
          className={`absolute -left-[9px] w-4 h-4 rounded-full border-2 ${
            entry.evaluation === 'excellent'
              ? 'bg-data-pass border-data-pass'
              : entry.evaluation === 'good'
                ? 'bg-[var(--color-category-practice)] border-[var(--color-category-practice)]'
                : entry.evaluation === 'fair'
                  ? 'bg-data-provisional border-data-provisional'
                  : entry.evaluation === 'poor'
                    ? 'bg-data-fail border-data-fail'
                    : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)]'
          }`}
        />
        <div className="text-xs text-data-neutral mb-0.5">
          {new Date(entry.timestamp).toLocaleTimeString()} • {entry.phase}
        </div>
        <div className="text-sm text-data-neutral">{entry.action}</div>
        {entry.feedback && (
          <div className="text-xs text-data-neutral mt-1 italic">{entry.feedback}</div>
        )}
      </div>
    ))}
  </div>
);

// Learning Gaps List
const LearningGapsList: React.FC<{ gaps: LearningGap[] }> = ({ gaps }) => (
  <div className="space-y-3">
    {gaps.map((gap, i) => (
      <div
        key={i}
        className={`p-3 rounded-lg border ${
          gap.severity === 'significant'
            ? 'bg-data-fail/20 border-data-fail'
            : gap.severity === 'moderate'
              ? 'bg-data-provisional/20 border-data-provisional'
              : 'bg-[color-mix(in_srgb,var(--color-category-practice)_20%,transparent)] border-[var(--color-category-practice)]'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <BookOpen
            className={`w-4 h-4 ${
              gap.severity === 'significant'
                ? 'text-data-fail'
                : gap.severity === 'moderate'
                  ? 'text-data-provisional'
                  : 'text-[var(--color-category-practice)]'
            }`}
          />
          <span className="font-medium text-sm text-data-neutral">
            {gap.category.charAt(0).toUpperCase() + gap.category.slice(1)}
          </span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${
              gap.severity === 'significant'
                ? 'bg-data-fail text-data-fail'
                : gap.severity === 'moderate'
                  ? 'bg-data-provisional text-data-provisional'
                  : 'bg-[var(--color-category-practice)] text-[var(--color-category-practice)]'
            }`}
          >
            {gap.severity}
          </span>
        </div>
        <p className="text-sm text-data-neutral">{gap.recommendation}</p>
      </div>
    ))}
  </div>
);

export default ScoreReport;
