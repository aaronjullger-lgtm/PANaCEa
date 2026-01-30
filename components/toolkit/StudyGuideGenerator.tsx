/**
 * Study Guide Generator Component
 * Creates printable study guides from missed questions and bookmarks
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Printer, Download, CheckSquare, XSquare, Settings } from 'lucide-react';
import type { Question } from '../types';

interface StudyGuideGeneratorProps {
  questions: Question[];
  onClose: () => void;
  title?: string;
}

export const StudyGuideGenerator: React.FC<StudyGuideGeneratorProps> = ({
  questions,
  onClose,
  title = 'Study Guide',
}) => {
  const [includeRationale, setIncludeRationale] = useState(true);
  const [includePearls, setIncludePearls] = useState(true);
  const [includeAnswers, setIncludeAnswers] = useState(false);
  const [groupBySystem, setGroupBySystem] = useState(true);

  const generateHTML = () => {
    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - PANaCEa</title>
  <style>
    @media print {
      @page { margin: 0.75in; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1a202c;
      max-width: 8.5in;
      margin: 0 auto;
      padding: 1in;
      background: #fff;
    }
    
    .header {
      text-align: center;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 3px solid #2563eb;
    }
    
    .header h1 {
      margin: 0 0 0.5rem 0;
      color: #1e40af;
      font-size: 2rem;
    }
    
    .header .subtitle {
      color: #64748b;
      font-size: 0.9rem;
    }
    
    .system-group {
      margin-bottom: 2rem;
    }
    
    .system-header {
      background: #eff6ff;
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      border-left: 4px solid #2563eb;
      font-weight: 600;
      font-size: 1.1rem;
      color: #1e40af;
    }
    
    .question-block {
      margin-bottom: 2rem;
      padding: 1rem;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #fafafa;
    }
    
    .question-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .question-number {
      font-weight: 700;
      color: #2563eb;
      font-size: 1.1rem;
    }
    
    .condition-tag {
      background: #dbeafe;
      color: #1e40af;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 500;
    }
    
    .question-text {
      margin-bottom: 1rem;
      font-size: 1rem;
      line-height: 1.7;
      white-space: pre-wrap;
    }
    
    .options {
      margin: 1rem 0;
      list-style: none;
      padding: 0;
    }
    
    .option {
      padding: 0.5rem 0;
      margin: 0.25rem 0;
    }
    
    .option-label {
      font-weight: 600;
      color: #4b5563;
      margin-right: 0.5rem;
    }
    
    .correct-answer {
      background: #dcfce7;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      margin: 1rem 0;
      font-weight: 600;
      color: #166534;
      border-left: 3px solid #16a34a;
    }
    
    .rationale {
      background: #f0f9ff;
      padding: 1rem;
      border-radius: 6px;
      margin: 1rem 0;
      border-left: 3px solid #0284c7;
    }
    
    .rationale-title {
      font-weight: 700;
      color: #0369a1;
      margin-bottom: 0.5rem;
    }
    
    .pearls {
      background: #fef3c7;
      padding: 1rem;
      border-radius: 6px;
      margin: 1rem 0;
      border-left: 3px solid #f59e0b;
    }
    
    .pearls-title {
      font-weight: 700;
      color: #d97706;
      margin-bottom: 0.5rem;
    }
    
    .pearl-item {
      margin: 0.5rem 0;
      padding-left: 1.5rem;
      position: relative;
    }
    
    .pearl-item:before {
      content: "●";
      position: absolute;
      left: 0;
      color: #d97706;
    }
    
    .footer {
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 2px solid #e2e8f0;
      text-align: center;
      color: #64748b;
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <div class="subtitle">
      Generated from PANaCEa • ${new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}
    </div>
    <div class="subtitle" style="margin-top: 0.5rem;">
      ${questions.length} Question${questions.length !== 1 ? 's' : ''}
    </div>
  </div>
`;

    // Group questions by system if enabled
    const questionsBySystem: Record<string, Question[]> = {};

    if (groupBySystem) {
      questions.forEach((q) => {
        const system = q.system || q.topic || 'Other';
        if (!questionsBySystem[system]) {
          questionsBySystem[system] = [];
        }
        questionsBySystem[system].push(q);
      });
    } else {
      questionsBySystem['All Questions'] = questions;
    }

    // Generate HTML for each system group
    Object.keys(questionsBySystem)
      .sort()
      .forEach((system, sysIndex) => {
        const systemQuestions = questionsBySystem[system];
        // Guard against undefined (TypeScript strict mode)
        if (!systemQuestions || systemQuestions.length === 0) return;

        if (groupBySystem) {
          html += `  <div class="system-group">
    <div class="system-header">${system}</div>
`;
        }

        systemQuestions.forEach((question, index) => {
          const questionNumber = groupBySystem ? `${sysIndex + 1}.${index + 1}` : `${index + 1}`;

          html += `    <div class="question-block">
      <div class="question-header">
        <span class="question-number">Question ${questionNumber}</span>
        <span class="condition-tag">${question.condition}</span>
      </div>
      
      <div class="question-text">${question.question}</div>
      
      <ol class="options" type="A">
`;

          question.options.forEach((option, optIndex) => {
            const label = String.fromCharCode(65 + optIndex); // A, B, C, D
            html += `        <li class="option">
          <span class="option-label">${label}.</span> ${option}
        </li>
`;
          });

          html += `      </ol>
`;

          if (includeAnswers) {
            const correctLetter = String.fromCharCode(65 + question.correctAnswerIndex);
            html += `      <div class="correct-answer">
        → Correct Answer: ${correctLetter}. ${question.options[question.correctAnswerIndex]}
      </div>
`;
          }

          if (includeRationale) {
            html += `      <div class="rationale">
        <div class="rationale-title">Rationale</div>
        <div>${question.rationale}</div>
      </div>
`;
          }

          if (includePearls && question.pearls && question.pearls.length > 0) {
            html += `      <div class="pearls">
        <div class="pearls-title">Clinical Pearls</div>
`;
            question.pearls.forEach((pearl) => {
              html += `        <div class="pearl-item">${pearl}</div>
`;
            });
            html += `      </div>
`;
          }

          html += `    </div>
`;
        });

        if (groupBySystem) {
          html += `  </div>
`;
        }
      });

    html += `  <div class="footer">
    Generated with PANaCEa - AI-Powered PANCE Exam Preparation<br>
    Study smart, not just hard
  </div>
</body>
</html>`;

    return html;
  };

  const handlePrint = () => {
    const html = generateHTML();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const handleDownload = () => {
    const html = generateHTML();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--color-bg-primary)] rounded-2xl shadow-2xl max-w-2xl w-full"
      >
        {/* Header */}
        <div className="bg-[var(--color-accent)] p-6 text-[var(--color-text-inverse)] dark:text-[var(--color-bg-primary)] rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Generate Study Guide</h2>
              <p className="text-[var(--color-text-inverse)]/90 text-sm">
                {questions.length} question{questions.length !== 1 ? 's' : ''} ready to export
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Options */}
          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
              <Settings className="w-5 h-5" />
              <span className="font-semibold">Customize Your Guide</span>
            </div>

            <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={includeAnswers}
                onChange={(e) => setIncludeAnswers(e.target.checked)}
                className="w-5 h-5 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
              />
              <div className="flex-1">
                <div className="font-medium text-[var(--color-text-primary)]">Include Answers</div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  Show correct answers in the guide
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={includeRationale}
                onChange={(e) => setIncludeRationale(e.target.checked)}
                className="w-5 h-5 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
              />
              <div className="flex-1">
                <div className="font-medium text-[var(--color-text-primary)]">Include Rationale</div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  Detailed explanations for each question
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={includePearls}
                onChange={(e) => setIncludePearls(e.target.checked)}
                className="w-5 h-5 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
              />
              <div className="flex-1">
                <div className="font-medium text-[var(--color-text-primary)]">
                  Include Clinical Pearls
                </div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  Key takeaways and mnemonics
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={groupBySystem}
                onChange={(e) => setGroupBySystem(e.target.checked)}
                className="w-5 h-5 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
              />
              <div className="flex-1">
                <div className="font-medium text-[var(--color-text-primary)]">Group by System</div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  Organize questions by organ system
                </div>
              </div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-6 rounded-lg border-2 border-[var(--color-border)] text-[var(--color-text-secondary)] font-semibold hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 py-3 px-6 rounded-lg bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Download HTML
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 py-3 px-6 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-inverse)] dark:text-[var(--color-bg-primary)] font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              <Printer className="w-5 h-5" />
              Print
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default StudyGuideGenerator;
