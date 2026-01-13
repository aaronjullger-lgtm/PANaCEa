/**
 * Enrich Critical Conditions Script
 * 
 * Populates the 62 critical stub conditions (15/100 score) with AI-generated content.
 * Uses Gemini API to generate clinically accurate required fields:
 * - overview
 * - symptoms
 * - treatment
 * - diagnostics
 */

import { prisma, disconnectPrisma } from '../helpers/prisma-client.js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface CriticalCondition {
  id: string;
  conditionId: string;
  condition: string;
  system: string;
  subcategory: string;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';

const BATCH_SIZE = 5; // Process 5 conditions at a time
const DELAY_MS = 2000; // 2 second delay between batches

async function generateContentForCondition(
  condition: string,
  system: string,
  subcategory: string
): Promise<{
  overview: string;
  symptoms: string;
  treatment: string;
  diagnostics: string;
}> {
  const prompt = `You are a PANCE exam content expert. Generate comprehensive, board-exam-level medical content for this condition.

CONDITION: ${condition}
SYSTEM: ${system}
SUBCATEGORY: ${subcategory}

Generate a JSON object with these fields:
{
  "overview": "2-3 paragraph comprehensive overview including definition, pathophysiology mechanism (be specific about antibodies, receptors, cellular processes), and clinical significance. Use markdown bold (**term**) for key concepts. Example: 'Myasthenia Gravis (MG) is a chronic **autoimmune** disorder characterized by an antibody-mediated attack on the **neuromuscular junction (NMJ)**...'",
  "symptoms": "Markdown bullet list of 5-8 key clinical symptoms and presentations. Include characteristic patterns (e.g., '- Fluctuating muscle weakness that worsens with activity and improves with rest')",
  "diagnostics": "Detailed diagnostic workup as markdown text. Include: 1) Best initial test, 2) Gold standard diagnostic test, 3) Additional confirmatory tests, 4) Lab findings, 5) Imaging findings. Format as: 'Test Name: Specific finding or purpose (e.g., Edrophonium test: Rapid improvement in muscle strength confirms diagnosis)'",
  "treatment": "2-3 paragraphs covering: 1) First-line treatment approach with specific medications/doses, 2) Alternative therapies and second-line options, 3) Special considerations including monitoring parameters, potential complications, referral indications, and contraindications. Use clinical language appropriate for PANCE exam"
}

IMPORTANT:
- Content should be PANCE-exam focused and high-yield
- Overview MUST be substantive with specific mechanisms - NO generic placeholder text
- Include testable facts and classic presentations
- Be detailed and comprehensive - this is for PA students studying for boards
- Use proper medical terminology and markdown formatting
- Return ONLY valid JSON - do not wrap in markdown code blocks (no \`\`\`json)
- Ensure the JSON is complete and properly closed`;

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3, // Lower temperature for more consistent medical content
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096, // Increased for longer comprehensive content
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('No content generated from Gemini API');
  }

  // Extract JSON from markdown code blocks if present
  let jsonText = text.trim();
  
  // Remove markdown code blocks (both ```json and ```)
  jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  
  // If still has code blocks in the middle, try to extract the JSON object
  const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonText = jsonMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonText);
    
    // Validate structure
    if (!parsed.overview || !parsed.symptoms || !parsed.treatment || !parsed.diagnostics) {
      throw new Error('Invalid content structure - missing required fields');
    }

    // Convert markdown bullet lists to single string if needed
    let symptoms = parsed.symptoms;
    if (Array.isArray(symptoms)) {
      // Join array items into a single markdown string
      symptoms = symptoms.join('\n');
    } else if (typeof symptoms === 'string') {
      // Already a string, ensure it's formatted properly
      symptoms = symptoms.trim();
    }

    // Ensure diagnostics is a string (not array)
    let diagnostics = parsed.diagnostics;
    if (Array.isArray(diagnostics)) {
      diagnostics = diagnostics.join('\n');
    }

    return {
      overview: parsed.overview,
      symptoms: symptoms,
      treatment: parsed.treatment,
      diagnostics: diagnostics,
    };
  } catch (parseError) {
    console.error('Failed to parse Gemini response:', jsonText.substring(0, 500));
    throw new Error(`JSON parse error: ${parseError}`);
  }
}

