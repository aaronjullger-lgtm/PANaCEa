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
} from 'lucide-react';
import type { OSCEScoreReport, CompetencyScore, CriticalAction, TimelineEntry, LearningGap } from '@/types/osce-enhanced';

interface ScoreReportProps {
  report: OSCEScoreReport;
  onClose?: () => void;
  onRetry?: () => void;
}

export const ScoreReport: React.FC<ScoreReportProps> = ({
  report,
  onClose,
  onRetry,
}) => {
  const [expandedSection, setExpandedSection] = React.useState<string | null>('overview');

  const getGradeColor = (score: number) => {
    if (score >= 90) return 'text-emerald-500';
    if (score >= 75) return 'text-blue-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  const getGradeBg = (score: number) => {
    if (score >= 90) return 'bg-emerald-500/10 border-emerald-500/30';
    if (score >= 75) return 'bg-blue-500/10 border-blue-500/30';
    if (score >= 60) return 'bg-amber-500/10 border-amber-500/30';
    return 'bg-red-500/10 border-red-500/30';
  };

  const getMilestoneLabel = (level: number) => {
    const labels = ['Novice', 'Advanced Beginner', 'Competent', 'Proficient', 'Expert'];
    return labels[level - 1] || 'Unknown';
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className={`p-6 ${getGradeBg(report.overallScore)} border-b`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Performance Report</h2>
            <p className="text-slate-600 dark:text-slate-300 mt-1">Patient Encounter Assessment</p>
          </div>
          <div className="text-center">
            <div className={`text-5xl font-bold ${getGradeColor(report.overallScore)}`}>
              {report.overallScore}%
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">Overall Score</div>
          </div>
        </div>
        
        {/* ACGME Milestone */}
        {report.acgmeMilestoneLevel && (
          <div className="mt-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <span className="text-slate-700 dark:text-slate-200">
              ACGME Milestone Level: <strong>{report.acgmeMilestoneLevel}</strong> - {getMilestoneLabel(report.acgmeMilestoneLevel)}
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
          badge={`${report.criticalActions.filter(a => a.triggered).length}/${report.criticalActions.length}`}
        >
          <CriticalActionsList actions={report.criticalActions} />
        </CollapsibleSection>

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
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4">
              <h4 className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-2 mb-3">
                <CheckCircle className="w-4 h-4" /> Strengths
              </h4>
              <ul className="space-y-2">
                {report.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-emerald-600 dark:text-emerald-300 flex items-start gap-2">
                    <span className="mt-1">•</span> {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {report.areasForImprovement.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
              <h4 className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4" /> Areas for Improvement
              </h4>
              <ul className="space-y-2">
                {report.areasForImprovement.map((a, i) => (
                  <li key={i} className="text-sm text-amber-600 dark:text-amber-300 flex items-start gap-2">
                    <span className="mt-1">•</span> {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
          >
            Try Another Case
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
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
  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
    >
      <div className="flex items-center gap-3">
        <span className="text-slate-500">{icon}</span>
        <span className="font-medium text-slate-700 dark:text-slate-200">{title}</span>
        {badge && (
          <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full">
            {badge}
          </span>
        )}
      </div>
      {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
    </button>
    {isExpanded && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="border-t border-slate-200 dark:border-slate-700 p-4"
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
    { key: 'diagnosticReasoning', label: 'Diagnostic Reasoning', score: scores.diagnosticReasoning },
    { key: 'treatment', label: 'Treatment', score: scores.treatment },
    { key: 'communication', label: 'Communication', score: scores.communication },
    { key: 'efficiency', label: 'Efficiency', score: scores.efficiency },
  ];

  return (
    <div className="space-y-3">
      {categories.map(({ key, label, score }) => (
        <div key={key} className="flex items-center gap-3">
          <span className="w-36 text-sm text-slate-600 dark:text-slate-300">{label}</span>
          <div className="flex-1 h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className={`h-full rounded-full ${
                score >= 80 ? 'bg-emerald-500' :
                score >= 60 ? 'bg-blue-500' :
                score >= 40 ? 'bg-amber-500' : 'bg-red-500'
              }`}
            />
          </div>
          <span className="w-12 text-right text-sm font-medium text-slate-700 dark:text-slate-200">
            {Math.round(score)}%
          </span>
        </div>
      ))}
    </div>
  );
};

// Critical Actions List
const CriticalActionsList: React.FC<{ actions: CriticalAction[] }> = ({ actions }) => (
  <div className="space-y-2">
    {actions.map(action => (
      <div
        key={action.id}
        className={`flex items-center gap-3 p-2 rounded-lg ${
          action.triggered
            ? 'bg-emerald-50 dark:bg-emerald-900/20'
            : 'bg-red-50 dark:bg-red-900/20'
        }`}
      >
        {action.triggered ? (
          <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
        ) : (
          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
        )}
        <span className={`text-sm ${
          action.triggered
            ? 'text-emerald-700 dark:text-emerald-300'
            : 'text-red-700 dark:text-red-300'
        }`}>
          {action.description}
        </span>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded ${
          action.category === 'safety' ? 'bg-red-100 text-red-700' :
          action.category === 'diagnosis' ? 'bg-blue-100 text-blue-700' :
          action.category === 'communication' ? 'bg-purple-100 text-purple-700' :
          'bg-slate-100 text-slate-700'
        }`}>
          {action.category}
        </span>
      </div>
    ))}
  </div>
);

// Timeline View
const TimelineView: React.FC<{ entries: TimelineEntry[] }> = ({ entries }) => (
  <div className="relative space-y-2 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
    {entries.map((entry, i) => (
      <div key={i} className="relative pl-4">
        <div className={`absolute -left-[9px] w-4 h-4 rounded-full border-2 ${
          entry.evaluation === 'excellent' ? 'bg-emerald-500 border-emerald-500' :
          entry.evaluation === 'good' ? 'bg-blue-500 border-blue-500' :
          entry.evaluation === 'fair' ? 'bg-amber-500 border-amber-500' :
          entry.evaluation === 'poor' ? 'bg-red-500 border-red-500' :
          'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'
        }`} />
        <div className="text-xs text-slate-400 mb-0.5">
          {new Date(entry.timestamp).toLocaleTimeString()} • {entry.phase}
        </div>
        <div className="text-sm text-slate-700 dark:text-slate-200">{entry.action}</div>
        {entry.feedback && (
          <div className="text-xs text-slate-500 mt-1 italic">{entry.feedback}</div>
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
          gap.severity === 'significant' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' :
          gap.severity === 'moderate' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' :
          'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className={`w-4 h-4 ${
            gap.severity === 'significant' ? 'text-red-500' :
            gap.severity === 'moderate' ? 'text-amber-500' : 'text-blue-500'
          }`} />
          <span className="font-medium text-sm text-slate-700 dark:text-slate-200">
            {gap.category.charAt(0).toUpperCase() + gap.category.slice(1)}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            gap.severity === 'significant' ? 'bg-red-200 text-red-700' :
            gap.severity === 'moderate' ? 'bg-amber-200 text-amber-700' :
            'bg-blue-200 text-blue-700'
          }`}>
            {gap.severity}
          </span>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">{gap.recommendation}</p>
      </div>
    ))}
  </div>
);

export default ScoreReport;
