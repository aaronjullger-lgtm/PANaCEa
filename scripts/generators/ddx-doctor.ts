/**
 * DDx Doctor - AI-powered generator for DifferentialDiagnosis table
 * Generates comprehensive differential diagnosis templates by presenting symptom
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// High-yield presenting symptoms for PANCE differential diagnosis
const PRESENTING_SYMPTOMS = [
  // Cardiovascular
  { symptom: 'Chest Pain', category: 'CV', isEmergency: true },
  { symptom: 'Dyspnea on Exertion', category: 'CV', isEmergency: false },
  { symptom: 'Palpitations', category: 'CV', isEmergency: false },
  { symptom: 'Syncope', category: 'CV', isEmergency: true },
  { symptom: 'Lower Extremity Edema', category: 'CV', isEmergency: false },
  
  // Pulmonary
  { symptom: 'Acute Dyspnea', category: 'PULM', isEmergency: true },
  { symptom: 'Chronic Cough', category: 'PULM', isEmergency: false },
  { symptom: 'Hemoptysis', category: 'PULM', isEmergency: true },
  { symptom: 'Wheezing', category: 'PULM', isEmergency: false },
  
  // GI
  { symptom: 'Acute Abdominal Pain', category: 'GI', isEmergency: true },
  { symptom: 'Right Upper Quadrant Pain', category: 'GI', isEmergency: false },
  { symptom: 'Right Lower Quadrant Pain', category: 'GI', isEmergency: true },
  { symptom: 'Left Lower Quadrant Pain', category: 'GI', isEmergency: false },
  { symptom: 'Epigastric Pain', category: 'GI', isEmergency: false },
  { symptom: 'Upper GI Bleeding', category: 'GI', isEmergency: true },
  { symptom: 'Lower GI Bleeding', category: 'GI', isEmergency: true },
  { symptom: 'Jaundice', category: 'GI', isEmergency: false },
  { symptom: 'Dysphagia', category: 'GI', isEmergency: false },
  { symptom: 'Chronic Diarrhea', category: 'GI', isEmergency: false },
  
  // Neurological
  { symptom: 'Headache', category: 'NEURO', isEmergency: false },
  { symptom: 'Acute Focal Weakness', category: 'NEURO', isEmergency: true },
  { symptom: 'Altered Mental Status', category: 'NEURO', isEmergency: true },
  { symptom: 'Dizziness and Vertigo', category: 'NEURO', isEmergency: false },
  { symptom: 'Seizure', category: 'NEURO', isEmergency: true },
  { symptom: 'Numbness and Tingling', category: 'NEURO', isEmergency: false },
  
  // MSK
  { symptom: 'Low Back Pain', category: 'MSK', isEmergency: false },
  { symptom: 'Shoulder Pain', category: 'MSK', isEmergency: false },
  { symptom: 'Knee Pain', category: 'MSK', isEmergency: false },
  { symptom: 'Monoarticular Joint Pain', category: 'MSK', isEmergency: false },
  { symptom: 'Polyarticular Joint Pain', category: 'MSK', isEmergency: false },
  
  // GU/Renal
  { symptom: 'Hematuria', category: 'GU', isEmergency: false },
  { symptom: 'Dysuria', category: 'GU', isEmergency: false },
  { symptom: 'Flank Pain', category: 'RENAL', isEmergency: false },
  { symptom: 'Acute Kidney Injury', category: 'RENAL', isEmergency: true },
  
  // Endocrine
  { symptom: 'Fatigue', category: 'ENDO', isEmergency: false },
  { symptom: 'Unintentional Weight Loss', category: 'ENDO', isEmergency: false },
  { symptom: 'Polyuria and Polydipsia', category: 'ENDO', isEmergency: false },
  
  // HEENT
  { symptom: 'Sore Throat', category: 'HEENT', isEmergency: false },
  { symptom: 'Red Eye', category: 'HEENT', isEmergency: false },
  { symptom: 'Acute Visual Loss', category: 'HEENT', isEmergency: true },
  { symptom: 'Hearing Loss', category: 'HEENT', isEmergency: false },
  
  // Skin
  { symptom: 'Diffuse Rash', category: 'DERM', isEmergency: false },
  { symptom: 'Concerning Skin Lesion', category: 'DERM', isEmergency: false },
  
  // Psych
  { symptom: 'Anxiety', category: 'PSYCH', isEmergency: false },
  { symptom: 'Depression', category: 'PSYCH', isEmergency: false },
  { symptom: 'Acute Psychosis', category: 'PSYCH', isEmergency: true },
];

interface DDxAIResponse {
  typicalPresentation: string;
  mustNotMiss: string[];
  mostCommon: string[];
  differentialList: string[];
  redFlags: string[];
  keyQuestions: string[];
  keyExamFindings: string[];
  initialWorkup: string[];
  workup: string;
  clinicalPearls: string[];
  mnemonics: string[];
}

async function generateDDxContent(symptom: typeof PRESENTING_SYMPTOMS[0]): Promise<DDxAIResponse> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  const prompt = `Generate a comprehensive differential diagnosis framework for "${symptom.symptom}" for PA/medical student education.

Return a JSON object with EXACTLY these fields:
{
  "typicalPresentation": "Typical patient presentation with this complaint (2-3 sentences)",
  "mustNotMiss": ["Array of 4-6 life-threatening diagnoses that MUST be ruled out - 'cannot miss' diagnoses"],
  "mostCommon": ["Array of 5-7 most common/likely diagnoses for this presentation"],
  "differentialList": ["Array of 8-12 comprehensive differential diagnoses"],
  "redFlags": ["Array of 5-7 symptoms/signs that indicate serious pathology requiring urgent workup"],
  "keyQuestions": ["Array of 5-7 most important history questions to ask"],
  "keyExamFindings": ["Array of 4-6 exam findings to specifically look for"],
  "initialWorkup": ["Array of 4-6 initial diagnostic tests to order"],
  "workup": "Step-by-step diagnostic approach (3-4 sentences)",
  "clinicalPearls": ["Array of 2-3 high-yield clinical pearls for this presentation"],
  "mnemonics": ["Array of 1-2 helpful memory aids if commonly used, or empty array if none"]
}

Emergency status: ${symptom.isEmergency ? 'YES - consider emergent causes first' : 'NO - but still rule out dangerous causes'}
Focus on PANCE-relevant differentials. Order lists by clinical importance.
Return ONLY valid JSON, no markdown formatting.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Failed to parse JSON for ${symptom.symptom}`);
  }
  
  return JSON.parse(jsonMatch[0]);
}

async function seedDifferentialDiagnoses() {
  console.log('🔍 DDx Doctor - Generating differential diagnosis frameworks...\n');
  
  let created = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const symptom of PRESENTING_SYMPTOMS) {
    try {
      // Check if exists - using presentingComplaint field
      const existing = await prisma.differentialDiagnosis.findFirst({
        where: { presentingComplaint: symptom.symptom }
      });
      
      if (existing) {
        console.log(`⏭️  Skipped ${symptom.symptom} (exists)`);
        skipped++;
        continue;
      }
      
      // Generate content via AI
      console.log(`🔄 Generating DDx for ${symptom.symptom}...`);
      const content = await generateDDxContent(symptom);
      
      // Create record - matching Prisma schema field names
      await prisma.differentialDiagnosis.create({
        data: {
          presentingComplaint: symptom.symptom,
          category: symptom.category,
          isEmergency: symptom.isEmergency,
          typicalPresentation: content.typicalPresentation,
          mustNotMiss: content.mustNotMiss,
          mostCommon: content.mostCommon,
          differentialList: content.differentialList,
          redFlags: content.redFlags,
          keyQuestions: content.keyQuestions,
          keyExamFindings: content.keyExamFindings,
          initialWorkup: content.initialWorkup,
          workup: content.workup,
          clinicalPearls: content.clinicalPearls,
          mnemonics: content.mnemonics,
          isHighYield: true,
          panceYield: 3,
        }
      });
      
      console.log(`✓ Created DDx for ${symptom.symptom}`);
      created++;
      
      // Rate limiting - 2 second delay between API calls
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`✗ Failed ${symptom.symptom}:`, error);
      failed++;
    }
  }
  
  console.log('\n📊 DDx Doctor Summary:');
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Failed: ${failed}`);
}

async function main() {
  try {
    await seedDifferentialDiagnoses();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
