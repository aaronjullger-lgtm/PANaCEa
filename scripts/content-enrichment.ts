#!/usr/bin/env npx ts-node
/**
 * Content Enrichment CLI Script
 * 
 * Batch enriches MedicalContent entries using the AI enrichment API
 * 
 * Usage:
 *   npx ts-node scripts/content-enrichment.ts --audit          # Run audit only
 *   npx ts-node scripts/content-enrichment.ts --enrich         # Enrich top 10 priority
 *   npx ts-node scripts/content-enrichment.ts --enrich --limit 50  # Enrich top 50
 *   npx ts-node scripts/content-enrichment.ts --enrich --system Cardiovascular
 *   npx ts-node scripts/content-enrichment.ts --condition "Acute MI"
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();

// Config
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const DELAY_BETWEEN_CALLS_MS = 1500; // Rate limit protection

// Required and high-yield fields
const REQUIRED_FIELDS = ['overview', 'symptoms', 'treatment', 'diagnostics'] as const;
const HIGH_YIELD_FIELDS = [
  'gold_standard_dx', 'first_line_rx', 'buzzwords', 'classic_patient',
  'clinical_pearls', 'best_initial_test', 'classic_triad', 'pathophysiology',
  'etiology', 'epidemiology', 'physicalExam', 'riskFactors', 'complications',
  'prognosis', 'differentialDiagnosis', 'mnemonic',
] as const;

const ALL_ENRICHABLE_FIELDS = [...REQUIRED_FIELDS, ...HIGH_YIELD_FIELDS];

interface EnrichmentStats {
  total: number;
  processed: number;
  success: number;
  errors: number;
  fieldsUpdated: number;
}

interface DisplayPriority {
  primary: string;
  secondary?: string;
  tertiary?: string;
  reasoning: string;
}

// Helper functions
function isFieldEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return true;
    if (trimmed.includes('to be generated') || trimmed.includes('content needed')) return true;
    return false;
  }
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

function calculateCompleteness(content: Record<string, unknown>): {
  score: number;
  missingRequired: string[];
  missingHighYield: string[];
} {
  const missingRequired: string[] = [];
  const missingHighYield: string[] = [];
  
  let filledRequired = 0;
  let filledHighYield = 0;
  
  for (const field of REQUIRED_FIELDS) {
    if (!isFieldEmpty(content[field])) {
      filledRequired++;
    } else {
      missingRequired.push(field);
    }
  }
  
  for (const field of HIGH_YIELD_FIELDS) {
    if (!isFieldEmpty(content[field])) {
      filledHighYield++;
    } else {
      missingHighYield.push(field);
    }
  }
  
  const requiredScore = (filledRequired / REQUIRED_FIELDS.length) * 60;
  const highYieldScore = (filledHighYield / HIGH_YIELD_FIELDS.length) * 40;
  
  return {
    score: Math.round(requiredScore + highYieldScore),
    missingRequired,
    missingHighYield,
  };
}

async function runAudit(systemFilter?: string): Promise<void> {
  console.log('\n📊 Running Content Audit...\n');
  
  const whereClause: Record<string, string> = {};
  if (systemFilter) whereClause.system = systemFilter;
  
  const allContent = await prisma.medicalContent.findMany({
    where: whereClause,
    select: {
      id: true,
      conditionId: true,
      condition: true,
      system: true,
      subcategory: true,
      pance_yield: true,
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
      classic_triad: true,
      pathophysiology: true,
      etiology: true,
      epidemiology: true,
      physicalExam: true,
      riskFactors: true,
      complications: true,
      prognosis: true,
      differentialDiagnosis: true,
      content: true,
    },
  });
  
  console.log(`Total conditions: ${allContent.length}`);
  
  // Field stats
  const fieldStats: Record<string, { filled: number; missing: number }> = {};
  for (const field of ALL_ENRICHABLE_FIELDS) {
    fieldStats[field] = { filled: 0, missing: 0 };
  }
  
  let fullyComplete = 0;
  let criticalMissing = 0;
  const priorityConditions: { condition: string; system: string; score: number; pance_yield: number | null; missingCount: number }[] = [];
  
  for (const item of allContent) {
    const { score, missingRequired, missingHighYield } = calculateCompleteness(item as unknown as Record<string, unknown>);
    
    // Update field stats
    for (const field of ALL_ENRICHABLE_FIELDS) {
      if (!isFieldEmpty((item as Record<string, unknown>)[field])) {
        fieldStats[field].filled++;
      } else {
        fieldStats[field].missing++;
      }
    }
    
    if (score === 100) {
      fullyComplete++;
    } else {
      if (missingRequired.length > 0) criticalMissing++;
      
      priorityConditions.push({
        condition: item.condition,
        system: item.system,
        score,
        pance_yield: item.pance_yield,
        missingCount: missingRequired.length + missingHighYield.length,
      });
    }
  }
  
  // Sort by priority (high yield + most missing)
  priorityConditions.sort((a, b) => {
    const yieldDiff = (b.pance_yield ?? 0) - (a.pance_yield ?? 0);
    if (yieldDiff !== 0) return yieldDiff;
    return a.score - b.score;
  });
  
  console.log('\n📈 Summary:');
  console.log(`  ✅ Fully complete: ${fullyComplete} (${Math.round(fullyComplete/allContent.length*100)}%)`);
  console.log(`  ⚠️  Critical (missing required): ${criticalMissing}`);
  console.log(`  📝 Needs enrichment: ${priorityConditions.length}`);
  
  console.log('\n📊 Field Completeness:');
  for (const [field, stats] of Object.entries(fieldStats)) {
    const pct = Math.round((stats.filled / allContent.length) * 100);
    const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
    console.log(`  ${field.padEnd(25)} ${bar} ${pct}%`);
  }
  
  console.log('\n🎯 Top 20 Priority Conditions:');
  for (const item of priorityConditions.slice(0, 20)) {
    const yieldLabel = item.pance_yield ? `[Yield ${item.pance_yield}]` : '';
    console.log(`  • ${item.condition} (${item.system}) - ${item.score}% complete, ${item.missingCount} missing ${yieldLabel}`);
  }
}

async function enrichCondition(
  conditionId: string,
  genAI: GoogleGenerativeAI,
  stats: EnrichmentStats
): Promise<boolean> {
  try {
    const content = await prisma.medicalContent.findUnique({
      where: { conditionId },
    });
    
    if (!content) {
      console.error(`  ❌ Condition not found: ${conditionId}`);
      stats.errors++;
      return false;
    }
    
    const contentObj = content as unknown as Record<string, unknown>;
    const missingFields = ALL_ENRICHABLE_FIELDS.filter(f => isFieldEmpty(contentObj[f]));
    
    if (missingFields.length === 0) {
      console.log(`  ✅ ${content.condition} - Already complete`);
      return true;
    }
    
    console.log(`  🔄 ${content.condition} - Enriching ${missingFields.length} fields...`);
    
    // Build prompt
    const prompt = buildEnrichmentPrompt(content, missingFields as string[]);
    
    // Call Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // Parse response
    let parsed: { fields: Record<string, unknown>; display_priority: DisplayPriority };
    try {
      const cleaned = text.replace(/```json\n?|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error(`  ❌ Failed to parse AI response for ${content.condition}`);
      stats.errors++;
      return false;
    }
    
    // Prepare update
    const updateData: Record<string, unknown> = {};
    let fieldsUpdated = 0;
    
    for (const field of missingFields) {
      const value = parsed.fields?.[field];
      if (value !== undefined) {
        updateData[field] = value;
        fieldsUpdated++;
      }
    }
    
    // Store display priority
    if (parsed.display_priority) {
      const existingContent = (content.content as Record<string, unknown>) || {};
      updateData.content = {
        ...existingContent,
        display_priority: parsed.display_priority,
      };
    }
    
    // Update database
    if (Object.keys(updateData).length > 0) {
      await prisma.medicalContent.update({
        where: { conditionId },
        data: {
          ...updateData,
          updatedAt: new Date(),
        },
      });
      
      stats.fieldsUpdated += fieldsUpdated;
      stats.success++;
      console.log(`  ✅ ${content.condition} - Updated ${fieldsUpdated} fields`);
    }
    
    return true;
  } catch (error) {
    console.error(`  ❌ Error enriching ${conditionId}:`, error instanceof Error ? error.message : error);
    stats.errors++;
    return false;
  }
}

function buildEnrichmentPrompt(
  content: { condition: string; system: string; subcategory: string; [key: string]: unknown },
  missingFields: string[]
): string {
  return `You are a PANCE exam content expert. Your task is to fill in missing fields for a medical condition in our study database.

CONDITION: ${content.condition}
SYSTEM: ${content.system}
SUBCATEGORY: ${content.subcategory}

EXISTING CONTENT (for context):
${Object.entries(content)
  .filter(([k, v]) => v && !isFieldEmpty(v) && !['id', 'conditionId', 'createdAt', 'updatedAt'].includes(k))
  .slice(0, 8)
  .map(([k, v]) => `- ${k}: ${typeof v === 'string' ? v.substring(0, 150) : JSON.stringify(v).substring(0, 150)}`)
  .join('\n')}

FIELDS TO GENERATE:
${missingFields.map(f => `- ${f}`).join('\n')}

INSTRUCTIONS:
1. For each missing field, provide PANCE-focused, high-yield content
2. If a field does NOT apply to this condition, respond with "N/A - [brief reason]"
3. Be concise but comprehensive - focus on board-testable facts
4. For buzzwords, provide 3-5 pathognomonic terms as an array
5. For clinical_pearls, provide 2-3 high-yield pearls as an array
6. For classic_triad, only include if the condition has a well-known triad (otherwise N/A)

ALSO DETERMINE DISPLAY PRIORITY:
- "classic_triad" - If condition has a pathognomonic triad
- "buzzwords" - If best recognized by specific buzzwords
- "classic_patient" - If patient demographics are key
- "gold_standard_dx" - If the diagnostic test is defining
- "mnemonic" - If a mnemonic is the best way to remember

Return a JSON object:
{
  "fields": {
    "overview": "...",
    // ... other requested fields
  },
  "display_priority": {
    "primary": "buzzwords",
    "secondary": "classic_patient",
    "tertiary": "gold_standard_dx",
    "reasoning": "Brief explanation"
  }
}

Return ONLY valid JSON, no markdown code blocks.`;
}

async function runEnrichment(options: {
  limit: number;
  systemFilter?: string;
  conditionFilter?: string;
}): Promise<void> {
  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY environment variable is required');
    process.exit(1);
  }
  
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  
  console.log('\n🚀 Starting Content Enrichment...\n');
  
  // Get conditions to enrich
  const whereClause: Record<string, unknown> = {};
  if (options.systemFilter) whereClause.system = options.systemFilter;
  if (options.conditionFilter) {
    whereClause.condition = { contains: options.conditionFilter, mode: 'insensitive' };
  }
  
  const allContent = await prisma.medicalContent.findMany({
    where: whereClause,
    orderBy: [
      { pance_yield: 'desc' },
      { condition: 'asc' },
    ],
  });
  
  // Filter to incomplete conditions
  const incompleteConditions = allContent.filter(item => {
    const { score } = calculateCompleteness(item as unknown as Record<string, unknown>);
    return score < 100;
  });
  
  // Sort by priority
  incompleteConditions.sort((a, b) => {
    const aAnalysis = calculateCompleteness(a as unknown as Record<string, unknown>);
    const bAnalysis = calculateCompleteness(b as unknown as Record<string, unknown>);
    
    // Prioritize high-yield conditions
    const yieldDiff = (b.pance_yield ?? 0) - (a.pance_yield ?? 0);
    if (yieldDiff !== 0) return yieldDiff;
    
    // Then by completeness (least complete first)
    return aAnalysis.score - bAnalysis.score;
  });
  
  const toProcess = incompleteConditions.slice(0, options.limit);
  
  console.log(`Found ${incompleteConditions.length} incomplete conditions`);
  console.log(`Processing top ${toProcess.length} by priority\n`);
  
  const stats: EnrichmentStats = {
    total: toProcess.length,
    processed: 0,
    success: 0,
    errors: 0,
    fieldsUpdated: 0,
  };
  
  for (const item of toProcess) {
    stats.processed++;
    console.log(`[${stats.processed}/${stats.total}]`);
    
    await enrichCondition(item.conditionId, genAI, stats);
    
    // Rate limiting
    if (stats.processed < stats.total) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CALLS_MS));
    }
  }
  
  console.log('\n📊 Enrichment Complete:');
  console.log(`  Total processed: ${stats.processed}`);
  console.log(`  Successful: ${stats.success}`);
  console.log(`  Errors: ${stats.errors}`);
  console.log(`  Fields updated: ${stats.fieldsUpdated}`);
}

// CLI Entry Point
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  const hasAudit = args.includes('--audit');
  const hasEnrich = args.includes('--enrich');
  const systemIdx = args.indexOf('--system');
  const systemFilter = systemIdx !== -1 ? args[systemIdx + 1] : undefined;
  const conditionIdx = args.indexOf('--condition');
  const conditionFilter = conditionIdx !== -1 ? args[conditionIdx + 1] : undefined;
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : 10;
  
  if (!hasAudit && !hasEnrich) {
    console.log(`
Content Enrichment CLI

Usage:
  npx ts-node scripts/content-enrichment.ts --audit
  npx ts-node scripts/content-enrichment.ts --enrich [--limit N] [--system System] [--condition "Name"]

Options:
  --audit           Run content completeness audit
  --enrich          Enrich incomplete conditions using AI
  --limit N         Number of conditions to enrich (default: 10)
  --system System   Filter by organ system (e.g., Cardiovascular)
  --condition Name  Filter by condition name (partial match)
    `);
    process.exit(0);
  }
  
  try {
    if (hasAudit) {
      await runAudit(systemFilter);
    }
    
    if (hasEnrich) {
      await runEnrichment({ limit, systemFilter, conditionFilter });
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
