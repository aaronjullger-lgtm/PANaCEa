/**
 * ScoringSystem Entry Generator
 * 
 * Generates missing PANCE-relevant scoring systems and clinical decision rules.
 * These are critical for exam preparation and clinical practice.
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Rate limiter
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  
  constructor(private capacity: number = 5, private refillRate: number = 0.5) {
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

// Essential PANCE scoring systems
const PANCE_SCORING_SYSTEMS = [
  // Cardiovascular
  { name: 'CHA2DS2-VASc Score', category: 'Cardiovascular', condition: 'Atrial fibrillation stroke risk' },
  { name: 'HAS-BLED Score', category: 'Cardiovascular', condition: 'Bleeding risk on anticoagulation' },
  { name: 'HEART Score', category: 'Cardiovascular', condition: 'Chest pain risk stratification' },
  { name: 'TIMI Risk Score', category: 'Cardiovascular', condition: 'ACS risk stratification' },
  { name: 'Wells Criteria for DVT', category: 'Cardiovascular', condition: 'DVT probability' },
  { name: 'Wells Criteria for PE', category: 'Cardiovascular', condition: 'PE probability' },
  { name: 'Geneva Score', category: 'Cardiovascular', condition: 'PE probability' },
  { name: 'Framingham Risk Score', category: 'Cardiovascular', condition: '10-year cardiovascular risk' },
  { name: 'Killip Classification', category: 'Cardiovascular', condition: 'Heart failure severity in MI' },
  { name: 'NYHA Functional Classification', category: 'Cardiovascular', condition: 'Heart failure severity' },
  
  // Neurologic
  { name: 'Glasgow Coma Scale', category: 'Neurologic', condition: 'Level of consciousness' },
  { name: 'NIH Stroke Scale', category: 'Neurologic', condition: 'Stroke severity' },
  { name: 'Hunt and Hess Scale', category: 'Neurologic', condition: 'Subarachnoid hemorrhage severity' },
  { name: 'Fisher Grade', category: 'Neurologic', condition: 'SAH CT findings and vasospasm risk' },
  { name: 'ABCD2 Score', category: 'Neurologic', condition: 'TIA stroke risk' },
  { name: 'Cincinnati Prehospital Stroke Scale', category: 'Neurologic', condition: 'Stroke screening' },
  
  // Pulmonary
  { name: 'CURB-65', category: 'Pulmonary', condition: 'Pneumonia severity and disposition' },
  { name: 'Pneumonia Severity Index (PSI)', category: 'Pulmonary', condition: 'CAP mortality risk' },
  { name: 'Berlin Criteria', category: 'Pulmonary', condition: 'ARDS diagnosis and severity' },
  { name: 'Light Criteria', category: 'Pulmonary', condition: 'Pleural effusion classification' },
  
  // Critical Care
  { name: 'APACHE II Score', category: 'Critical Care', condition: 'ICU mortality prediction' },
  { name: 'SOFA Score', category: 'Critical Care', condition: 'Organ dysfunction assessment' },
  { name: 'qSOFA Score', category: 'Critical Care', condition: 'Sepsis screening outside ICU' },
  
  // GI/Hepatic
  { name: 'Child-Pugh Score', category: 'Gastrointestinal', condition: 'Cirrhosis severity' },
  { name: 'MELD Score', category: 'Gastrointestinal', condition: 'Liver disease mortality and transplant priority' },
  { name: 'Ranson Criteria', category: 'Gastrointestinal', condition: 'Acute pancreatitis severity' },
  { name: 'Glasgow-Imrie Criteria', category: 'Gastrointestinal', condition: 'Acute pancreatitis severity' },
  { name: 'Rockall Score', category: 'Gastrointestinal', condition: 'Upper GI bleed risk stratification' },
  { name: 'Glasgow-Blatchford Score', category: 'Gastrointestinal', condition: 'Upper GI bleed intervention need' },
  { name: 'Alvarado Score', category: 'Gastrointestinal', condition: 'Appendicitis probability' },
  
  // Orthopedic/Trauma
  { name: 'Ottawa Ankle Rules', category: 'Orthopedic', condition: 'Ankle fracture imaging decision' },
  { name: 'Ottawa Knee Rules', category: 'Orthopedic', condition: 'Knee fracture imaging decision' },
  { name: 'Pittsburgh Knee Rules', category: 'Orthopedic', condition: 'Knee fracture imaging decision' },
  { name: 'Canadian C-Spine Rule', category: 'Orthopedic', condition: 'C-spine imaging decision' },
  { name: 'NEXUS Criteria', category: 'Orthopedic', condition: 'C-spine injury clearance' },
  { name: 'PECARN Pediatric Head Injury Rule', category: 'Pediatric', condition: 'CT decision in pediatric head trauma' },
  
  // Psychiatric
  { name: 'PHQ-9', category: 'Psychiatry', condition: 'Depression severity' },
  { name: 'GAD-7', category: 'Psychiatry', condition: 'Anxiety severity' },
  { name: 'CAGE Questionnaire', category: 'Psychiatry', condition: 'Alcohol use disorder screening' },
  { name: 'AUDIT-C', category: 'Psychiatry', condition: 'Alcohol use screening' },
  { name: 'Columbia Suicide Severity Rating Scale', category: 'Psychiatry', condition: 'Suicide risk assessment' },
  { name: 'Edinburgh Postnatal Depression Scale', category: 'Psychiatry', condition: 'Postpartum depression screening' },
  { name: 'Mini-Mental State Examination', category: 'Psychiatry', condition: 'Cognitive impairment screening' },
  { name: 'Montreal Cognitive Assessment', category: 'Psychiatry', condition: 'Mild cognitive impairment screening' },
  
  // OB/Pediatric
  { name: 'APGAR Score', category: 'Pediatric', condition: 'Newborn assessment' },
  { name: 'Bishop Score', category: 'Obstetrics', condition: 'Cervical readiness for labor induction' },
  
  // Infectious Disease
  { name: 'Centor Criteria', category: 'Infectious Disease', condition: 'Strep pharyngitis probability' },
  { name: 'McIsaac Score', category: 'Infectious Disease', condition: 'Strep pharyngitis probability (modified Centor)' },
  
  // VTE Risk
  { name: 'Caprini Score', category: 'Hematology', condition: 'VTE prophylaxis risk stratification' },
  { name: 'Padua Prediction Score', category: 'Hematology', condition: 'Medical patient VTE risk' },
];

interface ScoringSystemData {
  name: string;
  displayName: string;
  aliases: string[];
  category: string;
  condition: string;
  components: Record<string, any>;
  maxScore: number;
  minScore: number;
  interpretation: Record<string, any>;
  actionThresholds: Record<string, any>;
  sensitivity: number | null;
  specificity: number | null;
  validationStudies: string[];
  limitations: string[];
  whenToUse: string;
  whenNotToUse: string[];
  clinicalContext: string;
  clinicalPearls: string[];
  commonMistakes: string[];
  testQuestionTips: string[];
  mnemonics: string[];
  boardYieldFacts: string[];
  panceYield: number;
  isHighYield: boolean;
}

async function generateScoringSystemData(name: string, category: string, condition: string): Promise<ScoringSystemData | null> {
  await rateLimiter.acquire();
  
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  
  const prompt = `You are a PA/NP educator creating PANCE exam prep content. Generate comprehensive data for the clinical scoring system "${name}" used for "${condition}".

Return ONLY valid JSON (no markdown, no code blocks):
{
  "displayName": "Common name for the score",
  "aliases": ["Alternative names", "abbreviations"],
  "components": {
    "criteria": [
      {"name": "Criteria name", "points": 1, "description": "What it measures"}
    ],
    "notes": "Any special calculation notes"
  },
  "maxScore": 10,
  "minScore": 0,
  "interpretation": {
    "ranges": [
      {"range": "0-1", "risk": "Low", "interpretation": "What this means", "action": "Recommended action"}
    ]
  },
  "actionThresholds": {
    "low": {"score": "0-1", "action": "Outpatient management"},
    "moderate": {"score": "2-4", "action": "Consider admission"},
    "high": {"score": "5+", "action": "ICU admission"}
  },
  "sensitivity": 0.95,
  "specificity": 0.85,
  "validationStudies": ["Key validation studies"],
  "limitations": ["When NOT to use", "Populations not validated"],
  "whenToUse": "Clinical scenarios for using this score",
  "whenNotToUse": ["Contraindications", "Inappropriate use"],
  "clinicalContext": "How this fits into clinical decision-making",
  "clinicalPearls": ["High-yield clinical tips"],
  "commonMistakes": ["Common errors in application"],
  "testQuestionTips": ["How this appears on PANCE", "Key testable facts"],
  "mnemonics": ["Memory aids if any"],
  "boardYieldFacts": ["Must-know facts for PANCE"],
  "panceYield": 3,
  "isHighYield": true
}

Important:
- All components/criteria should be accurate with correct point values
- Include sensitivity/specificity if well-established (as decimals, or null if unknown)
- panceYield: 1=Low, 2=Medium, 3=High
- Focus on clinical application for PA practice
- Include PANCE-specific test tips`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // Clean response
    let cleanText = text.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    
    const data = JSON.parse(cleanText);
    
    return {
      name,
      displayName: data.displayName || name,
      aliases: Array.isArray(data.aliases) ? data.aliases : [],
      category,
      condition,
      components: data.components || { criteria: [] },
      maxScore: typeof data.maxScore === 'number' ? data.maxScore : 10,
      minScore: typeof data.minScore === 'number' ? data.minScore : 0,
      interpretation: data.interpretation || {},
      actionThresholds: data.actionThresholds || null,
      sensitivity: typeof data.sensitivity === 'number' ? data.sensitivity : null,
      specificity: typeof data.specificity === 'number' ? data.specificity : null,
      validationStudies: Array.isArray(data.validationStudies) ? data.validationStudies : [],
      limitations: Array.isArray(data.limitations) ? data.limitations : [],
      whenToUse: data.whenToUse || '',
      whenNotToUse: Array.isArray(data.whenNotToUse) ? data.whenNotToUse : [],
      clinicalContext: data.clinicalContext || '',
      clinicalPearls: Array.isArray(data.clinicalPearls) ? data.clinicalPearls : [],
      commonMistakes: Array.isArray(data.commonMistakes) ? data.commonMistakes : [],
      testQuestionTips: Array.isArray(data.testQuestionTips) ? data.testQuestionTips : [],
      mnemonics: Array.isArray(data.mnemonics) ? data.mnemonics : [],
      boardYieldFacts: Array.isArray(data.boardYieldFacts) ? data.boardYieldFacts : [],
      panceYield: typeof data.panceYield === 'number' ? data.panceYield : 2,
      isHighYield: data.isHighYield === true,
    };
  } catch (error) {
    console.error(`  ❌ Error generating data for ${name}:`, error);
    return null;
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║          SCORING SYSTEM ENTRY GENERATOR                          ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  
  // Get existing scoring systems
  const existing = await prisma.scoringSystem.findMany({
    select: { name: true }
  });
  const existingNames = new Set(existing.map(s => s.name.toLowerCase()));
  
  // Filter to only missing systems
  const missingSystemsToGenerate = PANCE_SCORING_SYSTEMS.filter(
    s => !existingNames.has(s.name.toLowerCase())
  );
  
  console.log(`\nExisting: ${existing.length}`);
  console.log(`Missing: ${missingSystemsToGenerate.length}`);
  console.log(`Will generate: ${missingSystemsToGenerate.length}\n`);
  
  let created = 0;
  let failed = 0;
  
  for (let i = 0; i < missingSystemsToGenerate.length; i++) {
    const system = missingSystemsToGenerate[i];
    console.log(`Processing [${i + 1}/${missingSystemsToGenerate.length}]: ${system.name}`);
    
    const data = await generateScoringSystemData(system.name, system.category, system.condition);
    
    if (!data) {
      failed++;
      continue;
    }
    
    try {
      await prisma.scoringSystem.create({
        data: {
          id: uuidv4(),
          name: data.name,
          displayName: data.displayName,
          aliases: data.aliases,
          category: data.category,
          condition: data.condition,
          components: data.components,
          maxScore: data.maxScore,
          minScore: data.minScore,
          interpretation: data.interpretation,
          actionThresholds: data.actionThresholds,
          sensitivity: data.sensitivity,
          specificity: data.specificity,
          validationStudies: data.validationStudies,
          limitations: data.limitations,
          whenToUse: data.whenToUse,
          whenNotToUse: data.whenNotToUse,
          clinicalContext: data.clinicalContext,
          clinicalPearls: data.clinicalPearls,
          commonMistakes: data.commonMistakes,
          testQuestionTips: data.testQuestionTips,
          mnemonics: data.mnemonics,
          boardYieldFacts: data.boardYieldFacts,
          panceYield: data.panceYield,
          isHighYield: data.isHighYield,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      });
      console.log(`  ✅ Created`);
      created++;
    } catch (error: any) {
      console.error(`  ❌ DB error:`, error.message);
      failed++;
    }
  }
  
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                         SUMMARY                                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(`Created: ${created}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total scoring systems now: ${existing.length + created}`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
