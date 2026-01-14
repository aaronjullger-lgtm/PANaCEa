/**
 * Analytics Components Index
 * Central export for analytics and performance visualization components
 */

// Heatmaps & Calendars
export { CompetencyHeatmap, default as CompetencyHeatmapDefault } from './CompetencyHeatmap';
export { default as ActivityHeatmap } from './ActivityHeatmap';
export { default as StudyCalendar } from './StudyCalendar';
export type { CalendarViewMode } from './StudyCalendar';

// Dashboards & Analysis
export { default as IntelligenceHub } from './IntelligenceHub';
export { default as LongitudinalProgressDashboard } from './LongitudinalProgressDashboard';
export { default as DecisionTimeAnalysis } from './DecisionTimeAnalysis';
export { default as AnalyticsDashboard } from './AnalyticsDashboard';
export { default as DatabaseAnalyticsDashboard } from './DatabaseAnalyticsDashboard';
export { default as LearningProfileDashboard } from './LearningProfileDashboard';
export { default as AdvancedLearningProfileDashboard } from './AdvancedLearningProfileDashboard';
export { UserFriendlyStatsDisplay } from './UserFriendlyStatsDisplay';
export { default as SrsDashboard } from './SrsDashboard';

// Performance & Insights
export { default as ConditionPerformancePanel } from './ConditionPerformancePanel';
export { default as PerformanceTrendChart } from './PerformanceTrendChart';
export { default as FSRSInsightCard } from './FSRSInsightCard';
export { default as LearningProgressCard } from './LearningProgressCard';
export { default as PredictedScoreCard } from './PredictedScoreCard';
export { default as SystemMasteryMap } from './SystemMasteryMap';
export { ConfusionMatrix, default as ConfusionMatrixDefault } from './ConfusionMatrix';

// Export Tools
export { default as WeaknessCheatsheetExporter } from './WeaknessCheatsheetExporter';
export { default as SyllabusDecompiler } from './SyllabusDecompiler';

// Tiered Analytics (Sprint D: Analytics Simplification)
export { TieredAnalytics, default as TieredAnalyticsDefault } from './TieredAnalytics';

// FSRS Decay Visualization (Sprint E: Magic Features)
export { FSRSDecayVisualization, default as FSRSDecayVisualizationDefault } from './FSRSDecayVisualization';

// DayCellPopover - import directly from './DayCellPopover' if needed
