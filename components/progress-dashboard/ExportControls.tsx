/**
 * Export Controls Component
 *
 * Provides CSV and JSON export functionality for performance data.
 */

import React, { useState } from 'react';
import { Download, FileJson, FileSpreadsheet, Check } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ExportControlsProps {
  /** Data to export */
  data: Record<string, unknown>[];
  /** Prefix for generated filenames */
  filePrefix?: string;
  /** User ID to include in filename */
  userId?: string;
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Convert data array to CSV format
 */
export function exportToCSV(data: Record<string, unknown>[], filename: string): void {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Get all unique keys from the data
  const keys = Array.from(new Set(data.flatMap((obj) => Object.keys(obj))));

  // Build CSV content
  const header = keys.join(',');
  const rows = data.map((obj) =>
    keys
      .map((key) => {
        const value = obj[key];
        // Handle strings with commas or quotes
        if (typeof value === 'string') {
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }
        if (value === null || value === undefined) {
          return '';
        }
        if (typeof value === 'object') {
          return JSON.stringify(value).replace(/"/g, '""');
        }
        return String(value);
      })
      .join(',')
  );

  const csvContent = [header, ...rows].join('\n');

  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

/**
 * Convert data to JSON and download
 */
export function exportToJSON(data: Record<string, unknown>[], filename: string): void {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  downloadBlob(blob, filename);
}

/**
 * Download a blob as a file
 */
function downloadBlob(blob: Blob, filename: string): void {
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
 * Generate filename with timestamp
 */
function generateFilename(prefix: string, extension: string, userId?: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const userPart = userId ? `_${userId}` : '';
  return `${prefix}${userPart}_${timestamp}.${extension}`;
}

// ============================================================================
// Component
// ============================================================================

const ExportControls: React.FC<ExportControlsProps> = ({
  data,
  filePrefix = 'panacea_progress',
  userId,
}) => {
  const [lastExported, setLastExported] = useState<'csv' | 'json' | null>(null);

  const handleExportCSV = () => {
    const filename = generateFilename(filePrefix, 'csv', userId);
    exportToCSV(data, filename);
    setLastExported('csv');
    setTimeout(() => setLastExported(null), 2000);
  };

  const handleExportJSON = () => {
    const filename = generateFilename(filePrefix, 'json', userId);
    exportToJSON(data, filename);
    setLastExported('json');
    setTimeout(() => setLastExported(null), 2000);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExportCSV}
        disabled={data.length === 0}
        className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
          data.length === 0
            ? 'bg-data-neutral text-data-neutral cursor-not-allowed'
            : lastExported === 'csv'
              ? 'bg-data-pass text-data-pass'
              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]'
        }`}
      >
        {lastExported === 'csv' ? (
          <Check className="w-4 h-4" />
        ) : (
          <FileSpreadsheet className="w-4 h-4" />
        )}
        Export CSV
      </button>

      <button
        onClick={handleExportJSON}
        disabled={data.length === 0}
        className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
          data.length === 0
            ? 'bg-data-neutral text-data-neutral cursor-not-allowed'
            : lastExported === 'json'
              ? 'bg-data-pass text-data-pass'
              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]'
        }`}
      >
        {lastExported === 'json' ? <Check className="w-4 h-4" /> : <FileJson className="w-4 h-4" />}
        Export JSON
      </button>
    </div>
  );
};

export default ExportControls;
