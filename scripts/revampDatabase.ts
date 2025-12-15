import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { CONDITION_REGISTRY, buildConditionDefinition } from '../conditionRegistry';

const prisma = new PrismaClient();

const JSON_PATH = path.join(process.cwd(), 'data', 'conditionContent.clean.json');

// Helper to flatten complex arrays into string arrays
function flattenToStringArray(input: any): string[] {
  if (!input) return [];
  if (typeof input === 'string') return [input];
  if (Array.isArray(input)) {
    return input.map(item => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        // Handle specific object shapes found in the JSON
        if (item.item) return item.item;
        if (item.buzzword) return `${item.buzzword}${item.explanation ? ': ' + item.explanation : ''}`;
        if (item.complication) return `${item.complication}${item.explanation ? ': ' + item.explanation : ''}`;
        if (item.concept) return `${item.concept}${item.explanation ? ': ' + item.explanation : ''}`;
        
        // Fallback: try to extract values or stringify
        const values = Object.values(item).filter(v => typeof v === 'string');
        if (values.length > 0) return values.join(': ');
        
        return JSON.stringify(item);
      }
      return String(item);
    });
  }
  return [];
}

// Helper to flatten complex content (arrays of objects) into a single text block (Markdown)
function flattenToText(input: any): string | null {
  if (!input) return null;
  if (typeof input === 'string') return input;
  if (Array.isArray(input)) {
    return input.map(item => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        // Handle { item: "...", explanation: "..." } or { concept: "...", explanation: "..." }
        const title = item.item || item.concept || '';
        const explanation = item.explanation || '';
        
        // Clean up title if it already has markdown formatting like * **Title**
        const cleanTitle = title.replace(/^ \*\*(.*?)\*\*$/, '$1').replace(/^\*\*(.*?)\*\*$/, '$1');
        
        if (cleanTitle && explanation) {
          return `**${cleanTitle}**
${explanation}`;
        }
        if (title) return title;
        if (explanation) return explanation;
        return JSON.stringify(item);
      }
      return String(item);
    }).join('\n\n');
  }
  return String(input);
}

async function main() {
  console.log('🚀 Starting database revamp...');

  // 1. Read and parse the JSON file
  console.log('📖 Reading conditionContent.clean.json...');
  if (!fs.existsSync(JSON_PATH)) {
    console.error(`❌ File not found: ${JSON_PATH}. Please run normalizeContent.ts first.`);
    process.exit(1);
  }
  const rawContent = fs.readFileSync(JSON_PATH, 'utf-8');
  const contentData = JSON.parse(rawContent);
  
  // Create a map for faster lookup
  const contentMap = new Map(contentData.map((item: any) => [item.conditionId, item]));

  // 2. Clear existing data
  console.log('🗑️  Clearing existing data...');
  // Delete MedicalContent first due to foreign key constraints if any (though schema shows loose relation)
  await prisma.medicalContent.deleteMany({});
  await prisma.condition.deleteMany({});
  console.log('✅ Data cleared.');

  // 3. Iterate through Registry and populate DB
  console.log('🔄 Processing registry and populating database...');
  
  let createdConditions = 0;
  let createdContent = 0;
  let missingContent = 0;

  // Store normalized items for saving to file
  const normalizedItems: any[] = [];
  const processedIds = new Set<string>();

  for (const meta of CONDITION_REGISTRY) {
    const definition = buildConditionDefinition(meta);
    const conditionId = definition.id;

    if (processedIds.has(conditionId)) {
      // console.warn(`⚠️  Skipping duplicate condition ID: ${conditionId}`);
      continue;
    }
    processedIds.add(conditionId);

    // Create Condition
    try {
      await prisma.condition.upsert({
        where: { id: conditionId },
        update: {
          name: meta.condition,
          system: meta.system,
          aliases: meta.aliases || [],
        },
        create: {
          id: conditionId,
          name: meta.condition,
          system: meta.system,
          aliases: meta.aliases || [],
        },
      });
      createdConditions++;
    } catch (e) {
      console.error(`❌ Failed to create condition ${meta.condition} (${conditionId}):`, e);
    }

    // Find and Normalize Content
    const jsonItem = contentMap.get(conditionId);
    
    if (jsonItem && jsonItem.content) {
      // Content is already normalized by normalizeContent.ts
      const normalizedContent = jsonItem.content;

      // Create MedicalContent
      try {
        await prisma.medicalContent.upsert({
          where: { conditionId: conditionId },
          update: {
            system: meta.system,
            subcategory: meta.subcategory,
            condition: meta.condition,
            
            // Exploded content columns
            overview: normalizedContent.overview || null,
            etiology: flattenToText(normalizedContent.etiology),
            pathophysiology: flattenToText(normalizedContent.pathophysiology),
            epidemiology: flattenToText(normalizedContent.epidemiology),
            symptoms: flattenToStringArray(normalizedContent.symptoms),
            physicalExam: flattenToStringArray(normalizedContent.physical_exam),
            diagnostics: normalizedContent.diagnostics || null,
            treatment: normalizedContent.treatment || null,
            prognosis: flattenToText(normalizedContent.prognosis),
            differentialDiagnosis: flattenToStringArray(normalizedContent.differential_diagnosis),
            riskFactors: flattenToStringArray(normalizedContent.risk_factors),
            complications: flattenToStringArray(normalizedContent.complications),
            buzzwords: flattenToStringArray(normalizedContent.buzzwords),

            status: 'published',
            version: 1,
            updatedBy: 'system_revamp'
          },
          create: {
            conditionId: conditionId,
            system: meta.system,
            subcategory: meta.subcategory,
            condition: meta.condition,
            
            // Exploded content columns
            overview: normalizedContent.overview || null,
            etiology: flattenToText(normalizedContent.etiology),
            pathophysiology: flattenToText(normalizedContent.pathophysiology),
            epidemiology: flattenToText(normalizedContent.epidemiology),
            symptoms: flattenToStringArray(normalizedContent.symptoms),
            physicalExam: flattenToStringArray(normalizedContent.physical_exam),
            diagnostics: normalizedContent.diagnostics || null,
            treatment: normalizedContent.treatment || null,
            prognosis: flattenToText(normalizedContent.prognosis),
            differentialDiagnosis: flattenToStringArray(normalizedContent.differential_diagnosis),
            riskFactors: flattenToStringArray(normalizedContent.risk_factors),
            complications: flattenToStringArray(normalizedContent.complications),
            buzzwords: flattenToStringArray(normalizedContent.buzzwords),

            status: 'published', // Default to published for this revamp
            version: 1,
            createdBy: 'system_revamp',
            updatedBy: 'system_revamp'
          },
        });
        createdContent++;
      } catch (e) {
        console.error(`❌ Failed to create content for ${meta.condition} (${conditionId}):`, e);
      }
    } else {
      missingContent++;
      // console.warn(`⚠️  No content found for ${meta.condition} (${conditionId})`);
    }
  }

  console.log('🎉 Revamp complete!');
  console.log(`   Conditions created: ${createdConditions}`);
  console.log(`   Content records created: ${createdContent}`);
  console.log(`   Missing content: ${missingContent}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
