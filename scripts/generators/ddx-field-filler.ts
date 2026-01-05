/**
 * DDx Field Filler - Fills missing fields in DifferentialDiagnosis table
 * Uses Gemini AI to generate mnemonics, differentials, PE findings, and related conditions
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface DDxContent {
  mnemonic: string;
  differentials: Array<{
    diagnosis: string;
    likelihood: 'common' | 'uncommon' | 'rare';
    mustNotMiss: boolean;
    keyFeatures: string[];
  }>;
  physicalExamFindings: Record<string, string[]>;
  relatedConditions: string[];
}

const PROMPT_TEMPLATE = `You are an emergency medicine expert creating educational content for PA students.

For the presenting complaint "${'{COMPLAINT}'}" (Category: ${'{CATEGORY}'}), generate comprehensive differential diagnosis content.

Existing data we have:
- Most Dangerous: {MOST_DANGEROUS}
- Key Questions: {KEY_QUESTIONS}
- Often Missed: {OFTEN_MISSED}

Generate the following fields in valid JSON format:

{
  "mnemonic": "A memorable mnemonic to help remember the key differentials for this complaint (format: WORD where each letter stands for something, or a catchy phrase)",
  "differentials": [
    {
      "diagnosis": "Name of condition",
      "likelihood": "common|uncommon|rare",
      "mustNotMiss": true/false,
      "keyFeatures": ["2-3 distinguishing features"]
    }
    // Include 8-12 differentials covering common, uncommon, and must-not-miss diagnoses
  ],
  "physicalExamFindings": {
    "Vital Signs": ["Relevant vital sign abnormalities to look for"],
    "Inspection": ["What to look for on visual exam"],
    "Palpation": ["What to feel for"],
    "Auscultation": ["What to listen for if applicable"],
    "Special Tests": ["Any specific maneuvers or tests"]
  },
  "relatedConditions": ["Array of 5-8 related conditions that share similar presentations or are commonly confused with conditions in this differential"]
}

Return ONLY the JSON object, no markdown or explanations.`;

async function generateDDxContent(record: any): Promise<DDxContent | null> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
  
  const prompt = PROMPT_TEMPLATE
    .replace('{COMPLAINT}', record.presentingComplaint)
    .replace('{CATEGORY}', record.category || 'Unknown')
    .replace('{MOST_DANGEROUS}', JSON.stringify(record.mostDangerous || []))
    .replace('{KEY_QUESTIONS}', JSON.stringify(record.keyQuestions || []))
    .replace('{OFTEN_MISSED}', JSON.stringify(record.oftenMissed || []));
  
  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // Extract JSON from response
    let jsonStr = text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    
    const content = JSON.parse(jsonStr) as DDxContent;
    return content;
  } catch (error) {
    console.error(`  ❌ Error generating content: ${error}`);
    return null;
  }
}

async function fillDDxFields(): Promise<void> {
  console.log('🔍 DDx Field Filler');
  console.log('='.repeat(50));
  
  // Find records with missing fields
  const records = await prisma.differentialDiagnosis.findMany();
  
  const needsUpdate = records.filter(r => 
    !r.mnemonics?.length || 
    !(r.differentialList as any[])?.length ||
    !r.keyExamFindings?.length
  );
  
  console.log(`Found ${needsUpdate.length}/${records.length} records needing updates\n`);
  
  let updated = 0;
  let failed = 0;
  
  for (const record of needsUpdate) {
    console.log(`  🔄 Processing: ${record.presentingComplaint}...`);
    
    const content = await generateDDxContent(record);
    
    if (!content) {
      failed++;
      continue;
    }
    
    try {
      // Convert differentials to string array (just diagnosis names)
      const differentialStrings = content.differentials?.map(d => d.diagnosis) || [];
      // Convert exam findings to string array (flatten the object)
      const examFindings: string[] = [];
      if (content.physicalExamFindings) {
        for (const [category, findings] of Object.entries(content.physicalExamFindings)) {
          findings.forEach((f: string) => examFindings.push(`${category}: ${f}`));
        }
      }
      
      await prisma.differentialDiagnosis.update({
        where: { id: record.id },
        data: {
          mnemonics: content.mnemonic ? [content.mnemonic, ...(record.mnemonics || [])] : record.mnemonics,
          differentialList: differentialStrings.length > 0 ? differentialStrings : record.differentialList,
          keyExamFindings: examFindings.length > 0 ? examFindings : record.keyExamFindings,
          updatedAt: new Date()
        }
      });
      
      updated++;
      console.log(`  ✅ Updated: ${record.presentingComplaint}`);
    } catch (error) {
      console.error(`  ❌ Failed to update ${record.presentingComplaint}: ${error}`);
      failed++;
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Summary:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total DDx records: ${records.length}`);
}

async function main() {
  try {
    await fillDDxFields();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
