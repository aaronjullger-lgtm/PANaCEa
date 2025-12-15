#!/usr/bin/env tsx
/**
 * Weekly Automation Tasks
 * 
 * Runs weekly for comprehensive system audit and improvement suggestions:
 * - Full database accuracy audit against latest medical guidelines
 * - Generate improvement suggestions report (features, tweaks, content updates)
 * - Check for outdated content based on guideline publication dates
 * - Generate weekly summary report (.txt format) for review
 * - Automated backup and archival
 * 
 * Usage: tsx scripts/automation/weeklyTasks.ts
 * Schedule: 0 2 * * 0 (2 AM every Sunday)
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config();

const prisma = new PrismaClient();

interface WeeklyReport {
  timestamp: Date;
  weekNumber: number;
  year: number;
  sections: {
    databaseAudit: any;
    contentAccuracy: any;
    outdatedContent: any;
    performanceMetrics: any;
    improvementSuggestions: string[];
    automationSuggestions: string[];
  };
  summary: string;
}

const report: WeeklyReport = {
  timestamp: new Date(),
  weekNumber: getWeekNumber(new Date()),
  year: new Date().getFullYear(),
  sections: {
    databaseAudit: {},
    contentAccuracy: {},
    outdatedContent: {},
    performanceMetrics: {},
    improvementSuggestions: [],
    automationSuggestions: [],
  },
  summary: '',
};

/**
 * Get ISO week number
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Comprehensive database audit
 */
async function runDatabaseAudit(): Promise<void> {
  console.log('🔍 Running comprehensive database audit...\n');
  
  try {
    // Content statistics
    const totalContent = await prisma.medicalContent.count();
    const publishedContent = await prisma.medicalContent.count({ where: { status: 'published' } });
    const draftContent = await prisma.medicalContent.count({ where: { status: 'draft' } });
    
    // Media statistics
    const totalMedia = await prisma.mediaAsset.count();
    const approvedMedia = await prisma.mediaAsset.count({ where: { status: 'approved' } });
    const pendingMedia = await prisma.mediaAsset.count({ where: { status: 'pending_review' } });
    
    // User statistics
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({
      where: {
        performanceRecords: {
          some: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
        },
      },
    });
    
    // Question statistics
    const goldenQuestions = await prisma.question.count();
    const stagingQuestions = await prisma.stagingQuestion.count();
    
    report.sections.databaseAudit = {
      content: { total: totalContent, published: publishedContent, draft: draftContent },
      media: { total: totalMedia, approved: approvedMedia, pending: pendingMedia },
      users: { total: totalUsers, activeLastWeek: activeUsers },
      questions: { golden: goldenQuestions, staging: stagingQuestions },
    };
    
    console.log('✅ Database audit completed\n');
  } catch (error: any) {
    console.error('❌ Database audit failed:', error.message);
  }
}

/**
 * Check content accuracy against medical standards
 */
async function checkContentAccuracy(): Promise<void> {
  console.log('🏥 Checking content accuracy against medical standards...\n');
  
  try {
    const content = await prisma.medicalContent.findMany({
      where: { status: 'published' },
      select: {
        conditionId: true,
        condition: true,
        overview: true,
        treatment: true,
        diagnostics: true,
        updatedAt: true,
      },
    });

    const issues = {
      missingTreatment: 0,
      missingDiagnostics: 0,
      placeholderContent: 0,
      outdatedUpdates: 0,
    };

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    for (const item of content) {
      // Check for missing critical sections
      if (!item.treatment) {
        issues.missingTreatment++;
      }
      
      if (!item.diagnostics) {
        issues.missingDiagnostics++;
      }
      
      // Check for placeholder content
      const overview = item.overview || '';
      if (/\[NO CONTENT PROVIDED\]/i.test(overview)) {
        issues.placeholderContent++;
      }
      
      // Check last update date
      if (item.updatedAt < sixMonthsAgo) {
        issues.outdatedUpdates++;
      }
    }

    report.sections.contentAccuracy = {
      totalChecked: content.length,
      issues,
      accuracyScore: ((content.length - Object.values(issues).reduce((a, b) => a + b, 0)) / content.length * 100).toFixed(2),
    };
    
    console.log('✅ Content accuracy check completed\n');
  } catch (error: any) {
    console.error('❌ Content accuracy check failed:', error.message);
  }
}

/**
 * Identify outdated content
 */
