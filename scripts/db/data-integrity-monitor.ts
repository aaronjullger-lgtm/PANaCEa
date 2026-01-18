/**
 * Step 10: Automated Data Integrity Monitoring
 *
 * This script provides comprehensive health checks for:
 * - Junction table population
 * - Question linkage rates
 * - Content completeness
 * - Media coverage
 * - User data quality
 */

import { prisma, disconnectPrisma } from '../helpers/prisma-client.js';

interface DataHealthReport {
  timestamp: Date;

  // Junction table health
  junctionPopulation: {
    DrugConditionLink: { count: number; targetCoverage: number; percentage: number };
    LabConditionLink: { count: number; targetCoverage: number; percentage: number };
    ImagingConditionLink: { count: number; targetCoverage: number; percentage: number };
    FindingConditionLink: { count: number; targetCoverage: number; percentage: number };
    TreatmentConditionLink: { count: number; targetCoverage: number; percentage: number };
    AnatomyConditionLink: { count: number; targetCoverage: number; percentage: number };
  };

  // Question linking
  questionLinkRate: number;
  preGeneratedLinkRate: number;
  orphanedQuestions: number;
  orphanedPreGenerated: number;

  // Content completeness
  totalConditions: number;
  conditionsWithContent: number;
  avgCompletenessScore: number;
  criticalMissing: number;

  // Media coverage
  conditionsWithMedia: number;
  mediaCoverageRate: number;

  // User data
  totalUsers: number;
  activeUsers: number;
  orphanedUserProgress: number;
  staleFsrsRecords: number;

  // Overall health score (0-100)
  healthScore: number;

  // Alerts
  alerts: Array<{
    severity: 'critical' | 'warning' | 'info';
    category: string;
    message: string;
  }>;
}

async function checkJunctionTables(): Promise<DataHealthReport['junctionPopulation']> {
  const [drugLinks, labLinks, imagingLinks, findingLinks, treatmentLinks, anatomyLinks] =
    await Promise.all([
      prisma.drugConditionLink.count(),
      prisma.labConditionLink.count(),
      prisma.imagingConditionLink.count(),
      prisma.findingConditionLink.count(),
      prisma.treatmentConditionLink.count(),
      prisma.anatomyConditionLink.count(),
    ]);

  return {
    DrugConditionLink: {
      count: drugLinks,
      targetCoverage: 500,
      percentage: Math.round((drugLinks / 500) * 100),
    },
    LabConditionLink: {
      count: labLinks,
      targetCoverage: 300,
      percentage: Math.round((labLinks / 300) * 100),
    },
    ImagingConditionLink: {
      count: imagingLinks,
      targetCoverage: 200,
      percentage: Math.round((imagingLinks / 200) * 100),
    },
    FindingConditionLink: {
      count: findingLinks,
      targetCoverage: 300,
      percentage: Math.round((findingLinks / 300) * 100),
    },
    TreatmentConditionLink: {
      count: treatmentLinks,
      targetCoverage: 400,
      percentage: Math.round((treatmentLinks / 400) * 100),
    },
    AnatomyConditionLink: {
      count: anatomyLinks,
      targetCoverage: 200,
      percentage: Math.round((anatomyLinks / 200) * 100),
    },
  };
}

async function checkQuestionLinkage() {
  const [totalQuestions, questionsLinked, totalPreGen, preGenLinked] = await Promise.all([
    prisma.question.count(),
    prisma.question.count({ where: { conditionId: { not: null } } }),
    prisma.preGeneratedQuestion.count(),
    prisma.preGeneratedQuestion.count({ where: { conditionId: { not: null } } }),
  ]);

  return {
    questionLinkRate: totalQuestions > 0 ? Math.round((questionsLinked / totalQuestions) * 100) : 0,
    preGeneratedLinkRate: totalPreGen > 0 ? Math.round((preGenLinked / totalPreGen) * 100) : 0,
    orphanedQuestions: totalQuestions - questionsLinked,
    orphanedPreGenerated: totalPreGen - preGenLinked,
  };
}

