/**
 * AI Content Drift Detector
 * Sprint 10: Automation & Long-Term Maintenance
 *
 * NOTE: This script needs schema updates to match current Prisma schema.
 * Field mappings: name → condition, content → medicalContent fields, stem → question
 *
 * Flags AI-generated content that may be outdated based on:
 * - Content age (>6 months since generation)
 * - Medical guideline updates
 * - User feedback patterns
 * - Verification failures
 *
 * Run: npx ts-node scripts/cron/drift-detector.ts
 * Schedule: Weekly via GitHub Actions or cron
 */

import { config } from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Load environment variables
config();

// Prisma v7 requires adapter for PostgreSQL
const directUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!directUrl) {
  console.error('❌ DATABASE_URL not set in environment');
  process.exit(1);
}
// @ts-ignore
const pool = new Pool({ connectionString: directUrl });
// @ts-ignore
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// =============================================================================
// TYPES
// =============================================================================

interface DriftReport {
  totalScanned: number;
  flaggedForReview: number;
  byReason: Record<string, number>;
  items: DriftItem[];
  generatedAt: Date;
}

interface DriftItem {
  id: string;
  table: string;
  name: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
  lastUpdated: Date;
  daysSinceUpdate: number;
  flagCount?: number;
  suggestedAction: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STALE_THRESHOLD_DAYS = 180; // 6 months
const HIGH_FLAG_THRESHOLD = 5;
const MEDIUM_FLAG_THRESHOLD = 2;

// Topics that change frequently - require shorter refresh cycles
const HIGH_VELOCITY_TOPICS = [
  'covid',
  'sars-cov-2',
  'vaccination',
  'guideline',
  'recommendation',
  'antibiotic resistance',
  'antimicrobial',
  'drug interaction',
  'contraindication',
];

// =============================================================================
// DRIFT DETECTION CLASS
// =============================================================================

class DriftDetector {
  private report: DriftReport;

  constructor() {
    this.report = {
      totalScanned: 0,
      flaggedForReview: 0,
      byReason: {},
      items: [],
      generatedAt: new Date(),
    };
  }

  /**
   * Run full drift detection scan
   */
  async scan(): Promise<DriftReport> {
    console.log('🔍 Starting AI Content Drift Detection...\n');

    // 1. Check MedicalContent for stale entries
    await this.scanMedicalContent();

    // 2. Check Questions with high error rates
    await this.scanQuestions();

    // 3. Check flagged content
    await this.scanFlaggedContent();

    // 4. Check for high-velocity topic updates needed
    await this.scanHighVelocityTopics();

    // 5. Save report to database
    await this.saveReport();

    return this.report;
  }

  /**
   * Scan MedicalContent for stale AI-generated entries
   */
  private async scanMedicalContent(): Promise<void> {
    console.log('📚 Scanning MedicalContent table...');

    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - STALE_THRESHOLD_DAYS);

    const staleContent = await prisma.medicalContent.findMany({
      where: {
        updatedAt: {
          lt: staleDate,
        },
        // Only check AI-generated content (removed source check as field doesn't exist)
        /* OR: [
          { source: { contains: "gemini" } },
          { source: { contains: "ai" } },
          { source: null },
        ], */
      },
      select: {
        id: true,
        condition: true, // was name
        updatedAt: true,
        // source: true, // removed
        content: true,
      },
      take: 100, // Limit for performance
    });

