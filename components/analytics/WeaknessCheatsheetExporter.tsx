/**
 * Weakness Cheatsheet Exporter Component
 *
 * UI component for generating and exporting weakness study guides.
 *
 * Note: This component generates a simplified cheatsheet based on performance
 * data only. Full question details (including options and explanations) are
 * not available in this context. The generated PDF includes condition names,
 * topics, and error counts for focused review planning.
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, AlertCircle, Check } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import type { PerformanceRecord } from '@/types';
import { getWeaknessSummary } from '@/lib/weaknessCheatsheetExport';

interface WeaknessCheatsheetExporterProps {
  performanceData: PerformanceRecord[];
  theme?: 'light' | 'dark';
  onExport?: () => void; // Callback when export is triggered
}

export default function WeaknessCheatsheetExporter({
  performanceData,
  theme = 'light',
  onExport,
}: WeaknessCheatsheetExporterProps): React.ReactElement {
  const { showToast } = useToast();
  const [days, setDays] = useState(30);
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const summary = useMemo(
    () => getWeaknessSummary(performanceData, { days, minErrors: 1 }),
    [performanceData, days]
  );

  const handleExport = () => {
    try {
      // Since we don't have direct access to all questions in this component,
      // we'll generate a simplified HTML export based on performance data alone
      const success = generateSimplifiedCheatsheet(performanceData, days);
      if (!success) {
        showToast({
          type: 'warning',
          message: 'Please allow pop-ups to generate the study guide.',
        });
        return;
      }
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 3000);
      onExport?.();
    } catch (error) {
      console.error('Error generating cheatsheet:', error);
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 3000);
    }
  };

  return (
    <div className="rounded-xl p-4 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-5 h-5 text-[var(--color-accent)]" />
        <h3 className="font-medium text-slate-800 dark:text-slate-200">Yield Optimization</h3>
      </div>

      <p className="text-xs mb-4 text-slate-600 dark:text-slate-400">
        Generate a study guide focused on high-yield areas to reinforce. Perfect for
        focused review and exam prep.
      </p>

      {/* Time Period Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2 text-slate-800 dark:text-slate-200">
          Time Period
        </label>
        <div className="flex gap-2">
          {[7, 14, 30, 60, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                days === d
                  ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                  : 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      {summary.totalWeaknesses > 0 ? (
        <div className="p-3 rounded-lg mb-4 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-[var(--color-accent)]" />
            <div>
              <p className="text-sm font-medium mb-1 text-[var(--color-text-primary)]">
                {summary.totalWeaknesses} focus area{summary.totalWeaknesses > 1 ? 's' : ''} to
                optimize
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {summary.totalQuestions} questions from last {days} days
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {summary.systems.slice(0, 3).map((sys) => (
                  <span
                    key={sys.system}
                    className="text-xs px-2 py-1 rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                  >
                    {sys.system} ({sys.errorCount})
                  </span>
                ))}
                {summary.systems.length > 3 && (
                  <span className="text-xs px-2 py-1 rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
                    +{summary.systems.length - 3} more
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-lg mb-4 text-center bg-slate-100 dark:bg-[var(--color-success)]/10 border border-slate-200 dark:border-[var(--color-success)]/30">
          <Check className="w-6 h-6 mx-auto mb-2 text-slate-600 dark:text-[var(--color-success)]" />
          <p className="text-sm text-slate-800 dark:text-[var(--color-text-primary)]">
            No yield gaps in the last {days} days—keep it up!
          </p>
        </div>
      )}

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={summary.totalWeaknesses === 0 || exportStatus !== 'idle'}
        className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-all ${
          exportStatus === 'success'
            ? 'bg-[var(--color-success)] text-[var(--color-text-inverse)]'
            : exportStatus === 'error'
              ? 'bg-[var(--color-error)] text-[var(--color-text-inverse)]'
              : summary.totalWeaknesses === 0
                ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-not-allowed'
                : 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:opacity-90'
        }`}
      >
        {exportStatus === 'success' ? (
          <>
            <Check className="w-4 h-4" />
            Study Guide Generated!
          </>
        ) : exportStatus === 'error' ? (
          <>
            <AlertCircle className="w-4 h-4" />
            Error Generating Guide
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Generate & Print Study Guide
          </>
        )}
      </button>

      <p className="text-xs mt-2 text-center text-[var(--color-text-muted)]">
        Opens in new window for printing to PDF
      </p>
    </div>
  );
}

/**
 * Generate simplified cheatsheet from performance data
 * (without full question details)
 * @returns boolean - true if window opened successfully
 */
