/**
 * Anatomy Doctor - AI-powered generator for AnatomyStructure table
 * Generates comprehensive anatomical structures with clinical correlations
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// High-yield anatomy structures for PANCE
const ANATOMY_STRUCTURES = [
  // Cardiovascular
  { name: 'Left Anterior Descending Artery', system: 'CV', region: 'Thorax', type: 'Artery' },
  { name: 'Right Coronary Artery', system: 'CV', region: 'Thorax', type: 'Artery' },
  { name: 'Aortic Valve', system: 'CV', region: 'Thorax', type: 'Valve' },
  { name: 'Mitral Valve', system: 'CV', region: 'Thorax', type: 'Valve' },
  { name: 'Internal Jugular Vein', system: 'CV', region: 'Neck', type: 'Vein' },

  // Pulmonary
  { name: 'Right Middle Lobe', system: 'PULM', region: 'Thorax', type: 'Organ' },
  { name: 'Lingula', system: 'PULM', region: 'Thorax', type: 'Organ' },
  { name: 'Carina', system: 'PULM', region: 'Thorax', type: 'Landmark' },
  { name: 'Diaphragm', system: 'PULM', region: 'Thorax', type: 'Muscle' },

  // GI
  { name: 'Hepatic Flexure', system: 'GI', region: 'Abdomen', type: 'Landmark' },
  { name: 'Splenic Flexure', system: 'GI', region: 'Abdomen', type: 'Landmark' },
  { name: 'McBurney Point', system: 'GI', region: 'Abdomen', type: 'Landmark' },
  { name: 'Sphincter of Oddi', system: 'GI', region: 'Abdomen', type: 'Sphincter' },
  { name: 'Portal Vein', system: 'GI', region: 'Abdomen', type: 'Vein' },

  // Neuro
  { name: 'Brachial Plexus', system: 'NEURO', region: 'Upper Extremity', type: 'Nerve' },
  { name: 'Sciatic Nerve', system: 'NEURO', region: 'Lower Extremity', type: 'Nerve' },
  { name: 'Facial Nerve CN VII', system: 'NEURO', region: 'Head', type: 'Nerve' },
  { name: 'Vagus Nerve CN X', system: 'NEURO', region: 'Neck', type: 'Nerve' },
  { name: 'Circle of Willis', system: 'NEURO', region: 'Head', type: 'Vascular' },
  { name: 'Cerebellopontine Angle', system: 'NEURO', region: 'Head', type: 'Space' },

  // MSK
  { name: 'Rotator Cuff', system: 'MSK', region: 'Upper Extremity', type: 'Muscle Group' },
  {
    name: 'Anterior Cruciate Ligament',
    system: 'MSK',
    region: 'Lower Extremity',
    type: 'Ligament',
  },
  { name: 'Medial Meniscus', system: 'MSK', region: 'Lower Extremity', type: 'Cartilage' },
  { name: 'Carpal Tunnel', system: 'MSK', region: 'Upper Extremity', type: 'Space' },
  { name: 'Femoral Triangle', system: 'MSK', region: 'Lower Extremity', type: 'Space' },
  { name: 'Anatomical Snuffbox', system: 'MSK', region: 'Upper Extremity', type: 'Landmark' },

  // HEENT
  { name: 'Eustachian Tube', system: 'HEENT', region: 'Head', type: 'Canal' },
  { name: 'Nasolacrimal Duct', system: 'HEENT', region: 'Head', type: 'Duct' },
  { name: 'Thyroid Gland', system: 'HEENT', region: 'Neck', type: 'Gland' },
  { name: 'Parotid Gland', system: 'HEENT', region: 'Head', type: 'Gland' },

  // GU/Renal
  { name: 'Ureteropelvic Junction', system: 'RENAL', region: 'Abdomen', type: 'Junction' },
  { name: 'Glomerulus', system: 'RENAL', region: 'Abdomen', type: 'Structure' },
  { name: 'Prostate Gland', system: 'GU', region: 'Pelvis', type: 'Gland' },
  { name: 'Epididymis', system: 'GU', region: 'Pelvis', type: 'Organ' },

  // Repro
  { name: 'Fallopian Tube', system: 'REPRO', region: 'Pelvis', type: 'Organ' },
  { name: 'Pouch of Douglas', system: 'REPRO', region: 'Pelvis', type: 'Space' },
  { name: 'Inguinal Canal', system: 'MSK', region: 'Abdomen', type: 'Canal' },
];

interface AnatomyAIResponse {
  description: string;
  function: string;
  clinicalSignificance: string;
  bloodSupply: string;
  innervation: string;
  relations: string;
  commonPathology: string[];
  examFindings: string[];
  clinicalPearls: string[];
  mnemonics: string[];
}

async function generateAnatomyContent(
  structure: (typeof ANATOMY_STRUCTURES)[0]
): Promise<AnatomyAIResponse> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `Generate comprehensive anatomical information for "${structure.name}" for PA/medical student education.

Return a JSON object with EXACTLY these fields:
{
  "description": "Clear anatomical description including location, structure, and boundaries (2-3 sentences)",
  "function": "Primary physiological function (1-2 sentences)",
  "clinicalSignificance": "Why this structure matters clinically for diagnosis/treatment (2-3 sentences)",
  "bloodSupply": "Arterial supply and venous drainage as a single string",
  "innervation": "Nerve supply including root levels where applicable as a single string",
  "relations": "Important anatomical relationships to adjacent structures as a single string (2-3 sentences)",
  "commonPathology": ["Array of 4-6 clinical conditions affecting this structure"],
  "examFindings": ["Array of 3-5 physical exam findings related to this structure"],
  "clinicalPearls": ["Array of 2-3 high-yield clinical pearls"],
  "mnemonics": ["Array of 1-2 helpful memory aids if commonly used, or empty array if none"]
}

Focus on PANCE-relevant clinical correlations. Be concise but comprehensive.
Return ONLY valid JSON, no markdown formatting.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Failed to parse JSON for ${structure.name}`);
  }

  return JSON.parse(jsonMatch[0]);
}

async function seedAnatomyStructures() {
  console.log('🦴 Anatomy Doctor - Generating anatomical structures...\n');

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const structure of ANATOMY_STRUCTURES) {
    try {
      // Check if exists
      const existing = await prisma.anatomyStructure.findFirst({
        where: { name: structure.name },
      });

      if (existing) {
        console.log(`⏭️  Skipped ${structure.name} (exists)`);
        skipped++;
        continue;
      }

      // Generate content via AI
      console.log(`🔄 Generating content for ${structure.name}...`);
      const content = await generateAnatomyContent(structure);

      // Create record - matching Prisma schema field names
      await prisma.anatomyStructure.create({
        data: {
          name: structure.name,
          system: structure.system,
          region: structure.region,
          type: structure.type,
          description: content.description,
          function: content.function,
          clinicalSignificance: content.clinicalSignificance,
          bloodSupply: content.bloodSupply,
          innervation: content.innervation,
          relations: content.relations, // Single text field, not array
          commonPathology: content.commonPathology,
          examFindings: content.examFindings,
          clinicalPearls: content.clinicalPearls,
          mnemonics: content.mnemonics,
          isHighYield: true,
          panceYield: 3,
        },
      });

      console.log(`✓ Created ${structure.name}`);
      created++;

      // Rate limiting - 2 second delay between API calls
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`✗ Failed ${structure.name}:`, error);
      failed++;
    }
  }

  console.log('\n📊 Anatomy Doctor Summary:');
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Failed: ${failed}`);
}

async function main() {
  try {
    await seedAnatomyStructures();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
