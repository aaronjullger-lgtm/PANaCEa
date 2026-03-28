'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Clock,
  CheckCircle,
  AlertTriangle,
  Zap,
  BookOpen,
  BarChart3,
  Info,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type DrilldownLevel = 'system' | 'category' | 'condition';

interface SystemMetrics {
  code: string;
  name: string;
  accuracy: number;
  totalQuestions: number;
  questionsAnswered: number;
  trend: 'up' | 'down' | 'stable';
  trendDelta: number;
  categories: CategoryMetrics[];
}

interface CategoryMetrics {
  id: string;
  name: string;
  accuracy: number;
  totalQuestions: number;
  questionsAnswered: number;
  trend: 'up' | 'down' | 'stable';
  conditions: ConditionMetrics[];
}

interface ConditionMetrics {
  id: string;
  name: string;
  accuracy: number;
  totalAttempts: number;
  lastPracticed?: Date;
  masteryLevel: 'novice' | 'developing' | 'proficient' | 'expert';
  srsStatus: 'due' | 'learning' | 'mastered';
}

interface CompetencyHeatmapProps {
  /** System-level performance data */
  systemData: SystemMetrics[];
  /** Callback when user wants to practice a specific area */
  onPractice?: (type: 'system' | 'category' | 'condition', id: string) => void;
  /** Whether to show detailed metrics */
  showDetailedMetrics?: boolean;
}

// ============================================================================
// Sample Data (for demo purposes)
// ============================================================================