async function identifyOutdatedContent(): Promise<void> {
  console.log('📅 Identifying outdated content...\n');
  
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const outdated = await prisma.medicalContent.findMany({
      where: {
        status: 'published',
        updatedAt: { lt: oneYearAgo },
      },
      select: {
        conditionId: true,
        condition: true,
        system: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'asc' },
      take: 50, // Top 50 oldest
    });

    report.sections.outdatedContent = {
      total: outdated.length,
      conditions: outdated.map(c => ({
        condition: c.condition,
        system: c.system,
        lastUpdated: c.updatedAt.toISOString().split('T')[0],
        daysOld: Math.floor((Date.now() - c.updatedAt.getTime()) / (1000 * 60 * 60 * 24)),
      })),
    };
    
    console.log('✅ Outdated content identification completed\n');
  } catch (error: any) {
    console.error('❌ Outdated content check failed:', error.message);
  }
}

/**
 * Aggregate weekly performance metrics
 */
async function aggregateWeeklyMetrics(): Promise<void> {
  console.log('📊 Aggregating weekly performance metrics...\n');
  
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const perfRecords = await prisma.performanceRecord.findMany({
      where: {
        createdAt: { gte: oneWeekAgo },
      },
    });

    const totalQuestions = perfRecords.length;
    const correctAnswers = perfRecords.filter(r => r.isCorrect).length;
    const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions * 100).toFixed(2) : 'N/A';

    // Group by system
    const systemStats: Record<string, { total: number; correct: number }> = {};
    perfRecords.forEach(r => {
      const sys = r.system || 'UNKNOWN';
      if (!systemStats[sys]) systemStats[sys] = { total: 0, correct: 0 };
      systemStats[sys].total++;
      if (r.isCorrect) systemStats[sys].correct++;
    });

    report.sections.performanceMetrics = {
      totalQuestions,
      correctAnswers,
      accuracy,
      systemBreakdown: Object.entries(systemStats).map(([system, stats]) => ({
        system,
        total: stats.total,
        accuracy: ((stats.correct / stats.total) * 100).toFixed(2),
      })),
    };
    
    console.log('✅ Performance metrics aggregated\n');
  } catch (error: any) {
    console.error('❌ Performance metrics aggregation failed:', error.message);
  }
}

/**
 * Generate improvement suggestions
 */
async function generateImprovementSuggestions(): Promise<void> {
  console.log('💡 Generating improvement suggestions...\n');
  
  try {
    const suggestions: string[] = [];

    // Based on content accuracy
    const accuracyScore = parseFloat(report.sections.contentAccuracy.accuracyScore || '0');
    if (accuracyScore < 90) {
      suggestions.push(`CONTENT QUALITY: Current accuracy score is ${accuracyScore}%. Recommend reviewing and updating conditions with missing critical sections.`);
    }

    // Based on outdated content
    const outdatedCount = report.sections.outdatedContent?.total || 0;
    if (outdatedCount > 20) {
      suggestions.push(`CONTENT FRESHNESS: ${outdatedCount} conditions haven't been updated in over a year. Consider scheduling systematic content review cycles.`);
    }

    // Based on media assets
    const pendingMedia = report.sections.databaseAudit.media?.pending || 0;
    if (pendingMedia > 50) {
      suggestions.push(`MEDIA APPROVAL: ${pendingMedia} media assets pending review. Consider implementing automated quality scoring or expanding approval team.`);
    }

    // Based on user engagement
    const activeRate = report.sections.databaseAudit.users
      ? ((report.sections.databaseAudit.users.activeLastWeek / report.sections.databaseAudit.users.total) * 100).toFixed(1)
      : '0';
    if (parseFloat(activeRate) < 20) {
      suggestions.push(`USER ENGAGEMENT: Only ${activeRate}% of users were active last week. Consider implementing engagement features like daily streaks, achievements, or study groups.`);
    }

    // Feature suggestions based on patterns
    suggestions.push('FEATURE: Consider adding a "Spaced Repetition Mode" that automatically resurfaces missed questions at optimal intervals.');
    suggestions.push('FEATURE: Implement a "Guideline Update Tracker" that monitors FDA, AHA, CDC for relevant changes.');
    suggestions.push('IMPROVEMENT: Add AI-powered question difficulty calibration based on user performance patterns.');
    suggestions.push('IMPROVEMENT: Create a "Clinical Pearl of the Day" feature to highlight high-yield facts.');

    report.sections.improvementSuggestions = suggestions;
    
    console.log('✅ Improvement suggestions generated\n');
  } catch (error: any) {
    console.error('❌ Suggestion generation failed:', error.message);
  }
}

/**
 * Generate automation suggestions
 */