function generateSimplifiedCheatsheet(performanceData: PerformanceRecord[], days: number): boolean {
  const cutoffDate = Date.now() - days * 24 * 60 * 60 * 1000;
  const recentData = performanceData.filter(
    (record) => record.timestamp >= cutoffDate && !record.isCorrect
  );

  // Group by system
  const systemMap = new Map<
    string,
    Array<{ condition: string; topic: string; timestamp: number }>
  >();

  recentData.forEach((record) => {
    const systemName = record.system || 'Other';
    if (!systemMap.has(systemName)) {
      systemMap.set(systemName, []);
    }
    systemMap.get(systemName)!.push({
      condition: record.condition || 'Unknown',
      topic: record.topic || 'General',
      timestamp: record.timestamp,
    });
  });

  // Generate HTML
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const rootStyles = getComputedStyle(document.documentElement);
  const resolveToken = (value: string, fallback: string) => value || fallback;
  const exportAccent = resolveToken(
    rootStyles.getPropertyValue('--color-accent').trim(),
    'currentColor'
  );
  const exportText = resolveToken(
    rootStyles.getPropertyValue('--color-text-primary').trim(),
    'currentColor'
  );
  const exportMuted = resolveToken(
    rootStyles.getPropertyValue('--color-text-muted').trim(),
    'currentColor'
  );
  const exportInverse = resolveToken(
    rootStyles.getPropertyValue('--color-text-inverse').trim(),
    'currentColor'
  );
  const exportBg = resolveToken(
    rootStyles.getPropertyValue('--color-bg-primary').trim(),
    'transparent'
  );
  const exportSurface = resolveToken(
    rootStyles.getPropertyValue('--color-bg-secondary').trim(),
    'transparent'
  );
  const exportBorder = resolveToken(
    rootStyles.getPropertyValue('--color-border').trim(),
    'currentColor'
  );

  let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PANaCEa Yield Optimization - Last ${days} Days</title>
  <style>
    :root {
      --export-accent: ${exportAccent};
      --export-text: ${exportText};
      --export-muted: ${exportMuted};
      --export-inverse: ${exportInverse};
      --export-bg: ${exportBg};
      --export-surface: ${exportSurface};
      --export-border: ${exportBorder};
    }
    @media print {
      @page { margin: 0.5in; }
      .no-print { display: none; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.6;
      max-width: 8.5in;
      margin: 0 auto;
      padding: 20px;
      background: var(--export-bg);
      color: var(--export-text);
    }
    .header {
      text-align: center;
      border-bottom: 3px solid var(--export-accent);
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: var(--export-accent);
      margin: 0 0 10px 0;
    }
    .system-section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    .system-header {
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--export-accent) 90%, transparent) 0%,
        color-mix(in srgb, var(--export-accent) 60%, transparent) 100%
      );
      color: var(--export-inverse);
      padding: 12px 20px;
      border-radius: 8px;
      margin-bottom: 15px;
    }
    .condition-list {
      list-style: none;
      padding: 0;
    }
    .condition-item {
      background: color-mix(in srgb, var(--export-surface) 90%, transparent);
      border-left: 4px solid var(--export-accent);
      padding: 10px 15px;
      margin-bottom: 10px;
      border-radius: 4px;
    }
    .condition-item .condition-name {
      font-weight: 600;
      color: var(--export-text);
    }
    .condition-item .topic {
      font-size: 0.875rem;
      color: var(--export-muted);
    }
    .print-button {
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--export-accent);
      color: var(--export-inverse);
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 6px color-mix(in srgb, var(--export-text) 12%, transparent);
    }
  </style>
</head>
<body>
  <button class="print-button no-print" onclick="window.print()">Print to PDF</button>
  <div class="header">
    <h1>Yield Optimization</h1>
    <p>Areas to Review from Last ${days} Days | Generated ${currentDate}</p>
  </div>
`;

  systemMap.forEach((conditions, system) => {
    html += `
  <div class="system-section">
    <div class="system-header">
      <h2 style="margin: 0;">${system}</h2>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">${conditions.length} area${conditions.length > 1 ? 's' : ''} for review</p>
    </div>
    <ul class="condition-list">
`;

    // Group conditions and count occurrences
    const conditionCounts = new Map<string, { count: number; topic: string }>();
    conditions.forEach((c) => {
      const key = c.condition;
      const existing = conditionCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        conditionCounts.set(key, { count: 1, topic: c.topic });
      }
    });

    conditionCounts.forEach((data, condition) => {
      html += `
      <li class="condition-item">
        <div class="condition-name">${condition}</div>
        <div class="topic">${data.topic} • Incorrect ${data.count} time${data.count > 1 ? 's' : ''}</div>
      </li>
`;
    });

    html += `
    </ul>
  </div>
`;
  });

  html += `
  <div style="text-align: center; color: var(--export-muted); font-size: 0.875rem; margin-top: 40px; padding-top: 20px; border-top: 1px solid var(--export-border);">
    <p>Generated by PANaCEa AI Study Platform</p>
    <p style="margin-top: 10px;"><strong>Tip:</strong> Review these conditions in your study materials and use PANaCEa's targeted drill modes for focused practice.</p>
  </div>
</body>
</html>
`;

  // Open in new window
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => printWindow.focus(), 250);
    };
    return true;
  } else {
    return false;
  }
}
