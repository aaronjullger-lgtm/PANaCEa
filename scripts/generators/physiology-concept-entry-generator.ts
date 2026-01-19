/**
 * PhysiologyConcept Entry Generator
 * Creates missing physiology concepts for PANCE coverage
 */

import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// PANCE-relevant physiology concepts organized by system
const PANCE_PHYSIOLOGY_CONCEPTS = [
  // Cardiovascular
  {
    name: 'Cardiac Output',
    category: 'Cardiovascular',
    context: 'CO = HR × SV, determinants of cardiac function',
  },
  {
    name: 'Starling Law of the Heart',
    category: 'Cardiovascular',
    context: 'Preload-contractility relationship',
  },
  {
    name: 'Baroreceptor Reflex',
    category: 'Cardiovascular',
    context: 'Blood pressure regulation mechanism',
  },
  {
    name: 'Renin-Angiotensin-Aldosterone System',
    category: 'Cardiovascular',
    context: 'Blood pressure and volume regulation',
  },
  {
    name: 'Autoregulation of Blood Flow',
    category: 'Cardiovascular',
    context: 'Organ-specific perfusion maintenance',
  },
  {
    name: 'Cardiac Action Potential',
    category: 'Cardiovascular',
    context: 'Electrical conduction in heart',
  },
  {
    name: 'Venous Return',
    category: 'Cardiovascular',
    context: 'Factors affecting blood return to heart',
  },
  {
    name: 'Myocardial Oxygen Demand',
    category: 'Cardiovascular',
    context: 'Determinants of cardiac oxygen consumption',
  },

  // Pulmonary
  {
    name: 'Ventilation-Perfusion Matching',
    category: 'Pulmonary',
    context: 'V/Q ratio, gas exchange optimization',
  },
  {
    name: 'Oxygen-Hemoglobin Dissociation Curve',
    category: 'Pulmonary',
    context: 'Factors shifting curve, oxygen delivery',
  },
  {
    name: 'Carbon Dioxide Transport',
    category: 'Pulmonary',
    context: 'Bicarbonate, carbaminohemoglobin, dissolved CO2',
  },
  {
    name: 'Pulmonary Surfactant',
    category: 'Pulmonary',
    context: 'Surface tension reduction, alveolar stability',
  },
  {
    name: 'Respiratory Drive',
    category: 'Pulmonary',
    context: 'Central and peripheral chemoreceptors',
  },
  {
    name: 'Dead Space Ventilation',
    category: 'Pulmonary',
    context: 'Anatomic vs physiologic dead space',
  },
  {
    name: 'Compliance and Elastance',
    category: 'Pulmonary',
    context: 'Lung and chest wall mechanics',
  },
  {
    name: 'Work of Breathing',
    category: 'Pulmonary',
    context: 'Elastic and resistive work components',
  },

  // Renal
  {
    name: 'Glomerular Filtration',
    category: 'Renal',
    context: 'Starling forces, GFR determinants',
  },
  {
    name: 'Tubuloglomerular Feedback',
    category: 'Renal',
    context: 'Autoregulation via macula densa',
  },
  {
    name: 'Countercurrent Multiplier',
    category: 'Renal',
    context: 'Urine concentration mechanism',
  },
  {
    name: 'ADH and Water Reabsorption',
    category: 'Renal',
    context: 'Collecting duct permeability',
  },
  {
    name: 'Renal Handling of Sodium',
    category: 'Renal',
    context: 'Proximal tubule, loop of Henle, DCT, collecting duct',
  },
  {
    name: 'Renal Acid-Base Handling',
    category: 'Renal',
    context: 'Bicarbonate reabsorption, acid secretion',
  },
  {
    name: 'Potassium Homeostasis',
    category: 'Renal',
    context: 'Renal potassium excretion regulation',
  },
  {
    name: 'Calcium-Phosphate Homeostasis',
    category: 'Renal',
    context: 'PTH, vitamin D, renal handling',
  },

  // Endocrine
  {
    name: 'Hypothalamic-Pituitary Axis',
    category: 'Endocrine',
    context: 'Feedback loops, hormone regulation',
  },
  {
    name: 'Thyroid Hormone Synthesis',
    category: 'Endocrine',
    context: 'Iodine uptake, T3/T4 production',
  },
  {
    name: 'Insulin Action and Glucose Metabolism',
    category: 'Endocrine',
    context: 'Glucose uptake, glycogen synthesis',
  },
  {
    name: 'Glucagon and Counter-regulatory Hormones',
    category: 'Endocrine',
    context: 'Glucose mobilization, stress response',
  },
  {
    name: 'Cortisol Physiology',
    category: 'Endocrine',
    context: 'HPA axis, stress response, metabolism',
  },
  {
    name: 'Aldosterone Physiology',
    category: 'Endocrine',
    context: 'Sodium retention, potassium excretion',
  },
  { name: 'Growth Hormone Axis', category: 'Endocrine', context: 'GH, IGF-1, metabolic effects' },
  {
    name: 'Calcium Regulation',
    category: 'Endocrine',
    context: 'PTH, calcitonin, vitamin D interplay',
  },

  // Neurological
  {
    name: 'Action Potential Generation',
    category: 'Neurological',
    context: 'Ion channels, threshold, propagation',
  },
  {
    name: 'Neuromuscular Junction',
    category: 'Neurological',
    context: 'ACh release, receptor activation',
  },
  {
    name: 'Blood-Brain Barrier',
    category: 'Neurological',
    context: 'Selective permeability, drug penetration',
  },
  {
    name: 'Cerebrospinal Fluid Dynamics',
    category: 'Neurological',
    context: 'Production, circulation, absorption',
  },
  {
    name: 'Autonomic Nervous System',
    category: 'Neurological',
    context: 'Sympathetic vs parasympathetic',
  },
  {
    name: 'Pain Pathways',
    category: 'Neurological',
    context: 'Nociception, ascending pathways, modulation',
  },
  {
    name: 'Motor Control Pathways',
    category: 'Neurological',
    context: 'Pyramidal and extrapyramidal systems',
  },
  {
    name: 'Vestibular Function',
    category: 'Neurological',
    context: 'Balance, equilibrium maintenance',
  },

  // Gastrointestinal
  {
    name: 'Gastric Acid Secretion',
    category: 'GI',
    context: 'Parietal cell, histamine, gastrin, ACh',
  },
  {
    name: 'Intestinal Absorption',
    category: 'GI',
    context: 'Carbohydrates, proteins, fats absorption',
  },
  {
    name: 'Bile Acid Metabolism',
    category: 'GI',
    context: 'Synthesis, secretion, enterohepatic circulation',
  },
  {
    name: 'Pancreatic Exocrine Function',
    category: 'GI',
    context: 'Enzyme secretion, bicarbonate',
  },
  { name: 'GI Motility', category: 'GI', context: 'Peristalsis, migrating motor complex' },
  {
    name: 'Hepatic Drug Metabolism',
    category: 'GI',
    context: 'Phase I/II reactions, first pass effect',
  },
  {
    name: 'Bilirubin Metabolism',
    category: 'GI',
    context: 'Unconjugated to conjugated, excretion',
  },

  // Hematologic
  {
    name: 'Hemostasis and Coagulation Cascade',
    category: 'Hematologic',
    context: 'Intrinsic, extrinsic, common pathways',
  },
  { name: 'Fibrinolysis', category: 'Hematologic', context: 'Plasmin, clot dissolution' },
  { name: 'Erythropoiesis', category: 'Hematologic', context: 'EPO, red cell production' },
  {
    name: 'Hemoglobin Structure and Function',
    category: 'Hematologic',
    context: 'Oxygen binding, cooperativity',
  },
  {
    name: 'Platelet Function',
    category: 'Hematologic',
    context: 'Adhesion, activation, aggregation',
  },
  { name: 'Iron Metabolism', category: 'Hematologic', context: 'Absorption, transport, storage' },

  // Immunologic
  {
    name: 'Innate vs Adaptive Immunity',
    category: 'Immunologic',
    context: 'Immediate vs specific response',
  },
  { name: 'T Cell Function', category: 'Immunologic', context: 'CD4+ helper, CD8+ cytotoxic' },
  {
    name: 'B Cell and Antibody Function',
    category: 'Immunologic',
    context: 'Ig classes, humoral immunity',
  },
  {
    name: 'Complement System',
    category: 'Immunologic',
    context: 'Classical, alternative, lectin pathways',
  },
  {
    name: 'Inflammatory Response',
    category: 'Immunologic',
    context: 'Acute inflammation, cytokines',
  },
  { name: 'Hypersensitivity Reactions', category: 'Immunologic', context: 'Type I-IV mechanisms' },

  // Musculoskeletal
  {
    name: 'Muscle Contraction',
    category: 'Musculoskeletal',
    context: 'Sliding filament, excitation-contraction coupling',
  },
  {
    name: 'Bone Remodeling',
    category: 'Musculoskeletal',
    context: 'Osteoblasts, osteoclasts, regulation',
  },
  {
    name: 'Calcium Homeostasis in Muscle',
    category: 'Musculoskeletal',
    context: 'SR, troponin, relaxation',
  },

  // Acid-Base
  {
    name: 'Acid-Base Physiology',
    category: 'Acid-Base',
    context: 'Henderson-Hasselbalch, buffers',
  },
  {
    name: 'Respiratory Compensation',
    category: 'Acid-Base',
    context: 'CO2 adjustment for metabolic disorders',
  },
  {
    name: 'Metabolic Compensation',
    category: 'Acid-Base',
    context: 'Renal response to respiratory disorders',
  },
  {
    name: 'Anion Gap Calculation',
    category: 'Acid-Base',
    context: 'Unmeasured anions, differential diagnosis',
  },
];