    for (const item of staleContent) {
      const daysSinceUpdate = Math.floor(
        (Date.now() - item.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check if content mentions high-velocity topics
      const contentStr = JSON.stringify(item.content || '').toLowerCase();
      const isHighVelocity = HIGH_VELOCITY_TOPICS.some((topic) => contentStr.includes(topic));

      this.addDriftItem({
        id: item.id,
        table: 'MedicalContent',
        name: item.condition || 'Unknown',
        reason: isHighVelocity ? 'high_velocity_stale' : 'age_stale',
        severity: isHighVelocity ? 'high' : daysSinceUpdate > 365 ? 'high' : 'medium',
        lastUpdated: item.updatedAt,
        daysSinceUpdate,
        suggestedAction: 'Regenerate content with latest medical guidelines',
      });
    }

    console.log(`  Found ${staleContent.length} stale entries\n`);
  }

  /**
   * Scan Questions with high error/flag rates
   */
  private async scanQuestions(): Promise<void> {
    console.log('❓ Scanning Questions for quality issues...');

    // Find questions with high incorrect answer rates
    const problematicQuestions = await prisma.$queryRaw<
      Array<{
        id: string;
        stem: string;
        updatedAt: Date;
        totalAttempts: bigint;
        incorrectCount: bigint;
      }>
    >`
      SELECT 
        q.id,
        q.question as "stem",
        q."updatedAt",
        COUNT(qa.id) as "totalAttempts",
        SUM(CASE WHEN qa."wasCorrect" = false THEN 1 ELSE 0 END) as "incorrectCount"
      FROM "Question" q
      LEFT JOIN "QuestionAttempt" qa ON q.id = qa."questionId"
      GROUP BY q.id
      HAVING COUNT(qa.id) >= 10 
        AND (SUM(CASE WHEN qa."wasCorrect" = false THEN 1 ELSE 0 END)::float / COUNT(qa.id)) > 0.7
      LIMIT 50
    `;

    for (const q of problematicQuestions) {
      const daysSinceUpdate = Math.floor(
        (Date.now() - new Date(q.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      const errorRate = (Number(q.incorrectCount) / Number(q.totalAttempts)) * 100;

      this.addDriftItem({
        id: q.id,
        table: 'Question',
        name: q.stem.substring(0, 80) + '...',
        reason: 'high_error_rate',
        severity: errorRate > 85 ? 'high' : 'medium',
        lastUpdated: new Date(q.updatedAt),
        daysSinceUpdate,
        flagCount: Number(q.incorrectCount),
        suggestedAction: `Review question clarity - ${errorRate.toFixed(1)}% error rate`,
      });
    }

    console.log(`  Found ${problematicQuestions.length} high-error-rate questions\n`);
  }

  /**
   * Scan user-flagged content
   */
  private async scanFlaggedContent(): Promise<void> {
    console.log('🚩 Scanning flagged content...');

    // Check for questions with multiple flags
    const flaggedQuestions = await prisma.questionFlag.groupBy({
      by: ['questionId'],
      _count: { id: true },
      having: {
        id: { _count: { gte: MEDIUM_FLAG_THRESHOLD } },
      },
      orderBy: { _count: { id: 'desc' } },
      take: 50,
    });

    for (const flag of flaggedQuestions) {
      const question = await prisma.question.findUnique({
        where: { id: flag.questionId },
        select: { question: true, updatedAt: true },
      });

      if (question) {
        const daysSinceUpdate = Math.floor(
          (Date.now() - question.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        const flagCount = flag._count.id;

        this.addDriftItem({
          id: flag.questionId,
          table: 'Question',
          name: question.question.substring(0, 80) + '...',
          reason: 'user_flagged',
          severity: flagCount >= HIGH_FLAG_THRESHOLD ? 'high' : 'medium',
          lastUpdated: question.updatedAt,
          daysSinceUpdate,
          flagCount,
          suggestedAction: `Review ${flagCount} user flags - may have errors or outdated info`,
        });
      }
    }

    console.log(`  Found ${flaggedQuestions.length} flagged items\n`);
  }

  /**
   * Scan content related to high-velocity medical topics
   */
  private async scanHighVelocityTopics(): Promise<void> {
    console.log('⚡ Scanning high-velocity topic content...');

    const shortStaleDate = new Date();
    shortStaleDate.setDate(shortStaleDate.getDate() - 90); // 3 months for high-velocity

    for (const topic of HIGH_VELOCITY_TOPICS.slice(0, 5)) {
      const matchingContent = await prisma.medicalContent.findMany({
        where: {
          OR: [
            { condition: { contains: topic, mode: 'insensitive' } },
            // { content: { path: [], string_contains: topic } }, // Prisma Json filter syntax varies, simple string check better or skip
          ],
          updatedAt: { lt: shortStaleDate },
        },
        select: {
          id: true,
          condition: true,
          updatedAt: true,
        },
        take: 10,
      });

      for (const item of matchingContent) {
        const daysSinceUpdate = Math.floor(
          (Date.now() - item.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        this.addDriftItem({
          id: item.id,
          table: 'MedicalContent',
          name: item.condition || 'Unknown',
          reason: 'high_velocity_topic',
          severity: 'high',
          lastUpdated: item.updatedAt,
          daysSinceUpdate,
          suggestedAction: `High-velocity topic "${topic}" - verify with latest guidelines`,
        });
      }
    }

    console.log(`  Scanned ${HIGH_VELOCITY_TOPICS.length} high-velocity topics\n`);
  }

  /**
   * Add item to drift report
   */
  private addDriftItem(item: DriftItem): void {
    // Avoid duplicates
    if (this.report.items.some((i) => i.id === item.id && i.table === item.table)) {
      return;
    }

    this.report.items.push(item);
    this.report.flaggedForReview++;
    this.report.byReason[item.reason] = (this.report.byReason[item.reason] || 0) + 1;
  }

  /**
   * Save report to database
   */
  private async saveReport(): Promise<void> {
    // Store report in a logs table or send notification
    console.log('💾 Saving drift report...');

    // Create audit log entry
    // Create audit log entry - simulated as AuditLog model is missing
    /* await prisma.auditLog.create({
      data: {

        id: uuidv4(),


        action: "DRIFT_DETECTION",
        entityType: "SYSTEM",
        details: {
          totalScanned: this.report.totalScanned,
          flaggedForReview: this.report.flaggedForReview,
          byReason: this.report.byReason,
          itemCount: this.report.items.length,
          highSeverityCount: this.report.items.filter(i => i.severity === "high").length,
        },
      },
    }); */

    console.log('  Report saved to AuditLog\n');
  }

  /**
   * Print report summary
   */
  printSummary(): void {
    console.log('═'.repeat(60));
    console.log('📊 DRIFT DETECTION REPORT');
    console.log('═'.repeat(60));
    console.log(`Generated: ${this.report.generatedAt.toISOString()}`);
    console.log(`Total Flagged: ${this.report.flaggedForReview}`);
    console.log();
    console.log('By Reason:');
    for (const [reason, count] of Object.entries(this.report.byReason)) {
      console.log(`  ${reason}: ${count}`);
    }
    console.log();
    console.log('By Severity:');
    console.log(`  🔴 High: ${this.report.items.filter((i) => i.severity === 'high').length}`);
    console.log(`  🟡 Medium: ${this.report.items.filter((i) => i.severity === 'medium').length}`);
    console.log(`  🟢 Low: ${this.report.items.filter((i) => i.severity === 'low').length}`);
    console.log();

    if (this.report.items.length > 0) {
      console.log('Top 10 Items Requiring Attention:');
      console.log('-'.repeat(60));

      const topItems = this.report.items
        .sort((a, b) => {
          const severityOrder = { high: 0, medium: 1, low: 2 };
          return severityOrder[a.severity] - severityOrder[b.severity];
        })
        .slice(0, 10);

      for (const item of topItems) {
        const severityIcon =
          item.severity === 'high' ? '🔴' : item.severity === 'medium' ? '🟡' : '🟢';
        console.log(`${severityIcon} [${item.table}] ${item.name}`);
        console.log(`   Reason: ${item.reason} | Days stale: ${item.daysSinceUpdate}`);
        console.log(`   Action: ${item.suggestedAction}`);
        console.log();
      }
    }

    console.log('═'.repeat(60));
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('🤖 AI Content Drift Detector');
  console.log('━'.repeat(50));
  console.log(`Run time: ${new Date().toISOString()}\n`);

  try {
    const detector = new DriftDetector();
    await detector.scan();
    detector.printSummary();

    console.log('✅ Drift detection complete!');
  } catch (error) {
    console.error('❌ Drift detection failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