async function checkContentCompleteness() {
  const [totalConditions, allContent] = await Promise.all([
    prisma.condition.count(),
    prisma.medicalContent.findMany({
      select: {
        id: true,
        overview: true,
        symptoms: true,
        treatment: true,
        diagnostics: true,
        gold_standard_dx: true,
        first_line_rx: true,
        buzzwords: true,
        classic_patient: true,
        clinical_pearls: true,
        best_initial_test: true,
      },
    }),
  ]);

  const conditionsWithContent = allContent.length;

  // Calculate completeness scores
  const scores = allContent.map((content) => {
    const requiredFields = ['overview', 'symptoms', 'treatment', 'diagnostics'];
    const highYieldFields = [
      'gold_standard_dx',
      'first_line_rx',
      'buzzwords',
      'classic_patient',
      'clinical_pearls',
      'best_initial_test',
    ];

    const requiredScore =
      (requiredFields.filter((f) => content[f as keyof typeof content]).length /
        requiredFields.length) *
      60;
    const highYieldScore =
      (highYieldFields.filter((f) => {
        const val = content[f as keyof typeof content];
        return val && (Array.isArray(val) ? val.length > 0 : true);
      }).length /
        highYieldFields.length) *
      40;

    return requiredScore + highYieldScore;
  });

  const avgCompletenessScore =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  const criticalMissing = allContent.filter(
    (content) =>
      !content.overview || !content.symptoms || !content.treatment || !content.diagnostics
  ).length;

  return {
    totalConditions,
    conditionsWithContent,
    avgCompletenessScore,
    criticalMissing,
  };
}

async function checkMediaCoverage() {
  const [totalConditions, conditionsWithMedia] = await Promise.all([
    prisma.condition.count(),
    prisma.condition.count({
      where: {
        MediaAsset: {
          some: {},
        },
      },
    }),
  ]);

  return {
    conditionsWithMedia,
    mediaCoverageRate:
      totalConditions > 0 ? Math.round((conditionsWithMedia / totalConditions) * 100) : 0,
  };
}

