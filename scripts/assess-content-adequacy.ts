/**
 * scripts/assess-content-adequacy.ts
 *
 * 🎯 Content Adequacy Assessment & Auto-Regeneration
 *
 * Analyzes content quality by comparing against peer conditions:
 * - Length/depth analysis (word count, detail level)
 * - Completeness scoring (all required sections present)
 * - Consistency checking (format, style, structure)
 * - Automatic regeneration for substandard content
 *
 * Sets standards by analyzing top-performing conditions and applies
 * those standards across the entire database.
 *
 * Usage: npx ts-node scripts/assess-content-adequacy.ts [--regenerate] [--system=CV]
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';

config();

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

interface ContentMetrics {
  conditionId: string;
  condition: string;
  system: string;
  overviewWordCount: number;
  etiologyWordCount: number;
  pathophysiologyWordCount: number;
  diagnosticsWordCount: number;
  treatmentCount: number;
  symptomsCount: number;
  complicationsCount: number;
  buzzwordsCount: number;
  pearlsCount: number;
  completenessScore: number; // 0-100
  depthScore: number; // 0-100
  overallScore: number; // 0-100
}

interface QualityStandards {
  minOverviewWords: number;
  minEtiologyWords: number;
  minPathophysiologyWords: number;
  minDiagnosticsWords: number;
  minTreatmentItems: number;
  minSymptomItems: number;
  minComplicationItems: number;
  minBuzzwords: number;
  minPearls: number;
  minCompletenessScore: number;
  minDepthScore: number;
  minOverallScore: number;
}

function calculateMetrics(content: any): ContentMetrics {
  const countWords = (text: string | null) => {
    if (!text || text === 'NONE') return 0;
    return text.split(/\s+/).length;
  };

  const countItems = (arr: any[] | null) => {
    if (!arr || !Array.isArray(arr)) return 0;
    return arr.filter((item) => item && item !== 'NONE').length;
  };

  // Word counts for text fields
  const overviewWordCount = countWords(content.overview);
  const etiologyWordCount = countWords(content.etiology);
  const pathophysiologyWordCount = countWords(content.pathophysiology);
  const diagnosticsWordCount = countWords(content.diagnostics);

  // Item counts for arrays
  const treatmentCount = countItems(content.treatment);
  const symptomsCount = countItems(content.symptoms);
  const complicationsCount = countItems(content.complications);
  const buzzwordsCount = countItems(content.buzzwords);
  const pearlsCount = countItems(content.clinical_pearls);

  // Completeness score (0-100): Are all required fields present?
  const requiredFields = [
    'overview',
    'etiology',
    'epidemiology',
    'pathophysiology',
    'riskFactors',
    'symptoms',
    'physicalExam',
    'diagnostics',
    'treatment',
    'complications',
    'prognosis',
    'buzzwords',
    'clinical_pearls',
    'gold_standard_dx',
    'first_line_rx',
  ];

  const presentFields = requiredFields.filter((field) => {
    const value = content[field];
    if (Array.isArray(value)) return value.length > 0 && value[0] !== 'NONE';
    return value && value !== 'NONE' && value !== '';
  });

  const completenessScore = Math.round((presentFields.length / requiredFields.length) * 100);

  // Depth score (0-100): Is content sufficiently detailed?
  const depthMetrics = [
    overviewWordCount >= 50 ? 1 : overviewWordCount / 50,
    etiologyWordCount >= 40 ? 1 : etiologyWordCount / 40,
    pathophysiologyWordCount >= 50 ? 1 : pathophysiologyWordCount / 50,
    diagnosticsWordCount >= 50 ? 1 : diagnosticsWordCount / 50,
    treatmentCount >= 3 ? 1 : treatmentCount / 3,
    symptomsCount >= 4 ? 1 : symptomsCount / 4,
    complicationsCount >= 3 ? 1 : complicationsCount / 3,
    buzzwordsCount >= 4 ? 1 : buzzwordsCount / 4,
    pearlsCount >= 3 ? 1 : pearlsCount / 3,
  ];

  const depthScore = Math.round(
    (depthMetrics.reduce((a, b) => a + b, 0) / depthMetrics.length) * 100
  );

  // Overall score: weighted average
  const overallScore = Math.round(completenessScore * 0.6 + depthScore * 0.4);

  return {
    conditionId: content.conditionId,
    condition: content.condition,
    system: content.system,
    overviewWordCount,
    etiologyWordCount,
    pathophysiologyWordCount,
    diagnosticsWordCount,
    treatmentCount,
    symptomsCount,
    complicationsCount,
    buzzwordsCount,
    pearlsCount,
    completenessScore,
    depthScore,
    overallScore,
  };
}

function deriveStandards(allMetrics: ContentMetrics[]): QualityStandards {
  // Use 75th percentile as the standard (top quartile performance)
  const percentile = (arr: number[], p: number) => {
    const sorted = arr.sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p);
    return sorted[index] || sorted[sorted.length - 1];
  };

  return {
    minOverviewWords: Math.max(
      50,
      percentile(
        allMetrics.map((m) => m.overviewWordCount),
        0.75
      )
    ),
    minEtiologyWords: Math.max(
      40,
      percentile(
        allMetrics.map((m) => m.etiologyWordCount),
        0.75
      )
    ),
    minPathophysiologyWords: Math.max(
      50,
      percentile(
        allMetrics.map((m) => m.pathophysiologyWordCount),
        0.75
      )
    ),
    minDiagnosticsWords: Math.max(
      50,
      percentile(
        allMetrics.map((m) => m.diagnosticsWordCount),
        0.75
      )
    ),
    minTreatmentItems: Math.max(
      3,
      percentile(
        allMetrics.map((m) => m.treatmentCount),
        0.75
      )
    ),
    minSymptomItems: Math.max(
      4,
      percentile(
        allMetrics.map((m) => m.symptomsCount),
        0.75
      )
    ),
    minComplicationItems: Math.max(
      3,
      percentile(
        allMetrics.map((m) => m.complicationsCount),
        0.75
      )
    ),
    minBuzzwords: Math.max(
      4,
      percentile(
        allMetrics.map((m) => m.buzzwordsCount),
        0.75
      )
    ),
    minPearls: Math.max(
      3,
      percentile(
        allMetrics.map((m) => m.pearlsCount),
        0.75
      )
    ),
    minCompletenessScore: 85, // At least 85% complete
    minDepthScore: 70, // At least 70% adequate depth
    minOverallScore: 75, // Overall threshold
  };
}

async function assessAndRegenerate(regenerate: boolean = false, targetSystem?: string) {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   Content Adequacy Assessment                             ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const whereClause = targetSystem ? { system: targetSystem } : {};

  const allContent = await prisma.medicalContent.findMany({
    where: whereClause,
  });

  console.log(`📊 Analyzing ${allContent.length} conditions...\n`);

  // Calculate metrics for all conditions
  const allMetrics = allContent.map(calculateMetrics);

  // Derive quality standards from top performers
  console.log('📈 Deriving quality standards from top 25% of conditions...\n');
  const standards = deriveStandards(allMetrics);

  console.log('📋 Quality Standards Established:');
  console.log(`   Overview: ≥${standards.minOverviewWords} words`);
  console.log(`   Etiology: ≥${standards.minEtiologyWords} words`);
  console.log(`   Pathophysiology: ≥${standards.minPathophysiologyWords} words`);
  console.log(`   Diagnostics: ≥${standards.minDiagnosticsWords} words`);
  console.log(`   Treatment items: ≥${standards.minTreatmentItems}`);
  console.log(`   Symptom items: ≥${standards.minSymptomItems}`);
  console.log(`   Complication items: ≥${standards.minComplicationItems}`);
  console.log(`   Buzzwords: ≥${standards.minBuzzwords}`);
  console.log(`   Clinical pearls: ≥${standards.minPearls}`);
  console.log(`   Completeness score: ≥${standards.minCompletenessScore}%`);
  console.log(`   Depth score: ≥${standards.minDepthScore}%`);
  console.log(`   Overall score: ≥${standards.minOverallScore}%\n`);

  // Find conditions below standards
  const inadequate = allMetrics.filter(
    (m) =>
      m.overallScore < standards.minOverallScore ||
      m.completenessScore < standards.minCompletenessScore ||
      m.depthScore < standards.minDepthScore
  );

  console.log(`🎯 Assessment Results:`);
  console.log(`   Total conditions: ${allMetrics.length}`);
  console.log(
    `   Meeting standards: ${allMetrics.length - inadequate.length} (${Math.round(((allMetrics.length - inadequate.length) / allMetrics.length) * 100)}%)`
  );
  console.log(
    `   Below standards: ${inadequate.length} (${Math.round((inadequate.length / allMetrics.length) * 100)}%)\n`
  );

  if (inadequate.length === 0) {
    console.log('✅ All conditions meet quality standards!');
    return;
  }

  // Show top 10 conditions needing improvement
  const sorted = inadequate.sort((a, b) => a.overallScore - b.overallScore);
  console.log('📉 Top 10 conditions needing improvement:');
  for (let i = 0; i < Math.min(10, sorted.length); i++) {
    const m = sorted[i];
    console.log(
      `   ${i + 1}. ${m.conditionId} (Score: ${m.overallScore}%, Complete: ${m.completenessScore}%, Depth: ${m.depthScore}%)`
    );
  }

  if (!regenerate) {
    console.log('\n💡 Run with --regenerate flag to automatically improve inadequate content');
    return;
  }

  // Regenerate inadequate content
  console.log('\n🔄 Regenerating inadequate content...\n');

  let regenerated = 0;
  let errors = 0;

  for (const metric of inadequate) {
    try {
      const content = allContent.find((c) => c.conditionId === metric.conditionId);
      if (!content) continue;

      // Identify specific weak fields
      const weakFields: string[] = [];
      if (metric.overviewWordCount < standards.minOverviewWords) weakFields.push('overview');
      if (metric.etiologyWordCount < standards.minEtiologyWords) weakFields.push('etiology');
      if (metric.pathophysiologyWordCount < standards.minPathophysiologyWords)
        weakFields.push('pathophysiology');
      if (metric.diagnosticsWordCount < standards.minDiagnosticsWords)
        weakFields.push('diagnostics');
      if (metric.treatmentCount < standards.minTreatmentItems) weakFields.push('treatment');
      if (metric.symptomsCount < standards.minSymptomItems) weakFields.push('symptoms');
      if (metric.complicationsCount < standards.minComplicationItems)
        weakFields.push('complications');
      if (metric.buzzwordsCount < standards.minBuzzwords) weakFields.push('buzzwords');
      if (metric.pearlsCount < standards.minPearls) weakFields.push('clinical_pearls');

      console.log(`  🔧 ${metric.conditionId}: Improving ${weakFields.join(', ')}`);

      // Generate improvement prompt
      const prompt = `You are improving medical education content for ${content.condition} (${content.system} system).

Current content scores:
- Completeness: ${metric.completenessScore}%
- Depth: ${metric.depthScore}%
- Overall: ${metric.overallScore}%

Weak fields needing improvement: ${weakFields.join(', ')}

Quality standards to meet:
- Overview: At least ${standards.minOverviewWords} words
- Etiology: At least ${standards.minEtiologyWords} words
- Pathophysiology: At least ${standards.minPathophysiologyWords} words
- Treatment: At least ${standards.minTreatmentItems} items
- Symptoms: At least ${standards.minSymptomItems} items
- Buzzwords: At least ${standards.minBuzzwords} items
- Clinical pearls: At least ${standards.minPearls} items

Generate ENHANCED content ONLY for the weak fields listed above. Make it:
- More detailed and comprehensive
- PANCE-relevant with high-yield information
- Well-structured with proper formatting
- Medically accurate and up-to-date

Return a JSON object with ONLY the fields that need improvement (${weakFields.join(', ')}). Use proper structure:
- Text fields: strings with markdown formatting
- Array fields: arrays of strings

Return ONLY valid JSON, no markdown wrapper, no explanation.`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      // Parse and extract JSON
      let jsonText = text.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText
          .replace(/```json\s*/gi, '')
          .replace(/```\s*/g, '')
          .trim();
      }

      const improvements = JSON.parse(jsonText);

      // Update only the weak fields
      await prisma.medicalContent.update({
        where: { id: content.id },
        data: improvements,
      });

      regenerated++;
      console.log(
        `  ✅ ${metric.conditionId}: Enhanced ${Object.keys(improvements).length} fields`
      );

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`  ❌ ${metric.conditionId}:`, error);
      errors++;
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log(`📈 Regeneration Summary: Enhanced ${regenerated} conditions, ${errors} errors`);
  console.log('\n💡 Run assessment again to verify improvements');
}

async function main() {
  const args = process.argv.slice(2);
  const regenerate = args.includes('--regenerate');
  const systemArg = args.find((arg) => arg.startsWith('--system='));
  const targetSystem = systemArg ? systemArg.split('=')[1] : undefined;

  try {
    await assessAndRegenerate(regenerate, targetSystem);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
