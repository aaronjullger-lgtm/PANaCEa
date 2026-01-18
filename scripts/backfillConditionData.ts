#!/usr/bin/env tsx
/**
 * Condition Data Backfill and Validation Script
 *
 * This script:
 * 1. Scans the database for empty/incomplete conditions
 * 2. Identifies missing high-yield PA school conditions
 * 3. Generates missing content using Gemini API
 * 4. Upserts data into the database
 * 5. Validates all conditions are properly organized
 * 6. Ensures proper parent-child relationships
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  CONDITION_REGISTRY,
  buildConditionDefinition,
  type ConditionMeta,
} from '../config/conditionRegistry';
import type { SystemCode } from '../types';

const prisma = new PrismaClient();
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

if (!geminiApiKey) {
  console.error('❌ GEMINI_API_KEY not found in environment variables');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

interface ConditionContentData {
  pathophysiology?: string;
  clinicalPresentation?: string;
  diagnosis?: string;
  management?: string;
  pearls?: string[];
}

/**
 * Generate content for a condition using Gemini API
 */
async function generateConditionContent(
  conditionName: string,
  system: string,
  subcategory: string
): Promise<ConditionContentData> {
  const prompt = `You are a medical educator creating study content for PA (Physician Assistant) students preparing for the PANCE exam.

Generate comprehensive, high-yield content for the following condition:
- Condition: ${conditionName}
- System: ${system}
- Category: ${subcategory}

Provide the content in the following JSON format:
{
  "pathophysiology": "Explain the underlying mechanisms and why this condition occurs (2-3 paragraphs)",
  "clinicalPresentation": "List signs and symptoms, physical exam findings (bullet points)",
  "diagnosis": "Describe diagnostic approach: labs, imaging, special tests (bullet points)",
  "management": "First-line treatment, second-line treatment, patient education (bullet points)",
  "pearls": ["High-yield fact 1", "High-yield fact 2", "High-yield fact 3"]
}

Keep it concise, clinically relevant, and focused on PANCE exam priorities.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from response (might be wrapped in markdown code blocks)
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/({[\s\S]*})/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from response');
    }

    const content = JSON.parse(jsonMatch[1]);
    return content;
  } catch (error) {
    console.error(`Failed to generate content for ${conditionName}:`, error);
    return {};
  }
}

/**
 * Check if a condition has meaningful content
 */
function hasContent(condition: any): boolean {
  if (!condition.content) return false;
  const content =
    typeof condition.content === 'string' ? JSON.parse(condition.content) : condition.content;

  const hasPathophysiology = content.pathophysiology && content.pathophysiology.length > 50;
  const hasClinical = content.clinicalPresentation && content.clinicalPresentation.length > 20;
  const hasDiagnosis = content.diagnosis && content.diagnosis.length > 20;
  const hasManagement = content.management && content.management.length > 20;

  return hasPathophysiology || (hasClinical && hasDiagnosis && hasManagement);
}

/**
 * Clean and standardize condition name
 */
function cleanConditionName(name: string): string {
  return name
    .replace(/\s*\([^)]*\)/g, '') // Remove parentheses
    .trim();
}

/**
 * Determine parent-child relationships
 */
function getParentConditionId(meta: ConditionMeta): string | null {
  const name = meta.condition.toLowerCase();

  // AKI variants should be children of main AKI
  if (name.includes('aki') && !name.includes('acute kidney injury')) {
    return buildConditionDefinition({
      system: 'RENAL',
      subcategory: 'AKI',
      condition: 'Acute Kidney Injury',
    } as ConditionMeta).id;
  }

  // PKD variants should be children of main PKD
  if (
    name.includes('polycystic kidney') &&
    (name.includes('dominant') || name.includes('recessive'))
  ) {
    return buildConditionDefinition({
      system: 'RENAL',
      subcategory: 'Congenital',
      condition: 'Polycystic Kidney Disease',
    } as ConditionMeta).id;
  }

  return null;
}

/**
 * Main backfill function
 */
async function backfillConditionData() {
  console.log('🚀 Starting condition data backfill...\n');

  // Step 1: Get all existing conditions from database
  const existingConditions = await prisma.condition.findMany({
    select: {
      id: true,
      name: true,
      system: true,
      content: true,
      displayName: true,
      aliases: true,
    },
  });

  const existingMap = new Map(existingConditions.map((c) => [c.name.toLowerCase(), c]));

  console.log(`📊 Found ${existingConditions.length} existing conditions in database`);

  // Step 2: Identify empty/incomplete conditions
  const emptyConditions = existingConditions.filter((c) => !hasContent(c));
  console.log(`⚠️  Found ${emptyConditions.length} conditions without meaningful content\n`);

  // Step 3: Process registry entries
  const registryConditions = CONDITION_REGISTRY;
  console.log(`📋 Found ${registryConditions.length} conditions in registry`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const meta of registryConditions) {
    const conditionDef = buildConditionDefinition(meta);
    const cleanName = cleanConditionName(meta.condition);
    const existing = existingMap.get(meta.condition.toLowerCase());

    // Determine parent relationship
    const parentId = getParentConditionId(meta);

    // Check if we need to create or update
    if (!existing) {
      console.log(`➕ Creating new condition: ${cleanName}`);

      // Generate content for new condition
      let content = {};
      try {
        content = await generateConditionContent(meta.condition, meta.system, meta.subcategory);

        // Add overview from registry if available
        if (meta.overview) {
          content = { overview: meta.overview, ...content };
        }

        // Add pearls from registry if available
        if (meta.keyPoints || meta.redFlags || meta.treatmentPearls) {
          content = {
            ...content,
            keyPoints: meta.keyPoints,
            redFlags: meta.redFlags,
            treatmentPearls: meta.treatmentPearls,
          };
        }
      } catch (error) {
        console.error(`  ❌ Failed to generate content:`, error);
      }

      // Create new condition
      await prisma.condition.create({
        data: {
          id: conditionDef.id,
          name: meta.condition,
          displayName: cleanName,
          system: meta.system,
          aliases: meta.aliases || [],
          parentId,
          content: content as any,
        },
      });

      created++;
    } else if (!hasContent(existing)) {
      console.log(`🔄 Updating incomplete condition: ${cleanName}`);

      // Generate content for existing but empty condition
      let content = {};
      try {
        content = await generateConditionContent(meta.condition, meta.system, meta.subcategory);

        if (meta.overview) {
          content = { overview: meta.overview, ...content };
        }

        if (meta.keyPoints || meta.redFlags || meta.treatmentPearls) {
          content = {
            ...content,
            keyPoints: meta.keyPoints,
            redFlags: meta.redFlags,
            treatmentPearls: meta.treatmentPearls,
          };
        }
      } catch (error) {
        console.error(`  ❌ Failed to generate content:`, error);
      }

      // Update existing condition
      await prisma.condition.update({
        where: { id: existing.id },
        data: {
          displayName: cleanName,
          aliases: meta.aliases || [],
          parentId,
          content: content as any,
        },
      });

      updated++;
    } else if (
      existing.displayName !== cleanName ||
      !existing.aliases ||
      existing.aliases.length === 0
    ) {
      // Update just display name and aliases if content exists
      console.log(`✏️  Updating metadata for: ${cleanName}`);

      await prisma.condition.update({
        where: { id: existing.id },
        data: {
          displayName: cleanName,
          aliases: meta.aliases || [],
          parentId,
        },
      });

      updated++;
    } else {
      skipped++;
    }

    // Rate limiting - wait between API calls
    if ((created + updated) % 5 === 0) {
      console.log(`  ⏳ Waiting 2 seconds to avoid rate limits...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.log('\n✅ Backfill complete!');
  console.log(`   📊 Summary:`);
  console.log(`      - Created: ${created}`);
  console.log(`      - Updated: ${updated}`);
  console.log(`      - Skipped: ${skipped}`);
  console.log(`      - Total processed: ${created + updated + skipped}`);
}

