/**
 * Weakness Cheatsheet Export
 *
 * Generates printable PDF study guides based on missed questions
 * in the last 30 days, including questions, pearls, and rationales.
 */

import type { Question, PerformanceRecord, SystemCode } from '@/types';
import { ABBREVIATION_TO_TOPIC_MAP } from "@/config/topic-map";

export interface CheatsheetOptions {
  days?: number; // Number of days to look back (default: 30)
  minErrors?: number; // Minimum errors in a category to include (default: 1)
  includeCorrectAnswers?: boolean; // Include correct answers in export (default: true)
  maxQuestionsPerSystem?: number; // Maximum questions per system (default: 10)
}

interface CategoryWeakness {
  system: SystemCode;
  systemName: string;
  errorCount: number;
  questions: Array<{
    question: string;
    options: string[];
    correctAnswerIndex: number;
    userWasCorrect: boolean;
    rationale: string;
    pearls: string[];
    condition: string;
  }>;
}

/**
 * Identify weaknesses based on performance data
 */
function identifyWeaknesses(
  performanceData: PerformanceRecord[],
  allQuestions: Question[],
  options: CheatsheetOptions = {}
): CategoryWeakness[] {
  const { days = 30, minErrors = 1 } = options;

  // Filter to last N days
  const cutoffDate = Date.now() - days * 24 * 60 * 60 * 1000;
  const recentData = performanceData.filter((record) => record.timestamp >= cutoffDate);

  // Group by system, track errors
  const systemErrorMap = new Map<
    SystemCode,
    Array<{
      conditionId: string;
      condition: string;
      isCorrect: boolean;
    }>
  >();

  recentData.forEach((record) => {
    if (!record.system || record.system === 'OTHER') return;

    if (!systemErrorMap.has(record.system)) {
      systemErrorMap.set(record.system, []);
    }

    systemErrorMap.get(record.system)!.push({
      conditionId: record.conditionId,
      condition: record.condition,
      isCorrect: record.isCorrect,
    });
  });

  // Build category weaknesses
  const weaknesses: CategoryWeakness[] = [];

  systemErrorMap.forEach((records, system) => {
    const errors = records.filter((r) => !r.isCorrect);

    if (errors.length < minErrors) return;

    // Find relevant questions from allQuestions
    const errorConditionIds = new Set(errors.map((e) => e.conditionId));
    const maxQuestions = options.maxQuestionsPerSystem || 10;
    const relevantQuestions = allQuestions
      .filter((q) => errorConditionIds.has(q.conditionId))
      .slice(0, maxQuestions); // Limit questions per system for readability

    if (relevantQuestions.length === 0) return;

    weaknesses.push({
      system,
      systemName: ABBREVIATION_TO_TOPIC_MAP[system] || system,
      errorCount: errors.length,
      questions: relevantQuestions.map((q) => ({
        question: q.question,
        options: q.options,
        correctAnswerIndex: q.correctAnswerIndex,
        userWasCorrect: false, // From missed questions
        rationale: q.rationale,
        pearls: q.pearls || [],
        condition: q.condition,
      })),
    });
  });

  // Sort by error count (descending)
  return weaknesses.sort((a, b) => b.errorCount - a.errorCount);
}

/**
 * Generate HTML for printable cheatsheet
 */
