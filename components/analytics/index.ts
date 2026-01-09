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
// DayCellPopover - not exported due to missing named export
export { default as AnalyticsDashboard } from './AnalyticsDashboard';
export { default as DatabaseAnalyticsDashboard } from './DatabaseAnalyticsDashboard';
export { default as LearningProfileDashboard } from './AdvancedLearningProfileDashboard';
export { AdvancedLearningProfileDashboard } from './AdvancedLearningProfileDashboard';
export { UserFriendlyStatsDisplay } from './UserFriendlyStatsDisplay';

// Performance Panels
export { default as ConditionPerformancePanel } from './ConditionPerformancePanel';
export { default as PerformanceTrendChart } from './PerformanceTrendChart';

// Export Tools
export { default as WeaknessCheatsheetExporter } from './WeaknessCheatsheetExporter';
export { default as SyllabusDecompiler } from './SyllabusDecompiler';
