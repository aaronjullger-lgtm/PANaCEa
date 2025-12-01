/**
 * Progress Dashboard Components
 * 
 * Re-exports all progress visualization components.
 */

export { default as HeatmapCalendar, generateMockHeatmapData } from './HeatmapCalendar';
export type { ProgressDayRecord, HeatmapMetric } from './HeatmapCalendar';

export { default as SystemComparison, generateMockSystemData } from './SystemComparison';
export type { SystemMasterySummary } from './SystemComparison';

export { default as ExportControls, exportToCSV, exportToJSON } from './ExportControls';

export { default as WidgetGrid, DEFAULT_WIDGET_CONFIG } from './WidgetGrid';
export type { WidgetId, WidgetConfig, WidgetData, TimeScope } from './WidgetGrid';

export { default as TimeScopeFilter } from './TimeScopeFilter';

export { default as StatisticsPreferences } from './StatisticsPreferences';

export { default as RootCauseAnalysis } from './RootCauseAnalysis';
export type { ErrorTagCount } from './RootCauseAnalysis';

export { default as DailyPrescription } from './DailyPrescription';
