/**
 * Scoring Doctor - Clinical decision rules generator
 * Populates ScoringSystem table with PANCE high-yield scoring tools
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const SCORING_SYSTEMS = [
  { name: 'Wells DVT', condition: 'Deep Vein Thrombosis', category: 'Diagnostic' },
  { name: 'Wells PE', condition: 'Pulmonary Embolism', category: 'Diagnostic' },
  { name: 'PERC Rule', condition: 'Pulmonary Embolism', category: 'Risk Stratification' },
  { name: 'CURB-65', condition: 'Community-Acquired Pneumonia', category: 'Prognostic' },
  { name: 'CHA2DS2-VASc', condition: 'Atrial Fibrillation', category: 'Risk Stratification' },
  { name: 'HAS-BLED', condition: 'Bleeding Risk', category: 'Risk Stratification' },
  { name: 'Ottawa Ankle Rules', condition: 'Ankle Fracture', category: 'Diagnostic' },
  { name: 'HEART Score', condition: 'Acute Coronary Syndrome', category: 'Risk Stratification' },
  { name: 'GCS', condition: 'Altered Mental Status', category: 'Prognostic' },
  { name: 'ABCD2', condition: 'TIA', category: 'Risk Stratification' },
];

async function generateScoringContent(system: {
  name: string;
  condition: string;
  category: string;
}) {
  const prompt = `For clinical decision rule "${system.name}" used for ${system.condition}, provide PANCE content.

Return ONLY valid JSON:
{
  "components": [
    {"criterion": "description", "points": 1, "description": "when to assign"}
  ],
  "maxScore": 10,
  "interpretation": [
    {"scoreRange": "0-1", "riskLevel": "Low", "recommendation": "action"}
  ],
  "sensitivity": 95.0,
  "specificity": 50.0,
  "whenToUse": "clinical scenario",
  "whenNotToUse": ["exclusion 1"],
  "clinicalPearls": ["pearl 1"],
  "testQuestionTips": ["tip 1"],
  "panceYield": 3
}`;

  const result = await model.generateContent(prompt);
  const text = result.response
    .text()
    .replace(/```json\n?|\n?```/g, '')
    .trim();
  return JSON.parse(text);
}

async function seedScoringSystems(dryRun = false) {
  console.log('Seeding Scoring Systems...');

  for (const system of SCORING_SYSTEMS) {
    const exists = await prisma.scoringSystem.findUnique({ where: { name: system.name } });
    if (exists) {
      console.log(`  Skip: ${system.name} exists`);
      continue;
    }

    try {
      console.log(`  Generating: ${system.name}`);
      const content = await generateScoringContent(system);

      if (!dryRun) {
        await prisma.scoringSystem.create({
          data: {

            id: uuidv4(),


            name: system.name,
            condition: system.condition,
            category: system.category,
            isHighYield: true,
            ...content,
          },
        });
        console.log(`    ✓ Created ${system.name}`);
      }

      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      console.error(`    ✗ Failed: ${system.name}`, err);
    }
  }

  await prisma.$disconnect();
}

const dryRun = process.argv.includes('--dry-run');
seedScoringSystems(dryRun);
