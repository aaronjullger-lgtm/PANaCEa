import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Zap,
  Clock,
  Target,
  AlertTriangle,
  CheckCircle2,
  Circle,
  ChevronRight,
  Play,
  Calendar,
  BarChart3,
  Brain,
  Activity,
  ArrowLeft,
  FileText,
} from 'lucide-react';
import type { PerformanceRecord, SystemCode } from '@/types';
import { ABBREVIATION_TO_TOPIC_MAP } from '@/src/constants';
import { ConditionPreviewCard } from '../conditions/ConditionPreviewCard';
import type { ConditionMeta } from '../../src/types/conditions';
import { useLowPowerMode } from '@/hooks/useLowPowerMode';

interface IntelligenceHubProps {
  performanceData: PerformanceRecord[];
  onStartSession?: (system: SystemCode, subcategory?: string) => void;
  theme?: 'light' | 'dark';
}

interface SystemStats {
  system: SystemCode;
  systemName: string;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  avgDecisionTimeMs: number;
  decisionTimeTrend: number; // positive = getting slower, negative = getting faster
  retentionScore: number; // 0-100, predicted stability
  subcategories: SubcategoryStats[];
}

interface SubcategoryStats {
  name: string;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  conditions: ConditionStats[];
  avgDecisionTimeMs: number;
  lastPracticed?: Date;
}

interface ConditionStats {
  name: string;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  nextDue?: Date;
  retentionScore: number;
  avgDecisionTimeMs: number;
  trend: 'improving' | 'declining' | 'stable';
}

interface HighYieldGap {
  system: SystemCode;
  subcategory: string;
  accuracy: number;
  examWeight: number; // Mock weight for demo
  gapScore: number; // (examWeight * (100 - accuracy))
}

type ViewLevel = 'dashboard' | 'system' | 'subcategory';

