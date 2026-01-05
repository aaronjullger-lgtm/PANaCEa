/**
 * LabTest Entry Generator
 * Creates new LabTest records for common labs that are missing from the database
 * 
 * Usage:
 *   npx tsx scripts/generators/labtest-entry-generator.ts --batch=5
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Common lab tests that should exist in the database
const COMMON_LABS = [
  // Basic Chemistry
  { name: "Anion Gap", category: "Metabolic", typicalUse: "Metabolic acidosis workup, identifying causes of acidosis" },
  { name: "Bicarbonate (HCO3)", category: "Electrolytes", typicalUse: "Acid-base status evaluation, metabolic disorders" },
  { name: "BUN/Creatinine Ratio", category: "Renal", typicalUse: "Differentiating prerenal from renal causes of azotemia" },
  { name: "Chloride (Cl)", category: "Electrolytes", typicalUse: "Electrolyte imbalance, metabolic disorders" },
  
  // Hematology
  { name: "Absolute Neutrophil Count (ANC)", category: "Hematology", typicalUse: "Infection risk assessment, chemotherapy monitoring" },
  { name: "Absolute Lymphocyte Count", category: "Hematology", typicalUse: "Immune function assessment, HIV monitoring" },
  { name: "Immature Platelet Fraction (IPF)", category: "Hematology", typicalUse: "Thrombocytopenia evaluation, bone marrow function" },
  { name: "Nucleated RBC Count", category: "Hematology", typicalUse: "Hemolysis, bone marrow stress, newborn evaluation" },
  
  // Cardiac
  { name: "Pro-BNP", category: "Cardiac", typicalUse: "Heart failure diagnosis and monitoring" },
  { name: "High-Sensitivity CRP (hs-CRP)", category: "Cardiac", typicalUse: "Cardiovascular risk assessment, inflammation" },
  { name: "Homocysteine", category: "Cardiac", typicalUse: "Cardiovascular risk assessment, B12/folate deficiency" },
  { name: "Myoglobin", category: "Cardiac", typicalUse: "Acute MI diagnosis, rhabdomyolysis" },
  
  // Liver
  { name: "Direct Bilirubin", category: "Hepatic", typicalUse: "Conjugated hyperbilirubinemia, cholestasis" },
  { name: "Indirect Bilirubin", category: "Hepatic", typicalUse: "Unconjugated hyperbilirubinemia, hemolysis" },
  { name: "AST/ALT Ratio", category: "Hepatic", typicalUse: "Differentiating liver disease etiology" },
  { name: "GGTP (GGT)", category: "Hepatic", typicalUse: "Cholestasis, alcohol use, hepatobiliary disease" },
  
  // Endocrine
  { name: "Free T4", category: "Endocrine", typicalUse: "Thyroid function evaluation" },
  { name: "Free T3", category: "Endocrine", typicalUse: "Hyperthyroidism evaluation, thyroid function" },
  { name: "Reverse T3", category: "Endocrine", typicalUse: "Euthyroid sick syndrome, non-thyroidal illness" },
  { name: "Anti-TPO Antibodies", category: "Endocrine", typicalUse: "Autoimmune thyroid disease diagnosis" },
  { name: "Random Cortisol", category: "Endocrine", typicalUse: "Adrenal function screening" },
  { name: "1-Hour Post-Glucose Load", category: "Endocrine", typicalUse: "Gestational diabetes screening" },
  { name: "2-Hour Post-Glucose Load", category: "Endocrine", typicalUse: "Diabetes diagnosis, OGTT" },
  { name: "Fasting Insulin", category: "Endocrine", typicalUse: "Insulin resistance, hyperinsulinemia" },
  { name: "HOMA-IR", category: "Endocrine", typicalUse: "Insulin resistance quantification" },
  
  // Coagulation
  { name: "Thrombin Time (TT)", category: "Coagulation", typicalUse: "Fibrinogen abnormalities, heparin effect" },
  { name: "Fibrinogen", category: "Coagulation", typicalUse: "DIC workup, coagulation disorders, inflammation" },
  { name: "Factor V Leiden", category: "Coagulation", typicalUse: "Thrombophilia evaluation" },
  { name: "Prothrombin G20210A", category: "Coagulation", typicalUse: "Thrombophilia evaluation" },
  { name: "Antithrombin III", category: "Coagulation", typicalUse: "Thrombophilia evaluation, heparin resistance" },
  { name: "Mixing Study", category: "Coagulation", typicalUse: "Prolonged PTT workup - factor deficiency vs inhibitor" },
  { name: "Lupus Anticoagulant", category: "Coagulation", typicalUse: "Antiphospholipid syndrome, thrombophilia" },
  { name: "Anti-Xa Level", category: "Coagulation", typicalUse: "LMWH/fondaparinux monitoring" },
  
  // Renal
  { name: "Urine Sodium", category: "Renal", typicalUse: "Volume status, AKI differentiation" },
  { name: "Fractional Excretion of Sodium (FENa)", category: "Renal", typicalUse: "AKI differentiation - prerenal vs ATN" },
  { name: "Urine Osmolality", category: "Renal", typicalUse: "Concentrating ability, SIADH workup" },
  { name: "Urine Specific Gravity", category: "Renal", typicalUse: "Hydration status, concentrating ability" },
  { name: "Cystatin C", category: "Renal", typicalUse: "GFR estimation, especially in muscle wasting" },
  { name: "Spot Urine Protein/Creatinine Ratio", category: "Renal", typicalUse: "Proteinuria quantification" },
  { name: "24-Hour Urine Protein", category: "Renal", typicalUse: "Nephrotic syndrome quantification" },
  
  // Infectious Disease
  { name: "Blood Culture", category: "Infectious Disease", typicalUse: "Bacteremia/septicemia diagnosis" },
  { name: "Urine Culture", category: "Infectious Disease", typicalUse: "UTI diagnosis, pathogen identification" },
  { name: "Wound Culture", category: "Infectious Disease", typicalUse: "Wound infection diagnosis" },
  { name: "CSF Culture", category: "Infectious Disease", typicalUse: "Meningitis diagnosis" },
  { name: "Stool Culture", category: "Infectious Disease", typicalUse: "Bacterial gastroenteritis diagnosis" },
  { name: "Rapid Strep Test", category: "Infectious Disease", typicalUse: "Group A strep pharyngitis diagnosis" },
  { name: "COVID-19 PCR", category: "Infectious Disease", typicalUse: "SARS-CoV-2 infection diagnosis" },
  { name: "COVID-19 Antigen", category: "Infectious Disease", typicalUse: "Rapid SARS-CoV-2 detection" },
  { name: "Rapid Flu Test", category: "Infectious Disease", typicalUse: "Influenza A/B rapid detection" },
  { name: "C. difficile Toxin", category: "Infectious Disease", typicalUse: "C. diff colitis diagnosis" },
  { name: "Quantiferon-TB Gold", category: "Infectious Disease", typicalUse: "Latent TB infection diagnosis" },
  
  // Urinalysis
  { name: "Urine pH", category: "Urinalysis", typicalUse: "Acidification disorders, stone risk" },
  { name: "Urine Leukocyte Esterase", category: "Urinalysis", typicalUse: "Pyuria detection, UTI screening" },
  { name: "Urine RBC", category: "Urinalysis", typicalUse: "Hematuria detection, glomerular disease" },
  { name: "Urine WBC", category: "Urinalysis", typicalUse: "Pyuria, UTI, interstitial nephritis" },
  { name: "Urine Casts", category: "Urinalysis", typicalUse: "Renal disease localization" },
  { name: "Urine Bacteria", category: "Urinalysis", typicalUse: "Bacteriuria detection" },
  
  // Immunology
  { name: "Anti-CCP Antibodies", category: "Immunology", typicalUse: "Rheumatoid arthritis diagnosis" },
  { name: "Anti-dsDNA Antibodies", category: "Immunology", typicalUse: "SLE diagnosis and activity" },
  { name: "Anti-Smith Antibodies", category: "Immunology", typicalUse: "SLE-specific antibody" },
  { name: "Anti-SSA/Ro Antibodies", category: "Immunology", typicalUse: "Sjögren syndrome, SLE, neonatal lupus" },
  { name: "Anti-SSB/La Antibodies", category: "Immunology", typicalUse: "Sjögren syndrome" },
  { name: "C3 Complement", category: "Immunology", typicalUse: "Complement consumption, SLE activity" },
  { name: "C4 Complement", category: "Immunology", typicalUse: "Complement consumption, hereditary angioedema" },
  { name: "Quantitative Immunoglobulins", category: "Immunology", typicalUse: "Immunodeficiency, multiple myeloma" },
  
  // Tumor Markers
  { name: "CEA (Carcinoembryonic Antigen)", category: "Tumor Markers", typicalUse: "Colorectal cancer monitoring" },
  { name: "AFP (Alpha-Fetoprotein)", category: "Tumor Markers", typicalUse: "Liver cancer, germ cell tumors" },
  { name: "Beta-hCG", category: "Tumor Markers", typicalUse: "Pregnancy, gestational trophoblastic disease" },
  { name: "LDH (Lactate Dehydrogenase)", category: "Tumor Markers", typicalUse: "Tumor burden, hemolysis, tissue damage" },
  
  // Toxicology
  { name: "Urine Drug Screen", category: "Toxicology", typicalUse: "Drug abuse screening" },
  { name: "Blood Alcohol Level", category: "Toxicology", typicalUse: "Alcohol intoxication" },
  { name: "Carboxyhemoglobin", category: "Toxicology", typicalUse: "Carbon monoxide poisoning" },
  { name: "Methemoglobin", category: "Toxicology", typicalUse: "Methemoglobinemia diagnosis" },
  { name: "Lithium Level", category: "Toxicology", typicalUse: "Lithium therapeutic monitoring" },
  { name: "Digoxin Level", category: "Toxicology", typicalUse: "Digoxin therapeutic monitoring" },
  { name: "Vancomycin Level", category: "Toxicology", typicalUse: "Vancomycin therapeutic monitoring" },
  { name: "Gentamicin Level", category: "Toxicology", typicalUse: "Aminoglycoside therapeutic monitoring" },
  { name: "Phenytoin Level", category: "Toxicology", typicalUse: "Seizure medication monitoring" },
  { name: "Valproic Acid Level", category: "Toxicology", typicalUse: "Seizure medication monitoring" },
  { name: "Carbamazepine Level", category: "Toxicology", typicalUse: "Seizure medication monitoring" },
  
  // Vitamins & Minerals
  { name: "Iron Studies Panel", category: "Hematology", typicalUse: "Iron deficiency vs overload" },
  { name: "TIBC (Total Iron Binding Capacity)", category: "Hematology", typicalUse: "Iron deficiency evaluation" },
  { name: "Transferrin Saturation", category: "Hematology", typicalUse: "Iron status evaluation" },
  { name: "Zinc Level", category: "Vitamins", typicalUse: "Zinc deficiency, wound healing" },
  { name: "Copper Level", category: "Vitamins", typicalUse: "Wilson disease, copper deficiency" },
  { name: "Ceruloplasmin", category: "Hepatic", typicalUse: "Wilson disease diagnosis" },
];

// Schema for Gemini response
const labTestSchema = {
  type: SchemaType.OBJECT,
  properties: {
    description: { type: SchemaType.STRING },
    conventionalRange: { type: SchemaType.STRING },
    units: { type: SchemaType.STRING },
    siRange: { type: SchemaType.STRING },
    siUnits: { type: SchemaType.STRING },
    sampleType: { type: SchemaType.STRING },
    collectionTube: { type: SchemaType.STRING },
    fastingRequired: { type: SchemaType.BOOLEAN },
    turnaroundTime: { type: SchemaType.STRING },
    stability: { type: SchemaType.STRING },
    specialInstructions: { type: SchemaType.STRING },
    interpretationSteps: { type: SchemaType.STRING },
    falsePosNeg: { type: SchemaType.STRING },
    increaseIndicates: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    decreaseIndicates: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    commonAbnormalities: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    whenToOrder: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    followUpTests: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    relatedTests: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    interferingFactors: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    clinicalPearls: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    boardYieldFacts: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    testQuestionTips: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    commonMistakes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    mnemonics: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ["description", "conventionalRange", "sampleType", "clinicalPearls", "boardYieldFacts"],
};

interface LabTestData {
  description?: string;
  conventionalRange?: string;
  units?: string;
  siRange?: string;
  siUnits?: string;
  sampleType?: string;
  collectionTube?: string;
  fastingRequired?: boolean;
  turnaroundTime?: string;
  stability?: string;
  specialInstructions?: string;
  interpretationSteps?: string;
  falsePosNeg?: string;
  increaseIndicates?: string[];
  decreaseIndicates?: string[];
  commonAbnormalities?: string[];
  whenToOrder?: string[];
  followUpTests?: string[];
  relatedTests?: string[];
  interferingFactors?: string[];
  clinicalPearls?: string[];
  boardYieldFacts?: string[];
  testQuestionTips?: string[];
  commonMistakes?: string[];
  mnemonics?: string[];
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
      const waitTime = (1 - this.tokens) / this.refillRate * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
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

async function generateLabTestData(
  name: string,
  category: string,
  typicalUse: string
): Promise<LabTestData> {
  await rateLimiter.acquire();
  
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-pro",
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
    },
  });

  const prompt = `Generate comprehensive laboratory test information for: ${name}

Category: ${category}
Typical Use: ${typicalUse}

Provide complete, clinically accurate, PANCE/board exam-focused data in this exact JSON format:
{
  "description": "Brief clinical description of the test (2-3 sentences)",
  "conventionalRange": "Normal range in conventional US units",
  "units": "Unit of measurement (conventional)",
  "siRange": "Normal range in SI units",
  "siUnits": "Unit of measurement (SI)",
  "sampleType": "Blood, Serum, Plasma, Urine, etc.",
  "collectionTube": "Tube color and type (e.g., Lavender EDTA)",
  "fastingRequired": true/false,
  "turnaroundTime": "Typical result time",
  "stability": "Sample stability and storage",
  "specialInstructions": "Collection instructions, transport requirements",
  "interpretationSteps": "Step-by-step interpretation guide as a single text",
  "falsePosNeg": "Causes of false positives and negatives",
  "increaseIndicates": ["Condition 1", "Condition 2", "Condition 3"],
  "decreaseIndicates": ["Condition 1", "Condition 2", "Condition 3"],
  "commonAbnormalities": ["Finding 1", "Finding 2", "Finding 3"],
  "whenToOrder": ["Indication 1", "Indication 2", "Indication 3"],
  "followUpTests": ["Test 1", "Test 2"],
  "relatedTests": ["Test 1", "Test 2"],
  "interferingFactors": ["Factor 1", "Factor 2"],
  "clinicalPearls": ["Pearl 1 - high-yield clinical fact", "Pearl 2"],
  "boardYieldFacts": ["High-yield board fact 1", "High-yield board fact 2"],
  "testQuestionTips": ["How this appears in exam questions", "Key stem phrases"],
  "commonMistakes": ["Common student mistake 1", "Mistake 2"],
  "mnemonics": ["Memory aid for interpretation", "Mnemonic for causes"]
}

Be accurate, clinically relevant, and focused on PANCE/board exam content.
For arrays, provide 3-5 items each. For qualitative tests, adapt as appropriate.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  try {
    return JSON.parse(text) as LabTestData;
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as LabTestData;
    }
    throw new Error(`Failed to parse response for ${name}`);
  }
}

// Helper functions
const ensureString = (val: any): string => {
  if (Array.isArray(val)) return val.join('. ');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val || '');
};

const ensureArray = (val: any): string[] => {
  if (Array.isArray(val)) return val.map(v => String(v));
  if (typeof val === 'string') return val.split('. ').filter(s => s.trim());
  return [];
};

async function main() {
  const args = process.argv.slice(2);
  const batchArg = args.find(a => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : 5;
  const skipArg = args.find(a => a.startsWith('--skip='));
  const skip = skipArg ? parseInt(skipArg.split('=')[1]) : 0;
  
  console.log('🧪 LabTest Entry Generator');
  console.log('============================================================');
  console.log(`Batch size: ${batchSize}, Skip: ${skip}\n`);
  
  try {
    // Get existing lab test names to avoid duplicates
    const existingLabs = await prisma.labTest.findMany({
      select: { name: true }
    });
    const existingNames = new Set(existingLabs.map(l => l.name.toLowerCase()));
    
    // Filter out labs that already exist
    const labsToCreate = COMMON_LABS.filter(lab => 
      !existingNames.has(lab.name.toLowerCase())
    );
    
    console.log(`Found ${labsToCreate.length} labs to create (${COMMON_LABS.length - labsToCreate.length} already exist)\n`);
    
    // Apply batch/skip
    const batch = labsToCreate.slice(skip, skip + batchSize);
    
    if (batch.length === 0) {
      console.log('No more labs to create in this batch.');
      return;
    }
    
    console.log(`Processing ${batch.length} labs in this batch\n`);
    
    let success = 0;
    let failed = 0;
    
    for (const lab of batch) {
      try {
        console.log(`\n📋 Creating: ${lab.name} (${lab.category})`);
        
        const data = await generateLabTestData(lab.name, lab.category, lab.typicalUse);
        
        await prisma.labTest.create({
          data: {
            id: randomUUID(),
            name: lab.name,
            category: lab.category,
            typicalUse: lab.typicalUse,
            conventionalRange: ensureString(data.conventionalRange),
            units: ensureString(data.units),
            siRange: ensureString(data.siRange),
            siUnits: ensureString(data.siUnits),
            sampleType: ensureString(data.sampleType),
            collectionTube: ensureString(data.collectionTube),
            fastingRequired: Boolean(data.fastingRequired),
            turnaroundTime: ensureString(data.turnaroundTime),
            stability: ensureString(data.stability),
            specialInstructions: ensureString(data.specialInstructions),
            interpretationSteps: ensureString(data.interpretationSteps),
            falsePosNeg: ensureString(data.falsePosNeg),
            increaseIndicates: ensureArray(data.increaseIndicates),
            decreaseIndicates: ensureArray(data.decreaseIndicates),
            commonAbnormalities: ensureArray(data.commonAbnormalities),
            whenToOrder: ensureArray(data.whenToOrder),
            followUpTests: ensureArray(data.followUpTests),
            relatedTests: ensureArray(data.relatedTests),
            interferingFactors: ensureArray(data.interferingFactors),
            clinicalPearls: ensureArray(data.clinicalPearls),
            boardYieldFacts: ensureArray(data.boardYieldFacts),
            testQuestionTips: ensureArray(data.testQuestionTips),
            commonMistakes: ensureArray(data.commonMistakes),
            mnemonics: ensureArray(data.mnemonics),
            updatedAt: new Date(),
          }
        });
        
        console.log(`  ✅ Created with all fields`);
        console.log(`     Range: ${data.conventionalRange} ${data.units}`);
        success++;
        
      } catch (error) {
        console.error(`  ❌ Error: ${error}`);
        failed++;
      }
    }
    
    console.log('\n============================================================');
    console.log(`✅ Created: ${success}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Success rate: ${((success / batch.length) * 100).toFixed(1)}%`);
    
    // Show remaining
    const remaining = labsToCreate.length - skip - batchSize;
    if (remaining > 0) {
      console.log(`\n📋 Remaining labs to create: ${remaining}`);
      console.log(`   Run with --skip=${skip + batchSize} to continue`);
    } else {
      console.log('\n🎉 All common labs have been created!');
    }
    
  } finally {
    await prisma.$disconnect();
  }
}

main();