function generateCheatsheetHTML(weaknesses: CategoryWeakness[], days: number): string {
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PANaCEa Weakness Study Guide</title>
  <style>
    @media print {
      @page {
        margin: 0.5in;
      }
      .page-break {
        page-break-after: always;
      }
      .no-print {
        display: none;
      }
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: var(--color-text-primary);
      max-width: 8.5in;
      margin: 0 auto;
      padding: 20px;
      background: var(--color-bg-primary);
    }
    
    .header {
      text-align: center;
      border-bottom: 3px solid var(--color-accent);
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    
    .header h1 {
      color: var(--color-accent);
      margin: 0 0 10px 0;
      font-size: 28px;
    }
    
    .header .subtitle {
      color: var(--color-text-muted);
      font-size: 14px;
    }
    
    .system-section {
      margin-bottom: 40px;
    }
    
    .system-header {
      background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent) 100%);
      color: var(--color-text-inverse);
      padding: 12px 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .system-header h2 {
      margin: 0;
      font-size: 20px;
    }
    
    .system-header .error-badge {
      background: var(--color-bg-primary);
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
    }
    
    .question-card {
      background: var(--color-bg-secondary);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }
    
    .question-card .condition {
      color: var(--color-text-muted);
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    
    .question-card .question-text {
      font-weight: 600;
      color: var(--color-text-primary);
      margin-bottom: 15px;
      font-size: 15px;
    }
    
    .question-card .options {
      list-style: none;
      padding: 0;
      margin: 0 0 15px 0;
    }
    
    .question-card .options li {
      padding: 8px 12px;
      margin-bottom: 6px;
      border-radius: 6px;
      background: var(--color-bg-primary);
      border: 1px solid var(--color-border);
      font-size: 14px;
    }
    
    .question-card .options li.correct {
      background: color-mix(in srgb, var(--color-data-pass) 15%, transparent);
      border-color: color-mix(in srgb, var(--color-data-pass) 40%, transparent);
      font-weight: 600;
      color: var(--color-data-pass);
    }
    
    .question-card .rationale {
      background: color-mix(in srgb, var(--color-accent) 10%, transparent);
      border-left: 4px solid var(--color-accent);
      padding: 12px 16px;
      margin-bottom: 12px;
      border-radius: 4px;
    }
    
    .question-card .rationale-title {
      font-weight: 700;
      color: var(--color-accent);
      font-size: 13px;
      margin-bottom: 6px;
    }
    
    .question-card .rationale-text {
      color: var(--color-text-secondary);
      font-size: 13px;
      line-height: 1.5;
    }
    
    .question-card .pearls {
      background: color-mix(in srgb, var(--color-data-provisional) 15%, transparent);
      border-left: 4px solid var(--color-data-provisional);
      padding: 12px 16px;
      border-radius: 4px;
    }
    
    .question-card .pearls-title {
      font-weight: 700;
      color: var(--color-data-provisional);
      font-size: 13px;
      margin-bottom: 6px;
    }
    
    .question-card .pearls ul {
      margin: 0;
      padding-left: 20px;
      color: var(--color-text-secondary);
      font-size: 13px;
    }
    
    .question-card .pearls li {
      margin-bottom: 4px;
    }
    
    .footer {
      text-align: center;
      color: var(--color-text-muted);
      font-size: 12px;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid var(--color-border);
    }
    
    .print-button {
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--color-accent);
      color: var(--color-text-inverse);
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 6px var(--color-shadow-soft);
      font-size: 14px;
    }
    
    .print-button:hover {
      background: color-mix(in srgb, var(--color-accent) 90%, transparent);
    }
  </style>
</head>
<body>
  <button class="print-button no-print" onclick="window.print()">🖨️ Print to PDF</button>
  
  <div class="header">
    <h1>🎯 PANaCEa Weakness Study Guide</h1>
    <div class="subtitle">
      Based on questions missed in the last ${days} days | Generated ${currentDate}
    </div>
  </div>
`;

  if (weaknesses.length === 0) {
    html += `
  <div style="text-align: center; padding: 60px 20px; color: var(--color-text-muted);">
    <h2 style="color: var(--color-data-pass); margin-bottom: 10px;">🎉 Excellent Work!</h2>
    <p>No significant weaknesses identified in the last ${days} days.</p>
    <p>Keep up the great study habits!</p>
  </div>
`;
  } else {
    weaknesses.forEach((weakness, sysIndex) => {
      html += `
  <div class="system-section${sysIndex < weaknesses.length - 1 ? ' page-break' : ''}">
    <div class="system-header">
      <h2>${weakness.systemName}</h2>
      <span class="error-badge">${weakness.errorCount} errors</span>
    </div>
`;

      weakness.questions.forEach((q, qIndex) => {
        html += `
    <div class="question-card">
      <div class="condition">${q.condition}</div>
      <div class="question-text">${q.question}</div>
      <ol class="options" type="A">
`;

        q.options.forEach((option, optIndex) => {
          const isCorrect = optIndex === q.correctAnswerIndex;
          html += `        <li${isCorrect ? ' class="correct"' : ''}>${option}</li>\n`;
        });

        html += `      </ol>
      <div class="rationale">
        <div class="rationale-title">📖 Explanation</div>
        <div class="rationale-text">${q.rationale}</div>
      </div>
`;

        if (q.pearls.length > 0) {
          html += `      <div class="pearls">
        <div class="pearls-title">💎 Clinical Pearls</div>
        <ul>
`;
          q.pearls.forEach((pearl) => {
            html += `          <li>${pearl}</li>\n`;
          });
          html += `        </ul>
      </div>
`;
        }

        html += `    </div>\n`;
      });

      html += `  </div>\n`;
    });
  }

  html += `
  <div class="footer">
    <p>
      Generated by PANaCEa AI Study Platform<br>
      This study guide is personalized based on your recent performance.
    </p>
  </div>
</body>
</html>
`;

  return html;
}

/**
 * Export weakness cheatsheet as printable HTML
 * Opens in new window for printing to PDF
 */
/**
 * Export weakness data as printable HTML cheatsheet
 * @returns boolean - true if window opened successfully, false if blocked
 */
export function exportWeaknessCheatsheet(
  performanceData: PerformanceRecord[],
  allQuestions: Question[],
  options: CheatsheetOptions = {}
): boolean {
  const weaknesses = identifyWeaknesses(performanceData, allQuestions, options);
  const html = generateCheatsheetHTML(weaknesses, options.days || 30);

  // Open in new window
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();

    // Auto-trigger print dialog after load
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
      }, 250);
    };
    return true;
  } else {
    return false;
  }
}

/**
 * Get weakness summary without generating full export
 */
export function getWeaknessSummary(
  performanceData: PerformanceRecord[],
  options: CheatsheetOptions = {}
): {
  totalWeaknesses: number;
  totalQuestions: number;
  systems: Array<{ system: string; errorCount: number }>;
} {
  const { days = 30, minErrors = 1 } = options;

  const cutoffDate = Date.now() - days * 24 * 60 * 60 * 1000;
  const recentData = performanceData.filter((record) => record.timestamp >= cutoffDate);

  const systemErrorMap = new Map<SystemCode, number>();

  recentData.forEach((record) => {
    if (!record.system || record.system === 'OTHER') return;
    if (!record.isCorrect) {
      systemErrorMap.set(record.system, (systemErrorMap.get(record.system) || 0) + 1);
    }
  });

  const systems = Array.from(systemErrorMap.entries())
    .filter(([_, count]) => count >= minErrors)
    .map(([system, count]) => ({
      system: ABBREVIATION_TO_TOPIC_MAP[system] || system,
      errorCount: count,
    }))
    .sort((a, b) => b.errorCount - a.errorCount);

  const totalQuestions = systems.reduce((sum, s) => sum + s.errorCount, 0);

  return {
    totalWeaknesses: systems.length,
    totalQuestions,
    systems,
  };
}
