#!/usr/bin/env npx tsx
/**
 * Content Enrichment CLI Script
 *
 * Batch enriches MedicalContent entries using the AI enrichment API
 *
 * Usage:
 *   npx tsx scripts/content-enrichment.ts --audit          # Run audit only
 *   npx tsx scripts/content-enrichment.ts --enrich         # Enrich top 10 priority
 *   npx tsx scripts/content-enrichment.ts --enrich --limit 50  # Enrich top 50
 *   npx tsx scripts/content-enrichment.ts --enrich --system Cardiovascular
 *   npx tsx scripts/content-enrichment.ts --condition "Acute MI"
 */

import { prisma, disconnectPrisma } from './helpers/prisma-client';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Config
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const DELAY_BETWEEN_CALLS_MS = 1500; // Rate limit protection

// All MedicalContent fields organized by priority
const REQUIRED_FIELDS = ['overview', 'symptoms', 'treatment', 'diagnostics'] as const;

const HIGH_YIELD_FIELDS = [
  'gold_standard_dx',
  'first_line_rx',
  'buzzwords',
  'classic_patient',
  'clinical_pearls',
  'best_initial_test',
  'classic_triad',
  'pathophysiology',
] as const;

const CLINICAL_FIELDS = [
  'etiology',
  'epidemiology',
  'physicalExam',
  'riskFactors',
  'complications',
  'prognosis',
  'differentialDiagnosis',
] as const;

const ADDITIONAL_FIELDS = [
  'mnemonic',
  'patient_education',
  'prevention',
  'guidelines',
  'disposition',
  'gender_bias',
] as const;

const ALL_ENRICHABLE_FIELDS = [
  ...REQUIRED_FIELDS,
  ...HIGH_YIELD_FIELDS,
  ...CLINICAL_FIELDS,
  ...ADDITIONAL_FIELDS,
];

// Adequacy standards - minimum requirements for each field type
const ADEQUACY_STANDARDS: Record<string, { minChars?: number; minItems?: number; type: string }> = {
  // Core narrative fields - need substance
  overview: { minChars: 150, type: 'text' },
  pathophysiology: { minChars: 100, type: 'text' },
  treatment: { minChars: 80, type: 'text' },
  diagnostics: { minChars: 80, type: 'text' },
  symptoms: { minChars: 50, type: 'text' },
  // Clinical fields
  etiology: { minChars: 50, type: 'text' },
  epidemiology: { minChars: 50, type: 'text' },
  physicalExam: { minChars: 50, type: 'text' },
  riskFactors: { minChars: 30, type: 'text' },
  complications: { minChars: 30, type: 'text' },
  prognosis: { minChars: 30, type: 'text' },
  differentialDiagnosis: { minChars: 30, type: 'text' },
  // Quick reference fields - concise
  gold_standard_dx: { minChars: 5, type: 'short' },
  first_line_rx: { minChars: 5, type: 'short' },
  best_initial_test: { minChars: 5, type: 'short' },
  classic_patient: { minChars: 20, type: 'short' },
  mnemonic: { minChars: 3, type: 'short' },
  patient_education: { minChars: 20, type: 'text' },
  prevention: { minChars: 20, type: 'text' },
  guidelines: { minChars: 10, type: 'text' },
  disposition: { minChars: 10, type: 'short' },
  gender_bias: { minChars: 3, type: 'short' },
  // Array fields
  buzzwords: { minItems: 2, type: 'array' },
  clinical_pearls: { minItems: 2, type: 'json' },
  classic_triad: { minItems: 1, type: 'json' },
};

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
    if (trimmed === 'n/a' || trimmed === 'na' || trimmed === 'none') return true;
    return false;
  }
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