/**
 * Validate data integrity
 */
async function validateData() {
  console.log('\n🔍 Validating data integrity...\n');

  const allConditions = await prisma.condition.findMany({
    include: {
      Condition: true,
      other_Condition: true,
    },
  });

  let errors = 0;

  // Check for orphaned children
  for (const condition of allConditions) {
    if (condition.parentId) {
      const parent = await prisma.condition.findUnique({
        where: { id: condition.parentId },
      });

      if (!parent) {
        console.error(
          `❌ Orphaned child: ${condition.name} references non-existent parent ${condition.parentId}`
        );
        errors++;
      }
    }
  }

  // Check for missing display names
  const missingDisplayName = allConditions.filter((c) => !c.displayName);
  if (missingDisplayName.length > 0) {
    console.warn(`⚠️  ${missingDisplayName.length} conditions missing display names`);
    errors += missingDisplayName.length;
  }

  // Check content completeness
  const emptyContent = allConditions.filter((c) => !hasContent(c));
  console.log(`📊 ${emptyContent.length} conditions still need content`);

  if (errors === 0) {
    console.log('✅ Data validation passed!');
  } else {
    console.log(`⚠️  Found ${errors} validation issues`);
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    await backfillConditionData();
    await validateData();
  } catch (error) {
    console.error('❌ Error during backfill:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