async function getCriticalConditions(): Promise<CriticalCondition[]> {
  const conditions = await prisma.medicalContent.findMany({
    select: {
      id: true,
      conditionId: true,
      condition: true,
      system: true,
      subcategory: true,
      symptoms: true,
      treatment: true,
      diagnostics: true,
      overview: true,
    },
  });

  // Filter to those missing at least 3 of the 4 required fields
  const critical = conditions.filter(c => {
    let missingCount = 0;
    
    if (!c.symptoms || (Array.isArray(c.symptoms) && c.symptoms.length === 0)) missingCount++;
    if (!c.treatment || c.treatment === '') missingCount++;
    if (!c.diagnostics || (Array.isArray(c.diagnostics) && c.diagnostics.length === 0)) missingCount++;
    if (!c.overview || c.overview === '') missingCount++;
    
    return missingCount >= 3;
  });

  return critical.map(c => ({
    id: c.id,
    conditionId: c.conditionId,
    condition: c.condition,
    system: c.system,
    subcategory: c.subcategory,
  }));
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function enrichConditions(
  conditions: CriticalCondition[],
  dryRun: boolean = false
): Promise<void> {
  const logFile = join(process.cwd(), 'enrichment-log.json');
  const results: any[] = [];
  
  let successCount = 0;
  let errorCount = 0;

  console.log(`🚀 Starting enrichment for ${conditions.length} conditions...\n`);

  for (let i = 0; i < conditions.length; i += BATCH_SIZE) {
    const batch = conditions.slice(i, i + BATCH_SIZE);
    console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(conditions.length / BATCH_SIZE)}...`);

    for (const condition of batch) {
      try {
        console.log(`  ⏳ Generating content for: ${condition.condition}`);
        
        const content = await generateContentForCondition(
          condition.condition,
          condition.system,
          condition.subcategory
        );

        if (dryRun) {
          console.log(`  ✅ DRY RUN - Would update ${condition.condition}`);
          console.log(`     Overview: ${content.overview.substring(0, 100)}...`);
          console.log(`     Symptoms: ${content.symptoms.split('\n').length} items`);
          console.log(`     Diagnostics: ${typeof content.diagnostics === 'string' ? 'text content' : 'unknown format'}`);
        } else {
          await prisma.medicalContent.update({
            where: { id: condition.id },
            data: {
              overview: content.overview,
              symptoms: content.symptoms,
              treatment: content.treatment,
              diagnostics: content.diagnostics,
              updatedAt: new Date(),
            },
          });
          console.log(`  ✅ Updated ${condition.condition}`);
        }

        results.push({
          condition: condition.condition,
          status: 'success',
          content,
        });

        successCount++;
      } catch (error: any) {
        console.error(`  ❌ Error for ${condition.condition}: ${error.message}`);
        results.push({
          condition: condition.condition,
          status: 'error',
          error: error.message,
        });
        errorCount++;
      }
    }

    // Delay between batches to respect API rate limits
    if (i + BATCH_SIZE < conditions.length) {
      console.log(`  ⏸️  Waiting ${DELAY_MS / 1000}s before next batch...\n`);
      await delay(DELAY_MS);
    }
  }

  // Save results log
  writeFileSync(logFile, JSON.stringify(results, null, 2));
  console.log(`\n📄 Enrichment log saved to: ${logFile}`);

  console.log('\n' + '='.repeat(80));
  console.log('📊 ENRICHMENT SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total conditions:        ${conditions.length}`);
  console.log(`Successfully enriched:   ${successCount} ✅`);
  console.log(`Errors:                  ${errorCount} ❌`);
  console.log(`Success rate:            ${Math.round((successCount / conditions.length) * 100)}%`);
  
  if (dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No database changes were made');
    console.log('Run without --dry-run to apply changes');
  } else {
    console.log('\n✅ Database updated successfully');
  }
  
  console.log('='.repeat(80) + '\n');
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limit = args.find(arg => arg.startsWith('--limit='))?.split('=')[1];
  
  if (!GEMINI_API_KEY) {
    console.error('❌ Error: GEMINI_API_KEY environment variable not set');
    console.error('   Set it with: export GEMINI_API_KEY=your-api-key');
    process.exit(1);
  }

  console.log('🏥 PANaCEa Database: Critical Condition Enrichment\n');
  
  if (dryRun) {
    console.log('⚠️  Running in DRY RUN mode - no changes will be saved\n');
  }

  const allCritical = await getCriticalConditions();
  console.log(`Found ${allCritical.length} critical conditions (missing all required fields)\n`);

  const conditions = limit 
    ? allCritical.slice(0, parseInt(limit, 10))
    : allCritical;

  if (limit) {
    console.log(`⚠️  Limited to first ${limit} conditions\n`);
  }

  if (conditions.length === 0) {
    console.log('✅ No critical conditions found - database is complete!');
    return;
  }

  await enrichConditions(conditions, dryRun);
}

main()
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectPrisma();
  });