// Check if a field meets adequacy standards
function isFieldAdequate(field: string, value: unknown): { adequate: boolean; reason?: string } {
  if (isFieldEmpty(value)) {
    return { adequate: false, reason: 'empty' };
  }

  const standard = ADEQUACY_STANDARDS[field];
  if (!standard) {
    return { adequate: true }; // No standard defined = adequate if not empty
  }

  // Check text/short fields for minimum length
  if (standard.type === 'text' || standard.type === 'short') {
    if (typeof value === 'string') {
      const len = value.trim().length;
      if (standard.minChars && len < standard.minChars) {
        return { adequate: false, reason: `too short (${len}/${standard.minChars} chars)` };
      }
    }
  }

  // Check array fields for minimum items
  if (standard.type === 'array') {
    if (Array.isArray(value)) {
      if (standard.minItems && value.length < standard.minItems) {
        return { adequate: false, reason: `too few items (${value.length}/${standard.minItems})` };
      }
    }
  }

  // Check JSON fields
  if (standard.type === 'json') {
    if (Array.isArray(value)) {
      if (standard.minItems && value.length < standard.minItems) {
        return { adequate: false, reason: `too few items (${value.length}/${standard.minItems})` };
      }
    } else if (typeof value === 'object' && value !== null) {
      const keys = Object.keys(value);
      if (standard.minItems && keys.length < standard.minItems) {
        return { adequate: false, reason: `too few entries (${keys.length}/${standard.minItems})` };
      }
    }
  }

  return { adequate: true };
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
      // Clinical fields
      etiology: true,
      epidemiology: true,
      physicalExam: true,
      riskFactors: true,
      complications: true,
      prognosis: true,
      differentialDiagnosis: true,
      // Additional fields
      mnemonic: true,
      patient_education: true,
      prevention: true,
      guidelines: true,
      disposition: true,
      gender_bias: true,
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
  const priorityConditions: {
    condition: string;
    system: string;
    score: number;
    pance_yield: number | null;
    missingCount: number;
  }[] = [];

  for (const item of allContent) {
    const { score, missingRequired, missingHighYield } = calculateCompleteness(
      item as unknown as Record<string, unknown>
    );

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
  console.log(
    `  ✅ Fully complete: ${fullyComplete} (${Math.round((fullyComplete / allContent.length) * 100)}%)`
  );
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
    console.log(
      `  • ${item.condition} (${item.system}) - ${item.score}% complete, ${item.missingCount} missing ${yieldLabel}`
    );
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
    const missingFields = ALL_ENRICHABLE_FIELDS.filter((f) => isFieldEmpty(contentObj[f]));

    if (missingFields.length === 0) {
      console.log(`  ✅ ${content.condition} - Already complete`);
      return true;
    }

    console.log(`  🔄 ${content.condition} - Enriching ${missingFields.length} fields...`);

    // Build prompt
    const prompt = buildEnrichmentPrompt(content, missingFields as string[]);

    // Call Gemini 2.5 Pro for high-quality medical content generation
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
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
    console.error(
      `  ❌ Error enriching ${conditionId}:`,
      error instanceof Error ? error.message : error
    );
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
  .filter(
    ([k, v]) =>
      v && !isFieldEmpty(v) && !['id', 'conditionId', 'createdAt', 'updatedAt'].includes(k)
  )
  .slice(0, 8)
  .map(
    ([k, v]) =>
      `- ${k}: ${typeof v === 'string' ? v.substring(0, 150) : JSON.stringify(v).substring(0, 150)}`
  )
  .join('\n')}

FIELDS TO GENERATE:
${missingFields.map((f) => `- ${f}`).join('\n')}

INSTRUCTIONS:
1. For each missing field, provide PANCE-focused, high-yield content
2. If a field does NOT apply to this condition, you MUST explicitly state "Not pertinent" or "Not applicable"
3. Never leave a requested field blank - either provide meaningful content or state why it's not applicable
4. Be concise but comprehensive - focus on board-testable facts
5. For buzzwords, provide 3-5 pathognomonic terms as an array
6. For clinical_pearls, provide 2-3 high-yield pearls as an array
7. For classic_triad, only include if the condition has a well-known triad (otherwise state "Not applicable")

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
    orderBy: [{ pance_yield: 'desc' }, { condition: 'asc' }],
  });

  // Filter to incomplete conditions
  const incompleteConditions = allContent.filter((item) => {
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
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_CALLS_MS));
    }
  }

  console.log('\n📊 Enrichment Complete:');
  console.log(`  Total processed: ${stats.processed}`);
  console.log(`  Successful: ${stats.success}`);
  console.log(`  Errors: ${stats.errors}`);
  console.log(`  Fields updated: ${stats.fieldsUpdated}`);
}

