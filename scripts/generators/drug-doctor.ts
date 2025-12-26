/**
 * Drug Doctor - AI-powered pharmacology content generator
 * Enhances Drug table entries with PANCE high-yield information
 * 
 * Usage: npx ts-node scripts/generators/drug-doctor.ts --limit=100
 * Note: Unset GEMINI_API_KEY to avoid expired key errors
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY required');

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// Use 2.5-pro for better accuracy and consistency
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

interface DrugEnhancement {
  mechanismDetailed: string;
  pharmacokinetics: {
    absorption: string;
    distribution: string;
    metabolism: string;
    elimination: string;
    halfLife: string;
    bioavailability: string;
  };
  absorption: string;
  distribution: string;
  metabolismDetail: string;
  eliminationRoute: string;
  halfLife: string;
  onsetOfAction: string;
  peakEffect: string;
  duration: string;
  bioavailability: string;
  pregnancyCategory: string;
  pregnancyNotes: string;
  lactationSafety: string;
  lactationNotes: string;
  pediatricDosing: string;
  geriatricDosing: string;
  renalDosing: string;
  hepaticDosing: string;
  blackBoxWarnings: string[];
  riskStrategies: string[];
  monitoringParams: string[];
  reversalAgent: string;
  toxicity: string;
  maxDailyDose: string;
  clinicalPearls: string[];
  commonMistakes: string[];
  mnemonics: string[];
  testQuestionTips: string[];
  boardYieldFacts: string[];
  majorInteractions: Array<{
    drug: string;
    severity: string;
    mechanism: string;
    clinicalEffect: string;
    management: string;
  }>;
  cyp450Effects: {
    inhibits: string[];
    induces: string[];
    substrates: string[];
  };
  foodInteractions: string[];
  routesOfAdmin: string[];
  formulations: string[];
  administrationTips: string;
  storageRequirements: string;
  genericAvailable: boolean;
  typicalCost: string;
  insuranceTier: number;
  isFirstLine: boolean;
  panceYield: number;
}

/**
 * Sanitize and validate AI response to ensure type consistency
 */
function sanitizeDrugData(data: any): DrugEnhancement {
  // Helper to ensure string
  const ensureString = (val: any, fallback = 'Not available'): string => {
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.join(', ');
    return fallback;
  };

  // Helper to ensure array
  const ensureArray = (val: any): string[] => {
    if (Array.isArray(val)) return val.filter((v: any) => typeof v === 'string');
    if (typeof val === 'string') return val.trim() ? [val] : [];
    return [];
  };

  // Helper to ensure boolean
  const ensureBoolean = (val: any): boolean => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') return val.toLowerCase() === 'true';
    return false;
  };

  // Helper to ensure number
  const ensureNumber = (val: any, min: number, max: number, fallback: number): number => {
    const num = typeof val === 'number' ? val : parseInt(String(val), 10);
    if (isNaN(num) || num < min || num > max) return fallback;
    return num;
  };

  return {
    mechanismDetailed: ensureString(data.mechanismDetailed),
    pharmacokinetics: {
      absorption: ensureString(data.pharmacokinetics?.absorption),
      distribution: ensureString(data.pharmacokinetics?.distribution),
      metabolism: ensureString(data.pharmacokinetics?.metabolism),
      elimination: ensureString(data.pharmacokinetics?.elimination),
      halfLife: ensureString(data.pharmacokinetics?.halfLife),
      bioavailability: ensureString(data.pharmacokinetics?.bioavailability)
    },
    absorption: ensureString(data.absorption),
    distribution: ensureString(data.distribution),
    metabolismDetail: ensureString(data.metabolismDetail),
    eliminationRoute: ensureString(data.eliminationRoute),
    halfLife: ensureString(data.halfLife),
    onsetOfAction: ensureString(data.onsetOfAction),
    peakEffect: ensureString(data.peakEffect),
    duration: ensureString(data.duration),
    bioavailability: ensureString(data.bioavailability),
    pregnancyCategory: ensureString(data.pregnancyCategory),
    pregnancyNotes: ensureString(data.pregnancyNotes),
    lactationSafety: ensureString(data.lactationSafety),
    lactationNotes: ensureString(data.lactationNotes),
    pediatricDosing: ensureString(data.pediatricDosing),
    geriatricDosing: ensureString(data.geriatricDosing),
    renalDosing: ensureString(data.renalDosing),
    hepaticDosing: ensureString(data.hepaticDosing),
    blackBoxWarnings: ensureArray(data.blackBoxWarnings),
    riskStrategies: ensureArray(data.riskStrategies),
    monitoringParams: ensureArray(data.monitoringParams),
    reversalAgent: ensureString(data.reversalAgent, 'None'),
    toxicity: ensureString(data.toxicity),
    maxDailyDose: ensureString(data.maxDailyDose),
    clinicalPearls: ensureArray(data.clinicalPearls),
    commonMistakes: ensureArray(data.commonMistakes),
    mnemonics: ensureArray(data.mnemonics),
    testQuestionTips: ensureArray(data.testQuestionTips),
    boardYieldFacts: ensureArray(data.boardYieldFacts),
    majorInteractions: Array.isArray(data.majorInteractions) 
      ? data.majorInteractions.map((i: any) => ({
          drug: ensureString(i.drug),
          severity: ensureString(i.severity, 'moderate'),
          mechanism: ensureString(i.mechanism),
          clinicalEffect: ensureString(i.clinicalEffect),
          management: ensureString(i.management)
        }))
      : [],
    cyp450Effects: {
      inhibits: ensureArray(data.cyp450Effects?.inhibits),
      induces: ensureArray(data.cyp450Effects?.induces),
      substrates: ensureArray(data.cyp450Effects?.substrates)
    },
    foodInteractions: ensureArray(data.foodInteractions),
    routesOfAdmin: ensureArray(data.routesOfAdmin),
    formulations: ensureArray(data.formulations),
    administrationTips: ensureString(data.administrationTips),
    storageRequirements: ensureString(data.storageRequirements),
    genericAvailable: ensureBoolean(data.genericAvailable),
    typicalCost: ensureString(data.typicalCost, '$'),
    insuranceTier: ensureNumber(data.insuranceTier, 1, 4, 2),
    isFirstLine: ensureBoolean(data.isFirstLine),
    panceYield: ensureNumber(data.panceYield, 1, 3, 2)
  };
}