async function checkUserData() {
  const [totalUsers, recentUsers, orphanedProgress, staleProgress] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: {
        updatedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    }),
    // UserProgress without valid MedicalContent
    prisma.$queryRaw`
      SELECT COUNT(*)
      FROM "UserProgress" up
      LEFT JOIN "MedicalContent" mc ON up."conditionId" = mc.id
      WHERE mc.id IS NULL
    `.then((result: any) => Number(result[0]?.count || 0)),
    // Stale UserProgress (no review in 90+ days)
    prisma.userProgress.count({
      where: {
        lastReviewAt: {
          lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  return {
    totalUsers,
    activeUsers: recentUsers,
    orphanedUserProgress: orphanedProgress,
    staleFsrsRecords: staleProgress,
  };
}

function calculateHealthScore(report: Omit<DataHealthReport, 'healthScore' | 'alerts'>): number {
  let score = 100;

  // Deduct points for critical issues
  if (report.criticalMissing > 10) score -= 20;
  else if (report.criticalMissing > 0) score -= 10;

  if (report.questionLinkRate < 50) score -= 15;
  else if (report.questionLinkRate < 70) score -= 10;
  else if (report.questionLinkRate < 90) score -= 5;

  if (report.preGeneratedLinkRate < 90) score -= 10;

  if (report.avgCompletenessScore < 50) score -= 15;
  else if (report.avgCompletenessScore < 70) score -= 10;

  if (report.orphanedUserProgress > 100) score -= 10;
  else if (report.orphanedUserProgress > 50) score -= 5;

  // Bonus for good junction coverage
  const avgJunctionCoverage =
    Object.values(report.junctionPopulation).reduce((sum, j) => sum + j.percentage, 0) / 6;
  if (avgJunctionCoverage > 80) score += 5;

  return Math.max(0, Math.min(100, score));
}

function generateAlerts(
  report: Omit<DataHealthReport, 'healthScore' | 'alerts'>
): DataHealthReport['alerts'] {
  const alerts: DataHealthReport['alerts'] = [];

  // Critical alerts
  if (report.criticalMissing > 50) {
    alerts.push({
      severity: 'critical',
      category: 'Content',
      message: `${report.criticalMissing} conditions missing required fields (overview, symptoms, treatment, diagnostics)`,
    });
  }

  if (report.orphanedUserProgress > 100) {
    alerts.push({
      severity: 'critical',
      category: 'User Data',
      message: `${report.orphanedUserProgress} UserProgress records reference non-existent MedicalContent`,
    });
  }

  // Warning alerts
  if (report.questionLinkRate < 70) {
    alerts.push({
      severity: 'warning',
      category: 'Questions',
      message: `Only ${report.questionLinkRate}% of questions linked to conditions (target: 70%+)`,
    });
  }

  if (report.avgCompletenessScore < 70) {
    alerts.push({
      severity: 'warning',
      category: 'Content',
      message: `Average content completeness score is ${report.avgCompletenessScore}/100 (target: 70+)`,
    });
  }

  const lowJunctions = Object.entries(report.junctionPopulation).filter(
    ([_, data]) => data.percentage < 30
  );
  if (lowJunctions.length > 0) {
    alerts.push({
      severity: 'warning',
      category: 'Junction Tables',
      message: `Low population in: ${lowJunctions.map(([name, data]) => `${name} (${data.percentage}%)`).join(', ')}`,
    });
  }

  // Info alerts
  if (report.mediaCoverageRate < 20) {
    alerts.push({
      severity: 'info',
      category: 'Media',
      message: `Only ${report.mediaCoverageRate}% of conditions have media assets`,
    });
  }

  if (report.staleFsrsRecords > 500) {
    alerts.push({
      severity: 'info',
      category: 'User Data',
      message: `${report.staleFsrsRecords} FSRS records haven't been reviewed in 90+ days`,
    });
  }

  return alerts;
}

function printReport(report: DataHealthReport): void {
  const severityEmoji = {
    critical: '🔴',
    warning: '⚠️ ',
    info: 'ℹ️ ',
  };

  console.log('\n' + '='.repeat(70));
  console.log('📊 PANaCEa DATABASE HEALTH REPORT');
  console.log('='.repeat(70));
  console.log(`Generated: ${report.timestamp.toLocaleString()}`);
  console.log(`\n🏥 Overall Health Score: ${report.healthScore}/100`);

  const healthBar =
    '█'.repeat(Math.floor(report.healthScore / 5)) +
    '░'.repeat(20 - Math.floor(report.healthScore / 5));
  console.log(`[${healthBar}]`);

  console.log(`\n🔗 Junction Tables:`);
  Object.entries(report.junctionPopulation).forEach(([name, data]) => {
    const emoji = data.percentage >= 50 ? '✅' : data.percentage >= 30 ? '⚠️ ' : '🔴';
    console.log(
      `  ${emoji} ${name.padEnd(25)} ${data.count.toString().padStart(4)} / ${data.targetCoverage} (${data.percentage}%)`
    );
  });

  console.log(`\n❓ Question Linkage:`);
  console.log(
    `  Question table:           ${report.questionLinkRate}% linked (${report.orphanedQuestions} orphaned)`
  );
  console.log(
    `  PreGeneratedQuestion:     ${report.preGeneratedLinkRate}% linked (${report.orphanedPreGenerated} orphaned)`
  );

  console.log(`\n📝 Content Quality:`);
  console.log(`  Total conditions:         ${report.totalConditions}`);
  console.log(`  With MedicalContent:      ${report.conditionsWithContent}`);
  console.log(`  Avg completeness score:   ${report.avgCompletenessScore}/100`);
  console.log(`  Missing required fields:  ${report.criticalMissing}`);

  console.log(`\n🖼️  Media Coverage:`);
  console.log(
    `  Conditions with media:    ${report.conditionsWithMedia} (${report.mediaCoverageRate}%)`
  );

  console.log(`\n👥 User Data:`);
  console.log(`  Total users:              ${report.totalUsers}`);
  console.log(`  Active (30d):             ${report.activeUsers}`);
  console.log(`  Orphaned UserProgress:    ${report.orphanedUserProgress}`);
  console.log(`  Stale FSRS (90d+):        ${report.staleFsrsRecords}`);

  if (report.alerts.length > 0) {
    console.log(`\n🚨 Alerts (${report.alerts.length}):`);
    report.alerts.forEach((alert) => {
      console.log(`  ${severityEmoji[alert.severity]} [${alert.category}] ${alert.message}`);
    });
  } else {
    console.log(`\n✅ No alerts - database health is good!`);
  }

  console.log('\n' + '='.repeat(70) + '\n');
}

async function generateHealthReport(): Promise<DataHealthReport> {
  console.log('🔍 Gathering database health metrics...\n');

  const [junctionPopulation, questionLinkage, contentStats, mediaStats, userData] =
    await Promise.all([
      checkJunctionTables(),
      checkQuestionLinkage(),
      checkContentCompleteness(),
      checkMediaCoverage(),
      checkUserData(),
    ]);

  const partialReport = {
    timestamp: new Date(),
    junctionPopulation,
    ...questionLinkage,
    ...contentStats,
    ...mediaStats,
    ...userData,
  };

  const healthScore = calculateHealthScore(partialReport);
  const alerts = generateAlerts(partialReport);

  return {
    ...partialReport,
    healthScore,
    alerts,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');

  console.log('🏥 PANaCEa Database: Data Integrity Monitor\n');

  const report = await generateHealthReport();

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }

  // Exit with non-zero code if critical alerts exist
  const hasCritical = report.alerts.some((a) => a.severity === 'critical');
  if (hasCritical) {
    console.log('❌ Exiting with error due to critical alerts');
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectPrisma();
  });
