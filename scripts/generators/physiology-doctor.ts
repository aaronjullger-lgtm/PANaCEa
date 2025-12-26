/**
 * Physiology Doctor - AI-powered generator for PhysiologyConcept table
 * Generates comprehensive physiological concepts with clinical correlations
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// High-yield physiology concepts for PANCE
const PHYSIOLOGY_CONCEPTS = [
  // Cardiovascular
  { name: 'Frank-Starling Mechanism', system: 'CV', category: 'Cardiac Mechanics' },
  { name: 'Cardiac Action Potential', system: 'CV', category: 'Electrophysiology' },
  { name: 'Baroreceptor Reflex', system: 'CV', category: 'Autonomic Regulation' },
  { name: 'Cardiac Output Regulation', system: 'CV', category: 'Hemodynamics' },
  { name: 'Venous Return', system: 'CV', category: 'Hemodynamics' },
  
  // Pulmonary
  { name: 'Ventilation-Perfusion Matching', system: 'PULM', category: 'Gas Exchange' },
  { name: 'Oxygen-Hemoglobin Dissociation Curve', system: 'PULM', category: 'Gas Transport' },
  { name: 'Surfactant Function', system: 'PULM', category: 'Lung Mechanics' },
  { name: 'Respiratory Drive', system: 'PULM', category: 'Neural Control' },
  { name: 'Dead Space Ventilation', system: 'PULM', category: 'Gas Exchange' },
  
  // Renal
  { name: 'Glomerular Filtration', system: 'RENAL', category: 'Filtration' },
  { name: 'Renin-Angiotensin-Aldosterone System', system: 'RENAL', category: 'Hormonal Regulation' },
  { name: 'Countercurrent Multiplier', system: 'RENAL', category: 'Concentration' },
  { name: 'Tubular Reabsorption', system: 'RENAL', category: 'Transport' },
  { name: 'Acid-Base Regulation', system: 'RENAL', category: 'Homeostasis' },
  
  // Endocrine
  { name: 'Hypothalamic-Pituitary Axis', system: 'ENDO', category: 'Hormonal Regulation' },
  { name: 'Insulin and Glucagon Balance', system: 'ENDO', category: 'Glucose Metabolism' },
  { name: 'Thyroid Hormone Regulation', system: 'ENDO', category: 'Metabolic Control' },
  { name: 'Cortisol Secretion Pattern', system: 'ENDO', category: 'Stress Response' },
  { name: 'Calcium Homeostasis', system: 'ENDO', category: 'Mineral Balance' },
  
  // GI
  { name: 'Gastric Acid Secretion', system: 'GI', category: 'Secretion' },
  { name: 'Bile Production and Flow', system: 'GI', category: 'Hepatobiliary' },
  { name: 'Intestinal Absorption', system: 'GI', category: 'Absorption' },
  { name: 'Gastric Motility', system: 'GI', category: 'Motility' },
  { name: 'Enterohepatic Circulation', system: 'GI', category: 'Hepatobiliary' },
  
  // Neuro
  { name: 'Action Potential Propagation', system: 'NEURO', category: 'Neurophysiology' },
  { name: 'Neuromuscular Junction Transmission', system: 'NEURO', category: 'Synaptic' },
  { name: 'Cerebral Autoregulation', system: 'NEURO', category: 'Cerebrovascular' },
  { name: 'Pain Pathway', system: 'NEURO', category: 'Sensory' },
  { name: 'Autonomic Nervous System', system: 'NEURO', category: 'Autonomic' },
  
  // Heme
  { name: 'Hemostasis Cascade', system: 'HEME', category: 'Coagulation' },
  { name: 'Erythropoiesis', system: 'HEME', category: 'Hematopoiesis' },
  { name: 'Iron Metabolism', system: 'HEME', category: 'Mineral Transport' },
  
  // Immune
  { name: 'Inflammatory Response', system: 'ID', category: 'Innate Immunity' },
  { name: 'Antibody-Mediated Immunity', system: 'ID', category: 'Adaptive Immunity' },
  { name: 'Cell-Mediated Immunity', system: 'ID', category: 'Adaptive Immunity' },
];

interface PhysiologyAIResponse {
  description: string;
  mechanism: string;
  regulatoryFactors: string[];
  clinicalSignificance: string;
  pathophysiology: string;
  relatedConditions: string[];
  relatedDrugs: string[];
  normalValues: string;
  clinicalPearls: string[];
  mnemonics: string[];
}

async function generatePhysiologyContent(concept: typeof PHYSIOLOGY_CONCEPTS[0]): Promise<PhysiologyAIResponse> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  const prompt = `Generate comprehensive physiological information for "${concept.name}" (${concept.category}) for PA/medical student education.

Return a JSON object with EXACTLY these fields:
{
  "description": "Clear explanation of this physiological concept (2-3 sentences)",
  "mechanism": "Step-by-step explanation of the underlying mechanism (3-4 sentences)",
  "regulatoryFactors": ["Array of 3-5 key regulators/factors that control this process"],
  "clinicalSignificance": "Why understanding this matters clinically (2-3 sentences)",
  "pathophysiology": "What happens when it goes wrong (2-3 sentences)",
  "relatedConditions": ["Array of 4-6 disease states that result from dysfunction"],
  "relatedDrugs": ["Array of 3-5 drugs that affect this process"],
  "normalValues": "Normal physiologic values with units as a string (if applicable, otherwise 'N/A')",
  "clinicalPearls": ["Array of 2-3 high-yield clinical pearls"],
  "mnemonics": ["Array of 1-2 helpful memory aids if commonly used, or empty array if none"]
}

Focus on PANCE-relevant clinical correlations. Include specific numbers where applicable.
Return ONLY valid JSON, no markdown formatting.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Failed to parse JSON for ${concept.name}`);
  }
  
  return JSON.parse(jsonMatch[0]);
}

async function seedPhysiologyConcepts() {
  console.log('⚡ Physiology Doctor - Generating physiological concepts...\n');
  
  let created = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const concept of PHYSIOLOGY_CONCEPTS) {
    try {
      // Check if exists
      const existing = await prisma.physiologyConcept.findFirst({
        where: { name: concept.name }
      });
      
      if (existing) {
        console.log(`⏭️  Skipped ${concept.name} (exists)`);
        skipped++;
        continue;
      }
      
      // Generate content via AI
      console.log(`🔄 Generating content for ${concept.name}...`);
      const content = await generatePhysiologyContent(concept);
      
      // Create record - matching Prisma schema field names
      await prisma.physiologyConcept.create({
        data: {
          name: concept.name,
          system: concept.system,
          category: concept.category,
          description: content.description,
          mechanism: content.mechanism,
          regulatoryFactors: content.regulatoryFactors,
          clinicalSignificance: content.clinicalSignificance,
          pathophysiology: content.pathophysiology,
          relatedConditions: content.relatedConditions,
          relatedDrugs: content.relatedDrugs,
          normalValues: content.normalValues,
          clinicalPearls: content.clinicalPearls,
          mnemonics: content.mnemonics,
          isHighYield: true,
          panceYield: 3,
        }
      });
      
      console.log(`✓ Created ${concept.name}`);
      created++;
      
      // Rate limiting - 2 second delay between API calls
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`✗ Failed ${concept.name}:`, error);
      failed++;
    }
  }
  
  console.log('\n📊 Physiology Doctor Summary:');
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Failed: ${failed}`);
}

async function main() {
  try {
    await seedPhysiologyConcepts();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
