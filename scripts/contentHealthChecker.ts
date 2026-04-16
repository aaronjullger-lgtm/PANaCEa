/**
 * Content Health Checker
 * Runs nightly to audit content quality and flag issues
 *
 * DEPRECATED: this legacy local-cron helper is no longer part of the scheduled
 * production architecture. GitHub Actions owns recurring automation.
 *
 * Usage: tsx scripts/contentHealthChecker.ts
 *
 * NOTE: This now uses the database as the source of truth for content.
 */

import type { ContentHealthReport, ContentHealthIssue } from '../types/admin-cms';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

const prisma = new PrismaClient();

interface ConditionContent {
  [key: string]: {
    overview?: string;
    etiologyPathophysiology?: string;
    treatment?: string[];
    diagnostics?: any;
    basicScienceLinks?: Array<{ title: string; conceptId: string }>;
    mediaIds?: string[];
  };
}

/**
 * Load condition content from database
 */
async function loadConditionContent(): Promise<ConditionContent> {
  try {
    const content = await prisma.medicalContent.findMany({
      where: { status: 'published' },
    });

    const contentMap: ConditionContent = {};
    content.forEach((item) => {
      contentMap[item.conditionId] = item as any;
    });

    return contentMap;
  } catch (error) {
    console.error('Error loading content from database:', error);
    console.warn('Database may not be available. Returning empty content.');
    return {};
  }
}

/**
 * Check if content has placeholder text
 */
function hasPlaceholder(text: string | undefined): boolean {
  if (!text) return false;
  return /\[NO CONTENT PROVIDED\]/i.test(text);
}

/**
 * Check if field is empty or missing
 */
function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Audit a single condition's content
 */
function auditCondition(conditionId: string, content: any): ContentHealthIssue[] {
  const issues: ContentHealthIssue[] = [];

  // Check for missing overview
  if (isEmpty(content.overview)) {
    issues.push({
      contentId: conditionId,
      condition: conditionId.split('__').pop() || conditionId,
      issueType: 'missing_explanation',
      description: 'Missing overview section',
      severity: 'high',
    });
  } else if (hasPlaceholder(content.overview)) {
    issues.push({
      contentId: conditionId,
      condition: conditionId.split('__').pop() || conditionId,
      issueType: 'missing_explanation',
      description: 'Overview contains placeholder text',
      severity: 'high',
    });
  }

  // Check for missing etiology/pathophysiology
  if (isEmpty(content.etiologyPathophysiology)) {
    issues.push({
      contentId: conditionId,
      condition: conditionId.split('__').pop() || conditionId,
      issueType: 'missing_explanation',
      description: 'Missing etiology/pathophysiology section',
      severity: 'high',
    });
  } else if (hasPlaceholder(content.etiologyPathophysiology)) {
    issues.push({
      contentId: conditionId,
      condition: conditionId.split('__').pop() || conditionId,
      issueType: 'missing_explanation',
      description: 'Etiology/pathophysiology contains placeholder text',
      severity: 'high',
    });
  }

  // Check for missing treatment
  if (isEmpty(content.treatment)) {
    issues.push({
      contentId: conditionId,
      condition: conditionId.split('__').pop() || conditionId,
      issueType: 'missing_explanation',
      description: 'Missing treatment section',
      severity: 'high',
    });
  }

  // Check for broken media links (if mediaIds exist but are invalid)
  if (content.mediaIds && Array.isArray(content.mediaIds)) {
    const invalidMediaIds = content.mediaIds.filter((id: string) => {
      // Check if media ID follows expected format
      return typeof id !== 'string' || id.trim().length === 0;
    });

    if (invalidMediaIds.length > 0) {
      issues.push({
        contentId: conditionId,
        condition: conditionId.split('__').pop() || conditionId,
        issueType: 'broken_media',
        description: `${invalidMediaIds.length} invalid media reference(s)`,
        severity: 'medium',
      });
    }
  }

  // Check for incomplete diagnostics
  if (content.diagnostics) {
    const diagnostics = content.diagnostics;
    let missingDiagnosticFields = 0;

    if (isEmpty(diagnostics.notes)) missingDiagnosticFields++;
    if (isEmpty(diagnostics.imaging)) missingDiagnosticFields++;
    if (isEmpty(diagnostics.labs)) missingDiagnosticFields++;

    if (missingDiagnosticFields === 3) {
      issues.push({
        contentId: conditionId,
        condition: conditionId.split('__').pop() || conditionId,
        issueType: 'invalid_field',
        description: 'Diagnostics section is empty',
        severity: 'medium',
      });
    }
  }

  // Check for missing basic science links (low priority)
  if (isEmpty(content.basicScienceLinks)) {
    issues.push({
      contentId: conditionId,
      condition: conditionId.split('__').pop() || conditionId,
      issueType: 'missing_explanation',
      description: 'No basic science links provided',
      severity: 'low',
    });
  }

  return issues;
}

