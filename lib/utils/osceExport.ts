/**
 * OSCE encounter report generation and export utilities.
 * Generates markdown summaries of OSCE encounter results for download.
 */

export interface OSCEExportParams {
  caseName: string;
  correctDiagnosis: string;
  userDiagnosis: string;
  date: string;
  score?: number;
  clinicalReasoningScore?: number;
  differentialScore?: number;
  communicationScore?: number;
  dangerousActionsDetected?: Array<{ description: string; penalty: number }>;
  competencies?: {
    historyTaking?: number;
    physicalExam?: number;
    diagnosis?: number;
    management?: number;
  };
  checklist?: Array<{ item: string; status: 'PASS' | 'FAIL'; feedback?: string }>;
  redFlagsMissed?: string[];
  strengths?: string[];
  areasForImprovement?: string[];
  teachingPoints?: string[];
  totalTimeMs?: number;
}

export function generateOSCEMarkdown(params: OSCEExportParams): string {
  const {
    caseName,
    correctDiagnosis,
    userDiagnosis,
    date,
    score,
    clinicalReasoningScore,
    differentialScore,
    communicationScore,
    dangerousActionsDetected,
    competencies,
    checklist,
    redFlagsMissed,
    strengths,
    areasForImprovement,
    teachingPoints,
    totalTimeMs,
  } = params;

  const isCorrect = userDiagnosis.toLowerCase().trim() === correctDiagnosis.toLowerCase().trim();
  let md = `# OSCE Encounter Report — ${caseName}\n\n`;

  // Date & Scores Summary
  md += `**Date:** ${date}\n`;
  if (score !== undefined) md += `**Overall Score:** ${score}%\n`;
  if (clinicalReasoningScore !== undefined) md += `**Clinical Reasoning Score:** ${clinicalReasoningScore}%\n`;
  if (differentialScore !== undefined) md += `**Differential Diagnosis Score:** ${differentialScore}%\n`;
  if (communicationScore !== undefined) md += `**Communication Score:** ${communicationScore}%\n`;
  md += '\n---\n\n';

  // Diagnosis Result
  md += `## Diagnosis\n\n`;
  md += `**Status:** ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}\n`;
  md += `**Your Diagnosis:** ${userDiagnosis}\n`;
  md += `**Correct Diagnosis:** ${correctDiagnosis}\n\n`;

  // Competency Scores
  if (competencies) {
    md += `## Competency Scores\n\n`;
    md += '| Competency | Score |\n';
    md += '|---|---|\n';
    if (competencies.historyTaking !== undefined)
      md += `| History Taking | ${competencies.historyTaking}% |\n`;
    if (competencies.physicalExam !== undefined)
      md += `| Physical Exam | ${competencies.physicalExam}% |\n`;
    if (competencies.diagnosis !== undefined)
      md += `| Diagnosis | ${competencies.diagnosis}% |\n`;
    if (competencies.management !== undefined)
      md += `| Management | ${competencies.management}% |\n`;
    md += '\n';
  }

  // Rubric Checklist
  if (checklist && checklist.length > 0) {
    md += `## Rubric Checklist\n\n`;
    checklist.forEach((item) => {
      const icon = item.status === 'PASS' ? '✓' : '✗';
      md += `- [${icon}] ${item.item}`;
      if (item.feedback) md += ` — *${item.feedback}*`;
      md += '\n';
    });
    md += '\n';
  }

  // Red Flags Missed
  if (redFlagsMissed && redFlagsMissed.length > 0) {
    md += `## Red Flags Missed\n\n`;
    redFlagsMissed.forEach((flag) => {
      md += `- ⚠️ ${flag}\n`;
    });
    md += '\n';
  }

  // Dangerous Actions
  if (dangerousActionsDetected && dangerousActionsDetected.length > 0) {
    const totalPenalty = dangerousActionsDetected.reduce((sum, a) => sum + a.penalty, 0);
    md += `## Dangerous Actions Detected\n\n`;
    md += `> **Total penalty: -${totalPenalty} points**\n\n`;
    dangerousActionsDetected.forEach((action) => {
      md += `- 🚨 ${action.description} (-${action.penalty} pts)\n`;
    });
    md += '\n';
  }

  // Strengths
  if (strengths && strengths.length > 0) {
    md += `## Strengths\n\n`;
    strengths.forEach((strength) => {
      md += `- ✨ ${strength}\n`;
    });
    md += '\n';
  }

  // Areas for Improvement
  if (areasForImprovement && areasForImprovement.length > 0) {
    md += `## Areas for Improvement\n\n`;
    areasForImprovement.forEach((area) => {
      md += `- 📌 ${area}\n`;
    });
    md += '\n';
  }

  // Teaching Points
  if (teachingPoints && teachingPoints.length > 0) {
    md += `## Key Teaching Points\n\n`;
    teachingPoints.forEach((point) => {
      md += `- ${point}\n`;
    });
    md += '\n';
  }

  // Time Spent
  if (totalTimeMs !== undefined) {
    const minutes = Math.floor(totalTimeMs / 60000);
    const seconds = Math.floor((totalTimeMs % 60000) / 1000);
    md += `---\n\n**Time Spent:** ${minutes}m ${seconds}s\n`;
  }

  return md;
}

export function downloadOSCEReport(markdown: string, filename: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.md') ? filename : `${filename}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