const IntelligenceHub: React.FC<IntelligenceHubProps> = ({
  performanceData,
  onStartSession,
  theme = 'dark',
}) => {
  const lowPower = useLowPowerMode();
  const [viewLevel, setViewLevel] = useState<ViewLevel>('dashboard');
  const [selectedSystem, setSelectedSystem] = useState<SystemCode | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [selectedCondition, setSelectedCondition] = useState<ConditionStats | null>(null);

  // Calculate system statistics with subcategories and conditions
  const systemStats = useMemo(() => {
    const statsMap = new Map<SystemCode, SystemStats>();

    // Initialize all systems
    Object.keys(ABBREVIATION_TO_TOPIC_MAP).forEach((sys) => {
      const system = sys as SystemCode;
      // Guard: map lookup returns string | undefined, fallback to system code
      const mappedName = ABBREVIATION_TO_TOPIC_MAP[system];
      const systemName = mappedName !== undefined ? mappedName : system;
      statsMap.set(system, {
        system,
        systemName,
        totalQuestions: 0,
        correctAnswers: 0,
        accuracy: 0,
        avgDecisionTimeMs: 0,
        decisionTimeTrend: 0,
        retentionScore: 0,
        subcategories: [],
      });
    });

    // Group by system, subcategory, condition
    const subcategoryMap = new Map<string, Map<string, ConditionStats>>();

    performanceData.forEach((record: PerformanceRecord) => {
      if (!record.system) return;

      const system = record.system as SystemCode;
      const subcategory = record.subcategory || 'General';
      const condition = record.condition || 'Unknown';

      // Update subcategory map
      const key = `${system}|${subcategory}`;
      if (!subcategoryMap.has(key)) {
        subcategoryMap.set(key, new Map());
      }
      const conditionsMap = subcategoryMap.get(key)!;

      if (!conditionsMap.has(condition)) {
        conditionsMap.set(condition, {
          name: condition,
          totalQuestions: 0,
          correctAnswers: 0,
          accuracy: 0,
          retentionScore: Math.random() * 40 + 60, // Mock FSRS score 60-100
          avgDecisionTimeMs: 0,
          trend: 'stable',
        });
      }

      const conditionStats = conditionsMap.get(condition)!;
      conditionStats.totalQuestions++;
      if (record.isCorrect) conditionStats.correctAnswers++;
    });

    // Calculate subcategory stats
    const subcategoryStatsMap = new Map<string, SubcategoryStats>();
    subcategoryMap.forEach((conditions, key) => {
      const [system, subcategory = 'General'] = key.split('|');
      const conditionArray = Array.from(conditions.values());

      const totalQ = conditionArray.reduce((sum, c) => sum + c.totalQuestions, 0);
      const correctA = conditionArray.reduce((sum, c) => sum + c.correctAnswers, 0);

      // Calculate condition-level metrics
      conditionArray.forEach((cond) => {
        cond.accuracy =
          cond.totalQuestions > 0
            ? Math.round((cond.correctAnswers / cond.totalQuestions) * 100)
            : 0;

        // Determine trend (mock logic based on accuracy)
        if (cond.accuracy >= 80) cond.trend = 'improving';
        else if (cond.accuracy < 60) cond.trend = 'declining';
        else cond.trend = 'stable';

        // Mock next due date (1-14 days from now)
        const daysUntilDue = Math.floor(Math.random() * 14) + 1;
        cond.nextDue = new Date(Date.now() + daysUntilDue * 24 * 60 * 60 * 1000);
      });

      subcategoryStatsMap.set(key, {
        name: subcategory,
        totalQuestions: totalQ,
        correctAnswers: correctA,
        accuracy: totalQ > 0 ? Math.round((correctA / totalQ) * 100) : 0,
        conditions: conditionArray.sort((a, b) => b.totalQuestions - a.totalQuestions),
        avgDecisionTimeMs: 0,
        lastPracticed: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      });
    });

    // Aggregate to system level
    performanceData.forEach((record) => {
      if (!record.system) return;
      const system = record.system as SystemCode;
      const stats = statsMap.get(system)!;

      stats.totalQuestions++;
      if (record.isCorrect) stats.correctAnswers++;
    });

    // Calculate final system metrics
    statsMap.forEach((stats, system) => {
      stats.accuracy =
        stats.totalQuestions > 0
          ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100)
          : 0;

      // Gather subcategories for this system
      const subcats: SubcategoryStats[] = [];
      subcategoryStatsMap.forEach((subcat, key) => {
        if (key.startsWith(`${system}|`)) {
          subcats.push(subcat);
        }
      });
      stats.subcategories = subcats.sort((a, b) => b.totalQuestions - a.totalQuestions);

      // Mock retention score (weighted average of conditions)
      const allConditions = subcats.flatMap((s) => s.conditions);
      stats.retentionScore =
        allConditions.length > 0
          ? Math.round(
              allConditions.reduce((sum, c) => sum + c.retentionScore, 0) / allConditions.length
            )
          : 0;

      // Mock decision time trend (-20 to +20 ms/question change)
      stats.decisionTimeTrend = Math.random() * 40 - 20;
      stats.avgDecisionTimeMs = 45000 + Math.random() * 30000; // 45-75 seconds
    });

    return Array.from(statsMap.values()).filter((s) => s.totalQuestions > 0);
  }, [performanceData]);

  // Calculate High-Yield Gaps (Top 3)
  const highYieldGaps = useMemo(() => {
    const gaps: HighYieldGap[] = [];

    systemStats.forEach((sys) => {
      sys.subcategories.forEach((subcat) => {
        // Mock exam weight (0.5 - 2.5, higher for CV, PULM, GI)
        let examWeight = 1.0;
        if (['CV', 'PULM', 'GI', 'NEURO'].includes(sys.system)) examWeight = 2.0;
        if (['DERM', 'HEENT', 'PSYCH'].includes(sys.system)) examWeight = 0.7;

        const gapScore = examWeight * (100 - subcat.accuracy);

        gaps.push({
          system: sys.system,
          subcategory: subcat.name,
          accuracy: subcat.accuracy,
          examWeight,
          gapScore,
        });
      });
    });

    return gaps.sort((a, b) => b.gapScore - a.gapScore).slice(0, 3);
  }, [systemStats]);

  // Radar chart data for Level 1 Dashboard
  const radarChartData = useMemo(() => {
    const maxSystems = 14;
    const angleStep = (2 * Math.PI) / maxSystems;
    const centerX = 200;
    const centerY = 200;
    const maxRadius = 160;

    const points = systemStats.map((sys, index) => {
      const angle = index * angleStep - Math.PI / 2; // Start at top
      const radius = (sys.accuracy / 100) * maxRadius;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      return { x, y, system: sys.system, accuracy: sys.accuracy };
    });

    // Generate polygon path
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ') + ' Z';

    // Generate grid circles
    const gridCircles = [0.25, 0.5, 0.75, 1.0].map((factor) => ({
      radius: maxRadius * factor,
      label: `${factor * 100}%`,
    }));

    // Generate axis lines and labels
    const axes = systemStats.map((sys, index) => {
      const angle = index * angleStep - Math.PI / 2;
      const endX = centerX + maxRadius * Math.cos(angle);
      const endY = centerY + maxRadius * Math.sin(angle);
      const labelX = centerX + (maxRadius + 30) * Math.cos(angle);
      const labelY = centerY + (maxRadius + 30) * Math.sin(angle);

      return {
        x1: centerX,
        y1: centerY,
        x2: endX,
        y2: endY,
        labelX,
        labelY,
        system: sys.system,
      };
    });

    return { points, pathD, gridCircles, axes, centerX, centerY };
  }, [systemStats]);

  const handleSystemClick = (system: SystemCode) => {
    setSelectedSystem(system);
    setSelectedSubcategory(null);
    setViewLevel('system');
  };

  const handleSubcategoryClick = (subcategory: string) => {
    setSelectedSubcategory(subcategory);
    setViewLevel('subcategory');
  };

  const handleBackToDashboard = () => {
    setViewLevel('dashboard');
    setSelectedSystem(null);
    setSelectedSubcategory(null);
  };

  const handleBackToSystem = () => {
    setViewLevel('system');
    setSelectedSubcategory(null);
  };

  const currentSystemStats = selectedSystem
    ? systemStats.find((s) => s.system === selectedSystem)
    : null;

  const currentSubcategoryStats =
    currentSystemStats && selectedSubcategory
      ? currentSystemStats.subcategories.find((s) => s.name === selectedSubcategory)
      : null;

  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[var(--color-accent)] rounded-lg">
            <Brain className="w-6 h-6 text-[var(--color-text-inverse)]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Intelligence Hub</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              {viewLevel === 'dashboard' ? 'System Overview' : ''}
              {viewLevel === 'system' && selectedSystem
                ? `${ABBREVIATION_TO_TOPIC_MAP[selectedSystem] || selectedSystem} Deep Dive`
                : ''}
              {viewLevel === 'subcategory' ? (selectedSubcategory ?? '') : ''}
            </p>
          </div>
        </div>

        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={handleBackToDashboard}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              viewLevel === 'dashboard'
                ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-primary)]'
            }`}
          >
            Dashboard
          </button>
          {selectedSystem && (
            <>
              <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
              <button
                onClick={handleBackToSystem}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  viewLevel === 'system'
                    ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-primary)]'
                }`}
              >
                {selectedSystem}
              </button>
            </>
          )}
          {selectedSubcategory && (
            <>
              <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
              <span className="px-3 py-1.5 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg">
                {selectedSubcategory}
              </span>
            </>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* LEVEL 1: DASHBOARD - Radar Chart */}
        {viewLevel === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* High-Yield Gaps - Priority Alert */}
            <div className="bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-[var(--color-warning)]" />
                <h3 className="font-semibold text-[var(--color-text-primary)]">
                  High-Yield Gaps (Top 3 Priority Areas)
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {highYieldGaps.map((gap, index) => (
                  <button
                    key={`${gap.system}-${gap.subcategory}`}
                    onClick={() => handleSystemClick(gap.system)}
                    className="text-left p-3 bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-warning)]/40 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-[var(--color-warning)]">
                        #{index + 1} PRIORITY
                      </span>
                      <Target className="w-4 h-4 text-[var(--color-warning)]" />
                    </div>
                    <div className="font-semibold text-sm text-[var(--color-text-primary)] mb-1">
                      {gap.system}: {gap.subcategory}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--color-text-muted)]">
                        Accuracy: {gap.accuracy}%
                      </span>
                      <span className="text-[var(--color-warning)] font-medium">
                        Weight: {gap.examWeight.toFixed(1)}x
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Radar Chart — GPU layer for compositing (battery drain audit) */}
            <div
              className="bg-[var(--color-bg-primary)] rounded-lg p-6"
              style={{ transform: 'translateZ(0)' }}
            >
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-4 text-center">
                System Mastery Overview
              </h3>
              <div className="flex justify-center">
                <svg width="440" height="440" className="overflow-visible">
                  {/* Grid circles */}
                  {radarChartData.gridCircles.map((circle, i) => (
                    <g key={i}>
                      <circle
                        cx={radarChartData.centerX}
                        cy={radarChartData.centerY}
                        r={circle.radius}
                        fill="none"
                        stroke="var(--color-border)"
                        strokeWidth="1"
                        strokeDasharray={i === radarChartData.gridCircles.length - 1 ? '0' : '4 4'}
                      />
                      {i === radarChartData.gridCircles.length - 1 && (
                        <text
                          x={radarChartData.centerX + circle.radius + 8}
                          y={radarChartData.centerY + 4}
                          className="text-xs fill-[var(--color-text-muted)]"
                        >
                          {circle.label}
                        </text>
                      )}
                    </g>
                  ))}

                  {/* Axis lines */}
                  {radarChartData.axes.map((axis, i) => (
                    <line
                      key={i}
                      x1={axis.x1}
                      y1={axis.y1}
                      x2={axis.x2}
                      y2={axis.y2}
                      stroke="var(--color-border)"
                      strokeWidth="1"
                    />
                  ))}

                  {/* Performance polygon */}
                  <path
                    d={radarChartData.pathD}
                    fill="var(--color-accent)"
                    fillOpacity={0.2}
                    stroke="var(--color-accent)"
                    strokeWidth="2"
                  />

                  {/* Data points and labels */}
                  {radarChartData.points.map((point, i) => {
                    const axis = radarChartData.axes[i];
                    if (!axis) return null;
                    return (
                      <g key={i}>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r="4"
                          fill="var(--color-accent)"
                          className="cursor-pointer hover:r-6 transition-all"
                          onClick={() => handleSystemClick(point.system)}
                        />
                        <text
                          x={axis.labelX}
                          y={axis.labelY}
                          textAnchor="middle"
                          className="text-xs font-medium fill-[var(--color-text-primary)] cursor-pointer hover:fill-[var(--color-accent)]"
                          onClick={() => handleSystemClick(point.system)}
                        >
                          {axis.system}
                        </text>
                        <text
                          x={axis.labelX}
                          y={axis.labelY + 12}
                          textAnchor="middle"
                          className="text-xs fill-[var(--color-text-muted)]"
                        >
                          {point.accuracy}%
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* System List (Alternative View) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {systemStats.map((sys) => (
                <button
                  key={sys.system}
                  onClick={() => handleSystemClick(sys.system)}
                  className="text-left p-4 bg-[var(--color-bg-primary)] rounded-lg hover:shadow-lg transition-all border border-[var(--color-border)] hover:border-[var(--color-accent)]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[var(--color-accent)]">{sys.system}</span>
                    <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
                  </div>
                  <div className="text-sm text-[var(--color-text-primary)] mb-2">
                    {sys.systemName}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)] mb-2">
                    <span>{sys.totalQuestions} questions</span>
                    <span className="font-medium text-[var(--color-accent)]">{sys.accuracy}%</span>
                  </div>
                  <div className="w-full h-2 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--color-accent)] rounded-full transition-all"
                      style={{ width: `${sys.accuracy}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* LEVEL 2: SYSTEM DRILLDOWN - Subcategories */}
        {viewLevel === 'system' && currentSystemStats && (
          <motion.div
            key="system"
            initial={{ x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* System Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-[var(--color-bg-primary)] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-5 h-5 text-[var(--color-accent)]" />
                  <span className="text-sm text-[var(--color-text-muted)]">Accuracy</span>
                </div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {currentSystemStats.accuracy}%
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {currentSystemStats.correctAnswers}/{currentSystemStats.totalQuestions} correct
                </div>
              </div>

              <div className="bg-[var(--color-bg-primary)] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="w-5 h-5 text-[var(--color-accent)]" />
                  <span className="text-sm text-[var(--color-text-muted)]">Retention</span>
                </div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {currentSystemStats.retentionScore}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  Predicted stability score
                </div>
              </div>

              <div className="bg-[var(--color-bg-primary)] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-[var(--color-accent)]" />
                  <span className="text-sm text-[var(--color-text-muted)]">Decision Speed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                    {Math.round(currentSystemStats.avgDecisionTimeMs / 1000)}s
                  </div>
                  {currentSystemStats.decisionTimeTrend < 0 ? (
                    <TrendingDown className="w-5 h-5 text-[var(--color-success)]" />
                  ) : (
                    <TrendingUp className="w-5 h-5 text-[var(--color-warning)]" />
                  )}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {Math.abs(currentSystemStats.decisionTimeTrend).toFixed(1)}s/q trend
                </div>
              </div>

              <div className="bg-[var(--color-bg-primary)] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-5 h-5 text-[var(--color-accent)]" />
                  <span className="text-sm text-[var(--color-text-muted)]">Topics</span>
                </div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {currentSystemStats.subcategories.length}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">Subcategories covered</div>
              </div>
            </div>

            {/* Quick Start Button */}
            {onStartSession && (
              <button
                onClick={() => onStartSession(currentSystemStats.system)}
                className="w-full p-4 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg font-semibold flex items-center justify-center gap-2 hover:shadow-xl transition-all"
              >
                <Play className="w-5 h-5" />
                Quick Start PANCE Session -{' '}
                {ABBREVIATION_TO_TOPIC_MAP[currentSystemStats.system] ?? currentSystemStats.system}
              </button>
            )}

            {/* Subcategories List */}
            <div className="space-y-3">
              <h3 className="font-semibold text-[var(--color-text-primary)]">
                Subcategories ({currentSystemStats.subcategories.length})
              </h3>
              {currentSystemStats.subcategories.map((subcat) => (
                <button
                  key={subcat.name}
                  onClick={() => handleSubcategoryClick(subcat.name)}
                  className="w-full text-left p-4 bg-[var(--color-bg-primary)] rounded-lg hover:shadow-md transition-all border border-[var(--color-border)] hover:border-[var(--color-accent)]"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <div className="font-semibold text-[var(--color-text-primary)] mb-1">
                        {subcat.name}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
                        <span>{subcat.totalQuestions} questions</span>
                        <span>{subcat.conditions.length} conditions</span>
                        {subcat.lastPracticed && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {Math.round(
                              (Date.now() - subcat.lastPracticed.getTime()) / (1000 * 60 * 60 * 24)
                            )}
                            d ago
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xl font-bold text-[var(--color-accent)]">
                          {subcat.accuracy}%
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">accuracy</div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)]" />
                    </div>
                  </div>
                  <div className="w-full h-2 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        subcat.accuracy >= 80
                          ? 'bg-[var(--color-success)]'
                          : subcat.accuracy >= 60
                            ? 'bg-[var(--color-accent)]'
                            : 'bg-[var(--color-warning)]'
                      }`}
                      style={{ width: `${subcat.accuracy}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* LEVEL 3: SUBCATEGORY DEEP DIVE - Conditions */}
        {viewLevel === 'subcategory' && currentSubcategoryStats && (
          <motion.div
            key="subcategory"
            initial={{ x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Subcategory Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[var(--color-bg-primary)] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-5 h-5 text-[var(--color-accent)]" />
                  <span className="text-sm text-[var(--color-text-muted)]">Accuracy</span>
                </div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {currentSubcategoryStats.accuracy}%
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {currentSubcategoryStats.correctAnswers}/{currentSubcategoryStats.totalQuestions}{' '}
                  correct
                </div>
              </div>

              <div className="bg-[var(--color-bg-primary)] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-5 h-5 text-[var(--color-accent)]" />
                  <span className="text-sm text-[var(--color-text-muted)]">Conditions</span>
                </div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {currentSubcategoryStats.conditions.length}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">Conditions tracked</div>
              </div>

              <div className="bg-[var(--color-bg-primary)] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-5 h-5 text-[var(--color-accent)]" />
                  <span className="text-sm text-[var(--color-text-muted)]">Last Practiced</span>
                </div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {currentSubcategoryStats.lastPracticed
                    ? `${Math.round((Date.now() - currentSubcategoryStats.lastPracticed.getTime()) / (1000 * 60 * 60 * 24))}d`
                    : 'N/A'}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">Days ago</div>
              </div>
            </div>

            {/* Quick Start Button */}
            {onStartSession && selectedSystem && (
              <button
                onClick={() => onStartSession(selectedSystem, selectedSubcategory!)}
                className="w-full p-4 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg font-semibold flex items-center justify-center gap-2 hover:shadow-xl transition-all"
              >
                <Play className="w-5 h-5" />
                Practice {selectedSubcategory} Now
              </button>
            )}

            {/* Conditions Master-Detail View */}
            <div className="space-y-4">
              <AnimatePresence mode="wait">
                {/* VIEW A: Interactive List (Master) */}
                {!selectedCondition && (
                  <motion.div
                    key="list"
                    initial={{}}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      Conditions ({currentSubcategoryStats.conditions.length})
                    </h3>

                    {currentSubcategoryStats.conditions.length === 0 ? (
                      /* Empty State */
                      <div className="flex flex-col items-center justify-center py-16 px-4">
                        <FileText className="w-12 h-12 text-[var(--color-text-muted)] mb-3" />
                        <p className="text-sm font-medium text-[var(--color-text-muted)]">
                          No conditions found
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          Questions will appear here as you practice
                        </p>
                      </div>
                    ) : (
                      /* Grid of Condition Preview Cards */
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {currentSubcategoryStats.conditions.map((condition, index) => {
                          // Build ConditionMeta from performance data
                          // We have the condition name and can infer system/subcategory from context
                          const conditionMeta: ConditionMeta = {
                            system: selectedSystem!,
                            subcategory: selectedSubcategory!,
                            condition: condition.name,
                            aliases: [],
                          };

                          // Use the polished ConditionPreviewCard
                          return (
                            <ConditionPreviewCard
                              key={condition.name}
                              condition={conditionMeta}
                              content={undefined} // Content will be fetched inside the card if needed
                              onClick={() => setSelectedCondition(condition)}
                              index={index}
                            />
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* VIEW B: Detail Page */}
                {selectedCondition && (
                  <motion.div
                    key="detail"
                    initial={{ x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="space-y-6"
                  >
                    {/* Sticky Header Bar */}
                    <div className="sticky top-0 z-10 bg-[var(--color-bg-primary)]/80 backdrop-blur-md border-b border-[var(--color-border)] -mx-6 -mt-6 px-6 py-4">
                      <button
                        onClick={() => setSelectedCondition(null)}
                        className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Conditions
                      </button>
                    </div>

                    {/* Hero Section */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
                            {selectedCondition.name}
                          </h2>
                          <div className="flex items-center gap-2">
                            <span className="inline-block bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-md">
                              {selectedSubcategory}
                            </span>
                            {selectedCondition.trend === 'improving' && (
                              <span className="inline-flex items-center gap-1 bg-[var(--color-success)]/10 text-[var(--color-success)] text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-md">
                                <TrendingUp className="w-3 h-3" />
                                Improving
                              </span>
                            )}
                            {selectedCondition.trend === 'declining' && (
                              <span className="inline-flex items-center gap-1 bg-[var(--color-error)]/10 text-[var(--color-error)] text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-md">
                                <TrendingDown className="w-3 h-3" />
                                Declining
                              </span>
                            )}
                            {selectedCondition.trend === 'stable' && (
                              <span className="inline-flex items-center gap-1 bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-md">
                                <Circle className="w-3 h-3" />
                                Stable
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="w-4 h-4 text-[var(--color-accent)]" />
                          <span className="text-xs font-medium text-[var(--color-text-muted)]">
                            Accuracy
                          </span>
                        </div>
                        <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                          {selectedCondition.accuracy}%
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-1">
                          {selectedCondition.correctAnswers}/{selectedCondition.totalQuestions}{' '}
                          correct
                        </div>
                      </div>

                      <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
                        <div className="flex items-center gap-2 mb-2">
                          <BarChart3 className="w-4 h-4 text-[var(--color-text-muted)]" />
                          <span className="text-xs font-medium text-[var(--color-text-muted)]">
                            Attempts
                          </span>
                        </div>
                        <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                          {selectedCondition.totalQuestions}
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-1">
                          Total questions
                        </div>
                      </div>

                      <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
                        <div className="flex items-center gap-2 mb-2">
                          <Brain className="w-4 h-4 text-[var(--color-accent)]" />
                          <span className="text-xs font-medium text-[var(--color-text-muted)]">
                            Retention
                          </span>
                        </div>
                        <div className="text-2xl font-bold text-[var(--color-accent)]">
                          {selectedCondition.retentionScore}%
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-1">
                          Memory strength
                        </div>
                      </div>

                      <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-4 h-4 text-[var(--color-text-muted)]" />
                          <span className="text-xs font-medium text-[var(--color-text-muted)]">
                            Avg Time
                          </span>
                        </div>
                        <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                          {(selectedCondition.avgDecisionTimeMs / 1000).toFixed(1)}s
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-1">
                          Per question
                        </div>
                      </div>
                    </div>

                    {/* Performance Section */}
                    <div className="bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] p-6 space-y-6">
                      <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                        Performance Metrics
                      </h3>

                      {/* Accuracy Progress */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-[var(--color-text-primary)]">
                            Accuracy Rate
                          </span>
                          <span className="font-semibold text-[var(--color-text-primary)]">
                            {selectedCondition.accuracy}%
                          </span>
                        </div>
                        <div className="relative w-full h-3 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${selectedCondition.accuracy}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            className={`absolute inset-y-0 left-0 rounded-full ${
                              selectedCondition.accuracy >= 80
                                ? 'bg-[var(--color-success)]'
                                : selectedCondition.accuracy >= 60
                                  ? 'bg-[var(--color-accent)]'
                                  : 'bg-[var(--color-warning)]'
                            }`}
                          />
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {selectedCondition.correctAnswers} out of{' '}
                          {selectedCondition.totalQuestions} questions answered correctly
                        </p>
                      </div>

                      {/* Retention Progress */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-[var(--color-text-primary)]">
                            Retention Strength
                          </span>
                          <span className="font-semibold text-[var(--color-accent)]">
                            {selectedCondition.retentionScore}%
                          </span>
                        </div>
                        <div className="relative w-full h-3 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${selectedCondition.retentionScore}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                            className="absolute inset-y-0 left-0 bg-[var(--color-accent)] rounded-full"
                          />
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          Predicted memory stability based on spaced repetition algorithm
                        </p>
                      </div>
                    </div>

                    {/* Next Review Card */}
                    {selectedCondition.nextDue && (
                      <div className="bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 rounded-xl p-5">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-[var(--color-accent)]/15 rounded-lg">
                            <Calendar className="w-5 h-5 text-[var(--color-accent)]" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-[var(--color-text-primary)] mb-1">
                              Next Review Scheduled
                            </h4>
                            <p className="text-sm text-[var(--color-text-primary)]">
                              Due in{' '}
                              {Math.round(
                                (selectedCondition.nextDue.getTime() - Date.now()) /
                                  (1000 * 60 * 60 * 24)
                              )}{' '}
                              days
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)] mt-1">
                              {selectedCondition.nextDue.toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Study Recommendation */}
                    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5">
                      <h4 className="font-semibold text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-[var(--color-warning)]" />
                        Study Recommendation
                      </h4>
                      <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                        {selectedCondition.accuracy < 60
                          ? 'This condition needs more practice. Consider reviewing the material and attempting more questions.'
                          : selectedCondition.accuracy < 80
                            ? "You're making good progress! A few more practice sessions will solidify this knowledge."
                            : selectedCondition.retentionScore < 70
                              ? 'Strong accuracy! Focus on retention by spacing out your review sessions.'
                              : 'Excellent mastery! Maintain your knowledge with periodic reviews.'}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default IntelligenceHub;
