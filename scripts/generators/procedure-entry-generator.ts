/**
 * Procedure Entry Generator
 * Creates missing medical procedures for PANCE coverage
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// PANCE-relevant procedures organized by type
const PANCE_PROCEDURES = [
  // Emergency/Resuscitation
  {
    name: 'Endotracheal Intubation',
    category: 'Airway Management',
    indication: 'Airway protection, respiratory failure',
  },
  {
    name: 'Bag-Valve-Mask Ventilation',
    category: 'Airway Management',
    indication: 'Emergency ventilation, bridge to intubation',
  },
  {
    name: 'Cricothyrotomy',
    category: 'Airway Management',
    indication: 'Cannot intubate/cannot ventilate emergency',
  },
  {
    name: 'Chest Compressions',
    category: 'Resuscitation',
    indication: 'Cardiac arrest, pulseless patient',
  },
  { name: 'Defibrillation', category: 'Resuscitation', indication: 'VF, pulseless VT' },
  { name: 'Cardioversion', category: 'Resuscitation', indication: 'Unstable tachyarrhythmias' },
  {
    name: 'Central Line Placement',
    category: 'Vascular Access',
    indication: 'Vasopressors, TPN, access',
  },
  {
    name: 'Arterial Line Placement',
    category: 'Vascular Access',
    indication: 'Continuous BP monitoring, ABG access',
  },
  {
    name: 'Intraosseous Access',
    category: 'Vascular Access',
    indication: 'Emergency access when IV unavailable',
  },

  // Cardiovascular
  { name: 'Pericardiocentesis', category: 'Cardiovascular', indication: 'Cardiac tamponade' },
  {
    name: 'Temporary Pacemaker Placement',
    category: 'Cardiovascular',
    indication: 'Symptomatic bradycardia, heart block',
  },
  {
    name: 'Coronary Angiography',
    category: 'Cardiovascular',
    indication: 'CAD diagnosis, ACS management',
  },
  {
    name: 'Percutaneous Coronary Intervention',
    category: 'Cardiovascular',
    indication: 'STEMI, ACS revascularization',
  },

  // Pulmonary
  {
    name: 'Thoracentesis',
    category: 'Pulmonary',
    indication: 'Pleural effusion diagnosis/treatment',
  },
  {
    name: 'Chest Tube Placement',
    category: 'Pulmonary',
    indication: 'Pneumothorax, hemothorax, large effusion',
  },
  { name: 'Needle Decompression', category: 'Pulmonary', indication: 'Tension pneumothorax' },
  { name: 'Bronchoscopy', category: 'Pulmonary', indication: 'Airway evaluation, BAL, biopsy' },
  {
    name: 'Pulmonary Function Testing',
    category: 'Pulmonary',
    indication: 'Obstructive vs restrictive lung disease',
  },

  // Gastrointestinal
  {
    name: 'Nasogastric Tube Placement',
    category: 'GI',
    indication: 'Decompression, medication, feeding',
  },
  { name: 'Paracentesis', category: 'GI', indication: 'Ascites diagnosis/treatment' },
  { name: 'Upper Endoscopy (EGD)', category: 'GI', indication: 'GI bleeding, dysphagia, biopsy' },
  { name: 'Colonoscopy', category: 'GI', indication: 'CRC screening, GI bleeding, polyp removal' },
  { name: 'Flexible Sigmoidoscopy', category: 'GI', indication: 'Lower GI evaluation' },
  { name: 'PEG Tube Placement', category: 'GI', indication: 'Long-term enteral feeding' },

  // Genitourinary
  {
    name: 'Foley Catheter Placement',
    category: 'GU',
    indication: 'Urinary retention, output monitoring',
  },
  {
    name: 'Suprapubic Catheter Placement',
    category: 'GU',
    indication: 'Urethral obstruction, long-term catheterization',
  },
  { name: 'Cystoscopy', category: 'GU', indication: 'Bladder evaluation, ureteral stent' },

  // Orthopedic
  {
    name: 'Joint Aspiration (Arthrocentesis)',
    category: 'Orthopedic',
    indication: 'Joint effusion, septic arthritis workup',
  },
  { name: 'Fracture Reduction (Closed)', category: 'Orthopedic', indication: 'Displaced fracture' },
  {
    name: 'Splinting',
    category: 'Orthopedic',
    indication: 'Fracture immobilization, soft tissue injury',
  },
  {
    name: 'Joint Injection',
    category: 'Orthopedic',
    indication: 'Inflammatory arthritis, pain management',
  },
  {
    name: 'Trigger Point Injection',
    category: 'Pain Management',
    indication: 'Myofascial pain syndrome',
  },

  // Dermatologic
  { name: 'Skin Biopsy (Punch)', category: 'Dermatologic', indication: 'Skin lesion diagnosis' },
  {
    name: 'Skin Biopsy (Shave)',
    category: 'Dermatologic',
    indication: 'Superficial lesion sampling',
  },
  {
    name: 'Excisional Biopsy',
    category: 'Dermatologic',
    indication: 'Complete lesion removal and diagnosis',
  },
  { name: 'Incision and Drainage', category: 'Dermatologic', indication: 'Abscess drainage' },
  { name: 'Cryotherapy', category: 'Dermatologic', indication: 'Warts, actinic keratoses' },
  { name: 'Wound Closure (Suturing)', category: 'Wound Care', indication: 'Laceration repair' },
  {
    name: 'Wound Debridement',
    category: 'Wound Care',
    indication: 'Infected/necrotic tissue removal',
  },

  // Neurologic
  { name: 'Lumbar Puncture', category: 'Neurologic', indication: 'Meningitis, SAH, MS workup' },
  {
    name: 'Nerve Block',
    category: 'Pain Management',
    indication: 'Regional anesthesia, pain management',
  },
  {
    name: 'Epidural Injection',
    category: 'Pain Management',
    indication: 'Radiculopathy, back pain',
  },

  // ENT
  { name: 'Anterior Nasal Packing', category: 'ENT', indication: 'Anterior epistaxis' },
  { name: 'Posterior Nasal Packing', category: 'ENT', indication: 'Posterior epistaxis' },
  { name: 'Foreign Body Removal (Ear)', category: 'ENT', indication: 'Ear foreign body' },
  { name: 'Foreign Body Removal (Nose)', category: 'ENT', indication: 'Nasal foreign body' },
  { name: 'Cerumen Removal', category: 'ENT', indication: 'Impacted cerumen, hearing loss' },
  { name: 'Myringotomy', category: 'ENT', indication: 'Acute otitis media with complications' },

  // Ophthalmologic
  {
    name: 'Slit Lamp Examination',
    category: 'Ophthalmologic',
    indication: 'Anterior segment evaluation',
  },
  {
    name: 'Fundoscopic Examination',
    category: 'Ophthalmologic',
    indication: 'Retina, optic nerve evaluation',
  },
  { name: 'Tonometry', category: 'Ophthalmologic', indication: 'Intraocular pressure measurement' },
  {
    name: 'Fluorescein Staining',
    category: 'Ophthalmologic',
    indication: 'Corneal abrasion, ulcer detection',
  },
  {
    name: 'Foreign Body Removal (Eye)',
    category: 'Ophthalmologic',
    indication: 'Ocular foreign body',
  },

  // OB/GYN
  { name: 'Pelvic Examination', category: 'OB/GYN', indication: 'Gynecologic assessment' },
  { name: 'Pap Smear', category: 'OB/GYN', indication: 'Cervical cancer screening' },
  { name: 'Colposcopy', category: 'OB/GYN', indication: 'Abnormal Pap follow-up' },
  { name: 'Endometrial Biopsy', category: 'OB/GYN', indication: 'AUB, endometrial evaluation' },
  { name: 'IUD Insertion', category: 'OB/GYN', indication: 'Contraception' },

  // Diagnostic
  {
    name: 'Electrocardiogram (ECG)',
    category: 'Diagnostic',
    indication: 'Cardiac rhythm, ischemia',
  },
  {
    name: 'Arterial Blood Gas',
    category: 'Diagnostic',
    indication: 'Oxygenation, acid-base status',
  },
  {
    name: 'Point-of-Care Ultrasound (POCUS)',
    category: 'Diagnostic',
    indication: 'Bedside imaging, FAST exam',
  },
  {
    name: 'Bone Marrow Biopsy',
    category: 'Hematologic',
    indication: 'Hematologic malignancy, cytopenias',
  },
];

// Schema for Gemini response
const procedureSchema = {
  type: SchemaType.OBJECT,
  properties: {
    description: { type: SchemaType.STRING },
    steps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    equipment: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    preparation: { type: SchemaType.STRING },
    anesthesia: { type: SchemaType.STRING },
    complications: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    contraindications: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    postProcedureCare: { type: SchemaType.STRING },
    successIndicators: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    commonPitfalls: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    clinicalPearls: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    boardYieldFacts: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    alternativeProcedures: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ['description', 'steps', 'complications', 'clinicalPearls', 'boardYieldFacts'],
};

interface ProcedureData {
  description?: string;
  steps?: string[];
  equipment?: string[];
  preparation?: string;
  anesthesia?: string;
  complications?: string[];
  contraindications?: string[];
  postProcedureCare?: string;
  successIndicators?: string[];
  commonPitfalls?: string[];
  clinicalPearls?: string[];
  boardYieldFacts?: string[];
  alternativeProcedures?: string[];
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

async function generateProcedureData(
  name: string,
  category: string,
  indication: string
): Promise<ProcedureData> {
  await rateLimiter.acquire();

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  });

  const prompt = `Generate comprehensive medical procedure information for: ${name}

Category: ${category}
Primary Indication: ${indication}

Provide accurate, PANCE/board-focused data in this JSON format:
{
  "description": "Brief description of the procedure (2-3 sentences)",
  "steps": ["Step 1", "Step 2", "Step 3", "Step 4"],
  "equipment": ["Equipment 1", "Equipment 2"],
  "preparation": "Patient preparation",
  "anesthesia": "Type of anesthesia used",
  "complications": ["Complication 1", "Complication 2"],
  "contraindications": ["Contraindication 1", "Contraindication 2"],
  "postProcedureCare": "Post-procedure monitoring and care",
  "successIndicators": ["Success indicator 1", "Success indicator 2"],
  "commonPitfalls": ["Pitfall 1", "Pitfall 2"],
  "clinicalPearls": ["Pearl 1", "Pearl 2"],
  "boardYieldFacts": ["High-yield fact 1", "High-yield fact 2"],
  "alternativeProcedures": ["Alternative 1"]
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    return JSON.parse(text) as ProcedureData;
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as ProcedureData;
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
  console.log('║          PROCEDURE ENTRY GENERATOR                               ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  try {
    // Get existing procedures
    const existing = await prisma.procedure.findMany({
      select: { name: true },
    });
    const existingNames = new Set(existing.map((p) => p.name.toLowerCase()));

    // Filter out procedures that already exist
    const toCreate = PANCE_PROCEDURES.filter((p) => !existingNames.has(p.name.toLowerCase()));

    console.log(`Existing: ${existing.length}`);
    console.log(`Missing: ${toCreate.length}`);
    console.log(`Will generate: ${toCreate.length}\n`);

    if (toCreate.length === 0) {
      console.log('All procedures already exist!');
      return;
    }

    let success = 0;
    let failed = 0;

    for (let i = 0; i < toCreate.length; i++) {
      const procedure = toCreate[i];
      console.log(`Processing [${i + 1}/${toCreate.length}]: ${procedure.name}`);

      try {
        const data = await generateProcedureData(
          procedure.name,
          procedure.category,
          procedure.indication
        );

        await prisma.procedure.create({
          data: {
            id: randomUUID(),
            name: procedure.name,
            category: procedure.category,
            description: ensureString(data.description),
            technique: ensureArray(data.steps).join('; '),
            equipment: ensureArray(data.equipment),
            preparation: ensureString(data.preparation),
            anesthesia: ensureString(data.anesthesia),
            complications: ensureArray(data.complications),
            absoluteContraindications: ensureArray(data.contraindications),
            postProcedureCare: ensureString(data.postProcedureCare),
            expectedFindings: ensureArray(data.successIndicators).join('; '),
            commonMistakes: ensureArray(data.commonPitfalls),
            clinicalPearls: ensureArray(data.clinicalPearls),
            boardYieldFacts: ensureArray(data.boardYieldFacts),
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
    console.log(`Total procedures now: ${existing.length + success}`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
