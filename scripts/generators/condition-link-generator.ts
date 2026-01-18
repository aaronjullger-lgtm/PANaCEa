#!/usr/bin/env npx tsx
/**
 * Condition Link Generator
 *
 * Creates links between ECGPatterns/ImagingStudies and Conditions
 * These are junction tables that connect diagnostic tools to conditions
 *
 * Tables generated:
 *   - ECGConditionLink: Links ECG patterns to conditions they diagnose
 *   - ImagingConditionLink: Links imaging studies to conditions they diagnose
 *
 * Usage:
 *   npx tsx scripts/generators/condition-link-generator.ts --ecg         # Generate ECG links
 *   npx tsx scripts/generators/condition-link-generator.ts --imaging     # Generate Imaging links
 *   npx tsx scripts/generators/condition-link-generator.ts --all         # Generate both
 *   npx tsx scripts/generators/condition-link-generator.ts --dry-run     # Preview mode
 *   npx tsx scripts/generators/condition-link-generator.ts --analyze     # Show current state
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as crypto from 'crypto';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Parse CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const ANALYZE = args.includes('--analyze');
const GEN_ECG = args.includes('--ecg') || args.includes('--all') || !args.includes('--imaging');
const GEN_IMAGING = args.includes('--imaging') || args.includes('--all');

// Rate limiter
class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,
    private refillRate: number
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;

    if (this.tokens < 1) {
      const waitTime = ((1 - this.tokens) / this.refillRate) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
  }
}

const rateLimiter = new TokenBucket(5, 0.5);

// ================================
// ECG CONDITION LINK TYPES
// ================================

interface ECGConditionLinkData {
  ecgPatternId: string;
  conditionId: string;
  relationshipType: string; // 'diagnostic', 'suggestive', 'associated', 'risk_marker'
  findingDescription: string;
  isFirstLine: boolean;
  panceYield: number;
}

interface ImagingConditionLinkData {
  imagingId: string;
  conditionId: string;
  relationshipType: string; // 'diagnostic', 'first_line', 'confirmatory', 'screening'
  expectedFindings: string[];
  classicFindings: string;
  findingDescription: string;
  sensitivity?: number;
  specificity?: number;
  isFirstLine: boolean;
  panceYield: number;
}

// ================================
// AI GENERATION FUNCTIONS
// ================================

async function generateECGLinks(
  ecgPattern: { id: string; name: string; category: string },
  conditions: Array<{ id: string; name: string; system: string }>,
  retryCount = 0
): Promise<ECGConditionLinkData[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

  const conditionsList = conditions
    .slice(0, 50)
    .map((c) => `${c.name} (${c.system})`)
    .join(', ');

  const prompt =
    retryCount === 0
      ? `You are a medical expert. For the ECG pattern "${ecgPattern.name}" (category: ${ecgPattern.category}), identify which conditions from this list it can help diagnose:

Conditions: ${conditionsList}

Return a JSON array of condition links. For each relevant condition, provide:

[
  {
    "conditionName": "Exact condition name from list",
    "relationshipType": "diagnostic|suggestive|associated|risk_marker",
    "findingDescription": "How this ECG finding relates to the condition",
    "isFirstLine": true/false,
    "panceYield": 1-3
  }
]

Rules:
- Only include conditions where this ECG pattern is clinically relevant
- Use "diagnostic" if the ECG pattern is pathognomonic or highly specific
- Use "suggestive" if it raises suspicion but needs confirmation
- Use "associated" if commonly seen but not diagnostic
- Use "risk_marker" if it indicates increased risk
- isFirstLine = true if ECG is the first test ordered for this condition
- panceYield: 3=high-yield, 2=moderate, 1=low
- Return ONLY valid JSON array, no markdown
- Use straight apostrophes, no special symbols`
      : `List conditions that the ECG pattern "${ecgPattern.name}" helps diagnose.
Return JSON array only:
[{"conditionName":"Name","relationshipType":"diagnostic","findingDescription":"Description","isFirstLine":true,"panceYield":3}]`;

  try {
    await rateLimiter.acquire();
    const result = await model.generateContent(prompt);
    let jsonStr = result.response
      .text()
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```\s*$/, '');

    // Find array bounds
    const firstBracket = jsonStr.indexOf('[');
    const lastBracket = jsonStr.lastIndexOf(']');
    if (firstBracket === -1 || lastBracket === -1) {
      return [];
    }
    jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);

    // Fix common JSON issues
    jsonStr = jsonStr
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      .replace(/,(\s*[\]}])/g, '$1');

    let parsed: Array<{
      conditionName: string;
      relationshipType: string;
      findingDescription: string;
      isFirstLine: boolean;
      panceYield: number;
    }>;

    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      if (retryCount === 0) {
        console.log(`    🔄 Retrying...`);
        await new Promise((r) => setTimeout(r, 1000));
        return generateECGLinks(ecgPattern, conditions, 1);
      }
      return [];
    }

    // Map to actual condition IDs
    const links: ECGConditionLinkData[] = [];
    for (const item of parsed) {
      const condition = conditions.find(
        (c) =>
          c.name.toLowerCase() === item.conditionName.toLowerCase() ||
          c.name.toLowerCase().includes(item.conditionName.toLowerCase()) ||
          item.conditionName.toLowerCase().includes(c.name.toLowerCase())
      );

      if (condition) {
        links.push({
          ecgPatternId: ecgPattern.id,
          conditionId: condition.id,
          relationshipType: item.relationshipType || 'associated',
          findingDescription:
            item.findingDescription || `${ecgPattern.name} associated with ${condition.name}`,
          isFirstLine: item.isFirstLine ?? false,
          panceYield: item.panceYield ?? 2,
        });
      }
    }

    return links;
  } catch (error) {
    console.error(`    ❌ Error: ${error}`);
    if (retryCount === 0) {
      await new Promise((r) => setTimeout(r, 1000));
      return generateECGLinks(ecgPattern, conditions, 1);
    }
    return [];
  }
}

async function generateImagingLinks(
  imaging: { id: string; name: string; modality: string; bodyRegion: string | null },
  conditions: Array<{ id: string; name: string; system: string }>,
  retryCount = 0
): Promise<ImagingConditionLinkData[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

  const conditionsList = conditions
    .slice(0, 50)
    .map((c) => `${c.name} (${c.system})`)
    .join(', ');

  const prompt =
    retryCount === 0
      ? `You are a medical expert. For the imaging study "${imaging.name}" (${imaging.modality}, ${imaging.bodyRegion || 'various'}), identify which conditions from this list it can help diagnose:

Conditions: ${conditionsList}

Return a JSON array of condition links. For each relevant condition:

[
  {
    "conditionName": "Exact condition name from list",
    "relationshipType": "diagnostic|first_line|confirmatory|screening",
    "expectedFindings": ["finding1", "finding2"],
    "classicFindings": "The classic or pathognomonic finding",
    "findingDescription": "How findings relate to diagnosis",
    "sensitivity": 0.85,
    "specificity": 0.90,
    "isFirstLine": true/false,
    "panceYield": 1-3
  }
]

Rules:
- Only include conditions where this imaging is clinically relevant
- Use "diagnostic" if findings are pathognomonic
- Use "first_line" if this is the initial imaging ordered
- Use "confirmatory" if used after clinical suspicion
- Use "screening" if used for early detection
- sensitivity/specificity: use null if unknown, decimals 0-1 if known
- Return ONLY valid JSON array, no markdown`
      : `List conditions diagnosed by "${imaging.name}" imaging.
Return JSON array only:
[{"conditionName":"Name","relationshipType":"first_line","expectedFindings":["finding"],"classicFindings":"Classic sign","findingDescription":"Desc","isFirstLine":true,"panceYield":3}]`;

  try {
    await rateLimiter.acquire();
    const result = await model.generateContent(prompt);
    let jsonStr = result.response
      .text()
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```\s*$/, '');

    const firstBracket = jsonStr.indexOf('[');
    const lastBracket = jsonStr.lastIndexOf(']');
    if (firstBracket === -1 || lastBracket === -1) return [];
    jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);

    jsonStr = jsonStr
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      .replace(/,(\s*[\]}])/g, '$1');

    let parsed: Array<{
      conditionName: string;
      relationshipType: string;
      expectedFindings: string[];
      classicFindings: string;
      findingDescription: string;
      sensitivity?: number;
      specificity?: number;
      isFirstLine: boolean;
      panceYield: number;
    }>;

    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      if (retryCount === 0) {
        console.log(`    🔄 Retrying...`);
        await new Promise((r) => setTimeout(r, 1000));
        return generateImagingLinks(imaging, conditions, 1);
      }
      return [];
    }

    const links: ImagingConditionLinkData[] = [];
    for (const item of parsed) {
      const condition = conditions.find(
        (c) =>
          c.name.toLowerCase() === item.conditionName.toLowerCase() ||
          c.name.toLowerCase().includes(item.conditionName.toLowerCase()) ||
          item.conditionName.toLowerCase().includes(c.name.toLowerCase())
      );

      if (condition) {
        links.push({
          imagingId: imaging.id,
          conditionId: condition.id,
          relationshipType: item.relationshipType || 'associated',
          expectedFindings: item.expectedFindings || [],
          classicFindings: item.classicFindings || '',
          findingDescription:
            item.findingDescription || `${imaging.name} findings in ${condition.name}`,
          sensitivity: item.sensitivity,
          specificity: item.specificity,
          isFirstLine: item.isFirstLine ?? false,
          panceYield: item.panceYield ?? 2,
        });
      }
    }

    return links;
  } catch (error) {
    console.error(`    ❌ Error: ${error}`);
    if (retryCount === 0) {
      await new Promise((r) => setTimeout(r, 1000));
      return generateImagingLinks(imaging, conditions, 1);
    }
    return [];
  }
}

// ================================
// MAIN FUNCTIONS
// ================================

async function analyze() {
  console.log('\n📊 Current Database State');
  console.log('='.repeat(60));

  const [ecgCount, imagingCount, conditionCount, ecgLinkCount, imagingLinkCount] =
    await Promise.all([
      prisma.eCGPattern.count(),
      prisma.imagingStudy.count(),
      prisma.condition.count(),
      prisma.eCGConditionLink.count(),
      prisma.imagingConditionLink.count(),
    ]);

  console.log(`\n  ECG Patterns:          ${ecgCount}`);
  console.log(`  Imaging Studies:       ${imagingCount}`);
  console.log(`  Conditions:            ${conditionCount}`);
  console.log(`  ECG-Condition Links:   ${ecgLinkCount}`);
  console.log(`  Imaging-Condition Links: ${imagingLinkCount}`);

  // Calculate potential links
  const potentialECG = ecgCount * 5; // Estimate ~5 conditions per ECG
  const potentialImaging = imagingCount * 10; // Estimate ~10 conditions per imaging

  console.log(`\n  Estimated potential ECG links:     ~${potentialECG}`);
  console.log(`  Estimated potential Imaging links: ~${potentialImaging}`);

  if (ecgLinkCount === 0 && imagingLinkCount === 0) {
    console.log('\n⚠️  Both link tables are empty! Run with --all to populate.');
  }
}

async function generateECGConditionLinks() {
  console.log('\n🔗 Generating ECG-Condition Links');
  console.log('='.repeat(60));

  // Get all ECG patterns
  const ecgPatterns = await prisma.eCGPattern.findMany({
    select: { id: true, name: true, category: true },
  });

  // Get all conditions grouped by system
  const conditions = await prisma.condition.findMany({
    select: { id: true, name: true, system: true },
  });

  // Get existing links to avoid duplicates
  const existingLinks = await prisma.eCGConditionLink.findMany({
    select: { ecgPatternId: true, conditionId: true, relationshipType: true },
  });
  const existingSet = new Set(
    existingLinks.map((l) => `${l.ecgPatternId}|${l.conditionId}|${l.relationshipType}`)
  );

  console.log(`\n  ECG Patterns to process: ${ecgPatterns.length}`);
  console.log(`  Available Conditions: ${conditions.length}`);
  console.log(`  Existing Links: ${existingLinks.length}\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  // Group conditions by system for more targeted linking
  const conditionsBySystem: Record<string, typeof conditions> = {};
  for (const c of conditions) {
    const system = c.system || 'General';
    if (!conditionsBySystem[system]) conditionsBySystem[system] = [];
    conditionsBySystem[system].push(c);
  }

  // Map ECG categories to condition systems
  const categoryToSystems: Record<string, string[]> = {
    Arrhythmia: ['Cardiovascular', 'Cardiology', 'General'],
    Conduction: ['Cardiovascular', 'Cardiology', 'General'],
    Ischemia: ['Cardiovascular', 'Cardiology', 'General'],
    Hypertrophy: ['Cardiovascular', 'Cardiology', 'Renal', 'General'],
    Electrolyte: ['Renal', 'Endocrinology', 'General'],
    'Drug Effect': ['Toxicology', 'Psychiatry', 'General'],
    Pericardial: ['Cardiovascular', 'Cardiology', 'General'],
    Other: ['General'],
  };

  for (const ecg of ecgPatterns) {
    console.log(`  📍 ${ecg.name}...`);

    // Get relevant conditions based on ECG category
    const relevantSystems = categoryToSystems[ecg.category] || ['General', 'Cardiovascular'];
    let relevantConditions: typeof conditions = [];

    for (const system of relevantSystems) {
      if (conditionsBySystem[system]) {
        relevantConditions = [...relevantConditions, ...conditionsBySystem[system]];
      }
    }

    // Add cardiovascular conditions always
    if (conditionsBySystem['Cardiovascular']) {
      relevantConditions = [
        ...new Set([...relevantConditions, ...conditionsBySystem['Cardiovascular']]),
      ];
    }

    if (relevantConditions.length === 0) {
      relevantConditions = conditions.slice(0, 100);
    }

    if (DRY_RUN) {
      console.log(`    Would generate links for ${relevantConditions.length} conditions`);
      continue;
    }

    const links = await generateECGLinks(ecg, relevantConditions);

    for (const link of links) {
      const key = `${link.ecgPatternId}|${link.conditionId}|${link.relationshipType}`;

      if (existingSet.has(key)) {
        skipped++;
        continue;
      }

      try {
        await prisma.eCGConditionLink.create({
          data: {
            id: crypto.randomUUID(),
            ...link,
            updatedAt: new Date(),
          },
        });
        existingSet.add(key);
        created++;
      } catch (error) {
        // Skip unique constraint violations silently
        if ((error as any).code === 'P2002') {
          skipped++;
        } else {
          console.error(`    ❌ Error: ${error}`);
          failed++;
        }
      }
    }

    console.log(`    ✅ Created ${links.length} links`);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📊 ECG Links Summary:`);
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Failed: ${failed}`);

  const total = await prisma.eCGConditionLink.count();
  console.log(`   Total in database: ${total}`);
}

async function generateImagingConditionLinks() {
  console.log('\n🔗 Generating Imaging-Condition Links');
  console.log('='.repeat(60));

  const imagingStudies = await prisma.imagingStudy.findMany({
    select: { id: true, name: true, modality: true, bodyRegion: true },
  });

  const conditions = await prisma.condition.findMany({
    select: { id: true, name: true, system: true },
  });

  const existingLinks = await prisma.imagingConditionLink.findMany({
    select: { imagingId: true, conditionId: true, relationshipType: true },
  });
  const existingSet = new Set(
    existingLinks.map((l) => `${l.imagingId}|${l.conditionId}|${l.relationshipType}`)
  );

  console.log(`\n  Imaging Studies to process: ${imagingStudies.length}`);
  console.log(`  Available Conditions: ${conditions.length}`);
  console.log(`  Existing Links: ${existingLinks.length}\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  // Map body regions to condition systems
  const regionToSystems: Record<string, string[]> = {
    Chest: ['Pulmonary', 'Cardiovascular', 'Cardiology', 'Respiratory'],
    Abdomen: ['Gastroenterology', 'GI', 'Hepatology', 'Renal', 'General Surgery'],
    Head: ['Neurology', 'Neuro', 'ENT', 'Ophthalmology'],
    Spine: ['Orthopedics', 'Neurology', 'MSK'],
    Musculoskeletal: ['Orthopedics', 'MSK', 'Rheumatology'],
    Pelvis: ['Urology', 'Gynecology', 'OB/GYN', 'Renal'],
    Vascular: ['Cardiovascular', 'Vascular', 'Cardiology'],
    'Whole Body': ['Oncology', 'General', 'ID'],
  };

  for (const imaging of imagingStudies) {
    console.log(`  📍 ${imaging.name}...`);

    // Get relevant conditions based on body region
    const relevantSystems = regionToSystems[imaging.bodyRegion || 'Whole Body'] || ['General'];
    let relevantConditions = conditions.filter((c) =>
      relevantSystems.some(
        (sys) =>
          c.system?.toLowerCase().includes(sys.toLowerCase()) ||
          sys.toLowerCase().includes(c.system?.toLowerCase() || '')
      )
    );

    if (relevantConditions.length === 0) {
      relevantConditions = conditions.slice(0, 100);
    }

    if (DRY_RUN) {
      console.log(`    Would generate links for ${relevantConditions.length} conditions`);
      continue;
    }

    const links = await generateImagingLinks(imaging, relevantConditions);

    for (const link of links) {
      const key = `${link.imagingId}|${link.conditionId}|${link.relationshipType}`;

      if (existingSet.has(key)) {
        skipped++;
        continue;
      }

      try {
        await prisma.imagingConditionLink.create({
          data: {
            id: crypto.randomUUID(),
            imagingId: link.imagingId,
            conditionId: link.conditionId,
            relationshipType: link.relationshipType,
            expectedFindings: link.expectedFindings,
            classicFindings: link.classicFindings,
            findingDescription: link.findingDescription,
            sensitivity: link.sensitivity,
            specificity: link.specificity,
            isFirstLine: link.isFirstLine,
            panceYield: link.panceYield,
            updatedAt: new Date(),
          },
        });
        existingSet.add(key);
        created++;
      } catch (error) {
        if ((error as any).code === 'P2002') {
          skipped++;
        } else {
          console.error(`    ❌ Error: ${error}`);
          failed++;
        }
      }
    }

    console.log(`    ✅ Created ${links.length} links`);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📊 Imaging Links Summary:`);
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Failed: ${failed}`);

  const total = await prisma.imagingConditionLink.count();
  console.log(`   Total in database: ${total}`);
}

async function main() {
  console.log('🔗 Condition Link Generator');
  console.log('='.repeat(60));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);

  if (ANALYZE) {
    await analyze();
    await prisma.$disconnect();
    return;
  }

  if (GEN_ECG) {
    await generateECGConditionLinks();
  }

  if (GEN_IMAGING) {
    await generateImagingConditionLinks();
  }

  await prisma.$disconnect();
  console.log('\n✅ Done!');
}

main().catch(console.error);
