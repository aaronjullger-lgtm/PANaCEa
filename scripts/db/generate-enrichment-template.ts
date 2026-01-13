/**
 * Generate Enrichment Template
 * 
 * Creates a structured JSON template for the 62 critical conditions.
 * This can be:
 * 1. Manually filled in by content creators
 * 2. Processed by AI tools (ChatGPT, Claude, etc.)
 * 3. Used with Gemini API when key is renewed
 */

import { prisma, disconnectPrisma } from '../helpers/prisma-client.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface ConditionTemplate {
  id: string;
  conditionId: string;
  condition: string;
  system: string;
  subcategory: string;
  currentOverview: string | null;
  toGenerate: {
    overview: string;
    symptoms: string[];
    treatment: string;
    diagnostics: string[];
  };
}

async function generateTemplate(): Promise<void> {
  console.log('🏥 PANaCEa Database: Generating Enrichment Template\n');

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

  console.log(`Found ${critical.length} critical conditions\n`);

  const template: ConditionTemplate[] = critical.map(c => ({
    id: c.id,
    conditionId: c.conditionId,
    condition: c.condition,
    system: c.system,
    subcategory: c.subcategory,
    currentOverview: c.overview,
    toGenerate: {
      overview: c.overview || "[GENERATE: 2-3 sentence clinical overview. Focus on definition, pathophysiology basics, and clinical significance.]",
      symptoms: c.symptoms && Array.isArray(c.symptoms) && c.symptoms.length > 0 
        ? c.symptoms 
        : ["[GENERATE: 5-8 key clinical symptoms/presentations. Be specific and clinically relevant.]"],
      treatment: c.treatment || "[GENERATE: 2-3 paragraphs covering: 1) First-line treatment, 2) Alternatives, 3) Special considerations (monitoring, complications, referrals).]",
      diagnostics: c.diagnostics && Array.isArray(c.diagnostics) && c.diagnostics.length > 0
        ? c.diagnostics
        : ["[GENERATE: 5-8 diagnostic tests/findings. Include labs, imaging, physical exam. Format: 'Test Name: Finding/Purpose']"],
    },
  }));

  // Save full template
  const fullPath = join(process.cwd(), 'enrichment-template.json');
  writeFileSync(fullPath, JSON.stringify(template, null, 2));
  console.log(`✅ Full template saved to: ${fullPath}`);

  // Save simplified CSV for quick reference
  const csvLines = [
    'Condition,System,Subcategory,Has Overview,Needs Symptoms,Needs Treatment,Needs Diagnostics',
    ...template.map(t => 
      `"${t.condition}","${t.system}","${t.subcategory}",` +
      `${t.currentOverview ? 'YES' : 'NO'},` +
      `${!t.symptoms || t.symptoms.length === 0 ? 'YES' : 'NO'},` +
      `${!t.treatment ? 'YES' : 'NO'},` +
      `${!t.diagnostics || t.diagnostics.length === 0 ? 'YES' : 'NO'}`
    ),
  ];
  
  const csvPath = join(process.cwd(), 'enrichment-checklist.csv');
  writeFileSync(csvPath, csvLines.join('\n'));
  console.log(`✅ Checklist saved to: ${csvPath}`);

  // Generate AI prompt template for batch processing
  const aiPrompt = `I have ${critical.length} medical conditions that need content enrichment for a PANCE exam study platform. For each condition below, please generate:

1. overview: 2-3 sentence clinical overview (definition, pathophysiology basics, clinical significance)
2. symptoms: Array of 5-8 key clinical symptoms/presentations (specific and clinically relevant)
3. treatment: 2-3 paragraphs (first-line treatment, alternatives, special considerations)
4. diagnostics: Array of 5-8 diagnostic tests/findings (format: "Test Name: Finding/Purpose")

Return results in JSON format matching this structure:
[
  {
    "condition": "Patent Foramen Ovale",
    "content": {
      "overview": "...",
      "symptoms": [...],
      "treatment": "...",
      "diagnostics": [...]
    }
  }
]

CONDITIONS TO ENRICH:
${template.slice(0, 10).map((t, i) => `${i + 1}. ${t.condition} (${t.system} - ${t.subcategory})`).join('\n')}

[... and ${critical.length - 10} more conditions listed in enrichment-template.json]`;

  const promptPath = join(process.cwd(), 'enrichment-ai-prompt.txt');
  writeFileSync(promptPath, aiPrompt);
  console.log(`✅ AI prompt saved to: ${promptPath}`);

  console.log('\n' + '='.repeat(80));
  console.log('📋 NEXT STEPS');
  console.log('='.repeat(80));
  console.log('1. Review enrichment-checklist.csv for quick overview');
  console.log('2. Option A: Use enrichment-ai-prompt.txt with ChatGPT/Claude');
  console.log('3. Option B: Manually fill enrichment-template.json');
  console.log('4. Option C: Run npm run db:enrich after renewing Gemini API key');
  console.log('5. Apply changes with: npm run db:apply-enrichment <file>');
  console.log('='.repeat(80) + '\n');
}

async function main() {
  await generateTemplate();
}

main()
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectPrisma();
  });