// Schema for Gemini response
const physiologyConceptSchema = {
  type: SchemaType.OBJECT,
  properties: {
    description: { type: SchemaType.STRING },
    mechanism: { type: SchemaType.STRING },
    regulation: { type: SchemaType.STRING },
    keyEquations: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    normalValues: { type: SchemaType.STRING },
    pathophysiology: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    clinicalCorrelations: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    pharmacologicTargets: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    clinicalPearls: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    boardYieldFacts: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    relatedConcepts: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    mnemonics: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: [
    'description',
    'mechanism',
    'clinicalCorrelations',
    'clinicalPearls',
    'boardYieldFacts',
  ],
};

interface PhysiologyConceptData {
  description?: string;
  mechanism?: string;
  regulation?: string;
  keyEquations?: string[];
  normalValues?: string;
  pathophysiology?: string[];
  clinicalCorrelations?: string[];
  pharmacologicTargets?: string[];
  clinicalPearls?: string[];
  boardYieldFacts?: string[];
  relatedConcepts?: string[];
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

async function generatePhysiologyConceptData(
  name: string,
  category: string,
  context: string
): Promise<PhysiologyConceptData> {
  await rateLimiter.acquire();

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  });

  const prompt = `Generate comprehensive physiology concept information for: ${name}

Category: ${category}
Context: ${context}

Provide accurate, PANCE/board-focused data in this JSON format:
{
  "description": "Brief description of the concept (2-3 sentences)",
  "mechanism": "Detailed explanation of how this works physiologically",
  "regulation": "What regulates or controls this process",
  "keyEquations": ["Equation 1 if applicable", "Equation 2"],
  "normalValues": "Normal physiological values if applicable",
  "pathophysiology": ["What happens when disrupted 1", "What happens when disrupted 2"],
  "clinicalCorrelations": ["Clinical condition 1", "Clinical condition 2"],
  "pharmacologicTargets": ["Drug class that targets this", "Drug class 2"],
  "clinicalPearls": ["Pearl 1", "Pearl 2"],
  "boardYieldFacts": ["High-yield fact 1", "High-yield fact 2"],
  "relatedConcepts": ["Related concept 1", "Related concept 2"],
  "mnemonics": ["Memory aid if applicable"]
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    return JSON.parse(text) as PhysiologyConceptData;
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as PhysiologyConceptData;
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
  console.log('║          PHYSIOLOGY CONCEPT ENTRY GENERATOR                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  try {
    // Get existing concepts
    const existing = await prisma.physiologyConcept.findMany({
      select: { name: true },
    });
    const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));

    // Filter out concepts that already exist
    const toCreate = PANCE_PHYSIOLOGY_CONCEPTS.filter(
      (c) => !existingNames.has(c.name.toLowerCase())
    );

    console.log(`Existing: ${existing.length}`);
    console.log(`Missing: ${toCreate.length}`);
    console.log(`Will generate: ${toCreate.length}\n`);

    if (toCreate.length === 0) {
      console.log('All physiology concepts already exist!');
      return;
    }

    let success = 0;
    let failed = 0;

    for (let i = 0; i < toCreate.length; i++) {
      const concept = toCreate[i];
      console.log(`Processing [${i + 1}/${toCreate.length}]: ${concept.name}`);

      try {
        const data = await generatePhysiologyConceptData(
          concept.name,
          concept.category,
          concept.context
        );

        await prisma.physiologyConcept.create({
          data: {
            id: randomUUID(),
            name: concept.name,
            category: concept.category,
            description: ensureString(data.description),
            mechanism: ensureString(data.mechanism),
            feedbackLoops: ensureString(data.regulation),
            clinicalSignificance: ensureArray(data.pathophysiology).join('; '),
            relatedConditions: ensureArray(data.clinicalCorrelations),
            drugTargets: ensureArray(data.pharmacologicTargets),
            clinicalPearls: ensureArray(data.clinicalPearls),
            boardYieldFacts: ensureArray(data.boardYieldFacts),
            mnemonics: ensureArray(data.mnemonics),
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
