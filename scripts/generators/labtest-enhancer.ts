#!/usr/bin/env npx tsx
/**
 * LabTest Enhancer - Fill empty fields in LabTest table
 * 
 * CRITICAL: This table has 228 records but almost all clinical fields are empty.
 * This script fills the comprehensive clinical data needed for PANCE preparation.
 * 
 * Fields to fill:
 *   - commonAbnormalities[], increaseIndicates[], decreaseIndicates[]
 *   - conventionalRange, siRange, siUnits, units
 *   - criticalValues (jsonb), referenceRanges (jsonb)
 *   - sampleType, collectionTube, stability, turnaroundTime, fastingRequired
 *   - interferences[], falsePos/Neg, whenToOrder[]
 *   - relatedTests[], followUpTests[]
 *   - clinicalPearls[], boardYieldFacts[], mnemonics[], testQuestionTips[]
 *   - isHighYield, panceYield
 *   - clinicalScenarios (jsonb)
 *   - interpretationSteps, specialInstructions
 *   - conversionFactor
 * 
 * Usage:
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/labtest-enhancer.ts --dry-run
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/labtest-enhancer.ts --batch=10
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/labtest-enhancer.ts --high-yield-only
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// Rate limiting
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  
  constructor(
    private capacity: number,
    private refillRate: number
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }
  
  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
    
    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) / this.refillRate * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
  }
}

const rateLimiter = new TokenBucket(5, 0.5);

// High-yield lab tests for PANCE (process these first)
const HIGH_YIELD_LABS = [
  // CBC
  'hemoglobin', 'hematocrit', 'wbc', 'platelet', 'mcv', 'mch', 'mchc', 'rdw', 'reticulocyte',
  // BMP/CMP
  'sodium', 'potassium', 'chloride', 'bicarbonate', 'co2', 'bun', 'creatinine', 'glucose', 'calcium',
  'magnesium', 'phosphorus', 'albumin', 'total protein', 'ast', 'alt', 'alp', 'bilirubin', 'ggt',
  // Cardiac
  'troponin', 'bnp', 'nt-probnp', 'ck-mb', 'd-dimer', 'ldh',
  // Thyroid
  'tsh', 't4', 't3', 'free t4', 'free t3',
  // Lipids
  'total cholesterol', 'ldl', 'hdl', 'triglycerides',
  // Coagulation
  'pt', 'inr', 'ptt', 'aptt', 'fibrinogen',
  // Urinalysis
  'urinalysis', 'urine protein', 'urine glucose', 'urine ketones', 'urine blood',
  // Inflammatory
  'crp', 'esr', 'procalcitonin', 'ferritin',
  // Diabetes
  'hba1c', 'fasting glucose', 'ogtt',
  // Renal
  'gfr', 'egfr', 'uric acid', 'cystatin c',
  // Iron studies
  'iron', 'tibc', 'ferritin', 'transferrin saturation',
  // ABG/VBG
  'ph', 'pco2', 'po2', 'hco3', 'base excess', 'lactate',
  // Electrolytes
  'anion gap', 'osmolality', 'osmolar gap',
  // Infection
  'blood culture', 'urine culture', 'csf', 'gram stain',
  // Autoimmune
  'ana', 'rf', 'anti-ccp', 'anca', 'complement', 'c3', 'c4',
  // Vitamins
  'vitamin d', 'vitamin b12', 'folate', 'thiamine',
  // Hormones
  'cortisol', 'acth', 'aldosterone', 'renin', 'pth', 'prolactin', 'lh', 'fsh', 'estrogen', 'testosterone',
  // Tumor markers
  'psa', 'cea', 'afp', 'ca-125', 'ca 19-9', 'hcg', 'beta-hcg',
  // Drug levels
  'vancomycin', 'digoxin', 'lithium', 'phenytoin', 'valproic acid', 'theophylline', 'aminoglycoside',
  // Hepatitis
  'hepatitis a', 'hepatitis b', 'hepatitis c', 'hbsag', 'anti-hbs', 'anti-hbc', 'hbeag', 'hcv antibody',
  // HIV
  'hiv', 'cd4', 'viral load',
  // Other important
  'ammonia', 'lipase', 'amylase', 'ige', 'tryptase'
];

interface LabTestContent {
  // Reference ranges
  conventionalRange: string;
  siRange: string;
  siUnits: string;
  units: string;
  conversionFactor: number | null;
  
  // Critical values
  criticalValues: {
    low?: string;
    high?: string;
    notes?: string;
  };
  
  // Sample info
  sampleType: string;
  collectionTube: string;
  stability: string;
  turnaroundTime: string;
  fastingRequired: boolean;
  specialInstructions: string;
  
  // Clinical interpretation
  increaseIndicates: string[];
  decreaseIndicates: string[];
  commonAbnormalities: string[];
  interpretationSteps: string;
  falsePosNeg: string;
  interferingFactors: string[];
  
  // Reference ranges by population
  referenceRanges: {
    adult?: { male?: string; female?: string; };
    pediatric?: string;
    geriatric?: string;
    pregnancy?: string;
  };
  
  // Ordering guidance
  whenToOrder: string[];
  relatedTests: string[];
  followUpTests: string[];
  
  // Board prep
  clinicalPearls: string[];
  boardYieldFacts: string[];
  mnemonics: string[];
  testQuestionTips: string[];
  isHighYield: boolean;
  panceYield: number;
  
  // Clinical scenarios
  clinicalScenarios: Array<{
    scenario: string;
    expectedResult: string;
    interpretation: string;
  }>;
}

async function generateLabTestContent(labTest: any): Promise<LabTestContent> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set');
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  });
  
  await rateLimiter.acquire();
  
  // Check if this is a high-yield lab
  const isHighYield = HIGH_YIELD_LABS.some(hy => 
    labTest.name.toLowerCase().includes(hy) || 
    (labTest.category && labTest.category.toLowerCase().includes(hy))
  );
  
  const prompt = `Generate comprehensive clinical laboratory data for "${labTest.name}" for PANCE/PA board exam preparation.

Current info:
- Category: ${labTest.category || 'Not specified'}
- Typical Use: ${labTest.typicalUse || 'Not specified'}

You are a clinical laboratory medicine expert. Provide accurate, board-relevant content.

Return a JSON object with EXACTLY these fields:

{
  "conventionalRange": "Normal range in conventional US units (e.g., '70-100 mg/dL', '4.5-5.5 mEq/L')",
  "siRange": "Normal range in SI units (e.g., '3.9-5.6 mmol/L')",
  "siUnits": "SI unit abbreviation (e.g., 'mmol/L', 'μmol/L', 'g/L')",
  "units": "Conventional unit abbreviation (e.g., 'mg/dL', 'mEq/L', 'ng/mL')",
  "conversionFactor": <number or null - multiply conventional by this to get SI>,
  
  "criticalValues": {
    "low": "Critical low value requiring immediate action (if applicable)",
    "high": "Critical high value requiring immediate action (if applicable)",
    "notes": "When to panic call the provider"
  },
  
  "sampleType": "Type of specimen (serum, plasma, whole blood, urine, CSF, etc.)",
  "collectionTube": "Tube type and color (e.g., 'Red top/SST', 'Lavender (EDTA)', 'Light blue (citrate)')",
  "stability": "How long specimen is stable and storage conditions",
  "turnaroundTime": "Typical lab TAT (STAT vs routine)",
  "fastingRequired": <true/false - is fasting required>,
  "specialInstructions": "Special collection or handling instructions",
  
  "increaseIndicates": [
    "Condition/cause 1 when elevated",
    "Condition/cause 2 when elevated",
    "At least 5-8 causes of elevation"
  ],
  "decreaseIndicates": [
    "Condition/cause 1 when decreased",
    "Condition/cause 2 when decreased",
    "At least 5-8 causes of decrease (if applicable)"
  ],
  "commonAbnormalities": [
    "Most common clinical finding 1",
    "Most common clinical finding 2",
    "Include at least 4-6 common abnormalities"
  ],
  
  "interpretationSteps": "Step-by-step approach to interpreting this lab value in clinical context",
  "falsePosNeg": "Common causes of false positives and false negatives",
  "interferingFactors": [
    "Medications or conditions that interfere with accuracy",
    "Include at least 3-5 interferents"
  ],
  
  "referenceRanges": {
    "adult": {
      "male": "Adult male range if different",
      "female": "Adult female range if different"
    },
    "pediatric": "Pediatric range if different",
    "geriatric": "Elderly range if different",
    "pregnancy": "Pregnancy range if different"
  },
  
  "whenToOrder": [
    "Clinical indication 1",
    "Clinical indication 2",
    "Include 5-8 indications"
  ],
  "relatedTests": [
    "Related lab test 1 to order together",
    "Related lab test 2",
    "Include 3-5 related tests"
  ],
  "followUpTests": [
    "What to order if this is abnormal",
    "Include 3-5 follow-up tests"
  ],
  
  "clinicalPearls": [
    "High-yield clinical pearl 1",
    "High-yield clinical pearl 2",
    "Include 5-7 pearls for board prep"
  ],
  "boardYieldFacts": [
    "Specific fact commonly tested on PANCE",
    "Another board-relevant fact",
    "Include 4-6 facts"
  ],
  "mnemonics": [
    "Memory aid for interpretation",
    "Mnemonic for causes if applicable"
  ],
  "testQuestionTips": [
    "How this appears on board questions",
    "What to look for in vignettes",
    "Include 3-4 tips"
  ],
  
  "isHighYield": ${isHighYield},
  "panceYield": <1-5 where 5 is extremely high yield for PANCE>,
  
  "clinicalScenarios": [
    {
      "scenario": "Brief clinical vignette",
      "expectedResult": "What the lab result would show",
      "interpretation": "What this means clinically"
    },
    // Include 2-3 clinical scenarios
  ]
}

Be thorough and clinically accurate. This is for PA students preparing for boards.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  try {
    return JSON.parse(text);
  } catch (e) {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error(`Failed to parse response for ${labTest.name}: ${text.substring(0, 200)}`);
  }
}

async function enhanceLabTest(labTest: any, dryRun: boolean): Promise<boolean> {
  console.log(`\n📋 Enhancing: ${labTest.name}`);
  
  try {
    const content = await generateLabTestContent(labTest);
    
    if (dryRun) {
      console.log(`  [DRY RUN] Would update with:`);
      console.log(`    - conventionalRange: ${content.conventionalRange}`);
      console.log(`    - siRange: ${content.siRange}`);
      console.log(`    - increaseIndicates: ${content.increaseIndicates?.length || 0} items`);
      console.log(`    - decreaseIndicates: ${content.decreaseIndicates?.length || 0} items`);
      console.log(`    - clinicalPearls: ${content.clinicalPearls?.length || 0} items`);
      console.log(`    - boardYieldFacts: ${content.boardYieldFacts?.length || 0} items`);
      console.log(`    - isHighYield: ${content.isHighYield}`);
      console.log(`    - panceYield: ${content.panceYield}`);
      return true;
    }
    
    await prisma.labTest.update({
      where: { id: labTest.id },
      data: {
        conventionalRange: content.conventionalRange || null,
        siRange: content.siRange || null,
        siUnits: content.siUnits || null,
        units: content.units || null,
        conversionFactor: content.conversionFactor || null,
        
        criticalValues: content.criticalValues || null,
        
        sampleType: content.sampleType || null,
        collectionTube: content.collectionTube || null,
        stability: content.stability || null,
        turnaroundTime: content.turnaroundTime || null,
        fastingRequired: content.fastingRequired ?? false,
        specialInstructions: content.specialInstructions || null,
        
        increaseIndicates: content.increaseIndicates || [],
        decreaseIndicates: content.decreaseIndicates || [],
        commonAbnormalities: content.commonAbnormalities || [],
        
        interpretationSteps: content.interpretationSteps || null,
        falsePosNeg: content.falsePosNeg || null,
        interferingFactors: content.interferingFactors || [],
        
        referenceRanges: content.referenceRanges || null,
        
        whenToOrder: content.whenToOrder || [],
        relatedTests: content.relatedTests || [],
        followUpTests: content.followUpTests || [],
        
        clinicalPearls: content.clinicalPearls || [],
        boardYieldFacts: content.boardYieldFacts || [],
        mnemonics: content.mnemonics || [],
        testQuestionTips: content.testQuestionTips || [],
        
        isHighYield: content.isHighYield ?? false,
        panceYield: content.panceYield || 3,
        
        clinicalScenarios: content.clinicalScenarios || null,
        
        updatedAt: new Date()
      }
    });
    
    console.log(`  ✅ Updated successfully`);
    return true;
    
  } catch (error) {
    console.error(`  ❌ Error enhancing ${labTest.name}:`, error);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const highYieldOnly = args.includes('--high-yield-only');
  const batchArg = args.find(a => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : 50;
  const skipArg = args.find(a => a.startsWith('--skip='));
  const skipCount = skipArg ? parseInt(skipArg.split('=')[1]) : 0;
  
  console.log('🧪 LabTest Enhancer - Fill Empty Fields');
  console.log('=========================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE UPDATE'}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Skip: ${skipCount}`);
  console.log(`High-yield only: ${highYieldOnly}`);
  
  try {
    // Get lab tests that need enhancement (missing key fields)
    const labTests = await prisma.labTest.findMany({
      where: {
        OR: [
          { conventionalRange: null },
          { conventionalRange: '' },
          { increaseIndicates: { isEmpty: true } },
          { clinicalPearls: { isEmpty: true } }
        ]
      },
      orderBy: { name: 'asc' },
      skip: skipCount,
      take: batchSize
    });
    
    console.log(`\nFound ${labTests.length} lab tests needing enhancement`);
    
    // Filter for high-yield if requested
    let testsToProcess = labTests;
    if (highYieldOnly) {
      testsToProcess = labTests.filter(lt => 
        HIGH_YIELD_LABS.some(hy => 
          lt.name.toLowerCase().includes(hy) ||
          (lt.category && lt.category.toLowerCase().includes(hy))
        )
      );
      console.log(`Filtered to ${testsToProcess.length} high-yield tests`);
    }
    
    let success = 0;
    let failed = 0;
    
    for (const labTest of testsToProcess) {
      const result = await enhanceLabTest(labTest, dryRun);
      if (result) {
        success++;
      } else {
        failed++;
      }
      
      // Small delay between requests
      await new Promise(r => setTimeout(r, 500));
    }
    
    console.log('\n=========================================');
    console.log('Summary:');
    console.log(`  ✅ Success: ${success}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  📊 Total: ${testsToProcess.length}`);
    
    if (!dryRun && testsToProcess.length < labTests.length) {
      console.log(`\n💡 Run with --batch=${batchSize} --skip=${skipCount + batchSize} to continue`);
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