async function handleOrphanedConditions(): Promise<void> {
  console.log('\n🔍 Checking for orphaned Conditions (no MedicalContent)...\n');

  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY environment variable is required');
    return;
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  // Find Conditions without MedicalContent
  // Step 1: Get all conditionIds that have MedicalContent
  const existingContent = await prisma.medicalContent.findMany({
    select: { conditionId: true },
  });
  const existingConditionIds = new Set(existingContent.map((mc) => mc.conditionId));

  // Step 2: Get all Conditions and filter out those with MedicalContent
  const allConditions = await prisma.condition.findMany({
    select: {
      id: true,
      name: true,
      system: true,
    },
  });

  const orphanedConditions = allConditions.filter((c) => !existingConditionIds.has(c.id));

  console.log(`Found ${orphanedConditions.length} orphaned Conditions\n`);

  if (orphanedConditions.length === 0) {
    console.log('✅ No orphaned Conditions found');
    return;
  }

  console.log('Orphaned Conditions:');
  orphanedConditions.forEach((c) => console.log(`  • ${c.name} (${c.system})`));

  console.log('\n🚀 Creating MedicalContent for orphaned Conditions...\n');

  let created = 0;
  let errors = 0;

  for (const orphan of orphanedConditions) {
    try {
      console.log(`  🔄 Creating content for: ${orphan.name}`);

      // Infer subcategory from system (simplified mapping)
      const subcategory = orphan.system || 'General';

      // Build comprehensive prompt for creating full content
      const prompt = `You are a PANCE exam content expert. Create comprehensive medical content for this condition.

CONDITION: ${orphan.name}
SYSTEM: ${orphan.system}

Create complete content including ALL of these fields:
- overview (150+ chars): Concise definition and clinical significance
- symptoms (50+ chars): Key presenting symptoms
- treatment (80+ chars): Primary treatment approach
- diagnostics (80+ chars): Key diagnostic workup
- pathophysiology (100+ chars): Underlying disease mechanism
- gold_standard_dx: Single best diagnostic test
- first_line_rx: Primary treatment medication or approach
- best_initial_test: First test to order
- classic_patient: Typical patient presentation (demographics + presentation)
- buzzwords (array): 3-5 pathognomonic terms
- clinical_pearls (array): 2-3 high-yield facts
- etiology: Causes of the condition
- epidemiology: Population data, prevalence
- physicalExam: Key physical findings
- riskFactors: Major risk factors
- complications: Important complications
- prognosis: Expected outcomes
- differentialDiagnosis: Top differential diagnoses
- classic_triad (array or "Not applicable"): Famous triad if exists
- mnemonic: Memory aid if helpful, otherwise "Not applicable"
- patient_education: Key patient counseling points
- prevention: Prevention strategies if applicable
- guidelines: Relevant guidelines if applicable
- disposition: Admission vs discharge criteria
- gender_bias: If gender-specific, otherwise "Not applicable"

CRITICAL RULES:
1. Every field MUST have content or explicitly state "Not pertinent" / "Not applicable"
2. Never leave fields blank
3. Focus on PANCE-testable, high-yield information
4. Be concise but complete
5. Return ONLY the fields listed above - no extra metadata or display_priority objects

Return a JSON object with field names as keys matching the list above exactly.
Return ONLY valid JSON, no markdown code blocks.`;

      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      // Parse response
      let parsed: { fields?: Record<string, unknown>; [key: string]: unknown };
      try {
        const cleaned = text.replace(/```json\n?|```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error(`  ❌ Failed to parse AI response for ${orphan.name}`);
        errors++;
        continue;
      }

      // Merge top-level fields (backward compat if AI returns flat structure)
      const contentData = { ...(parsed.fields || {}), ...parsed };
      delete contentData.fields; // Remove wrapper if present

      // Remove invalid fields that aren't in the schema
      delete contentData.display_priority;
      delete contentData.reasoning;

      // Define valid MedicalContent fields
      const validFields = new Set([
        'overview',
        'symptoms',
        'treatment',
        'diagnostics',
        'pathophysiology',
        'gold_standard_dx',
        'first_line_rx',
        'best_initial_test',
        'classic_patient',
        'buzzwords',
        'clinical_pearls',
        'etiology',
        'epidemiology',
        'physicalExam',
        'riskFactors',
        'complications',
        'prognosis',
        'differentialDiagnosis',
        'classic_triad',
        'mnemonic',
        'patient_education',
        'prevention',
        'guidelines',
        'disposition',
        'gender_bias',
        'content',
        'relatedSystems',
        'age_demographic',
        'differentials',
        'image_query',
        'pance_yield',
        'synonyms',
      ]);

      // Remove any fields not in the valid set
      Object.keys(contentData).forEach((key) => {
        if (!validFields.has(key)) {
          delete contentData[key];
        }
      });

      // Ensure arrays are converted to strings where needed
      if (Array.isArray(contentData.riskFactors)) {
        contentData.riskFactors = contentData.riskFactors.join('; ');
      }

      // Log the data we're about to insert for debugging
      console.log(`  📝 Fields being inserted:`, Object.keys(contentData));

      // Create MedicalContent record
      try {
        await prisma.medicalContent.create({
          data: {
            id: `mc_${orphan.id}`,
            conditionId: orphan.id,
            system: orphan.system || 'General',
            subcategory: subcategory,
            condition: orphan.name,
            status: 'draft',
            version: 1,
            createdBy: 'system_ai_enrichment',
            updatedBy: 'system_ai_enrichment',
            createdAt: new Date(),
            ...contentData,
          } as any,
        });
      } catch (createErr: any) {
        // More detailed error message
        console.error(`  ❌ Prisma error:`, createErr.message);
        console.error(`  📊 Content data:`, JSON.stringify(contentData, null, 2));
        throw createErr;
      }

      created++;
      console.log(`  ✅ Created MedicalContent for ${orphan.name}`);

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_CALLS_MS));
    } catch (error) {
      console.error(
        `  ❌ Error creating content for ${orphan.name}:`,
        error instanceof Error ? error.message : error
      );
      errors++;
    }
  }

  console.log(`\n📊 Orphan Handling Complete:`);
  console.log(`  Created: ${created}`);
  console.log(`  Errors: ${errors}`);
}

// CLI Entry Point
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const hasAudit = args.includes('--audit');
  const hasEnrich = args.includes('--enrich');
  const hasOrphans = args.includes('--orphans');
  const systemIdx = args.indexOf('--system');
  const systemFilter = systemIdx !== -1 ? args[systemIdx + 1] : undefined;
  const conditionIdx = args.indexOf('--condition');
  const conditionFilter = conditionIdx !== -1 ? args[conditionIdx + 1] : undefined;
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : 10;

  if (!hasAudit && !hasEnrich && !hasOrphans) {
    console.log(`
Content Enrichment CLI

Usage:
  npx tsx scripts/content-enrichment.ts --audit
  npx tsx scripts/content-enrichment.ts --enrich [--limit N] [--system System] [--condition "Name"]
  npx tsx scripts/content-enrichment.ts --orphans

Options:
  --audit           Run content completeness audit
  --enrich          Enrich incomplete conditions using AI
  --orphans         Create MedicalContent for Conditions without content
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

    if (hasOrphans) {
      await handleOrphanedConditions();
    }

    if (hasEnrich) {
      await runEnrichment({ limit, systemFilter, conditionFilter });
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await disconnectPrisma();
  }
}

main();
