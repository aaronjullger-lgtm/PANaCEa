// components/modes/osce/ExamPanel.tsx
// Physical Exam Panel with BodyMap and Maneuver Selection

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope,
  Hand,
  Eye,
  Activity,
  ChevronRight,
  Check,
  AlertCircle,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { BodyMap, EXAM_MANEUVERS } from './BodyMap';
import type { BodyRegion, ExamFinding, ExamManeuver } from '@/types/osce-enhanced';

interface ExamPanelProps {
  onExamPerformed: (finding: ExamFinding) => void;
  completedExams: ExamFinding[];
  suggestedRegions?: BodyRegion[];
  caseData?: {
    physicalExamData?: Record<string, string>;
    correctDiagnosis?: string;
  };
  onClose?: () => void;
}

export const ExamPanel: React.FC<ExamPanelProps> = React.memo(
  ({ onExamPerformed, completedExams, suggestedRegions = [], caseData, onClose }) => {
    const [selectedRegion, setSelectedRegion] = useState<BodyRegion | null>(null);
    const [bodyView, setBodyView] = useState<'anterior' | 'posterior'>('anterior');
    const [isPerformingExam, setIsPerformingExam] = useState(false);
    const [recentFinding, setRecentFinding] = useState<ExamFinding | null>(null);

    // Get examined regions for highlighting
    const examinedRegions = completedExams.map((e) => e.region);

    // Get regions with abnormal findings
    const findingsMap = completedExams.reduce(
      (acc, e) => {
        if (e.isAbnormal) acc[e.region] = e.finding;
        return acc;
      },
      {} as Record<BodyRegion, string>
    );

    // Handle region selection
    const handleRegionClick = useCallback((region: BodyRegion) => {
      setSelectedRegion(region);
    }, []);

    // Get maneuvers for selected region
    const availableManeuvers = selectedRegion ? EXAM_MANEUVERS[selectedRegion] || [] : [];

    // Perform an exam maneuver
    const performManeuver = useCallback(
      async (maneuver: ExamManeuver) => {
        if (!selectedRegion) return;

        setIsPerformingExam(true);

        // Simulate exam time (would be real-time in actual implementation)
        await new Promise((resolve) => setTimeout(resolve, 800));

        // Generate finding - in real implementation, this would come from the case data
        let finding = 'Within normal limits';
        let isAbnormal = false;

        // Check if case data has this finding
        if (caseData?.physicalExamData) {
          const examData = caseData.physicalExamData;
          // Check for matching finding in case data
          const regionKey = Object.keys(examData).find(
            (key) =>
              key.toLowerCase().includes(selectedRegion.replace('_', ' ')) ||
              key.toLowerCase().includes(maneuver.name.toLowerCase())
          );
          if (regionKey) {
            // Guard: Record value access may return undefined, use default
            finding = examData[regionKey] ?? 'Within normal limits';
            isAbnormal = !/normal|unremarkable|negative|clear|soft|non.?tender/i.test(finding);
          }
        }

        const examFinding: ExamFinding = {
          maneuverId: maneuver.id,
          maneuverName: maneuver.name,
          region: selectedRegion,
          finding,
          isAbnormal,
          performedAt: Date.now(),
        };

        onExamPerformed(examFinding);
        setRecentFinding(examFinding);
        setIsPerformingExam(false);

        // Clear recent finding after a few seconds
        setTimeout(() => setRecentFinding(null), 3000);
      },
      [selectedRegion, caseData, onExamPerformed]
    );

    // Category icons
    const getCategoryIcon = (category?: string) => {
      switch (category) {
        case 'inspection':
          return <Eye className="w-4 h-4" />;
        case 'palpation':
          return <Hand className="w-4 h-4" />;
        case 'auscultation':
          return <Stethoscope className="w-4 h-4" />;
        case 'percussion':
          return <Activity className="w-4 h-4" />;
        default:
          return <Activity className="w-4 h-4" />;
      }
    };

    return (
      <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-data-neutral dark:border-data-neutral flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-[var(--color-category-practice)]" />
            <h3 className="font-semibold text-[var(--color-text-primary)]">Physical Examination</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBodyView((v) => (v === 'anterior' ? 'posterior' : 'anterior'))}
              className="flex items-center gap-1 px-2 py-1 text-sm bg-data-neutral dark:bg-data-neutral text-data-neutral dark:text-data-neutral rounded-lg hover:bg-data-neutral dark:hover:bg-data-neutral transition"
            >
              <RotateCcw className="w-4 h-4" />
              {bodyView === 'anterior' ? 'Posterior' : 'Anterior'}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 text-data-neutral hover:text-data-neutral dark:hover:text-data-neutral"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <div className="flex">
          {/* Body Map */}
          <div className="p-4 border-r border-data-neutral dark:border-data-neutral">
            <BodyMap
              onRegionClick={handleRegionClick}
              highlightedRegions={suggestedRegions}
              examinedRegions={examinedRegions}
              findingsMap={findingsMap}
              view={bodyView}
              size="md"
            />

            {/* Legend */}
            <div className="mt-4 space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-data-neutral" />
                <span className="text-data-neutral">Not examined</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-data-provisional" />
                <span className="text-data-neutral">Suggested</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-data-pass" />
                <span className="text-data-neutral">Normal</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-orange-500" />
                <span className="text-data-neutral">Abnormal</span>
              </div>
            </div>
          </div>

          {/* Maneuver Selection */}
          <div className="flex-1 p-4 min-w-[280px]">
            {selectedRegion ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-data-neutral dark:text-data-neutral capitalize">
                    {selectedRegion.replace(/_/g, ' ')}
                  </h4>
                  <button
                    onClick={() => setSelectedRegion(null)}
                    className="text-xs text-data-neutral hover:text-data-neutral"
                  >
                    Clear
                  </button>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {availableManeuvers.map((maneuver) => {
                    const isCompleted = completedExams.some((e) => e.maneuverId === maneuver.id);
                    const finding = completedExams.find((e) => e.maneuverId === maneuver.id);

                    return (
                      <button
                        key={maneuver.id}
                        onClick={() => !isCompleted && performManeuver(maneuver)}
                        disabled={isCompleted || isPerformingExam}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition ${
                          isCompleted
                            ? finding?.isAbnormal
                              ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
                              : 'bg-data-pass dark:bg-data-pass/20 border border-data-pass dark:border-data-pass'
                            : 'bg-data-neutral dark:bg-data-neutral/50 hover:bg-data-neutral dark:hover:bg-data-neutral border border-data-neutral dark:border-data-neutral'
                        }`}
                      >
                        <span
                          className={`${
                            isCompleted
                              ? finding?.isAbnormal
                                ? 'text-orange-500'
                                : 'text-data-pass'
                              : 'text-data-neutral'
                          }`}
                        >
                          {getCategoryIcon(maneuver.category)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-sm font-medium ${
                              isCompleted
                                ? finding?.isAbnormal
                                  ? 'text-orange-700 dark:text-orange-300'
                                  : 'text-data-pass dark:text-data-pass'
                                : 'text-data-neutral dark:text-data-neutral'
                            }`}
                          >
                            {maneuver.name}
                          </div>
                          {isCompleted && finding && (
                            <div
                              className={`text-xs mt-0.5 truncate ${
                                finding.isAbnormal
                                  ? 'text-orange-600 dark:text-orange-400'
                                  : 'text-data-pass dark:text-data-pass'
                              }`}
                            >
                              {finding.finding}
                            </div>
                          )}
                        </div>
                        {isCompleted ? (
                          <Check
                            className={`w-4 h-4 ${
                              finding?.isAbnormal ? 'text-orange-500' : 'text-data-pass'
                            }`}
                          />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-data-neutral" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-center">
                <Stethoscope className="w-12 h-12 text-data-neutral dark:text-data-neutral mb-3" />
                <p className="text-data-neutral dark:text-data-neutral text-sm">
                  Select a body region to examine
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Finding Toast */}
        <AnimatePresence>
          {recentFinding && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className={`absolute bottom-4 left-4 right-4 p-3 rounded-lg shadow-lg ${
                recentFinding.isAbnormal ? 'bg-orange-500 text-white' : 'bg-data-pass text-white'
              }`}
            >
              <div className="flex items-start gap-2">
                {recentFinding.isAbnormal ? (
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                ) : (
                  <Check className="w-5 h-5 flex-shrink-0" />
                )}
                <div>
                  <div className="font-medium">{recentFinding.maneuverName}</div>
                  <div className="text-sm opacity-90">{recentFinding.finding}</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading Overlay */}
        {isPerformingExam && (
          <div className="absolute inset-0 bg-[var(--color-overlay)] flex items-center justify-center">
            <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 shadow-xl">
              <div className="animate-pulse flex items-center gap-2 text-data-neutral dark:text-data-neutral">
                <Stethoscope className="w-5 h-5 animate-bounce" />
                <span>Performing exam...</span>
              </div>
            </div>
          </div>
        )}

        {/* Exam Summary Footer */}
        <div className="p-3 border-t border-data-neutral dark:border-data-neutral bg-data-neutral dark:bg-data-neutral/50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-data-neutral dark:text-data-neutral">
              {completedExams.length} exams performed
            </span>
            <div className="flex items-center gap-3">
              <span className="text-data-pass">
                {completedExams.filter((e) => !e.isAbnormal).length} normal
              </span>
              <span className="text-orange-500">
                {completedExams.filter((e) => e.isAbnormal).length} abnormal
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ExamPanel.displayName = 'ExamPanel';

export default ExamPanel;
