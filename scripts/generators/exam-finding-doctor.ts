/**
 * Exam Finding Doctor - AI-powered generator for PhysicalExamFinding table
 * Generates comprehensive physical exam findings with clinical correlations
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// High-yield physical exam findings for PANCE
const EXAM_FINDINGS = [
  // Cardiovascular
  { name: 'S3 Gallop', system: 'CV', category: 'Auscultation' },
  { name: 'S4 Gallop', system: 'CV', category: 'Auscultation' },
  { name: 'Systolic Ejection Murmur', system: 'CV', category: 'Auscultation' },
  { name: 'Pansystolic Murmur', system: 'CV', category: 'Auscultation' },
  { name: 'Pulsus Paradoxus', system: 'CV', category: 'Palpation' },
  { name: 'Jugular Venous Distension', system: 'CV', category: 'Inspection' },
  { name: 'Peripheral Edema', system: 'CV', category: 'Inspection' },
  
  // Pulmonary
  { name: 'Wheezes', system: 'PULM', category: 'Auscultation' },
  { name: 'Crackles', system: 'PULM', category: 'Auscultation' },
  { name: 'Rhonchi', system: 'PULM', category: 'Auscultation' },
  { name: 'Decreased Breath Sounds', system: 'PULM', category: 'Auscultation' },
  { name: 'Dullness to Percussion', system: 'PULM', category: 'Percussion' },
  { name: 'Egophony', system: 'PULM', category: 'Auscultation' },
  { name: 'Tactile Fremitus', system: 'PULM', category: 'Palpation' },
  
  // GI/Abdominal
  { name: 'Murphy Sign', system: 'GI', category: 'Palpation' },
  { name: 'McBurney Point Tenderness', system: 'GI', category: 'Palpation' },
  { name: 'Rovsing Sign', system: 'GI', category: 'Palpation' },
  { name: 'Rebound Tenderness', system: 'GI', category: 'Palpation' },
  { name: 'Hepatomegaly', system: 'GI', category: 'Palpation' },
  { name: 'Splenomegaly', system: 'GI', category: 'Palpation' },
  { name: 'Shifting Dullness', system: 'GI', category: 'Percussion' },
  { name: 'Fluid Wave', system: 'GI', category: 'Palpation' },
  
  // Neurological
  { name: 'Babinski Sign', system: 'NEURO', category: 'Reflex' },
  { name: 'Kernig Sign', system: 'NEURO', category: 'Maneuver' },
  { name: 'Brudzinski Sign', system: 'NEURO', category: 'Maneuver' },
  { name: 'Pronator Drift', system: 'NEURO', category: 'Motor' },
  { name: 'Romberg Test', system: 'NEURO', category: 'Coordination' },
  { name: 'Pupillary Light Reflex', system: 'NEURO', category: 'Cranial Nerve' },
  { name: 'Nystagmus', system: 'NEURO', category: 'Inspection' },
  
  // MSK
  { name: 'Anterior Drawer Test', system: 'MSK', category: 'Special Test' },
  { name: 'Lachman Test', system: 'MSK', category: 'Special Test' },
  { name: 'McMurray Test', system: 'MSK', category: 'Special Test' },
  { name: 'Phalen Test', system: 'MSK', category: 'Special Test' },
  { name: 'Tinel Sign', system: 'MSK', category: 'Special Test' },
  { name: 'Empty Can Test', system: 'MSK', category: 'Special Test' },
  { name: 'Drop Arm Test', system: 'MSK', category: 'Special Test' },
  { name: 'Straight Leg Raise', system: 'MSK', category: 'Special Test' },
  
  // HEENT
  { name: 'Papilledema', system: 'HEENT', category: 'Fundoscopy' },
  { name: 'Cotton Wool Spots', system: 'HEENT', category: 'Fundoscopy' },
  { name: 'Cherry Red Spot', system: 'HEENT', category: 'Fundoscopy' },
  { name: 'Tonsillar Exudate', system: 'HEENT', category: 'Inspection' },
  
  // Skin
  { name: 'Janeway Lesions', system: 'DERM', category: 'Inspection' },
  { name: 'Osler Nodes', system: 'DERM', category: 'Palpation' },
  { name: 'Splinter Hemorrhages', system: 'DERM', category: 'Inspection' },
  { name: 'Target Lesions', system: 'DERM', category: 'Inspection' },
];

interface ExamFindingAIResponse {
  description: string;
  clinicalSignificance: string;
  howToElicit: string;
  positiveIndicates: string[];
  differentialFor: string[];
  sensitivity: number;
  specificity: number;
  clinicalPearls: string[];
  commonMistakes: string[];
  mnemonics: string[];
}

async function generateExamFindingContent(finding: typeof EXAM_FINDINGS[0]): Promise<ExamFindingAIResponse> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  const prompt = `Generate comprehensive physical exam finding information for "${finding.name}" (${finding.category}) for PA/medical student education.

Return a JSON object with EXACTLY these fields:
{
  "description": "What this finding looks/sounds/feels like when positive (2-3 sentences)",
  "clinicalSignificance": "What a positive finding indicates pathophysiologically (2-3 sentences)",
  "howToElicit": "Step-by-step how to properly perform this exam maneuver (3-4 sentences)",
  "positiveIndicates": ["Array of 4-6 conditions where this finding is classically present"],
  "differentialFor": ["Array of 3-5 conditions to consider when finding is positive"],
  "sensitivity": 75,
  "specificity": 80,
  "clinicalPearls": ["Array of 2-3 high-yield clinical pearls"],
  "commonMistakes": ["Array of 2-3 common pitfalls to avoid"],
  "mnemonics": ["Array of 1-2 helpful memory aids if commonly used, or empty array if none"]
}

Note: For sensitivity and specificity, provide realistic estimates as numbers between 0-100.
Focus on PANCE-relevant clinical correlations.
Return ONLY valid JSON, no markdown formatting.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Failed to parse JSON for ${finding.name}`);
  }
  
  return JSON.parse(jsonMatch[0]);
}

async function seedExamFindings() {
  console.log('🩺 Exam Finding Doctor - Generating physical exam findings...\n');
  
  let created = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const finding of EXAM_FINDINGS) {
    try {
      // Check if exists
      const existing = await prisma.physicalExamFinding.findFirst({
        where: { name: finding.name }
      });
      
      if (existing) {
        console.log(`⏭️  Skipped ${finding.name} (exists)`);
        skipped++;
        continue;
      }
      
      // Generate content via AI
      console.log(`🔄 Generating content for ${finding.name}...`);
      const content = await generateExamFindingContent(finding);
      
      // Create record - matching Prisma schema field names
      await prisma.physicalExamFinding.create({
        data: {
          name: finding.name,
          system: finding.system,
          category: finding.category,
          description: content.description,
          clinicalSignificance: content.clinicalSignificance,
          howToElicit: content.howToElicit,
          positiveIndicates: content.positiveIndicates,
          differentialFor: content.differentialFor,
          sensitivity: content.sensitivity,
          specificity: content.specificity,
          clinicalPearls: content.clinicalPearls,
          commonMistakes: content.commonMistakes,
          mnemonics: content.mnemonics,
          isHighYield: true,
          panceYield: 3,
        }
      });
      
      console.log(`✓ Created ${finding.name}`);
      created++;
      
      // Rate limiting - 2 second delay between API calls
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`✗ Failed ${finding.name}:`, error);
      failed++;
    }
  }
  
  console.log('\n📊 Exam Finding Doctor Summary:');
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Failed: ${failed}`);
}

async function main() {
  try {
    await seedExamFindings();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
