/**
 * PhysiologyConcept Entry Generator v2
 * Creates missing physiology concepts for PANCE coverage
 * Fixed to match Prisma schema exactly
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// PANCE-relevant physiology concepts
const PANCE_PHYSIOLOGY_CONCEPTS = [
  { name: 'Starling Forces', category: 'Fluid Dynamics', system: 'Cardiovascular' },
  { name: 'Cardiac Action Potential', category: 'Electrophysiology', system: 'Cardiovascular' },
  { name: 'Pacemaker Cells', category: 'Electrophysiology', system: 'Cardiovascular' },
  { name: 'Baroreceptor Reflex', category: 'Autonomic Regulation', system: 'Cardiovascular' },
  { name: 'Frank-Starling Mechanism', category: 'Cardiac Mechanics', system: 'Cardiovascular' },
  { name: 'Preload and Afterload', category: 'Cardiac Mechanics', system: 'Cardiovascular' },
  { name: 'Cardiac Output Determinants', category: 'Cardiac Mechanics', system: 'Cardiovascular' },
  { name: 'Oxygen-Hemoglobin Dissociation Curve', category: 'Gas Exchange', system: 'Pulmonary' },
  { name: 'Ventilation-Perfusion Matching', category: 'Gas Exchange', system: 'Pulmonary' },
  { name: 'Pulmonary Compliance', category: 'Respiratory Mechanics', system: 'Pulmonary' },
  { name: 'Surfactant Function', category: 'Respiratory Mechanics', system: 'Pulmonary' },
  {
    name: 'Hypoxic Pulmonary Vasoconstriction',
    category: 'Pulmonary Circulation',
    system: 'Pulmonary',
  },
  { name: 'Glomerular Filtration', category: 'Renal Physiology', system: 'Genitourinary' },
  { name: 'Countercurrent Multiplier', category: 'Renal Physiology', system: 'Genitourinary' },
  {
    name: 'Renin-Angiotensin-Aldosterone System',
    category: 'Endocrine Regulation',
    system: 'Genitourinary',
  },
  { name: 'ADH and Water Balance', category: 'Fluid Balance', system: 'Genitourinary' },
  { name: 'Acid-Base Compensation', category: 'Acid-Base', system: 'Pulmonary' },
  { name: 'Henderson-Hasselbalch Equation', category: 'Acid-Base', system: 'Pulmonary' },
  { name: 'Anion Gap Calculation', category: 'Acid-Base', system: 'Pulmonary' },
  { name: 'Osmolality Regulation', category: 'Fluid Balance', system: 'Genitourinary' },
  { name: 'Sodium Balance', category: 'Electrolyte Physiology', system: 'Genitourinary' },
  { name: 'Potassium Balance', category: 'Electrolyte Physiology', system: 'Genitourinary' },
  { name: 'Calcium Homeostasis', category: 'Electrolyte Physiology', system: 'Endocrine' },
  { name: 'Thyroid Hormone Axis', category: 'Endocrine Regulation', system: 'Endocrine' },
  { name: 'Cortisol Regulation', category: 'Endocrine Regulation', system: 'Endocrine' },
  { name: 'Insulin and Glucose Homeostasis', category: 'Metabolism', system: 'Endocrine' },
  { name: 'Growth Hormone Axis', category: 'Endocrine Regulation', system: 'Endocrine' },
  {
    name: 'Menstrual Cycle Physiology',
    category: 'Reproductive Physiology',
    system: 'Reproductive',
  },
  { name: 'Spermatogenesis', category: 'Reproductive Physiology', system: 'Reproductive' },
  { name: 'Gastric Acid Secretion', category: 'GI Physiology', system: 'Gastrointestinal' },
  { name: 'Bile Formation and Secretion', category: 'GI Physiology', system: 'Gastrointestinal' },
  { name: 'Intestinal Absorption', category: 'GI Physiology', system: 'Gastrointestinal' },
  { name: 'Neuromuscular Junction', category: 'Neuromuscular', system: 'Neurological' },
  { name: 'Muscle Contraction', category: 'Neuromuscular', system: 'Musculoskeletal' },
  { name: 'Pain Pathway', category: 'Sensory Physiology', system: 'Neurological' },
  { name: 'Coagulation Cascade', category: 'Hemostasis', system: 'Hematologic' },
  { name: 'Fibrinolysis', category: 'Hemostasis', system: 'Hematologic' },
  { name: 'Immune Response - Innate', category: 'Immunology', system: 'Immunology' },
  { name: 'Immune Response - Adaptive', category: 'Immunology', system: 'Immunology' },
  { name: 'Inflammation Cascade', category: 'Immunology', system: 'Immunology' },
];

interface PhysiologyConceptData {
  displayName?: string;
  aliases?: string[];
  description?: string;
  mechanism?: string;
  clinicalSignificance?: string;
  relatedConditions?: string[];
  relatedDrugs?: string[];
  associatedLabs?: string[];
  panceYield?: number;
  isHighYield?: boolean;
  boardYieldFacts?: string[];
  clinicalPearls?: string[];
  commonMistakes?: string[];
  compareContrast?: Record<string, string>;
  compensatoryMechanisms?: string[];
  curveDescription?: string;
  curveType?: string;
  curveShifts?: Record<string, string>;
  decompensationSigns?: string[];
  drugEffects?: Record<string, string>;
  drugTargets?: string[];
  feedbackLoops?: string;
  graphUrl?: string;
  keyEquations?: Record<string, string>;
  labChanges?: Record<string, string>;
  mnemonics?: string[];
  molecularBasis?: string;
  normalValues?: string;
  pathophysiology?: string;
  regulatoryFactors?: string[];
  signalTransduction?: string;
  testQuestionTips?: string[];
}

// Rate limiter
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  constructor(
    private capacity: number = 5,
    private refillRate: number = 0.5
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }
  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens < 1) {
      const waitTime = ((1 - this.tokens) / this.refillRate) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.refill();
    }
    this.tokens -= 1;
  }
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

const rateLimiter = new TokenBucket();

async function generatePhysiologyConceptData(
  name: string,
  category: string,
  system: string
): Promise<PhysiologyConceptData> {
  await rateLimiter.acquire();

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  });

  const prompt = `Generate comprehensive physiology concept information for: ${name}

Category: ${category}
System: ${system}

Provide accurate, PANCE/board-focused data including:
- Display name and aliases
- Description of the concept
- Underlying mechanism
- Clinical significance
- Related conditions and drugs
- Associated lab values
- PANCE yield (1-10) and whether high-yield
- Board yield facts
- Clinical pearls and common mistakes
- Compare/contrast with related concepts (as object)
- Compensatory mechanisms
- Curve description (if applicable), curve type, curve shifts (as object with cause: direction pairs)
- Decompensation signs
- Drug effects (as object with drug: effect pairs)
- Drug targets in this pathway
- Feedback loops description
- Key equations (as object with name: formula pairs)
- Lab changes (as object with lab: expected change pairs)
- Mnemonics
- Molecular basis
- Normal values
- Pathophysiology
- Regulatory factors
- Signal transduction pathway
- Test question tips

Return as JSON.`;

  const response = await model.generateContent(prompt);
  const text = response.response.text();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  return JSON.parse(jsonMatch[0]);
}

function ensureString(val: unknown): string | null {
  if (val === undefined || val === null) return null;
  if (typeof val === 'string') return val;
  return String(val);
}

function ensureArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') return [val];
  return [];
}

function ensureInt(val: unknown): number | null {
  if (val === undefined || val === null) return null;
  if (typeof val === 'number') return Math.round(val);
  if (typeof val === 'string') {
    const num = parseInt(val);
    if (!isNaN(num)) return num;
  }
  return null;
}

function ensureBool(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  return false;
}

function ensureJson(val: unknown): Prisma.InputJsonValue | null {
  if (val === undefined || val === null) return null;
  if (typeof val === 'object') return val as Prisma.InputJsonValue;
  return null;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║          PHYSIOLOGY CONCEPT ENTRY GENERATOR v2                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  try {
    const existing = await prisma.physiologyConcept.findMany({ select: { name: true } });
    const existingNames = new Set(existing.map((e) => e.name.toLowerCase()));

    const missing = PANCE_PHYSIOLOGY_CONCEPTS.filter(
      (concept) => !existingNames.has(concept.name.toLowerCase())
    );

    console.log(`Existing: ${existing.length}`);
    console.log(`Missing: ${missing.length}`);
    console.log(`Will generate: ${missing.length}\n`);

    if (missing.length === 0) {
      console.log('All physiology concepts already exist!');
      return;
    }

    let success = 0;
    let failed = 0;

    for (let i = 0; i < missing.length; i++) {
      const concept = missing[i];
      console.log(`Processing [${i + 1}/${missing.length}]: ${concept.name}`);

      try {
        const data = await generatePhysiologyConceptData(
          concept.name,
          concept.category,
          concept.system
        );

        await prisma.physiologyConcept.create({
          data: {
            id: randomUUID(),
            name: concept.name,
            displayName: ensureString(data.displayName),
            aliases: ensureArray(data.aliases),
            system: concept.system,
            category: concept.category,
            description: ensureString(data.description),
            mechanism: ensureString(data.mechanism),
            clinicalSignificance: ensureString(data.clinicalSignificance),
            relatedConditions: ensureArray(data.relatedConditions),
            relatedDrugs: ensureArray(data.relatedDrugs),
            associatedLabs: ensureArray(data.associatedLabs),
            panceYield: ensureInt(data.panceYield),
            isHighYield: ensureBool(data.isHighYield),
            boardYieldFacts: ensureArray(data.boardYieldFacts),
            clinicalPearls: ensureArray(data.clinicalPearls),
            commonMistakes: ensureArray(data.commonMistakes),
            compareContrast: ensureJson(data.compareContrast),
            compensatoryMechanisms: ensureArray(data.compensatoryMechanisms),
            curveDescription: ensureString(data.curveDescription),
            curveType: ensureString(data.curveType),
            curveShifts: ensureJson(data.curveShifts),
            decompensationSigns: ensureArray(data.decompensationSigns),
            drugEffects: ensureJson(data.drugEffects),
            drugTargets: ensureArray(data.drugTargets),
            feedbackLoops: ensureString(data.feedbackLoops),
            graphUrl: ensureString(data.graphUrl),
            keyEquations: ensureJson(data.keyEquations),
            labChanges: ensureJson(data.labChanges),
            mnemonics: ensureArray(data.mnemonics),
            molecularBasis: ensureString(data.molecularBasis),
            normalValues: ensureString(data.normalValues),
            pathophysiology: ensureString(data.pathophysiology),
            regulatoryFactors: ensureArray(data.regulatoryFactors),
            signalTransduction: ensureString(data.signalTransduction),
            testQuestionTips: ensureArray(data.testQuestionTips),
            updatedAt: new Date(),
          },
        });

        console.log(`  ✅ Created`);
        success++;
      } catch (error) {
        console.error(`  ❌ Error: ${error}`);
        failed++;
      }
    }

    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║                         SUMMARY                                  ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log(`Created: ${success}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total physiology concepts now: ${existing.length + success}`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
