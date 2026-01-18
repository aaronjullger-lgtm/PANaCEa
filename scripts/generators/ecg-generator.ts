#!/usr/bin/env npx tsx
/**
 * ECG Pattern Generator - Create comprehensive ECG pattern database
 *
 * Usage:
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/ecg-generator.ts --dry-run
 *   unset GEMINI_API_KEY && DOTENV_CONFIG_PATH=.env node -r dotenv/config node_modules/.bin/tsx scripts/generators/ecg-generator.ts
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Comprehensive ECG patterns for PANCE
const ECG_PATTERNS = [
  // Normal and rate-related
  { name: 'Normal Sinus Rhythm', category: 'Normal', isEmergency: false, panceYield: 3 },
  { name: 'Sinus Bradycardia', category: 'Bradyarrhythmia', isEmergency: false, panceYield: 3 },
  { name: 'Sinus Tachycardia', category: 'Tachyarrhythmia', isEmergency: false, panceYield: 3 },
  { name: 'Sinus Arrhythmia', category: 'Normal Variant', isEmergency: false, panceYield: 2 },

  // Supraventricular arrhythmias
  {
    name: 'Supraventricular Tachycardia',
    category: 'Arrhythmia',
    isEmergency: true,
    panceYield: 3,
  },
  {
    name: 'Multifocal Atrial Tachycardia',
    category: 'Arrhythmia',
    isEmergency: false,
    panceYield: 2,
  },
  {
    name: 'Premature Atrial Contractions',
    category: 'Arrhythmia',
    isEmergency: false,
    panceYield: 2,
  },
  { name: 'Junctional Rhythm', category: 'Arrhythmia', isEmergency: false, panceYield: 2 },
  { name: 'Wandering Atrial Pacemaker', category: 'Arrhythmia', isEmergency: false, panceYield: 1 },

  // AV Blocks
  {
    name: 'First Degree AV Block',
    category: 'Conduction Abnormality',
    isEmergency: false,
    panceYield: 3,
  },
  {
    name: 'Second Degree AV Block Mobitz I',
    category: 'Conduction Abnormality',
    isEmergency: false,
    panceYield: 3,
  },
  {
    name: 'Second Degree AV Block Mobitz II',
    category: 'Conduction Abnormality',
    isEmergency: true,
    panceYield: 3,
  },

  // Bundle Branch Blocks
  {
    name: 'Right Bundle Branch Block',
    category: 'Conduction Abnormality',
    isEmergency: false,
    panceYield: 3,
  },
  {
    name: 'Left Bundle Branch Block',
    category: 'Conduction Abnormality',
    isEmergency: false,
    panceYield: 3,
  },
  {
    name: 'Left Anterior Fascicular Block',
    category: 'Conduction Abnormality',
    isEmergency: false,
    panceYield: 2,
  },
  {
    name: 'Left Posterior Fascicular Block',
    category: 'Conduction Abnormality',
    isEmergency: false,
    panceYield: 2,
  },
  {
    name: 'Bifascicular Block',
    category: 'Conduction Abnormality',
    isEmergency: false,
    panceYield: 2,
  },

  // Ventricular arrhythmias
  {
    name: 'Premature Ventricular Contractions',
    category: 'Arrhythmia',
    isEmergency: false,
    panceYield: 3,
  },
  { name: 'Torsades de Pointes', category: 'Arrhythmia', isEmergency: true, panceYield: 3 },
  { name: 'Idioventricular Rhythm', category: 'Arrhythmia', isEmergency: true, panceYield: 2 },
  {
    name: 'Accelerated Idioventricular Rhythm',
    category: 'Arrhythmia',
    isEmergency: false,
    panceYield: 2,
  },

  // Ischemia/Infarction
  { name: 'Lateral STEMI', category: 'Ischemia', isEmergency: true, panceYield: 3 },
  { name: 'Posterior STEMI', category: 'Ischemia', isEmergency: true, panceYield: 3 },
  { name: 'Right Ventricular Infarction', category: 'Ischemia', isEmergency: true, panceYield: 2 },
  { name: 'NSTEMI Pattern', category: 'Ischemia', isEmergency: true, panceYield: 3 },
  { name: 'Wellens Syndrome', category: 'Ischemia', isEmergency: true, panceYield: 2 },
  { name: 'De Winter T Waves', category: 'Ischemia', isEmergency: true, panceYield: 2 },

  // Other cardiac conditions
  { name: 'Pericarditis', category: 'Pericardial', isEmergency: false, panceYield: 3 },
  { name: 'Cardiac Tamponade', category: 'Pericardial', isEmergency: true, panceYield: 2 },
  { name: 'Myocarditis', category: 'Myocardial', isEmergency: true, panceYield: 2 },
  {
    name: 'Hypertrophic Cardiomyopathy',
    category: 'Structural',
    isEmergency: false,
    panceYield: 2,
  },
  {
    name: 'Left Ventricular Hypertrophy',
    category: 'Hypertrophy',
    isEmergency: false,
    panceYield: 3,
  },
  {
    name: 'Right Ventricular Hypertrophy',
    category: 'Hypertrophy',
    isEmergency: false,
    panceYield: 2,
  },
  { name: 'Right Atrial Enlargement', category: 'Hypertrophy', isEmergency: false, panceYield: 2 },
  { name: 'Left Atrial Enlargement', category: 'Hypertrophy', isEmergency: false, panceYield: 2 },

  // Pulmonary
  { name: 'Pulmonary Embolism Pattern', category: 'Pulmonary', isEmergency: true, panceYield: 3 },

  // Electrolyte abnormalities
  { name: 'Hypokalemia', category: 'Electrolyte', isEmergency: true, panceYield: 3 },
  { name: 'Hypercalcemia', category: 'Electrolyte', isEmergency: false, panceYield: 2 },
  { name: 'Hypocalcemia', category: 'Electrolyte', isEmergency: false, panceYield: 2 },
  { name: 'Hypomagnesemia', category: 'Electrolyte', isEmergency: false, panceYield: 2 },

  // Drug effects
  { name: 'Digoxin Effect', category: 'Drug Effect', isEmergency: false, panceYield: 3 },
  { name: 'Digoxin Toxicity', category: 'Drug Effect', isEmergency: true, panceYield: 3 },
  { name: 'Beta Blocker Effect', category: 'Drug Effect', isEmergency: false, panceYield: 2 },
  {
    name: 'Tricyclic Antidepressant Toxicity',
    category: 'Drug Effect',
    isEmergency: true,
    panceYield: 2,
  },

  // Paced rhythms
  { name: 'Ventricular Paced Rhythm', category: 'Pacemaker', isEmergency: false, panceYield: 2 },
  { name: 'Atrial Paced Rhythm', category: 'Pacemaker', isEmergency: false, panceYield: 2 },
  { name: 'Dual Chamber Paced Rhythm', category: 'Pacemaker', isEmergency: false, panceYield: 2 },
  { name: 'Pacemaker Malfunction', category: 'Pacemaker', isEmergency: true, panceYield: 2 },

  // Other
  { name: 'Brugada Syndrome', category: 'Channelopathy', isEmergency: true, panceYield: 2 },
  { name: 'Early Repolarization', category: 'Normal Variant', isEmergency: false, panceYield: 2 },
  { name: 'Hypothermia (Osborn Waves)', category: 'Metabolic', isEmergency: true, panceYield: 2 },
  { name: 'Dextrocardia', category: 'Structural', isEmergency: false, panceYield: 1 },
];

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateECGContent(pattern: (typeof ECG_PATTERNS)[0]): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
  });

  const prompt = `Generate comprehensive ECG pattern data for "${pattern.name}" (Category: ${pattern.category}).

Return JSON with these fields:
{
  "displayName": "Full display name with common abbreviation",
  "aliases": ["Alternative names", "Abbreviations"],
  "subcategory": "Specific subcategory within ${pattern.category}",
  "rate": "Heart rate description and typical ranges",
  "rhythm": "Rhythm regularity description",
  "pWave": "P wave morphology and characteristics",
  "prInterval": "PR interval characteristics",
  "qrsComplex": "QRS complex morphology, duration, axis",
  "qtInterval": "QT/QTc interval characteristics",
  "stSegment": "ST segment changes",
  "tWave": "T wave morphology",
  "diagnosticCriteria": ["4-6 specific diagnostic criteria"],
  "pathognomonic": "Pathognomonic finding if any, or most characteristic feature",
  "etiology": ["5-8 common causes/etiologies"],
  "symptoms": ["5-7 associated symptoms"],
  "hemodynamicEffect": "Hemodynamic impact description",
  "associatedConditions": ["5-7 associated clinical conditions"],
  "acuteManagement": "Step-by-step acute management approach",
  "medications": ["3-5 commonly used medications with doses if relevant"],
  "cardioversion": "Cardioversion indications and approach",
  "pacing": "Pacing indications and approach",
  "referral": "Referral guidelines (cardiology, EP, etc.)",
  "mimics": ["3-5 ECG patterns that may look similar"],
  "distinguishingFeatures": {
    "vs_pattern1": "How to distinguish from similar pattern",
    "vs_pattern2": "How to distinguish from another pattern"
  },
  "clinicalPearls": ["5-6 high-yield clinical pearls"],
  "commonMistakes": ["4-5 common interpretation errors"],
  "testQuestionTips": ["4-5 PANCE exam tips"],
  "mnemonics": ["1-2 memory aids if applicable"],
  "boardYieldFacts": ["5-6 high-yield board facts"]
}

Focus on PANCE-relevant content. Return ONLY valid JSON.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Failed to parse JSON for ${pattern.name}`);
  return JSON.parse(jsonMatch[0]);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const limit = process.argv.find((a) => a.startsWith('--limit='));
  const maxPatterns = limit ? parseInt(limit.split('=')[1]) : ECG_PATTERNS.length;

  console.log('🫀 ECG Pattern Generator');
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'CREATE'}`);
  console.log(`   Limit: ${maxPatterns}\n`);

  // Get existing patterns
  const existing = await prisma.eCGPattern.findMany({ select: { name: true } });
  const existingNames = new Set(existing.map((e) => e.name));
  console.log(`📊 Existing patterns: ${existingNames.size}`);

  // Filter to new patterns only
  const newPatterns = ECG_PATTERNS.filter((p) => !existingNames.has(p.name)).slice(0, maxPatterns);
  console.log(`📝 New patterns to create: ${newPatterns.length}\n`);

  if (newPatterns.length === 0) {
    console.log('✅ All patterns already exist!');
    await prisma.$disconnect();
    return;
  }

  let created = 0;
  let failed = 0;

  for (const pattern of newPatterns) {
    try {
      console.log(`  🔄 Generating: ${pattern.name}...`);
      const content = await generateECGContent(pattern);

      if (!dryRun) {
        await prisma.eCGPattern.create({
          data: {
            id: crypto.randomUUID(),
            name: pattern.name,
            displayName: content.displayName || pattern.name,
            aliases: content.aliases || [],
            category: pattern.category,
            subcategory: content.subcategory || pattern.category,
            panceYield: pattern.panceYield,
            isHighYield: pattern.panceYield >= 3,
            isEmergency: pattern.isEmergency,
            boardYieldFacts: content.boardYieldFacts || [],
            rate: content.rate || '',
            rhythm: content.rhythm || '',
            pWave: content.pWave || '',
            prInterval: content.prInterval || '',
            qrsComplex: content.qrsComplex || '',
            qtInterval: content.qtInterval || '',
            stSegment: content.stSegment || '',
            tWave: content.tWave || '',
            diagnosticCriteria: content.diagnosticCriteria || [],
            pathognomonic: content.pathognomonic || '',
            etiology: content.etiology || [],
            symptoms: content.symptoms || [],
            hemodynamicEffect: content.hemodynamicEffect || '',
            associatedConditions: content.associatedConditions || [],
            acuteManagement: content.acuteManagement || '',
            medications: content.medications || [],
            cardioversion: content.cardioversion || 'Not typically indicated',
            pacing: content.pacing || 'Not typically indicated',
            referral: content.referral || '',
            mimics: content.mimics || [],
            distinguishingFeatures: content.distinguishingFeatures || {},
            clinicalPearls: content.clinicalPearls || [],
            commonMistakes: content.commonMistakes || [],
            testQuestionTips: content.testQuestionTips || [],
            mnemonics: content.mnemonics || [],
            updatedAt: new Date(),
          },
        });
        console.log(`  ✅ Created: ${pattern.name}`);
      } else {
        console.log(`  📋 Would create: ${pattern.name}`);
      }
      created++;
      await sleep(1500);
    } catch (error) {
      console.log(
        `  ❌ Failed: ${pattern.name} - ${error instanceof Error ? error.message : error}`
      );
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 ECG Generator Summary:');
  console.log(`   Created: ${created}`);
  console.log(`   Failed:  ${failed}`);
  console.log(`   Total ECG patterns: ${existingNames.size + (dryRun ? 0 : created)}`);

  await prisma.$disconnect();
}

main().catch(console.error);
