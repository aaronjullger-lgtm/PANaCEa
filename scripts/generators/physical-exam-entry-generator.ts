/**
 * PhysicalExamFinding Entry Generator
 * Creates missing physical exam findings for PANCE coverage
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// PANCE-relevant physical exam findings organized by system
const PANCE_PHYSICAL_EXAM_FINDINGS = [
  // Cardiovascular
  { name: "Pulsus Paradoxus", category: "Cardiovascular", clinicalContext: "Cardiac tamponade, severe asthma, COPD exacerbation" },
  { name: "Pulsus Alternans", category: "Cardiovascular", clinicalContext: "Severe left ventricular failure" },
  { name: "Kussmaul Sign", category: "Cardiovascular", clinicalContext: "Constrictive pericarditis, right heart failure" },
  { name: "Water Hammer Pulse", category: "Cardiovascular", clinicalContext: "Aortic regurgitation" },
  { name: "Pulsus Bisferiens", category: "Cardiovascular", clinicalContext: "Combined aortic stenosis and regurgitation, HOCM" },
  { name: "Cannon A Waves", category: "Cardiovascular", clinicalContext: "Complete heart block, VT" },
  { name: "Hepatojugular Reflux", category: "Cardiovascular", clinicalContext: "Right heart failure, tricuspid regurgitation" },
  { name: "Carotid Shudder", category: "Cardiovascular", clinicalContext: "Severe aortic stenosis" },
  { name: "Austin Flint Murmur", category: "Cardiovascular", clinicalContext: "Severe aortic regurgitation" },
  { name: "Graham Steell Murmur", category: "Cardiovascular", clinicalContext: "Pulmonary hypertension" },
  { name: "Carey Coombs Murmur", category: "Cardiovascular", clinicalContext: "Acute rheumatic fever" },
  
  // Pulmonary
  { name: "Egophony", category: "Pulmonary", clinicalContext: "Consolidation, pleural effusion" },
  { name: "Whispered Pectoriloquy", category: "Pulmonary", clinicalContext: "Pulmonary consolidation" },
  { name: "Bronchophony", category: "Pulmonary", clinicalContext: "Lung consolidation" },
  { name: "Tactile Fremitus - Increased", category: "Pulmonary", clinicalContext: "Consolidation" },
  { name: "Tactile Fremitus - Decreased", category: "Pulmonary", clinicalContext: "Pleural effusion, pneumothorax" },
  { name: "Hamman's Sign", category: "Pulmonary", clinicalContext: "Pneumomediastinum" },
  { name: "Succussion Splash (Thoracic)", category: "Pulmonary", clinicalContext: "Hydropneumothorax" },
  
  // Neurological
  { name: "Brudzinski Sign", category: "Neurological", clinicalContext: "Meningeal irritation, meningitis" },
  { name: "Kernig Sign", category: "Neurological", clinicalContext: "Meningeal irritation, meningitis" },
  { name: "Pronator Drift", category: "Neurological", clinicalContext: "Upper motor neuron lesion, subtle hemiparesis" },
  { name: "Hoffman Sign", category: "Neurological", clinicalContext: "Upper motor neuron dysfunction, cervical myelopathy" },
  { name: "Romberg Sign", category: "Neurological", clinicalContext: "Sensory ataxia, posterior column disease" },
  { name: "Heel-to-Shin Test Abnormality", category: "Neurological", clinicalContext: "Cerebellar dysfunction" },
  { name: "Finger-to-Nose Test Abnormality", category: "Neurological", clinicalContext: "Cerebellar dysfunction, dysmetria" },
  { name: "Battle Sign", category: "Neurological", clinicalContext: "Basilar skull fracture" },
  { name: "Raccoon Eyes", category: "Neurological", clinicalContext: "Basilar skull fracture" },
  { name: "Doll's Eye Reflex", category: "Neurological", clinicalContext: "Brainstem function assessment in coma" },
  { name: "Chvostek Sign", category: "Neurological", clinicalContext: "Hypocalcemia" },
  { name: "Trousseau Sign", category: "Neurological", clinicalContext: "Hypocalcemia" },
  
  // Abdominal/GI
  { name: "Murphy Sign", category: "Abdominal", clinicalContext: "Acute cholecystitis" },
  { name: "McBurney Point Tenderness", category: "Abdominal", clinicalContext: "Acute appendicitis" },
  { name: "Rovsing Sign", category: "Abdominal", clinicalContext: "Acute appendicitis" },
  { name: "Psoas Sign", category: "Abdominal", clinicalContext: "Retrocecal appendicitis, psoas abscess" },
  { name: "Obturator Sign", category: "Abdominal", clinicalContext: "Pelvic appendicitis, pelvic abscess" },
  { name: "Cullen Sign", category: "Abdominal", clinicalContext: "Retroperitoneal hemorrhage, hemorrhagic pancreatitis" },
  { name: "Grey Turner Sign", category: "Abdominal", clinicalContext: "Retroperitoneal hemorrhage, hemorrhagic pancreatitis" },
  { name: "Carnett Sign", category: "Abdominal", clinicalContext: "Abdominal wall pain vs visceral pain" },
  { name: "Sister Mary Joseph Nodule", category: "Abdominal", clinicalContext: "Metastatic intra-abdominal malignancy" },
  { name: "Shifting Dullness", category: "Abdominal", clinicalContext: "Ascites" },
  { name: "Fluid Wave", category: "Abdominal", clinicalContext: "Large volume ascites" },
  { name: "Succussion Splash (Abdominal)", category: "Abdominal", clinicalContext: "Gastric outlet obstruction" },
  
  // Musculoskeletal
  { name: "Anterior Drawer Test (Knee)", category: "Musculoskeletal", clinicalContext: "ACL tear" },
  { name: "Posterior Drawer Test (Knee)", category: "Musculoskeletal", clinicalContext: "PCL tear" },
  { name: "Lachman Test", category: "Musculoskeletal", clinicalContext: "ACL tear" },
  { name: "McMurray Test", category: "Musculoskeletal", clinicalContext: "Meniscal tear" },
  { name: "Valgus Stress Test", category: "Musculoskeletal", clinicalContext: "MCL injury" },
  { name: "Varus Stress Test", category: "Musculoskeletal", clinicalContext: "LCL injury" },
  { name: "Anterior Drawer Test (Ankle)", category: "Musculoskeletal", clinicalContext: "ATFL injury" },
  { name: "Thompson Test", category: "Musculoskeletal", clinicalContext: "Achilles tendon rupture" },
  { name: "Drop Arm Test", category: "Musculoskeletal", clinicalContext: "Rotator cuff tear" },
  { name: "Empty Can Test", category: "Musculoskeletal", clinicalContext: "Supraspinatus tear" },
  { name: "Neer Impingement Test", category: "Musculoskeletal", clinicalContext: "Shoulder impingement" },
  { name: "Hawkins-Kennedy Test", category: "Musculoskeletal", clinicalContext: "Shoulder impingement" },
  { name: "Phalen Test", category: "Musculoskeletal", clinicalContext: "Carpal tunnel syndrome" },
  { name: "Tinel Sign (Wrist)", category: "Musculoskeletal", clinicalContext: "Carpal tunnel syndrome" },
  { name: "Finkelstein Test", category: "Musculoskeletal", clinicalContext: "De Quervain tenosynovitis" },
  { name: "Straight Leg Raise Test", category: "Musculoskeletal", clinicalContext: "Lumbar radiculopathy, herniated disc" },
  { name: "FABER Test", category: "Musculoskeletal", clinicalContext: "Hip pathology, SI joint dysfunction" },
  { name: "Thomas Test", category: "Musculoskeletal", clinicalContext: "Hip flexor contracture" },
  
  // Dermatological/General
  { name: "Nikolsky Sign", category: "Dermatological", clinicalContext: "Pemphigus vulgaris, TEN, SSSS" },
  { name: "Darier Sign", category: "Dermatological", clinicalContext: "Mastocytosis, urticaria pigmentosa" },
  { name: "Auspitz Sign", category: "Dermatological", clinicalContext: "Psoriasis" },
  { name: "Koebner Phenomenon", category: "Dermatological", clinicalContext: "Psoriasis, lichen planus, vitiligo" },
  { name: "Target Lesions", category: "Dermatological", clinicalContext: "Erythema multiforme" },
  { name: "Herald Patch", category: "Dermatological", clinicalContext: "Pityriasis rosea" },
  { name: "Wickham Striae", category: "Dermatological", clinicalContext: "Lichen planus" },
  
  // Eye/ENT
  { name: "Marcus Gunn Pupil (RAPD)", category: "Ophthalmologic", clinicalContext: "Optic nerve dysfunction, retinal disease" },
  { name: "Argyll Robertson Pupils", category: "Ophthalmologic", clinicalContext: "Neurosyphilis" },
  { name: "Kayser-Fleischer Rings", category: "Ophthalmologic", clinicalContext: "Wilson disease" },
  { name: "Papilledema", category: "Ophthalmologic", clinicalContext: "Increased intracranial pressure" },
  { name: "Cotton Wool Spots", category: "Ophthalmologic", clinicalContext: "Diabetic retinopathy, hypertensive retinopathy, HIV" },
];

// Schema for Gemini response
const examFindingSchema = {
  type: SchemaType.OBJECT,
  properties: {
    description: { type: SchemaType.STRING },
    technique: { type: SchemaType.STRING },
    normalFinding: { type: SchemaType.STRING },
    abnormalFindings: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    interpretation: { type: SchemaType.STRING },
    clinicalSignificance: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    sensitivity: { type: SchemaType.STRING },
    specificity: { type: SchemaType.STRING },
    positiveLR: { type: SchemaType.NUMBER },
    negativeLR: { type: SchemaType.NUMBER },
    associatedConditions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    commonPitfalls: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    clinicalPearls: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    boardYieldFacts: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    relatedFindings: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    mnemonics: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ["description", "technique", "interpretation", "clinicalPearls", "boardYieldFacts"],
};

interface ExamFindingData {
  description?: string;
  technique?: string;
  normalFinding?: string;
  abnormalFindings?: string[];
  interpretation?: string;
  clinicalSignificance?: string[];
  sensitivity?: string;
  specificity?: string;
  positiveLR?: number;
  negativeLR?: number;
  associatedConditions?: string[];
  commonPitfalls?: string[];
  clinicalPearls?: string[];
  boardYieldFacts?: string[];
  relatedFindings?: string[];
  mnemonics?: string[];
}

// Rate limiter
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  constructor(private capacity: number = 5, private refillRate: number = 0.5) {
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

async function generateExamFindingData(name: string, category: string, clinicalContext: string): Promise<ExamFindingData> {
  await rateLimiter.acquire();

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
    },
  });

  const prompt = `Generate comprehensive physical exam finding information for: ${name}

Category: ${category}
Clinical Context: ${clinicalContext}

Provide accurate, PANCE/board-focused data in this JSON format:
{
  "description": "Brief description of the finding (2-3 sentences)",
  "technique": "How to perform/elicit the finding",
  "normalFinding": "What is expected in normal patients",
  "abnormalFindings": ["Finding 1", "Finding 2"],
  "interpretation": "What a positive/abnormal finding indicates",
  "clinicalSignificance": ["Significance 1", "Significance 2"],
  "sensitivity": "Percentage or range (e.g., '70-85%' or 'Low')",
  "specificity": "Percentage or range",
  "positiveLR": 5.0,
  "negativeLR": 0.2,
  "associatedConditions": ["Condition 1", "Condition 2"],
  "commonPitfalls": ["Pitfall 1", "Pitfall 2"],
  "clinicalPearls": ["Pearl 1", "Pearl 2"],
  "boardYieldFacts": ["High-yield fact 1", "High-yield fact 2"],
  "relatedFindings": ["Related exam finding 1", "Related test"],
  "mnemonics": ["Memory aid if applicable"]
}

For likelihood ratios, use reasonable estimates based on literature. If unknown, use null.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    return JSON.parse(text) as ExamFindingData;
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as ExamFindingData;
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
  console.log('║          PHYSICAL EXAM FINDING ENTRY GENERATOR                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  try {
    // Get existing findings
    const existing = await prisma.physicalExamFinding.findMany({
      select: { name: true },
    });
    const existingNames = new Set(existing.map((f) => f.name.toLowerCase()));

    // Filter out findings that already exist
    const toCreate = PANCE_PHYSICAL_EXAM_FINDINGS.filter(
      (f) => !existingNames.has(f.name.toLowerCase())
    );

    console.log(`Existing: ${existing.length}`);
    console.log(`Missing: ${toCreate.length}`);
    console.log(`Will generate: ${toCreate.length}\n`);

    if (toCreate.length === 0) {
      console.log('All physical exam findings already exist!');
      return;
    }

    let success = 0;
    let failed = 0;

    for (let i = 0; i < toCreate.length; i++) {
      const finding = toCreate[i];
      console.log(`Processing [${i + 1}/${toCreate.length}]: ${finding.name}`);

      try {
        const data = await generateExamFindingData(finding.name, finding.category, finding.clinicalContext);

        await prisma.physicalExamFinding.create({
          data: {
            id: randomUUID(),
            name: finding.name,
            system: finding.category,
            category: finding.category,
            description: ensureString(data.description),
            howToElicit: ensureString(data.technique),
            clinicalSignificance: ensureString(data.interpretation),
            sensitivity: data.sensitivity ? parseFloat(data.sensitivity.replace(/[^0-9.]/g, '')) || null : null,
            specificity: data.specificity ? parseFloat(data.specificity.replace(/[^0-9.]/g, '')) || null : null,
            positiveLR: data.positiveLR ?? null,
            negativeLR: data.negativeLR ?? null,
            differentialFor: ensureArray(data.associatedConditions),
            commonMistakes: ensureArray(data.commonPitfalls),
            clinicalPearls: ensureArray(data.clinicalPearls),
            boardYieldFacts: ensureArray(data.boardYieldFacts),
            associatedFindings: ensureArray(data.relatedFindings),
            mnemonics: ensureArray(data.mnemonics),
            positiveIndicates: ensureArray(data.clinicalSignificance),
            negativeIndicates: ensureArray(data.abnormalFindings),
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
    console.log(`Total physical exam findings now: ${existing.length + success}`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