/**
 * Run content health check
 */
export async function runContentHealthCheck(): Promise<ContentHealthReport> {
  console.log('🏥 Starting Content Health Check...\n');

  const content = await loadConditionContent();
  const conditionIds = Object.keys(content);
  const allIssues: ContentHealthIssue[] = [];

  // Audit each condition
  for (const conditionId of conditionIds) {
    const issues = auditCondition(conditionId, content[conditionId]);
    allIssues.push(...issues);
  }

  // Generate summary
  const summary = {
    missingExplanations: allIssues.filter((i) => i.issueType === 'missing_explanation').length,
    brokenMediaLinks: allIssues.filter((i) => i.issueType === 'broken_media').length,
    invalidFields: allIssues.filter((i) => i.issueType === 'invalid_field').length,
    outdatedContent: allIssues.filter((i) => i.issueType === 'outdated').length,
  };

  const report: ContentHealthReport = {
    timestamp: new Date(),
    totalContent: conditionIds.length,
    issues: allIssues,
    summary,
  };

  return report;
}

/**
 * Format and print report
 */
function printReport(report: ContentHealthReport): void {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[INFO] Content Health Report');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Generated: ${report.timestamp.toLocaleString()}`);
  console.log(`Total Content Items: ${report.totalContent}`);
  console.log(`Total Issues Found: ${report.issues.length}\n`);

  console.log('Summary:');
  console.log(`  [ERROR] Missing Explanations: ${report.summary.missingExplanations}`);
  console.log(`  🔗 Broken Media Links: ${report.summary.brokenMediaLinks}`);
  console.log(`  [WARNING]  Invalid Fields: ${report.summary.invalidFields}`);
  console.log(`  📅 Outdated Content: ${report.summary.outdatedContent}\n`);

  // Group issues by severity
  const highSeverity = report.issues.filter((i) => i.severity === 'high');
  const mediumSeverity = report.issues.filter((i) => i.severity === 'medium');
  const lowSeverity = report.issues.filter((i) => i.severity === 'low');

  if (highSeverity.length > 0) {
    console.log(`\n🚨 HIGH SEVERITY ISSUES (${highSeverity.length}):`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    highSeverity.slice(0, 10).forEach((issue, i) => {
      console.log(`${i + 1}. [${issue.condition}] ${issue.description}`);
      console.log(`   ID: ${issue.contentId}`);
    });
    if (highSeverity.length > 10) {
      console.log(`   ... and ${highSeverity.length - 10} more`);
    }
  }

  if (mediumSeverity.length > 0) {
    console.log(`\n[WARNING]  MEDIUM SEVERITY ISSUES (${mediumSeverity.length}):`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    mediumSeverity.slice(0, 5).forEach((issue, i) => {
      console.log(`${i + 1}. [${issue.condition}] ${issue.description}`);
    });
    if (mediumSeverity.length > 5) {
      console.log(`   ... and ${mediumSeverity.length - 5} more`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Save report to file
  const reportPath = path.join(__dirname, '../content-health-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`✅ Full report saved to: ${reportPath}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * Main execution
 */
if (require.main === module) {
  (async () => {
    try {
      const report = await runContentHealthCheck();
      printReport(report);

      // Exit with error code if critical issues found
      const criticalIssues = report.issues.filter((i) => i.severity === 'high').length;
      if (criticalIssues > 0) {
        console.log(`[WARNING]  ${criticalIssues} critical issues require attention!`);
        process.exit(1);
      } else {
        console.log('✅ No critical issues found. Content health is good!');
        process.exit(0);
      }
    } catch (error) {
      console.error('[ERROR] Error running content health check:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  })();
}

export default runContentHealthCheck;
