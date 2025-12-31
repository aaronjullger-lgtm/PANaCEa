/**
 * ImagingStudy Entry Generator
 * Creates missing imaging studies for PANCE coverage
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// PANCE-relevant imaging studies
const PANCE_IMAGING_STUDIES = [
  // Chest
  { name: "Chest X-Ray PA/Lateral", category: "Radiography", indication: "Pulmonary, cardiac, thoracic pathology" },
  { name: "Chest CT with Contrast", category: "CT", indication: "PE, mediastinal mass, vascular pathology" },
  { name: "High Resolution CT Chest", category: "CT", indication: "Interstitial lung disease, bronchiectasis" },
  { name: "CT Pulmonary Angiography", category: "CT", indication: "Pulmonary embolism" },
  { name: "V/Q Scan", category: "Nuclear Medicine", indication: "PE when CT contraindicated" },
  
  // Abdominal
  { name: "Abdominal X-Ray (KUB)", category: "Radiography", indication: "Bowel obstruction, free air, stones" },
  { name: "CT Abdomen/Pelvis with Contrast", category: "CT", indication: "Abdominal pathology, appendicitis, diverticulitis" },
  { name: "CT Abdomen without Contrast", category: "CT", indication: "Renal stones, hemorrhage" },
  { name: "MRI Abdomen", category: "MRI", indication: "Liver lesions, pancreatic mass" },
  { name: "MRCP", category: "MRI", indication: "Biliary and pancreatic duct evaluation" },
  { name: "ERCP", category: "Fluoroscopy", indication: "Therapeutic biliary/pancreatic intervention" },
  { name: "Barium Swallow", category: "Fluoroscopy", indication: "Esophageal pathology, dysphagia workup" },
  { name: "Upper GI Series", category: "Fluoroscopy", indication: "Gastric pathology, hiatal hernia" },
  { name: "Small Bowel Follow Through", category: "Fluoroscopy", indication: "Small bowel pathology, Crohn disease" },
  { name: "Barium Enema", category: "Fluoroscopy", indication: "Colonic pathology" },
  { name: "Abdominal Ultrasound", category: "Ultrasound", indication: "Gallbladder, liver, biliary tree" },
  { name: "Right Upper Quadrant Ultrasound", category: "Ultrasound", indication: "Cholecystitis, biliary pathology" },
  { name: "HIDA Scan", category: "Nuclear Medicine", indication: "Acute cholecystitis, biliary patency" },
  
  // Cardiac
  { name: "Transthoracic Echocardiogram", category: "Ultrasound", indication: "Cardiac structure and function" },
  { name: "Transesophageal Echocardiogram", category: "Ultrasound", indication: "Endocarditis, aortic dissection, thrombus" },
  { name: "Stress Echocardiogram", category: "Ultrasound", indication: "Ischemic evaluation, CAD" },
  { name: "Nuclear Stress Test", category: "Nuclear Medicine", indication: "Myocardial perfusion, CAD" },
  { name: "Cardiac MRI", category: "MRI", indication: "Cardiomyopathy, myocarditis, infiltrative disease" },
  { name: "Coronary CT Angiography", category: "CT", indication: "CAD, calcium scoring" },
  { name: "Cardiac Catheterization", category: "Angiography", indication: "Coronary anatomy, intervention" },
  
  // Neurological
  { name: "CT Head without Contrast", category: "CT", indication: "Acute stroke, hemorrhage, trauma" },
  { name: "CT Head with Contrast", category: "CT", indication: "Mass, abscess, enhancement evaluation" },
  { name: "CT Angiography Head/Neck", category: "CT", indication: "Vascular pathology, aneurysm, dissection" },
  { name: "MRI Brain with/without Contrast", category: "MRI", indication: "CNS pathology, MS, tumor, stroke" },
  { name: "MRA Head", category: "MRI", indication: "Intracranial vascular pathology" },
  { name: "Carotid Duplex Ultrasound", category: "Ultrasound", indication: "Carotid stenosis, TIA/stroke workup" },
  { name: "Lumbar Puncture with Fluoroscopy", category: "Fluoroscopy", indication: "CSF analysis guidance" },
  { name: "MRI Spine Cervical", category: "MRI", indication: "Cervical disc, cord pathology" },
  { name: "MRI Spine Lumbar", category: "MRI", indication: "Lumbar disc, stenosis, radiculopathy" },
  { name: "Myelogram", category: "Fluoroscopy", indication: "Spinal pathology when MRI contraindicated" },
  
  // Musculoskeletal
  { name: "X-Ray Extremity", category: "Radiography", indication: "Fracture, arthritis, bone lesion" },
  { name: "X-Ray Spine Cervical", category: "Radiography", indication: "Trauma, degenerative changes" },
  { name: "X-Ray Spine Lumbar", category: "Radiography", indication: "Spondylosis, fracture, alignment" },
  { name: "MRI Shoulder", category: "MRI", indication: "Rotator cuff, labral pathology" },
  { name: "MRI Knee", category: "MRI", indication: "Ligament, meniscal, cartilage pathology" },
  { name: "MRI Hip", category: "MRI", indication: "AVN, labral tear, occult fracture" },
  { name: "Bone Scan", category: "Nuclear Medicine", indication: "Metastases, infection, stress fracture" },
  { name: "DEXA Scan", category: "Nuclear Medicine", indication: "Bone mineral density, osteoporosis" },
  { name: "Arthrogram", category: "Fluoroscopy/MRI", indication: "Joint pathology pre-MRI" },
  
  // Genitourinary
  { name: "Renal Ultrasound", category: "Ultrasound", indication: "Hydronephrosis, cysts, masses" },
  { name: "CT Urogram", category: "CT", indication: "Hematuria workup, urothelial pathology" },
  { name: "IVP", category: "Fluoroscopy", indication: "Urinary tract anatomy (largely replaced by CT)" },
  { name: "VCUG", category: "Fluoroscopy", indication: "Vesicoureteral reflux, voiding dysfunction" },
  { name: "Pelvic Ultrasound", category: "Ultrasound", indication: "Uterus, ovaries, pelvic mass" },
  { name: "Transvaginal Ultrasound", category: "Ultrasound", indication: "Early pregnancy, ovarian pathology" },
  { name: "Testicular Ultrasound", category: "Ultrasound", indication: "Scrotal pathology, torsion" },
  
  // Vascular
  { name: "Lower Extremity Venous Duplex", category: "Ultrasound", indication: "DVT" },
  { name: "Lower Extremity Arterial Duplex", category: "Ultrasound", indication: "PAD, claudication" },
  { name: "Abdominal Aortic Ultrasound", category: "Ultrasound", indication: "AAA screening" },
  { name: "CT Angiography Abdomen", category: "CT", indication: "Mesenteric ischemia, AAA, renal artery" },
  { name: "Peripheral Angiography", category: "Angiography", indication: "PAD intervention" },
  
  // Breast
  { name: "Mammography", category: "Radiography", indication: "Breast cancer screening and diagnostic" },
  { name: "Breast Ultrasound", category: "Ultrasound", indication: "Cyst vs solid mass, biopsy guidance" },
  { name: "Breast MRI", category: "MRI", indication: "High-risk screening, extent of disease" },
  
  // Thyroid/Neck
  { name: "Thyroid Ultrasound", category: "Ultrasound", indication: "Nodule characterization, biopsy guidance" },
  { name: "Thyroid Uptake and Scan", category: "Nuclear Medicine", indication: "Hyperthyroidism etiology" },
  { name: "CT Neck with Contrast", category: "CT", indication: "Neck mass, abscess, lymphadenopathy" },
  { name: "PET/CT", category: "Nuclear Medicine", indication: "Cancer staging, treatment response" },
];

// Schema for Gemini response
const imagingStudySchema = {
  type: SchemaType.OBJECT,
  properties: {
    description: { type: SchemaType.STRING },
    technique: { type: SchemaType.STRING },
    preparation: { type: SchemaType.STRING },
    contraindications: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    normalFindings: { type: SchemaType.STRING },
    abnormalFindings: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    sensitivity: { type: SchemaType.STRING },
    specificity: { type: SchemaType.STRING },
    advantages: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    limitations: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    radiationDose: { type: SchemaType.STRING },
    contrastConsiderations: { type: SchemaType.STRING },
    clinicalPearls: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    boardYieldFacts: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    whenToOrder: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    alternativeStudies: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ["description", "technique", "normalFindings", "clinicalPearls", "boardYieldFacts"],
};

interface ImagingStudyData {
  description?: string;
  technique?: string;
  preparation?: string;
  contraindications?: string[];
  normalFindings?: string;
  abnormalFindings?: string[];
  sensitivity?: string;
  specificity?: string;
  advantages?: string[];
  limitations?: string[];
  radiationDose?: string;
  contrastConsiderations?: string;
  clinicalPearls?: string[];
  boardYieldFacts?: string[];
  whenToOrder?: string[];
  alternativeStudies?: string[];
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

async function generateImagingStudyData(name: string, category: string, indication: string): Promise<ImagingStudyData> {
  await rateLimiter.acquire();

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
    },
  });

  const prompt = `Generate comprehensive imaging study information for: ${name}

Category: ${category}
Primary Indication: ${indication}

Provide accurate, PANCE/board-focused data in this JSON format:
{
  "description": "Brief description of the imaging modality (2-3 sentences)",
  "technique": "How the study is performed",
  "preparation": "Patient preparation required",
  "contraindications": ["Contraindication 1", "Contraindication 2"],
  "normalFindings": "What constitutes normal findings",
  "abnormalFindings": ["Finding 1", "Finding 2"],
  "sensitivity": "Percentage or range for primary indication",
  "specificity": "Percentage or range for primary indication",
  "advantages": ["Advantage 1", "Advantage 2"],
  "limitations": ["Limitation 1", "Limitation 2"],
  "radiationDose": "Relative dose (none/low/moderate/high) or mSv range",
  "contrastConsiderations": "Contrast type and precautions",
  "clinicalPearls": ["Pearl 1", "Pearl 2"],
  "boardYieldFacts": ["High-yield fact 1", "High-yield fact 2"],
  "whenToOrder": ["Indication 1", "Indication 2"],
  "alternativeStudies": ["Alternative 1", "Alternative 2"]
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    return JSON.parse(text) as ImagingStudyData;
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as ImagingStudyData;
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
  console.log('║          IMAGING STUDY ENTRY GENERATOR                           ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  try {
    // Get existing studies
    const existing = await prisma.imagingStudy.findMany({
      select: { name: true },
    });
    const existingNames = new Set(existing.map((s) => s.name.toLowerCase()));

    // Filter out studies that already exist
    const toCreate = PANCE_IMAGING_STUDIES.filter(
      (s) => !existingNames.has(s.name.toLowerCase())
    );

    console.log(`Existing: ${existing.length}`);
    console.log(`Missing: ${toCreate.length}`);
    console.log(`Will generate: ${toCreate.length}\n`);

    if (toCreate.length === 0) {
      console.log('All imaging studies already exist!');
      return;
    }

    let success = 0;
    let failed = 0;

    for (let i = 0; i < toCreate.length; i++) {
      const study = toCreate[i];
      console.log(`Processing [${i + 1}/${toCreate.length}]: ${study.name}`);

      try {
        const data = await generateImagingStudyData(study.name, study.category, study.indication);

        await prisma.imagingStudy.create({
          data: {
            id: randomUUID(),
            name: study.name,
            modality: study.category,
            description: ensureString(data.description),
            technique: ensureString(data.technique),
            preparation: ensureString(data.preparation),
            contraindications: ensureArray(data.contraindications),
            normalFindings: ensureString(data.normalFindings),
            abnormalFindings: ensureArray(data.abnormalFindings),
            sensitivity: ensureString(data.sensitivity),
            specificity: ensureString(data.specificity),
            advantages: ensureArray(data.advantages),
            limitations: ensureArray(data.limitations),
            radiationDose: ensureString(data.radiationDose),
            contrastConsiderations: ensureString(data.contrastConsiderations),
            clinicalPearls: ensureArray(data.clinicalPearls),
            boardYieldFacts: ensureArray(data.boardYieldFacts),
            whenToOrder: ensureArray(data.whenToOrder),
            alternativeStudies: ensureArray(data.alternativeStudies),
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
    console.log(`Total imaging studies now: ${existing.length + success}`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
