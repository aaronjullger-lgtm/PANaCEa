/**
 * Step 6: Content Completeness Dashboard
 *
 * This script generates a comprehensive report on content quality and completeness
 * for each condition in the database, helping prioritize enrichment efforts.
 */

import { prisma, disconnectPrisma } from '../helpers/prisma-client.js';

interface CompletenessScore {
  id: string;
  conditionId: string;
  condition: string;
  system: string;
  subcategory: string;
  pance_yield: number | null;
  score: number;
  missingFields: string[];
  presentFields: string[];
  priority: number;
}

interface SystemStats {
  system: string;
  totalConditions: number;
  avgScore: number;
  missingRequiredFields: number;
  highYieldCount: number;
  highYieldAvgScore: number;
}

const REQUIRED_FIELDS = ['overview', 'symptoms', 'treatment', 'diagnostics'];

const HIGH_YIELD_FIELDS = [
  'gold_standard_dx',
  'first_line_rx',
  'buzzwords',
  'classic_patient',
  'clinical_pearls',
  'best_initial_test',
  'classic_triad',
  'pathophysiology',
  'etiology',
  'epidemiology',
  'physicalExam',
  'riskFactors',
  'complications',
  'prognosis',
  'differentialDiagnosis',
  'mnemonic',
];

function hasContent(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function calculateCompletenessScore(content: any): CompletenessScore {
  // Required fields: 60 points max (15 points each)
  const requiredPresent = REQUIRED_FIELDS.filter((f) => hasContent(content[f]));
  const requiredScore = (requiredPresent.length / REQUIRED_FIELDS.length) * 60;

  // High-yield fields: 40 points max
  const highYieldPresent = HIGH_YIELD_FIELDS.filter((f) => hasContent(content[f]));
  const highYieldScore = (highYieldPresent.length / HIGH_YIELD_FIELDS.length) * 40;

  const totalScore = Math.round(requiredScore + highYieldScore);

  const missingFields = [
    ...REQUIRED_FIELDS.filter((f) => !hasContent(content[f])),
    ...HIGH_YIELD_FIELDS.filter((f) => !hasContent(content[f])),
  ];

  const presentFields = [...requiredPresent, ...highYieldPresent];

  // Priority = PANCE yield * (100 - score)
  // Higher yield + lower completeness = higher priority
  const panceYield = content.pance_yield || 1;
  const priority = Math.round(panceYield * (100 - totalScore));

  return {
    id: content.id,
    conditionId: content.conditionId,
    condition: content.condition,
    system: content.system,
    subcategory: content.subcategory,
    pance_yield: content.pance_yield,
    score: totalScore,
    missingFields,
    presentFields,
    priority,
  };
}

async function analyzeContentCompleteness(): Promise<CompletenessScore[]> {
  console.log('📊 Analyzing content completeness...\n');

  const allContent = await prisma.medicalContent.findMany({
    select: {
      id: true,
      conditionId: true,
      condition: true,
      system: true,
      subcategory: true,
      pance_yield: true,
      // Required fields
      overview: true,
      symptoms: true,
      treatment: true,
      diagnostics: true,
      // High-yield fields
      gold_standard_dx: true,
      first_line_rx: true,
      buzzwords: true,
      classic_patient: true,
      clinical_pearls: true,
      best_initial_test: true,
      classic_triad: true,
      pathophysiology: true,
      etiology: true,
      epidemiology: true,
      physicalExam: true,
      riskFactors: true,
      complications: true,
      prognosis: true,
      differentialDiagnosis: true,
      mnemonic: true,
    },
  });

  return allContent.map(calculateCompletenessScore);
}

function generateSystemStats(scores: CompletenessScore[]): SystemStats[] {
  const systemMap = new Map<string, CompletenessScore[]>();

  scores.forEach((score) => {
    if (!systemMap.has(score.system)) {
      systemMap.set(score.system, []);
    }
    systemMap.get(score.system)!.push(score);
  });

  return Array.from(systemMap.entries())
    .map(([system, conditions]) => {
      const highYield = conditions.filter((c) => (c.pance_yield || 0) >= 3);

      return {
        system,
        totalConditions: conditions.length,
        avgScore: Math.round(conditions.reduce((sum, c) => sum + c.score, 0) / conditions.length),
        missingRequiredFields: conditions.filter((c) =>
          REQUIRED_FIELDS.some((f) => c.missingFields.includes(f))
        ).length,
        highYieldCount: highYield.length,
        highYieldAvgScore:
          highYield.length > 0
            ? Math.round(highYield.reduce((sum, c) => sum + c.score, 0) / highYield.length)
            : 0,
      };
    })
    .sort((a, b) => a.avgScore - b.avgScore); // Lowest scores first (need most work)
}

function printDashboard(scores: CompletenessScore[], systemStats: SystemStats[]): void {
  console.log('\n' + '='.repeat(80));
  console.log('📊 CONTENT COMPLETENESS DASHBOARD');
  console.log('='.repeat(80));

  // Overall stats
  const avgScore = Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length);
  const missingRequired = scores.filter((s) =>
    REQUIRED_FIELDS.some((f) => s.missingFields.includes(f))
  ).length;
  const perfect = scores.filter((s) => s.score === 100).length;
  const critical = scores.filter((s) => s.score < 50).length;

  console.log(`\n📈 Overall Statistics:`);
  console.log(`  Total conditions:              ${scores.length}`);
  console.log(`  Average completeness:          ${avgScore}/100`);
  console.log(`  Perfect (100%):                ${perfect}`);
  console.log(`  Critical (<50%):               ${critical}`);
  console.log(`  Missing required fields:       ${missingRequired}`);

  // System breakdown
  console.log(`\n🏥 System Breakdown (sorted by avg score):`);
  console.log(
    `${'System'.padEnd(18)} ${'Total'.padStart(5)} ${'Avg'.padStart(4)} ${'Missing'.padStart(8)} ${'High Yield'.padStart(11)} ${'HY Avg'.padStart(7)}`
  );
  console.log('-'.repeat(80));

  systemStats.forEach((stat) => {
    const emoji = stat.avgScore >= 90 ? '✅' : stat.avgScore >= 70 ? '⚠️ ' : '🔴';
    console.log(
      `${emoji} ${stat.system.padEnd(15)} ${stat.totalConditions.toString().padStart(5)} ` +
        `${stat.avgScore.toString().padStart(4)} ${stat.missingRequiredFields.toString().padStart(8)} ` +
        `${stat.highYieldCount.toString().padStart(11)} ${stat.highYieldAvgScore.toString().padStart(7)}`
    );
  });

  // Top 50 priority conditions to enrich
  console.log(`\n🎯 Top 50 Priority Conditions (High PANCE Yield + Low Completeness):`);
  console.log(
    `${'Rank'.padStart(4)} ${'Priority'.padStart(8)} ${'Score'.padStart(5)} ${'System'.padEnd(8)} ${'Condition'.padEnd(40)}`
  );
  console.log('-'.repeat(80));

  const topPriority = scores.sort((a, b) => b.priority - a.priority).slice(0, 50);

  topPriority.forEach((item, index) => {
    const rank = (index + 1).toString().padStart(4);
    const priority = item.priority.toString().padStart(8);
    const score = item.score.toString().padStart(5);
    const system = item.system.substring(0, 8).padEnd(8);
    const condition = item.condition.substring(0, 40).padEnd(40);
    const yieldEmoji =
      (item.pance_yield || 0) >= 5 ? '🔥' : (item.pance_yield || 0) >= 3 ? '⭐' : '  ';

    console.log(`${rank} ${priority} ${score} ${system} ${yieldEmoji} ${condition}`);
  });

  // Missing field frequency
  console.log(`\n📋 Most Common Missing Fields:`);
  const fieldCounts = new Map<string, number>();
  scores.forEach((score) => {
    score.missingFields.forEach((field) => {
      fieldCounts.set(field, (fieldCounts.get(field) || 0) + 1);
    });
  });

  const sortedFields = Array.from(fieldCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  sortedFields.forEach(([field, count], index) => {
    const percentage = Math.round((count / scores.length) * 100);
    const bar = '█'.repeat(Math.floor(percentage / 5));
    const required = REQUIRED_FIELDS.includes(field) ? ' 🔴' : '';
    console.log(
      `  ${(index + 1).toString().padStart(2)}. ${field.padEnd(25)} ${count.toString().padStart(4)} (${percentage}%)${required} ${bar}`
    );
  });

  console.log('\n' + '='.repeat(80) + '\n');
}

async function exportToCSV(scores: CompletenessScore[], filename: string): Promise<void> {
  const { writeFileSync } = await import('fs');
  const { join } = await import('path');

  const csv = [
    'Priority,Score,PANCE Yield,System,Subcategory,Condition,Missing Fields',
    ...scores
      .sort((a, b) => b.priority - a.priority)
      .map(
        (s) =>
          `${s.priority},${s.score},${s.pance_yield || 0},"${s.system}","${s.subcategory}","${s.condition}","${s.missingFields.join(', ')}"`
      ),
  ].join('\n');

  const filepath = join(process.cwd(), filename);
  writeFileSync(filepath, csv);
  console.log(`✅ Exported to: ${filepath}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const exportCSV = args.includes('--csv');
  const csvFile =
    args.find((arg) => arg.startsWith('--file='))?.split('=')[1] || 'content-completeness.csv';

  console.log('🏥 PANaCEa Database: Content Completeness Dashboard\n');

  const scores = await analyzeContentCompleteness();
  const systemStats = generateSystemStats(scores);

  printDashboard(scores, systemStats);

  if (exportCSV) {
    await exportToCSV(scores, csvFile);
  } else {
    console.log('💡 Use --csv to export results to CSV');
    console.log('   Example: npm run db:completeness -- --csv --file=report.csv\n');
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
