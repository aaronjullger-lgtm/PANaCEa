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
}: WeaknessCheatsheetExporterProps): JSX.Element {
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
      generateSimplifiedCheatsheet(performanceData, days);
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
    <div
      className={`rounded-xl p-4 ${
        theme === 'light' ? 'bg-[var(--color-bg-secondary)]' : 'bg-gray-800'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <FileText
          className={`w-5 h-5 ${
            theme === 'light' ? 'text-[var(--color-accent)]' : 'text-blue-400'
          }`}
        />
        <h3
          className={`font-medium ${
            theme === 'light' ? 'text-[var(--color-text-primary)]' : 'text-white'
          }`}
        >
          Weakness Study Guide
        </h3>
      </div>

      <p
        className={`text-xs mb-4 ${
          theme === 'light' ? 'text-[var(--color-text-muted)]' : 'text-gray-400'
        }`}
      >
        Generate a professional PDF study guide based on questions you've missed.
        Perfect for focused review and cramming sessions.
      </p>

      {/* Time Period Selector */}
      <div className="mb-4">
        <label
          className={`block text-sm font-medium mb-2 ${
            theme === 'light' ? 'text-[var(--color-text-primary)]' : 'text-gray-300'
          }`}
        >
          Time Period
        </label>
        <div className="flex gap-2">
          {[7, 14, 30, 60, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                days === d
                  ? theme === 'light'
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-blue-600 text-white'
                  : theme === 'light'
                  ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)]'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      {summary.totalWeaknesses > 0 ? (
        <div
          className={`p-3 rounded-lg mb-4 ${
            theme === 'light'
              ? 'bg-blue-50 border border-blue-200'
              : 'bg-blue-900/20 border border-blue-800'
          }`}
        >
          <div className="flex items-start gap-2">
            <AlertCircle
              className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                theme === 'light' ? 'text-blue-600' : 'text-blue-400'
              }`}
            />
            <div>
              <p
                className={`text-sm font-medium mb-1 ${
                  theme === 'light' ? 'text-blue-900' : 'text-blue-100'
                }`}
              >
                Found {summary.totalWeaknesses} area{summary.totalWeaknesses > 1 ? 's' : ''} to review
              </p>
              <p
                className={`text-xs ${
                  theme === 'light' ? 'text-blue-700' : 'text-blue-300'
                }`}
              >
                {summary.totalQuestions} questions from last {days} days
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {summary.systems.slice(0, 3).map((sys) => (
                  <span
                    key={sys.system}
                    className={`text-xs px-2 py-1 rounded ${
                      theme === 'light'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-blue-800 text-blue-200'
                    }`}
                  >
                    {sys.system} ({sys.errorCount})
                  </span>
                ))}
                {summary.systems.length > 3 && (
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      theme === 'light'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-blue-800 text-blue-200'
                    }`}
                  >
                    +{summary.systems.length - 3} more
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`p-3 rounded-lg mb-4 text-center ${
            theme === 'light'
              ? 'bg-green-50 border border-green-200'
              : 'bg-green-900/20 border border-green-800'
          }`}
        >
          <Check
            className={`w-6 h-6 mx-auto mb-2 ${
              theme === 'light' ? 'text-green-600' : 'text-green-400'
            }`}
          />
          <p
            className={`text-sm ${
              theme === 'light' ? 'text-green-900' : 'text-green-100'
            }`}
          >
            No significant weaknesses in the last {days} days!
          </p>
        </div>
      )}

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={summary.totalWeaknesses === 0 || exportStatus !== 'idle'}
        className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-all ${
          summary.totalWeaknesses === 0 || exportStatus !== 'idle'
            ? theme === 'light'
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : exportStatus === 'success'
            ? 'bg-green-500 text-white'
            : exportStatus === 'error'
            ? 'bg-red-500 text-white'
            : theme === 'light'
            ? 'bg-[var(--color-accent)] text-white hover:opacity-90'
            : 'bg-blue-600 text-white hover:bg-blue-700'
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

      <p
        className={`text-xs mt-2 text-center ${
          theme === 'light' ? 'text-[var(--color-text-muted)]' : 'text-gray-500'
        }`}
      >
        Opens in new window for printing to PDF
      </p>
    </div>
  );
}

/**
 * Generate simplified cheatsheet from performance data
 * (without full question details)
 */
function generateSimplifiedCheatsheet(
  performanceData: PerformanceRecord[],
  days: number
): void {
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

  let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PANaCEa Weakness Summary - Last ${days} Days</title>
  <style>
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
      background: #fff;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #3b82f6;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #3b82f6;
      margin: 0 0 10px 0;
    }
    .system-section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    .system-header {
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      margin-bottom: 15px;
    }
    .condition-list {
      list-style: none;
      padding: 0;
    }
    .condition-item {
      background: #f9fafb;
      border-left: 4px solid #3b82f6;
      padding: 10px 15px;
      margin-bottom: 10px;
      border-radius: 4px;
    }
    .condition-item .condition-name {
      font-weight: 600;
      color: #1a1a1a;
    }
    .condition-item .topic {
      font-size: 0.875rem;
      color: #6b7280;
    }
    .print-button {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #3b82f6;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
  </style>
</head>
<body>
  <button class="print-button no-print" onclick="window.print()">🖨️ Print to PDF</button>
  <div class="header">
    <h1>🎯 Weakness Summary</h1>
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
        <div class="topic">${data.topic} • Missed ${data.count} time${data.count > 1 ? 's' : ''}</div>
      </li>
`;
    });

    html += `
    </ul>
  </div>
`;
  });

  html += `
  <div style="text-align: center; color: #9ca3af; font-size: 0.875rem; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
    <p>Generated by PANaCEa AI Study Platform</p>
    <p style="margin-top: 10px;">💡 Tip: Review these conditions in your study materials and use PANaCEa's targeted drill modes for focused practice.</p>
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
  } else {
    alert('Please allow pop-ups to generate the study guide.');
  }
}