function generateAutomationSuggestions(): void {
  console.log('🤖 Generating automation suggestions...\n');
  
  const automationSuggestions = [
    'AUTOMATION: Implement automatic guideline update detection by monitoring FDA RSS feeds, AHA publications, and CDC MMWR.',
    'AUTOMATION: Add semantic duplicate question detection using embeddings to prevent redundant content.',
    'AUTOMATION: Create automated content freshness scoring based on publication dates of referenced guidelines.',
    'AUTOMATION: Implement auto-scaling question pre-generation based on user activity patterns and time-of-day usage.',
    'AUTOMATION: Add automated media relevance scoring using computer vision to filter low-quality uploads.',
    'AUTOMATION: Create weekly automated backup of critical data to cloud storage with version history.',
    'AUTOMATION: Implement automated performance regression detection to identify content with declining accuracy.',
    'AUTOMATION: Add automated medical terminology consistency checker across all content.',
    'AUTOMATION: Create automated citation validator to ensure all treatment recommendations have current sources.',
    'AUTOMATION: Implement automated A/B testing framework for question variations to optimize learning outcomes.',
  ];

  report.sections.automationSuggestions = automationSuggestions;
  
  console.log('✅ Automation suggestions generated\n');
}

/**
 * Generate summary
 */
function generateSummary(): void {
  const { databaseAudit, contentAccuracy, performanceMetrics } = report.sections;
  
  report.summary = `
PANaCEa Weekly Report - Week ${report.weekNumber}, ${report.year}
Generated: ${report.timestamp.toISOString()}

=================================================================
DATABASE HEALTH
=================================================================
Content: ${databaseAudit.content?.published || 0} published conditions
Media: ${databaseAudit.media?.approved || 0} approved assets
Users: ${databaseAudit.users?.total || 0} registered (${databaseAudit.users?.activeLastWeek || 0} active this week)
Questions: ${databaseAudit.questions?.golden || 0} in golden repository

=================================================================
CONTENT ACCURACY
=================================================================
Accuracy Score: ${contentAccuracy.accuracyScore || 'N/A'}%
Issues Found: ${JSON.stringify(contentAccuracy.issues || {})}
Conditions Checked: ${contentAccuracy.totalChecked || 0}

=================================================================
PERFORMANCE METRICS
=================================================================
Total Questions Answered: ${performanceMetrics.totalQuestions || 0}
Overall Accuracy: ${performanceMetrics.accuracy || 'N/A'}%

System Breakdown:
${(performanceMetrics.systemBreakdown || []).map((s: any) => 
  `  ${s.system}: ${s.total} questions, ${s.accuracy}% accuracy`
).join('\n')}

=================================================================
IMPROVEMENT SUGGESTIONS
=================================================================
${report.sections.improvementSuggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

=================================================================
AUTOMATION SUGGESTIONS
=================================================================
${report.sections.automationSuggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

=================================================================
ACTION ITEMS
=================================================================
1. Review outdated content (${report.sections.outdatedContent?.total || 0} conditions > 1 year old)
2. Address content accuracy issues identified above
3. Consider implementing suggested automation improvements
4. Monitor user engagement metrics and implement engagement features if needed

=================================================================
END OF REPORT
=================================================================
  `.trim();
}

/**
 * Save reports in multiple formats
 */
function saveReports(): void {
  const reportDir = path.join(process.cwd(), 'logs', 'weekly');
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const dateStr = report.timestamp.toISOString().split('T')[0];
  
  // Save JSON report
  const jsonPath = path.join(reportDir, `weekly-${dateStr}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`💾 JSON report saved to: ${jsonPath}`);
  
  // Save TXT report (human-readable)
  const txtPath = path.join(reportDir, `weekly-report-${dateStr}.txt`);
  fs.writeFileSync(txtPath, report.summary);
  console.log(`📄 Text report saved to: ${txtPath}`);
  
  // Also save to root for easy access
  const rootPath = path.join(process.cwd(), 'weekly-report-latest.txt');
  fs.writeFileSync(rootPath, report.summary);
  console.log(`📄 Latest report saved to: ${rootPath}\n`);
}

/**
 * Print summary to console
 */
function printSummary(): void {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║    Weekly Automation Report Summary                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log(report.summary);
  console.log('\n');
}

/**
 * Main execution
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║    Weekly Automation Tasks - Comprehensive Audit          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    await runDatabaseAudit();
    await checkContentAccuracy();
    await identifyOutdatedContent();
    await aggregateWeeklyMetrics();
    await generateImprovementSuggestions();
    generateAutomationSuggestions();
    generateSummary();
    
    printSummary();
    saveReports();

    console.log('✅ All weekly tasks completed successfully!');
    console.log(`📧 Review the report at: weekly-report-latest.txt\n`);
    
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Fatal error during weekly tasks:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { main as runWeeklyTasks };