const SAMPLE_DATA: SystemMetrics[] = [
  {
    code: 'CV',
    name: 'Cardiovascular',
    accuracy: 78,
    totalQuestions: 150,
    questionsAnswered: 89,
    trend: 'up',
    trendDelta: 5,
    categories: [
      {
        id: 'cv-ischemic',
        name: 'Ischemic Heart Disease',
        accuracy: 82,
        totalQuestions: 45,
        questionsAnswered: 32,
        trend: 'up',
        conditions: [
          {
            id: 'mi',
            name: 'Myocardial Infarction',
            accuracy: 85,
            totalAttempts: 18,
            masteryLevel: 'proficient',
            srsStatus: 'mastered',
          },
          {
            id: 'angina',
            name: 'Angina Pectoris',
            accuracy: 78,
            totalAttempts: 14,
            masteryLevel: 'developing',
            srsStatus: 'learning',
            lastPracticed: new Date(Date.now() - 86400000),
          },
        ],
      },
      {
        id: 'cv-arrhythmia',
        name: 'Arrhythmias',
        accuracy: 72,
        totalQuestions: 38,
        questionsAnswered: 28,
        trend: 'stable',
        conditions: [
          {
            id: 'afib',
            name: 'Atrial Fibrillation',
            accuracy: 75,
            totalAttempts: 12,
            masteryLevel: 'developing',
            srsStatus: 'due',
            lastPracticed: new Date(Date.now() - 172800000),
          },
          {
            id: 'vfib',
            name: 'Ventricular Fibrillation',
            accuracy: 68,
            totalAttempts: 8,
            masteryLevel: 'novice',
            srsStatus: 'learning',
          },
        ],
      },
      {
        id: 'cv-hf',
        name: 'Heart Failure',
        accuracy: 80,
        totalQuestions: 35,
        questionsAnswered: 29,
        trend: 'up',
        conditions: [
          {
            id: 'hfref',
            name: 'HFrEF',
            accuracy: 82,
            totalAttempts: 15,
            masteryLevel: 'proficient',
            srsStatus: 'mastered',
          },
          {
            id: 'hfpef',
            name: 'HFpEF',
            accuracy: 78,
            totalAttempts: 14,
            masteryLevel: 'developing',
            srsStatus: 'learning',
          },
        ],
      },
    ],
  },
  {
    code: 'PULM',
    name: 'Pulmonary',
    accuracy: 71,
    totalQuestions: 120,
    questionsAnswered: 65,
    trend: 'stable',
    trendDelta: 0,
    categories: [
      {
        id: 'pulm-obstructive',
        name: 'Obstructive Disease',
        accuracy: 74,
        totalQuestions: 40,
        questionsAnswered: 25,
        trend: 'up',
        conditions: [
          {
            id: 'copd',
            name: 'COPD',
            accuracy: 80,
            totalAttempts: 15,
            masteryLevel: 'proficient',
            srsStatus: 'mastered',
          },
          {
            id: 'asthma',
            name: 'Asthma',
            accuracy: 68,
            totalAttempts: 10,
            masteryLevel: 'developing',
            srsStatus: 'due',
          },
        ],
      },
      {
        id: 'pulm-infectious',
        name: 'Pulmonary Infections',
        accuracy: 68,
        totalQuestions: 35,
        questionsAnswered: 22,
        trend: 'down',
        conditions: [
          {
            id: 'cap',
            name: 'Community-Acquired Pneumonia',
            accuracy: 72,
            totalAttempts: 12,
            masteryLevel: 'developing',
            srsStatus: 'learning',
          },
          {
            id: 'tb',
            name: 'Tuberculosis',
            accuracy: 64,
            totalAttempts: 10,
            masteryLevel: 'novice',
            srsStatus: 'due',
          },
        ],
      },
    ],
  },
  {
    code: 'GI',
    name: 'Gastrointestinal',
    accuracy: 65,
    totalQuestions: 130,
    questionsAnswered: 58,
    trend: 'down',
    trendDelta: -3,
    categories: [
      {
        id: 'gi-upper',
        name: 'Upper GI',
        accuracy: 70,
        totalQuestions: 45,
        questionsAnswered: 22,
        trend: 'stable',
        conditions: [
          {
            id: 'gerd',
            name: 'GERD',
            accuracy: 75,
            totalAttempts: 10,
            masteryLevel: 'developing',
            srsStatus: 'learning',
          },
          {
            id: 'pud',
            name: 'Peptic Ulcer Disease',
            accuracy: 65,
            totalAttempts: 12,
            masteryLevel: 'novice',
            srsStatus: 'due',
          },
        ],
      },
      {
        id: 'gi-hepatic',
        name: 'Hepatic/Biliary',
        accuracy: 58,
        totalQuestions: 40,
        questionsAnswered: 18,
        trend: 'down',
        conditions: [
          {
            id: 'cirrhosis',
            name: 'Cirrhosis',
            accuracy: 55,
            totalAttempts: 8,
            masteryLevel: 'novice',
            srsStatus: 'due',
          },
          {
            id: 'hepatitis',
            name: 'Viral Hepatitis',
            accuracy: 62,
            totalAttempts: 10,
            masteryLevel: 'novice',
            srsStatus: 'learning',
          },
        ],
      },
    ],
  },
  {
    code: 'NEURO',
    name: 'Neurology',
    accuracy: 82,
    totalQuestions: 100,
    questionsAnswered: 72,
    trend: 'up',
    trendDelta: 8,
    categories: [
      {
        id: 'neuro-stroke',
        name: 'Cerebrovascular',
        accuracy: 85,
        totalQuestions: 35,
        questionsAnswered: 28,
        trend: 'up',
        conditions: [
          {
            id: 'stroke-ischemic',
            name: 'Ischemic Stroke',
            accuracy: 88,
            totalAttempts: 15,
            masteryLevel: 'expert',
            srsStatus: 'mastered',
          },
          {
            id: 'stroke-hemorrhagic',
            name: 'Hemorrhagic Stroke',
            accuracy: 82,
            totalAttempts: 13,
            masteryLevel: 'proficient',
            srsStatus: 'mastered',
          },
        ],
      },
    ],
  },
  {
    code: 'MSK',
    name: 'Musculoskeletal',
    accuracy: 74,
    totalQuestions: 90,
    questionsAnswered: 45,
    trend: 'stable',
    trendDelta: 1,
    categories: [],
  },
  {
    code: 'DERM',
    name: 'Dermatology',
    accuracy: 68,
    totalQuestions: 70,
    questionsAnswered: 35,
    trend: 'up',
    trendDelta: 4,
    categories: [],
  },
  {
    code: 'ID',
    name: 'Infectious Disease',
    accuracy: 76,
    totalQuestions: 95,
    questionsAnswered: 52,
    trend: 'up',
    trendDelta: 3,
    categories: [],
  },
  {
    code: 'HEME',
    name: 'Hematology',
    accuracy: 62,
    totalQuestions: 65,
    questionsAnswered: 28,
    trend: 'down',
    trendDelta: -2,
    categories: [],
  },
  {
    code: 'ENDO',
    name: 'Endocrine',
    accuracy: 79,
    totalQuestions: 80,
    questionsAnswered: 55,
    trend: 'up',
    trendDelta: 6,
    categories: [],
  },
  {
    code: 'RENAL',
    name: 'Renal',
    accuracy: 71,
    totalQuestions: 60,
    questionsAnswered: 32,
    trend: 'stable',
    trendDelta: 0,
    categories: [],
  },
  {
    code: 'REPRO',
    name: 'Reproductive',
    accuracy: 73,
    totalQuestions: 55,
    questionsAnswered: 30,
    trend: 'up',
    trendDelta: 2,
    categories: [],
  },
  {
    code: 'PSYCH',
    name: 'Psychiatry',
    accuracy: 77,
    totalQuestions: 50,
    questionsAnswered: 38,
    trend: 'stable',
    trendDelta: 1,
    categories: [],
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

const getAccuracyColor = (accuracy: number): string => {
  if (accuracy >= 80) return 'bg-data-pass';
  if (accuracy >= 70) return 'bg-[var(--color-accent)]';
  if (accuracy >= 60) return 'bg-data-provisional';
  return 'bg-data-fail';
};

const getAccuracyColorText = (accuracy: number): string => {
  if (accuracy >= 80) return 'text-data-pass';
  if (accuracy >= 70) return 'text-[var(--color-accent)]';
  if (accuracy >= 60) return 'text-data-provisional';
  return 'text-data-fail';
};

const getMasteryColor = (level: ConditionMetrics['masteryLevel']): string => {
  switch (level) {
    case 'expert':
      return 'bg-data-pass/10 text-data-pass';
    case 'proficient':
      return 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]';
    case 'developing':
      return 'bg-data-provisional/10 text-data-provisional';
    case 'novice':
      return 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]';
  }
};