async function generateDrugEnhancement(drug: {
  genericName: string;
  drugClass: string[];
  mechanismOfAction?: string | null;
  indications: string[];
  for (const drug of drugs) {
    try {
      console.log(`Enhancing: ${drug.genericName}`);
      const enhancement = await generateDrugEnhancement(drug);

      // Verify data integrity before saving
      if (!enhancement.mechanismDetailed || enhancement.mechanismDetailed === 'Not available') {
        console.log(`  ⚠️  Skipping ${drug.genericName}: insufficient data generated`);
        continue;
      }

      if (!dryRun) {
  "mechanismDetailed": "string: 2-3 sentence detailed mechanism",
  "pharmacokinetics": {
    "absorption": "string: bioavailability, food effects",
    "distribution": "string: Vd, protein binding",
    "metabolism": "string: CYP enzymes",
    "elimination": "string: route with %",
    "halfLife": "string: hours",
    "bioavailability": "string: percentage"
  },
  "absorption": "string: oral absorption characteristics",
  "distribution": "string: Vd, protein binding %",
  "metabolismDetail": "string: CYP450 enzymes, metabolites",
  "eliminationRoute": "string: renal/hepatic/fecal %",
  "halfLife": "string: half-life in hours",
  "onsetOfAction": "string: time to effect",
  "peakEffect": "string: time to peak",
  "duration": "string: duration of action",
  "bioavailability": "string: bioavailability %",
  "pregnancyCategory": "string: A/B/C/D/X or current labeling",
  "pregnancyNotes": "string: pregnancy considerations",
  "lactationSafety": "string: Safe/Caution/Contraindicated",
  "lactationNotes": "string: breastfeeding notes",
  "pediatricDosing": "string: pediatric dosing",
  "geriatricDosing": "string: elderly adjustments",
  "renalDosing": "string: CrCl-based adjustments",
  "hepaticDosing": "string: Child-Pugh adjustments",
  "blackBoxWarnings": ["array of strings: FDA warnings or empty array"],
  "riskStrategies": ["array of strings: REMS programs or empty array"],
  "monitoringParams": ["array of strings: labs/vitals to monitor"],
  "reversalAgent": "string: antidote or 'None'",
  "toxicity": "string: overdose presentation/management",
  "maxDailyDose": "string: max daily dose",
  "clinicalPearls": ["array of strings: 4-6 clinical tips"],
  "commonMistakes": ["array of strings: 3-4 prescribing errors"],
  "mnemonics": ["array of strings: memory aids or empty array"],
  "testQuestionTips": ["array of strings: 3-4 board tips"],
  "boardYieldFacts": ["array of strings: 4-6 PANCE facts"],
  "majorInteractions": [
    {
      "drug": "string: drug name",
      "severity": "string: major/moderate/minor",
      "mechanism": "string: interaction mechanism",
      "clinicalEffect": "string: clinical consequence",
      "management": "string: how to manage"
    }
  ],
  "cyp450Effects": {
    "inhibits": ["array of strings: CYP enzymes inhibited or empty array"],
    "induces": ["array of strings: CYP enzymes induced or empty array"],
    "substrates": ["array of strings: CYP substrates or empty array"]
  },
  "foodInteractions": ["array of strings: food/beverage interactions or empty array"],
  "routesOfAdmin": ["array of strings: PO, IV, IM, etc."],
  "formulations": ["array of strings: tablet, capsule, solution, etc."],
  "administrationTips": "string: administration instructions",
  "storageRequirements": "string: storage conditions",
  "genericAvailable": boolean: true or false,
  "typicalCost": "string: $ or $$ or $$$ or $$$$",
  "insuranceTier": number: 1 or 2 or 3 or 4,
  "isFirstLine": boolean: true if first-line therapy,
  "panceYield": number: 1 or 2 or 3
}

VALIDATION RULES:
- ALL string fields must be strings (never arrays)
- ALL array fields must be arrays (never strings)  
- Empty arrays are [] not null
- Use "None", "N/A", or "Not applicable" for missing string data
- Boolean fields must be true/false
- Number fields must be numbers (no strings)`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().replace(/```json\n?|\n?```/g, '').trim();
  const parsed = JSON.parse(text);
  
  // Validate and sanitize the response
  return sanitizeDrugData(parsed);
}

async function enhanceDrugs(options: { limit?: number; dryRun?: boolean }) {
  const { limit = 10, dryRun = false } = options;

  // Find drugs missing enhanced fields
  const drugs = await prisma.drug.findMany({
    where: { mechanismDetailed: null },
    take: limit,
    select: { id: true, genericName: true, drugClass: true, mechanismOfAction: true, indications: true }
  });

  console.log(`Found ${drugs.length} drugs to enhance`);

  for (const drug of drugs) {
    try {
      console.log(`Enhancing: ${drug.genericName}`);
      const enhancement = await generateDrugEnhancement(drug);

      if (!dryRun) {
        await prisma.drug.update({
          where: { id: drug.id },
          data: {
            mechanismDetailed: enhancement.mechanismDetailed,
            pharmacokinetics: enhancement.pharmacokinetics,
            absorption: enhancement.absorption,
            distribution: enhancement.distribution,
            metabolismDetail: enhancement.metabolismDetail,
            eliminationRoute: enhancement.eliminationRoute,
            halfLife: enhancement.halfLife,
            onsetOfAction: enhancement.onsetOfAction,
            peakEffect: enhancement.peakEffect,
            duration: enhancement.duration,
            bioavailability: enhancement.bioavailability,
            pregnancyCategory: enhancement.pregnancyCategory,
            pregnancyNotes: enhancement.pregnancyNotes,
            lactationSafety: enhancement.lactationSafety,
            lactationNotes: enhancement.lactationNotes,
            pediatricDosing: enhancement.pediatricDosing,
            geriatricDosing: enhancement.geriatricDosing,
            renalDosing: enhancement.renalDosing,
            hepaticDosing: enhancement.hepaticDosing,
            blackBoxWarnings: enhancement.blackBoxWarnings,
            riskStrategies: enhancement.riskStrategies,
            monitoringParams: enhancement.monitoringParams,
            reversalAgent: enhancement.reversalAgent,
            toxicity: enhancement.toxicity,
            maxDailyDose: enhancement.maxDailyDose,
            clinicalPearls: enhancement.clinicalPearls,
            commonMistakes: enhancement.commonMistakes,
            mnemonics: enhancement.mnemonics,
            testQuestionTips: enhancement.testQuestionTips,
            boardYieldFacts: enhancement.boardYieldFacts,
            majorInteractions: enhancement.majorInteractions,
            cyp450Effects: enhancement.cyp450Effects,
            foodInteractions: enhancement.foodInteractions,
            routesOfAdmin: enhancement.routesOfAdmin,
            formulations: enhancement.formulations,
            administrationTips: enhancement.administrationTips,
            storageRequirements: enhancement.storageRequirements,
            genericAvailable: enhancement.genericAvailable,
            typicalCost: enhancement.typicalCost,
            insuranceTier: enhancement.insuranceTier,
            isFirstLine: enhancement.isFirstLine,
            panceYield: enhancement.panceYield
          }
      // Rate limit - 2 seconds for 2.0-flash-exp (higher quality, needs more time)
      await new Promise(r => setTimeout(r, 2000));
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      console.error(`  ✗ Failed: ${drug.genericName}`, errorMsg.slice(0, 200));
      
      // Continue on error rather than crashing
      if (errorMsg.includes('RATE_LIMIT')) {
        console.log('  ⏸️  Rate limited, waiting 10 seconds...');
        await new Promise(r => setTimeout(r, 10000));
      }
    }
  }

  console.log('\n✅ Drug enhancement complete!');
  await prisma.$disconnect();
}   } catch (err) {
      console.error(`  ✗ Failed: ${drug.genericName}`, err);
    }
  }

  await prisma.$disconnect();
}

// CLI
const args = process.argv.slice(2);
const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '10');
const dryRun = args.includes('--dry-run');

enhanceDrugs({ limit, dryRun });
