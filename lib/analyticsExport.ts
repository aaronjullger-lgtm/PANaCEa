/**
 * Analytics Export Utility
 * 
 * Utility functions for exporting user performance analytics data.
 * Supports CSV and JSON formats.
 */

import type { PerformanceRecord, SystemCode } from '../types';
import { ABBREVIATION_TO_TOPIC_MAP } from '../constants';

// ============================================================================
// Types
// ============================================================================

export type ExportFormat = 'csv' | 'json';

export interface AnalyticsSummary {
  exportDate: string;
  totalQuestions: number;
  totalCorrect: number;
  overallAccuracy: number;
  systemBreakdown: Array<{
    system: string;
    systemName: string;
    correct: number;
    total: number;
    accuracy: number;
  }>;
  dailyProgress: Array<{
    date: string;
    questions: number;
    correct: number;
    accuracy: number;
  }>;
  performanceRecords: PerformanceRecord[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Download content as a file
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate a timestamped filename
 */
function generateFilename(prefix: string, extension: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${prefix}_${timestamp}.${extension}`;
}

/**
 * Convert an array of objects to CSV format
 */
function arrayToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  
  // Get all unique keys
  const keys = Array.from(
    new Set(data.flatMap(obj => Object.keys(obj)))
  );
  
  // Header row
  const header = keys.join(',');
  
  // Data rows
  const rows = data.map(obj =>
    keys.map(key => {
      const value = obj[key];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string') {
        // Escape quotes and wrap in quotes if contains comma or quote
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }
      if (typeof value === 'object') {
        return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      }
      return String(value);
    }).join(',')
  );
  
  return [header, ...rows].join('\n');
}

/**
 * Prepare analytics summary from performance data
 */
function prepareAnalyticsSummary(performanceData: PerformanceRecord[]): AnalyticsSummary {
  const totalQuestions = performanceData.length;
  const totalCorrect = performanceData.filter(r => r.isCorrect).length;
  const overallAccuracy = totalQuestions > 0 
    ? Math.round((totalCorrect / totalQuestions) * 100) 
    : 0;

  // System breakdown
  const systemMap = new Map<string, { correct: number; total: number }>();
  for (const record of performanceData) {
    if (record.system && record.system !== 'OTHER') {
      const existing = systemMap.get(record.system) || { correct: 0, total: 0 };
      systemMap.set(record.system, {
        correct: existing.correct + (record.isCorrect ? 1 : 0),
        total: existing.total + 1,
      });
    }
  }

  const systemBreakdown = Array.from(systemMap.entries())
    .map(([system, data]) => ({
      system,
      systemName: ABBREVIATION_TO_TOPIC_MAP[system as SystemCode] || system,
      correct: data.correct,
      total: data.total,
      accuracy: Math.round((data.correct / data.total) * 100),
    }))
    .sort((a, b) => b.total - a.total);

  // Daily progress
  const dailyMap = new Map<string, { correct: number; total: number }>();
  for (const record of performanceData) {
    const date = new Date(record.timestamp).toISOString().split('T')[0];
    const existing = dailyMap.get(date) || { correct: 0, total: 0 };
    dailyMap.set(date, {
      correct: existing.correct + (record.isCorrect ? 1 : 0),
      total: existing.total + 1,
    });
  }

  const dailyProgress = Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      questions: data.total,
      correct: data.correct,
      accuracy: Math.round((data.correct / data.total) * 100),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    exportDate: new Date().toISOString(),
    totalQuestions,
    totalCorrect,
    overallAccuracy,
    systemBreakdown,
    dailyProgress,
    performanceRecords: performanceData,
  };
}

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Export user analytics data in the specified format
 * 
 * @param performanceData - Array of performance records
 * @param format - Export format ('csv' or 'json')
 * @returns void - Downloads the file to user's device
 */
export function exportUserAnalytics(
  performanceData: PerformanceRecord[],
  format: ExportFormat
): void {
  if (performanceData.length === 0) {
    console.warn('No performance data to export');
    return;
  }

  const summary = prepareAnalyticsSummary(performanceData);

  if (format === 'json') {
    const jsonContent = JSON.stringify(summary, null, 2);
    const filename = generateFilename('panacea_analytics', 'json');
    downloadFile(jsonContent, filename, 'application/json');
  } else {
    // CSV format - flatten performance records for tabular view
    const flatRecords = performanceData.map(record => ({
      timestamp: new Date(record.timestamp).toISOString(),
      date: new Date(record.timestamp).toISOString().split('T')[0],
      system: record.system || '',
      systemName: record.system ? (ABBREVIATION_TO_TOPIC_MAP[record.system as SystemCode] || record.system) : '',
      subcategory: record.subcategory || '',
      condition: record.condition || '',
      conditionId: record.conditionId || '',
      topic: record.topic || '',
      isCorrect: record.isCorrect ? 'TRUE' : 'FALSE',
      focus: record.focus || '',
      difficulty: record.difficulty || '',
    }));

    const csvContent = arrayToCSV(flatRecords);
    const filename = generateFilename('panacea_analytics', 'csv');
    downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
  }
}

/**
 * Export system breakdown summary
 */
export function exportSystemSummary(
  performanceData: PerformanceRecord[],
  format: ExportFormat
): void {
  const summary = prepareAnalyticsSummary(performanceData);
  
  if (format === 'json') {
    const jsonContent = JSON.stringify({
      exportDate: summary.exportDate,
      overallAccuracy: summary.overallAccuracy,
      systemBreakdown: summary.systemBreakdown,
    }, null, 2);
    const filename = generateFilename('panacea_system_summary', 'json');
    downloadFile(jsonContent, filename, 'application/json');
  } else {
    const csvContent = arrayToCSV(summary.systemBreakdown);
    const filename = generateFilename('panacea_system_summary', 'csv');
    downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
  }
}

/**
 * Export daily progress summary
 */
export function exportDailyProgress(
  performanceData: PerformanceRecord[],
  format: ExportFormat
): void {
  const summary = prepareAnalyticsSummary(performanceData);
  
  if (format === 'json') {
    const jsonContent = JSON.stringify({
      exportDate: summary.exportDate,
      dailyProgress: summary.dailyProgress,
    }, null, 2);
    const filename = generateFilename('panacea_daily_progress', 'json');
    downloadFile(jsonContent, filename, 'application/json');
  } else {
    const csvContent = arrayToCSV(summary.dailyProgress);
    const filename = generateFilename('panacea_daily_progress', 'csv');
    downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
  }
}

export default exportUserAnalytics;