const getSrsStatusIcon = (status: ConditionMetrics['srsStatus']) => {
  switch (status) {
    case 'mastered':
      return <CheckCircle className="w-4 h-4 text-data-pass" />;
    case 'learning':
      return <BookOpen className="w-4 h-4 text-[var(--color-accent)]" />;
    case 'due':
      return <AlertTriangle className="w-4 h-4 text-data-provisional" />;
  }
};

// ============================================================================
// Subcomponents
// ============================================================================

interface BreadcrumbProps {
  level: DrilldownLevel;
  systemName?: string;
  categoryName?: string;
  onNavigate: (level: DrilldownLevel) => void;
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ level, systemName, categoryName, onNavigate }) => {
  return (
    <nav className="flex items-center gap-2 text-sm mb-6">
      <button
        onClick={() => onNavigate('system')}
        className={`flex items-center gap-1 ${
          level === 'system'
            ? 'text-[var(--color-text-primary)] font-semibold'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
        }`}
      >
        <BarChart3 className="w-4 h-4" />
        All Systems
      </button>

      {systemName && (
        <>
          <span className="inline-flex items-center shrink-0 bg-transparent" aria-hidden>
            <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
          </span>
          <button
            onClick={() => onNavigate('category')}
            className={`${
              level === 'category'
                ? 'text-[var(--color-text-primary)] font-semibold'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {systemName}
          </button>
        </>
      )}

      {categoryName && (
        <>
          <span className="inline-flex items-center shrink-0 bg-transparent" aria-hidden>
            <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
          </span>
          <span className="text-[var(--color-text-primary)] font-semibold">{categoryName}</span>
        </>
      )}
    </nav>
  );
};

interface HeatmapCellProps {
  label: string;
  accuracy: number;
  questionsAnswered: number;
  totalQuestions: number;
  trend?: 'up' | 'down' | 'stable';
  trendDelta?: number;
  onClick: () => void;
  size?: 'sm' | 'md' | 'lg';
}

const HeatmapCell: React.FC<HeatmapCellProps> = ({
  label,
  accuracy,
  questionsAnswered,
  totalQuestions,
  trend,
  trendDelta,
  onClick,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-5',
  };

  const coverage = Math.round((questionsAnswered / totalQuestions) * 100);

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`${sizeClasses[size]} rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] hover:shadow-lg transition-all text-left group relative overflow-hidden`}
    >
      {/* Background accuracy indicator */}
      <div
        className={`absolute bottom-0 left-0 right-0 ${getAccuracyColor(accuracy)} opacity-10`}
        style={{ height: `${accuracy}%` }}
      />

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <span className="font-semibold text-[var(--color-text-primary)] text-sm line-clamp-1" title={label}>
            {label}
          </span>
          <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
        </div>

        {/* Accuracy */}
        <div className="flex items-baseline gap-1 mb-2">
          <span className={`text-2xl font-bold ${getAccuracyColorText(accuracy)}`}>
            {accuracy}%
          </span>
          {trend && trendDelta !== undefined && (
            <span
              className={`text-xs font-medium flex items-center gap-0.5 ${
                trend === 'up'
                  ? 'text-data-pass'
                  : trend === 'down'
                    ? 'text-data-fail'
                    : 'text-[var(--color-text-muted)]'
              }`}
            >
              {trend === 'up' ? (
                <TrendingUp className="w-3 h-3" />
              ) : trend === 'down' ? (
                <TrendingDown className="w-3 h-3" />
              ) : (
                <Minus className="w-3 h-3" />
              )}
              {trend !== 'stable' && `${trendDelta > 0 ? '+' : ''}${trendDelta}%`}
            </span>
          )}
        </div>

        {/* Coverage bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <span>Coverage</span>
            <span>{coverage}%</span>
          </div>
          <div className="h-1.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-accent)]/40 transition-all duration-500"
              style={{ width: `${coverage}%` }}
            />
          </div>
        </div>
      </div>
    </motion.button>
  );
};

interface ConditionRowProps {
  condition: ConditionMetrics;
  onPractice: () => void;
}

const ConditionRow: React.FC<ConditionRowProps> = ({ condition, onPractice }) => {
  const daysAgo = condition.lastPracticed
    ? Math.floor((Date.now() - condition.lastPracticed.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <motion.div
      initial={{ y: 10 }}
      animate={{ y: 0 }}
      className="flex items-center justify-between p-4 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] hover:shadow-md transition-all"
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* SRS Status */}
        <div className="flex-shrink-0">{getSrsStatusIcon(condition.srsStatus)}</div>

        {/* Condition info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[var(--color-text-primary)] truncate" title={condition.name}>
              {condition.name}
            </span>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${getMasteryColor(condition.masteryLevel)}`}
            >
              {condition.masteryLevel}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] mt-1">
            <span>{condition.totalAttempts} attempts</span>
            {daysAgo !== null && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`}
              </span>
            )}
          </div>
        </div>

        {/* Accuracy */}
        <div className="text-right flex-shrink-0">
          <div className={`text-xl font-bold ${getAccuracyColorText(condition.accuracy)}`}>
            {condition.accuracy}%
          </div>
        </div>
      </div>

      {/* Practice button */}
      <button
        onClick={onPractice}
        className={`ml-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
          condition.srsStatus === 'due'
            ? 'bg-[var(--color-warning)] hover:bg-[var(--color-warning)]/90 text-[var(--color-text-inverse)]'
            : 'bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]'
        }`}
      >
        {condition.srsStatus === 'due' ? (
          <span className="flex items-center gap-1">
            <Zap className="w-4 h-4" />
            Review Now
          </span>
        ) : (
          'Practice'
        )}
      </button>
    </motion.div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const CompetencyHeatmap: React.FC<CompetencyHeatmapProps> = ({
  systemData = SAMPLE_DATA,
  onPractice,
  showDetailedMetrics = true,
}) => {
  const [drilldownLevel, setDrilldownLevel] = useState<DrilldownLevel>('system');
  const [selectedSystem, setSelectedSystem] = useState<SystemMetrics | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryMetrics | null>(null);

  // Navigation handlers
  const handleSelectSystem = (system: SystemMetrics) => {
    if (system.categories.length > 0) {
      setSelectedSystem(system);
      setDrilldownLevel('category');
    }
  };

  const handleSelectCategory = (category: CategoryMetrics) => {
    setSelectedCategory(category);
    setDrilldownLevel('condition');
  };

  const handleNavigate = (level: DrilldownLevel) => {
    setDrilldownLevel(level);
    if (level === 'system') {
      setSelectedSystem(null);
      setSelectedCategory(null);
    } else if (level === 'category') {
      setSelectedCategory(null);
    }
  };

  const handlePractice = (type: 'system' | 'category' | 'condition', id: string) => {
    onPractice?.(type, id);
  };

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const total = systemData.reduce((acc, s) => acc + s.questionsAnswered, 0);
    const avgAccuracy = total > 0
      ? Math.round(systemData.reduce((acc, s) => acc + s.accuracy * s.questionsAnswered, 0) / total)
      : 0;
    const weakAreas = systemData.filter((s) => s.accuracy < 70).length;
    const strongAreas = systemData.filter((s) => s.accuracy >= 80).length;
    return { total, avgAccuracy, weakAreas, strongAreas };
  }, [systemData]);

  return (
    <div className="space-y-6">
      {/* Header with summary stats */}
      {drilldownLevel === 'system' && showDetailedMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)]">
            <div className="text-sm text-[var(--color-text-muted)] mb-1">Overall Accuracy</div>
            <div className={`text-2xl font-bold ${getAccuracyColorText(summaryStats.avgAccuracy)}`}>
              {summaryStats.avgAccuracy}%
            </div>
          </div>
          <div className="p-4 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)]">
            <div className="text-sm text-[var(--color-text-muted)] mb-1">Questions Answered</div>
            <div className="text-2xl font-bold text-[var(--color-text-primary)]">
              {summaryStats.total}
            </div>
          </div>
          <div className="p-4 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)]">
            <div className="text-sm text-[var(--color-text-muted)] mb-1">Strong Areas</div>
            <div className="text-2xl font-bold text-[var(--color-success)]">
              {summaryStats.strongAreas}
            </div>
          </div>
          <div className="p-4 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)]">
            <div className="text-sm text-[var(--color-text-muted)] mb-1">Needs Work</div>
            <div className="text-2xl font-bold text-[var(--color-warning)]">
              {summaryStats.weakAreas}
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb navigation */}
      <Breadcrumb
        level={drilldownLevel}
        systemName={selectedSystem?.name}
        categoryName={selectedCategory?.name}
        onNavigate={handleNavigate}
      />

      {/* Content based on drilldown level */}
      <AnimatePresence mode="wait">
        {/* System Level - Heatmap Grid */}
        {drilldownLevel === 'system' && (
          <motion.div
            key="system-grid"
            initial={{ x: -20 }}
            animate={{ x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            {systemData.map((system) => (
              <HeatmapCell
                key={system.code}
                label={`${system.code} - ${system.name}`}
                accuracy={system.accuracy}
                questionsAnswered={system.questionsAnswered}
                totalQuestions={system.totalQuestions}
                trend={system.trend}
                trendDelta={system.trendDelta}
                onClick={() => handleSelectSystem(system)}
              />
            ))}
          </motion.div>
        )}

        {/* Category Level */}
        {drilldownLevel === 'category' && selectedSystem && (
          <motion.div
            key="category-grid"
            initial={{ x: -20 }}
            animate={{ x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            {selectedSystem.categories.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedSystem.categories.map((category) => (
                  <HeatmapCell
                    key={category.id}
                    label={category.name}
                    accuracy={category.accuracy}
                    questionsAnswered={category.questionsAnswered}
                    totalQuestions={category.totalQuestions}
                    trend={category.trend}
                    onClick={() => handleSelectCategory(category)}
                    size="lg"
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-[var(--color-text-muted)]">
                <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No category breakdown available for this system yet.</p>
                <button
                  onClick={() => handlePractice('system', selectedSystem.code)}
                  className="mt-4 px-6 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 text-[var(--color-text-inverse)] rounded-lg transition-colors"
                >
                  Practice {selectedSystem.name}
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Condition Level */}
        {drilldownLevel === 'condition' && selectedCategory && (
          <motion.div
            key="condition-list"
            initial={{ x: -20 }}
            animate={{ x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-3"
          >
            {selectedCategory.conditions.map((condition, index) => (
              <motion.div
                key={condition.id}
                initial={{ y: 10 }}
                animate={{ y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <ConditionRow
                  condition={condition}
                  onPractice={() => handlePractice('condition', condition.id)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back button for mobile */}
      {drilldownLevel !== 'system' && (
        <button
          onClick={() => handleNavigate(drilldownLevel === 'condition' ? 'category' : 'system')}
          className="md:hidden fixed bottom-6 left-6 p-3 bg-[var(--color-bg-primary)] rounded-full shadow-lg border border-[var(--color-border)]"
        >
          <ChevronLeft className="w-6 h-6 text-[var(--color-text-muted)]" />
        </button>
      )}
    </div>
  );
};

export default CompetencyHeatmap;
