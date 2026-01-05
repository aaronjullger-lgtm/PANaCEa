/**
 * ECG Pattern Filler - Fills missing fields in ECGPattern table
 * Uses Gemini AI to generate comprehensive clinical content
 * 
 * Schema fields:
 * - displayName, rate, rhythm, pWave, prInterval, qrsComplex, qtInterval
 * - stSegment, tWave, pathognomonic, hemodynamicEffect, acuteManagement
 * - cardioversion, pacing, referral, diagnosticCriteria[], etiology[]
 * - symptoms[], associatedConditions[], medications[], mimics[]
 * - distinguishingFeatures (Json), clinicalPearls[], commonMistakes[]
 * - testQuestionTips[], mnemonics[], boardYieldFacts[]
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Token bucket rate limiter
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  constructor(private capacity: number, private refillRate: number) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }
  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
    if (this.tokens < 1) {
      const waitTime = ((1 - this.tokens) / this.refillRate) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
  }
}

const rateLimiter = new TokenBucket(5, 0.5);

interface ECGContent {
  displayName?: string;
  rate?: string;
  rhythm?: string;
  pWave?: string;
  prInterval?: string;
  qrsComplex?: string;
  qtInterval?: string;
  stSegment?: string;
  tWave?: string;
  pathognomonic?: string;
  hemodynamicEffect?: string;
  acuteManagement?: string;
  cardioversion?: string;
  pacing?: string;
  referral?: string;
  diagnosticCriteria?: string[];
  etiology?: string[];
  symptoms?: string[];
  associatedConditions?: string[];
  medications?: string[];
  mimics?: string[];
  distinguishingFeatures?: Record<string, string>;
  clinicalPearls?: string[];
  commonMistakes?: string[];
  testQuestionTips?: string[];
  mnemonics?: string[];
  boardYieldFacts?: string[];
}

const PROMPT_TEMPLATE = `You are a cardiology expert creating educational content for PA students studying ECG patterns.

For the ECG pattern "${'{PATTERN_NAME}'}" in category "${'{CATEGORY}'}", provide comprehensive clinical content.

Current data we have:
- Name: {NAME}
- Category: {CATEGORY}
- Is Emergency: {IS_EMERGENCY}
- Is High Yield: {IS_HIGH_YIELD}

Generate the following fields in valid JSON format. Only include fields where you can provide accurate, clinically relevant information:

{
  "displayName": "Human-readable display name if different from technical name",
  "rate": "Heart rate characteristics (e.g., 'Tachycardic 150-250 bpm', 'Bradycardic <60 bpm', 'Variable')",
  "rhythm": "Rhythm description (e.g., 'Irregularly irregular', 'Regular', 'Regularly irregular')",
  "pWave": "P wave characteristics (e.g., 'Absent', 'Sawtooth flutter waves', 'Normal upright in II')",
  "prInterval": "PR interval findings (e.g., 'Prolonged >200ms', 'Short <120ms', 'Variable', 'N/A')",
  "qrsComplex": "QRS morphology (e.g., 'Narrow <120ms', 'Wide >120ms with RBBB pattern', 'Normal')",
  "qtInterval": "QT/QTc considerations (e.g., 'Prolonged QTc >450ms', 'Normal', 'May be shortened')",
  "stSegment": "ST segment changes (e.g., 'Elevated in contiguous leads', 'Depressed', 'Normal isoelectric')",
  "tWave": "T wave appearance (e.g., 'Inverted in precordial leads', 'Peaked/hyperacute', 'Normal')",
  "pathognomonic": "The single most pathognomonic finding if one exists (e.g., 'Delta wave for WPW')",
  "hemodynamicEffect": "How this affects cardiac output/hemodynamics (1-2 sentences)",
  "acuteManagement": "Immediate management steps (2-3 sentences)",
  "cardioversion": "When/if cardioversion indicated (e.g., 'Synchronized for unstable patients', 'Not indicated', 'Emergent unsynchronized')",
  "pacing": "When/if pacing indicated (e.g., 'Transcutaneous for symptomatic bradycardia', 'Not indicated')",
  "referral": "Referral considerations (e.g., 'Cardiology urgent', 'EP study evaluation', 'Routine follow-up')",
  "diagnosticCriteria": ["Array of 3-5 specific ECG criteria used to diagnose this pattern"],
  "etiology": ["Array of 3-5 common causes/etiologies"],
  "symptoms": ["Array of 3-5 symptoms patients commonly experience"],
  "associatedConditions": ["Array of 3-5 conditions associated with this ECG pattern"],
  "medications": ["Array of 3-5 medications used in treatment"],
  "mimics": ["Array of 2-4 ECG patterns that can look similar"],
  "distinguishingFeatures": {
    "key_differentiator_1": "What distinguishes this from similar patterns",
    "key_differentiator_2": "Another distinguishing feature"
  },
  "clinicalPearls": ["Array of 3-5 high-yield clinical pearls for board exams"],
  "commonMistakes": ["Array of 2-4 common mistakes students/clinicians make"],
  "testQuestionTips": ["Array of 2-3 tips for answering test questions about this pattern"],
  "mnemonics": ["Any helpful mnemonics if they exist"],
  "boardYieldFacts": ["Array of 3-5 high-yield facts likely to appear on PANCE/boards"]
}

Return ONLY the JSON object, no markdown code fences or explanations. Ensure all JSON is valid.`;

async function generateECGContent(record: any): Promise<ECGContent | null> {
  await rateLimiter.acquire();
  
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
  
  const prompt = PROMPT_TEMPLATE
    .replace(/\{PATTERN_NAME\}/g, record.name)
    .replace(/\{NAME\}/g, record.name)
    .replace(/\{CATEGORY\}/g, record.category || 'Unknown')
    .replace(/\{IS_EMERGENCY\}/g, String(record.isEmergency))
    .replace(/\{IS_HIGH_YIELD\}/g, String(record.isHighYield));
  
  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // Extract JSON from response
    let jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    
    const content = JSON.parse(jsonStr) as ECGContent;
    return content;
  } catch (error) {
    console.error(`  ❌ Error generating content: ${error}`);
    return null;
  }
}

function needsUpdate(record: any): boolean {
  // Check if key fields are missing
  return (
    !record.displayName ||
    !record.rate ||
    !record.rhythm ||
    !record.pWave ||
    !record.prInterval ||
    !record.qrsComplex ||
    !record.stSegment ||
    !record.tWave ||
    !record.hemodynamicEffect ||
    !record.acuteManagement ||
    !(record.diagnosticCriteria as string[])?.length ||
    !(record.etiology as string[])?.length ||
    !(record.symptoms as string[])?.length ||
    !(record.clinicalPearls as string[])?.length ||
    !(record.boardYieldFacts as string[])?.length
  );
}

async function fillECGPatterns(): Promise<void> {
  console.log('🔍 ECG Pattern Filler v2');
  console.log('='.repeat(50));
  
  // Find records with missing fields
  const records = await prisma.eCGPattern.findMany();
  const toUpdate = records.filter(needsUpdate);
  
  console.log(`Found ${toUpdate.length}/${records.length} records needing updates\n`);
  
  let updated = 0;
  let failed = 0;
  
  for (let i = 0; i < toUpdate.length; i++) {
    const record = toUpdate[i];
    console.log(`  🔄 [${i + 1}/${toUpdate.length}] Processing: ${record.name}...`);
    
    const content = await generateECGContent(record);
    
    if (!content) {
      failed++;
      continue;
    }
    
    try {
      await prisma.eCGPattern.update({
        where: { id: record.id },
        data: {
          displayName: content.displayName || record.displayName,
          rate: content.rate || record.rate,
          rhythm: content.rhythm || record.rhythm,
          pWave: content.pWave || record.pWave,
          prInterval: content.prInterval || record.prInterval,
          qrsComplex: content.qrsComplex || record.qrsComplex,
          qtInterval: content.qtInterval || record.qtInterval,
          stSegment: content.stSegment || record.stSegment,
          tWave: content.tWave || record.tWave,
          pathognomonic: content.pathognomonic || record.pathognomonic,
          hemodynamicEffect: content.hemodynamicEffect || record.hemodynamicEffect,
          acuteManagement: content.acuteManagement || record.acuteManagement,
          cardioversion: content.cardioversion || record.cardioversion,
          pacing: content.pacing || record.pacing,
          referral: content.referral || record.referral,
          diagnosticCriteria: content.diagnosticCriteria?.length ? content.diagnosticCriteria : record.diagnosticCriteria,
          etiology: content.etiology?.length ? content.etiology : record.etiology,
          symptoms: content.symptoms?.length ? content.symptoms : record.symptoms,
          associatedConditions: content.associatedConditions?.length ? content.associatedConditions : record.associatedConditions,
          medications: content.medications?.length ? content.medications : record.medications,
          mimics: content.mimics?.length ? content.mimics : record.mimics,
          distinguishingFeatures: content.distinguishingFeatures || record.distinguishingFeatures,
          clinicalPearls: content.clinicalPearls?.length ? content.clinicalPearls : record.clinicalPearls,
          commonMistakes: content.commonMistakes?.length ? content.commonMistakes : record.commonMistakes,
          testQuestionTips: content.testQuestionTips?.length ? content.testQuestionTips : record.testQuestionTips,
          mnemonics: content.mnemonics?.length ? content.mnemonics : record.mnemonics,
          boardYieldFacts: content.boardYieldFacts?.length ? content.boardYieldFacts : record.boardYieldFacts,
          updatedAt: new Date()
        }
      });
      
      updated++;
      console.log(`  ✅ Updated: ${record.name}`);
    } catch (error) {
      console.error(`  ❌ Failed to update ${record.name}: ${error}`);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Summary:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total ECG records: ${records.length}`);
}

async function main() {
  try {
    await fillECGPatterns();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
