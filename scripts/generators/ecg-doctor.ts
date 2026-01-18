/**
 * ECG Doctor - AI-powered ECG pattern content generator
 * Populates ECGPattern table with PANCE high-yield rhythms
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// High-yield ECG patterns for PANCE
const ECG_PATTERNS = [
  { name: 'Atrial Fibrillation', category: 'Arrhythmia', isEmergency: false },
  { name: 'Atrial Flutter', category: 'Arrhythmia', isEmergency: false },
  { name: 'Ventricular Fibrillation', category: 'Arrhythmia', isEmergency: true },
  { name: 'Ventricular Tachycardia', category: 'Arrhythmia', isEmergency: true },
  { name: 'Third Degree AV Block', category: 'Conduction', isEmergency: true },
  { name: 'Anterior STEMI', category: 'Ischemia', isEmergency: true },
  { name: 'Inferior STEMI', category: 'Ischemia', isEmergency: true },
  { name: 'Wolff-Parkinson-White', category: 'Conduction', isEmergency: false },
  { name: 'Hyperkalemia', category: 'Metabolic', isEmergency: true },
  { name: 'Long QT Syndrome', category: 'Conduction', isEmergency: false },
];

async function generateECGContent(pattern: {
  name: string;
  category: string;
  isEmergency: boolean;
}) {
  const prompt = `You are a cardiology educator. For ECG pattern "${pattern.name}", provide PANCE-focused content.

Return ONLY valid JSON:
{
  "rate": "description of rate",
  "rhythm": "regular/irregular/etc",
  "pWave": "P wave characteristics",
  "prInterval": "PR interval findings",
  "qrsComplex": "QRS characteristics",
  "stSegment": "ST segment changes if any",
  "tWave": "T wave findings",
  "diagnosticCriteria": ["criterion 1", "criterion 2"],
  "pathognomonic": "classic finding if exists",
  "etiology": ["cause 1", "cause 2"],
  "symptoms": ["symptom 1", "symptom 2"],
  "acuteManagement": "step-by-step management",
  "medications": ["drug 1", "drug 2"],
  "mimics": ["similar patterns"],
  "clinicalPearls": ["pearl 1", "pearl 2"],
  "testQuestionTips": ["board tip 1"],
  "panceYield": 3
}`;

  const result = await model.generateContent(prompt);
  const text = result.response
    .text()
    .replace(/```json\n?|\n?```/g, '')
    .trim();
  return JSON.parse(text);
}

async function seedECGPatterns(dryRun = false) {
  console.log('Seeding ECG Patterns...');

  for (const pattern of ECG_PATTERNS) {
    const exists = await prisma.eCGPattern.findUnique({ where: { name: pattern.name } });
    if (exists) {
      console.log(`  Skip: ${pattern.name} exists`);
      continue;
    }

    try {
      console.log(`  Generating: ${pattern.name}`);
      const content = await generateECGContent(pattern);

      if (!dryRun) {
        await prisma.eCGPattern.create({
          data: {
            name: pattern.name,
            category: pattern.category,
            isEmergency: pattern.isEmergency,
            isHighYield: true,
            ...content,
          },
        });
        console.log(`    ✓ Created ${pattern.name}`);
      }

      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      console.error(`    ✗ Failed: ${pattern.name}`, err);
    }
  }

  await prisma.$disconnect();
}

const dryRun = process.argv.includes('--dry-run');
seedECGPatterns(dryRun);
