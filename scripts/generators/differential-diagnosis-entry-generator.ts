/**
 * DifferentialDiagnosis Entry Generator
 * Creates missing differential diagnosis entries for PANCE coverage
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// PANCE-relevant differential diagnosis presentations
const PANCE_DIFFERENTIAL_DIAGNOSES = [
  // Chief Complaints - Cardiovascular
  { name: 'Chest Pain', category: 'Cardiovascular', context: 'Acute chest pain differential' },
  { name: 'Palpitations', category: 'Cardiovascular', context: 'Awareness of heartbeat' },
  { name: 'Syncope', category: 'Cardiovascular', context: 'Transient loss of consciousness' },
  { name: 'Lower Extremity Edema', category: 'Cardiovascular', context: 'Bilateral leg swelling' },
  {
    name: 'Dyspnea on Exertion',
    category: 'Cardiovascular',
    context: 'Shortness of breath with activity',
  },

  // Chief Complaints - Pulmonary
  { name: 'Acute Dyspnea', category: 'Pulmonary', context: 'Sudden shortness of breath' },
  { name: 'Chronic Cough', category: 'Pulmonary', context: 'Cough > 8 weeks' },
  { name: 'Hemoptysis', category: 'Pulmonary', context: 'Coughing up blood' },
  { name: 'Wheezing', category: 'Pulmonary', context: 'High-pitched breath sounds' },
  { name: 'Pleuritic Chest Pain', category: 'Pulmonary', context: 'Sharp, positional chest pain' },

  // Chief Complaints - GI
  { name: 'Acute Abdominal Pain', category: 'GI', context: 'Sudden onset abdominal pain' },
  { name: 'Right Upper Quadrant Pain', category: 'GI', context: 'RUQ pain differential' },
  { name: 'Right Lower Quadrant Pain', category: 'GI', context: 'RLQ pain differential' },
  { name: 'Left Lower Quadrant Pain', category: 'GI', context: 'LLQ pain differential' },
  { name: 'Epigastric Pain', category: 'GI', context: 'Upper central abdominal pain' },
  { name: 'Nausea and Vomiting', category: 'GI', context: 'N/V differential' },
  { name: 'Acute Diarrhea', category: 'GI', context: 'Diarrhea < 2 weeks' },
  { name: 'Chronic Diarrhea', category: 'GI', context: 'Diarrhea > 4 weeks' },
  { name: 'Melena', category: 'GI', context: 'Black tarry stools' },
  { name: 'Hematochezia', category: 'GI', context: 'Bright red blood per rectum' },
  { name: 'Jaundice', category: 'GI', context: 'Yellow discoloration of skin/sclera' },
  { name: 'Dysphagia', category: 'GI', context: 'Difficulty swallowing' },

  // Chief Complaints - Neurological
  {
    name: 'Headache',
    category: 'Neurological',
    context: 'Acute and chronic headache differential',
  },
  {
    name: 'Acute Altered Mental Status',
    category: 'Neurological',
    context: 'Sudden confusion, delirium',
  },
  {
    name: 'Dizziness',
    category: 'Neurological',
    context: 'Vertigo vs lightheadedness vs disequilibrium',
  },
  { name: 'Weakness', category: 'Neurological', context: 'Focal vs generalized weakness' },
  { name: 'Seizure', category: 'Neurological', context: 'New onset seizure differential' },
  { name: 'Numbness and Tingling', category: 'Neurological', context: 'Paresthesias differential' },
  { name: 'Tremor', category: 'Neurological', context: 'Involuntary rhythmic movement' },
  { name: 'Ataxia', category: 'Neurological', context: 'Coordination and gait problems' },

  // Chief Complaints - Musculoskeletal
  {
    name: 'Low Back Pain',
    category: 'Musculoskeletal',
    context: 'Acute and chronic LBP differential',
  },
  { name: 'Neck Pain', category: 'Musculoskeletal', context: 'Cervical pain differential' },
  { name: 'Shoulder Pain', category: 'Musculoskeletal', context: 'Shoulder pain differential' },
  { name: 'Knee Pain', category: 'Musculoskeletal', context: 'Knee pain differential' },
  { name: 'Hip Pain', category: 'Musculoskeletal', context: 'Hip pain differential' },
  {
    name: 'Monoarticular Joint Pain',
    category: 'Musculoskeletal',
    context: 'Single joint arthritis',
  },
  {
    name: 'Polyarticular Joint Pain',
    category: 'Musculoskeletal',
    context: 'Multiple joint arthritis',
  },

  // Chief Complaints - Genitourinary
  { name: 'Dysuria', category: 'GU', context: 'Painful urination' },
  { name: 'Hematuria', category: 'GU', context: 'Blood in urine' },
  { name: 'Flank Pain', category: 'GU', context: 'Lateral back pain' },
  { name: 'Scrotal Pain', category: 'GU', context: 'Testicular pain differential' },
  { name: 'Pelvic Pain', category: 'GU', context: 'Female pelvic pain' },
  { name: 'Vaginal Bleeding', category: 'GU', context: 'Abnormal uterine bleeding' },
  { name: 'Urinary Retention', category: 'GU', context: 'Inability to void' },

  // Chief Complaints - Dermatologic
  { name: 'Rash', category: 'Dermatologic', context: 'Generalized rash differential' },
  { name: 'Pruritus', category: 'Dermatologic', context: 'Itching without rash' },
  { name: 'Skin Lesion', category: 'Dermatologic', context: 'Single skin lesion differential' },
  { name: 'Hair Loss', category: 'Dermatologic', context: 'Alopecia differential' },

  // Chief Complaints - ENT
  { name: 'Sore Throat', category: 'ENT', context: 'Pharyngitis differential' },
  { name: 'Ear Pain', category: 'ENT', context: 'Otalgia differential' },
  { name: 'Hearing Loss', category: 'ENT', context: 'Sudden vs gradual hearing loss' },
  { name: 'Epistaxis', category: 'ENT', context: 'Nosebleed differential' },
  { name: 'Hoarseness', category: 'ENT', context: 'Voice changes differential' },

  // Chief Complaints - Ophthalmologic
  { name: 'Red Eye', category: 'Ophthalmologic', context: 'Conjunctival injection differential' },
  { name: 'Vision Loss', category: 'Ophthalmologic', context: 'Acute vs chronic vision loss' },
  { name: 'Eye Pain', category: 'Ophthalmologic', context: 'Ocular pain differential' },
  { name: 'Double Vision', category: 'Ophthalmologic', context: 'Diplopia differential' },

  // Chief Complaints - Psychiatric
  { name: 'Anxiety', category: 'Psychiatric', context: 'Anxiety disorder differential' },
  { name: 'Depression', category: 'Psychiatric', context: 'Depressed mood differential' },
  { name: 'Insomnia', category: 'Psychiatric', context: 'Sleep disturbance differential' },

  // Chief Complaints - Systemic
  { name: 'Fever of Unknown Origin', category: 'Systemic', context: 'Prolonged unexplained fever' },
  { name: 'Fatigue', category: 'Systemic', context: 'Chronic fatigue differential' },
  { name: 'Weight Loss', category: 'Systemic', context: 'Unintentional weight loss' },
  { name: 'Lymphadenopathy', category: 'Systemic', context: 'Enlarged lymph nodes' },
  { name: 'Night Sweats', category: 'Systemic', context: 'Drenching night sweats' },

  // Abnormal Findings
  { name: 'Anemia', category: 'Hematologic', context: 'Low hemoglobin differential' },
  { name: 'Thrombocytopenia', category: 'Hematologic', context: 'Low platelet count' },
  { name: 'Leukocytosis', category: 'Hematologic', context: 'Elevated WBC count' },
  { name: 'Elevated Liver Enzymes', category: 'GI', context: 'Transaminitis differential' },
  { name: 'Hyponatremia', category: 'Endocrine', context: 'Low sodium differential' },
  { name: 'Hyperkalemia', category: 'Endocrine', context: 'High potassium differential' },
  { name: 'Hypercalcemia', category: 'Endocrine', context: 'Elevated calcium differential' },
  { name: 'Proteinuria', category: 'Renal', context: 'Protein in urine differential' },
];

// Schema for Gemini response
const differentialSchema = {
  type: SchemaType.OBJECT,
  properties: {
    description: { type: SchemaType.STRING },
    commonCauses: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    emergentCauses: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    lifeThreatening: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    keyHistoryQuestions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    physicalExamFindings: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    initialWorkup: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    redFlags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    diagnosticApproach: { type: SchemaType.STRING },
    clinicalPearls: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    boardYieldFacts: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    mnemonics: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: [
    'description',
    'commonCauses',
    'lifeThreatening',
    'redFlags',
    'clinicalPearls',
    'boardYieldFacts',
  ],
};

interface DifferentialData {
  description?: string;
  commonCauses?: string[];
  emergentCauses?: string[];
  lifeThreatening?: string[];
  keyHistoryQuestions?: string[];
  physicalExamFindings?: string[];
  initialWorkup?: string[];
  redFlags?: string[];
  diagnosticApproach?: string;
  clinicalPearls?: string[];
  boardYieldFacts?: string[];
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

async function generateDifferentialData(
  name: string,
  category: string,
  context: string
): Promise<DifferentialData> {
  await rateLimiter.acquire();

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  });

  const prompt = `Generate comprehensive differential diagnosis information for: ${name}

Category: ${category}
Context: ${context}

Provide accurate, PANCE/board-focused data in this JSON format:
{
  "description": "Brief description of this presenting complaint (2-3 sentences)",
  "commonCauses": ["Most common cause 1", "Common cause 2", "Common cause 3"],
  "emergentCauses": ["Emergent cause 1", "Emergent cause 2"],
  "lifeThreatening": ["Life-threatening cause 1", "Life-threatening cause 2"],
  "keyHistoryQuestions": ["Question 1", "Question 2", "Question 3"],
  "physicalExamFindings": ["Finding to look for 1", "Finding 2"],
  "initialWorkup": ["Test 1", "Test 2", "Test 3"],
  "redFlags": ["Red flag 1", "Red flag 2", "Red flag 3"],
  "diagnosticApproach": "Systematic approach to diagnosis",
  "clinicalPearls": ["Pearl 1", "Pearl 2"],
  "boardYieldFacts": ["High-yield fact 1", "High-yield fact 2"],
  "mnemonics": ["Memory aid for differential"]
}

Focus on PANCE-relevant differentials. Life-threatening causes should be listed even if uncommon.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    return JSON.parse(text) as DifferentialData;
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as DifferentialData;
    }
    throw new Error(`Failed to parse response for ${name}`);
  }
}

const ensureString = (val: any): string => {
  if (Array.isArray(val)) return val.join('. ');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val || '');
};

const ensureArray = (val: any): string[] => {
  if (Array.isArray(val)) return val.map((v) => String(v));
  if (typeof val === 'string') return val.split('. ').filter((s) => s.trim());
  return [];
};

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║          DIFFERENTIAL DIAGNOSIS ENTRY GENERATOR                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  try {
    // Get existing entries
    const existing = await prisma.differentialDiagnosis.findMany({
      select: { presentingComplaint: true },
    });
    const existingNames = new Set(existing.map((d) => d.presentingComplaint.toLowerCase()));

    // Filter out entries that already exist
    const toCreate = PANCE_DIFFERENTIAL_DIAGNOSES.filter(
      (d) => !existingNames.has(d.name.toLowerCase())
    );

    console.log(`Existing: ${existing.length}`);
    console.log(`Missing: ${toCreate.length}`);
    console.log(`Will generate: ${toCreate.length}\n`);

    if (toCreate.length === 0) {
      console.log('All differential diagnoses already exist!');
      return;
    }

    let success = 0;
    let failed = 0;

    for (let i = 0; i < toCreate.length; i++) {
      const ddx = toCreate[i];
      console.log(`Processing [${i + 1}/${toCreate.length}]: ${ddx.name}`);

      try {
        const data = await generateDifferentialData(ddx.name, ddx.category, ddx.context);

        await prisma.differentialDiagnosis.create({
          data: {
            id: randomUUID(),
            presentingComplaint: ddx.name,
            category: ddx.category,
            typicalPresentation: ensureString(data.description),
            mostCommon: ensureArray(data.commonCauses),
            mustNotMiss: ensureArray(data.emergentCauses),
            mostDangerous: ensureArray(data.lifeThreatening),
            keyQuestions: ensureArray(data.keyHistoryQuestions),
            keyExamFindings: ensureArray(data.physicalExamFindings),
            initialWorkup: ensureArray(data.initialWorkup),
            redFlags: ensureArray(data.redFlags),
            diagnosticAlgorithm: ensureString(data.diagnosticApproach),
            clinicalPearls: ensureArray(data.clinicalPearls),
            mnemonics: ensureArray(data.mnemonics),
            differentialList: ensureArray(data.commonCauses),
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
    console.log(`Total differential diagnoses now: ${existing.length + success}`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
