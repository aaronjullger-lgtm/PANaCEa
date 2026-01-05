/**
 * AnatomyStructure Text Gap Filler
 * Fills text fields: contents, anastomoses, tributaries, branches, attachments, layers, aliases, etc.
 * (URL fields like imageUrl, videoUrl need media integration, not AI)
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Rate limiting
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  constructor(private capacity: number, private refillRate: number) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }
  async consume(): Promise<void> {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
    if (this.tokens < 1) {
      const waitTime = ((1 - this.tokens) / this.refillRate) * 1000;
      await new Promise(r => setTimeout(r, waitTime));
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
  }
}

const rateLimiter = new TokenBucket(5, 0.5);

interface AnatomyContent {
  contents: string[];
  anastomoses: string[];
  tributaries: string[];
  branches: string[];
  attachments: string[];
  layers: string[];
  aliases: string[];
  surfaceLandmarks: string[];
  abbreviation: string;
  autonomicFunction: string;
  borders: string;
  dermatome: string;
  injuryMechanism: string;
  insertion: string;
  latinName: string;
  motorFunction: string;
  myotome: string;
  nervePath: string;
  nerveRoots: string;
  origin: string;
  palpationTips: string;
  sensoryFunction: string;
  surgicalApproach: string;
  vesselPath: string;
}

async function generateContent(structure: any): Promise<AnatomyContent | null> {
  await rateLimiter.consume();

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });

  const structureType = structure.type || 'general';
  const prompt = `Generate comprehensive anatomy content for "${structure.name}" (system: ${structure.system}, region: ${structure.region || 'various'}, type: ${structureType}).

Current data:
- Description: ${structure.description || 'none'}
- Function: ${structure.function || 'none'}
- Blood Supply: ${structure.bloodSupply || 'none'}
- Innervation: ${structure.innervation || 'none'}

Based on the structure type (${structureType}), provide relevant fields in JSON format.
Use empty arrays [] or empty strings "" for fields NOT applicable to this structure type.

{
  "contents": ["For cavities/spaces: what structures are contained within. Empty if not a cavity."],
  "anastomoses": ["For vessels: arterial/venous connections. Empty if not a vessel."],
  "tributaries": ["For veins: draining tributaries. Empty if not a vein."],
  "branches": ["For arteries/nerves: named branches. Empty if not applicable."],
  "attachments": ["For muscles/ligaments: attachment points. Empty if not applicable."],
  "layers": ["For layered structures (skin, GI wall, etc.): named layers. Empty if not applicable."],
  "aliases": ["Alternative names, common abbreviations"],
  "surfaceLandmarks": ["Surface anatomy landmarks for locating this structure"],
  "abbreviation": "Common abbreviation if any",
  "autonomicFunction": "Autonomic (sympathetic/parasympathetic) function if applicable",
  "borders": "Anatomical borders/boundaries",
  "dermatome": "Dermatome level if nerve-related",
  "injuryMechanism": "Common mechanism of injury to this structure",
  "insertion": "For muscles: insertion point. Empty if not a muscle.",
  "latinName": "Latin anatomical name",
  "motorFunction": "Motor function if nerve/muscle",
  "myotome": "Myotome level if nerve-related",
  "nervePath": "Course/path of nerve if applicable",
  "nerveRoots": "Spinal nerve roots if applicable (e.g., C5-C6)",
  "origin": "For muscles: origin point. Empty if not a muscle.",
  "palpationTips": "Tips for palpating this structure on physical exam",
  "sensoryFunction": "Sensory distribution if nerve",
  "surgicalApproach": "Common surgical approach to this structure",
  "vesselPath": "Course/path of vessel if applicable"
}

Be clinically accurate. Only provide content relevant to this structure type.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error(`Error generating for ${structure.name}:`, error);
    return null;
  }
}

function ensureArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim()) return [val];
  return [];
}

async function main() {
  console.log('='.repeat(60));
  console.log('ANATOMY STRUCTURE TEXT GAP FILLER');
  console.log('(Excludes URL fields that need media integration)');
  console.log('='.repeat(60));

  const args = process.argv.slice(2);
  const batchArg = args.find(a => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : undefined;

  // Find structures with text gaps (not URL gaps)
  const allStructures = await prisma.anatomyStructure.findMany();
  const structuresWithGaps = allStructures.filter(s => {
    return (!s.contents || s.contents.length === 0) ||
           (!s.anastomoses || s.anastomoses.length === 0) ||
           (!s.tributaries || s.tributaries.length === 0) ||
           (!s.branches || s.branches.length === 0) ||
           (!s.attachments || s.attachments.length === 0) ||
           (!s.layers || s.layers.length === 0) ||
           (!s.aliases || s.aliases.length === 0);
  });

  const toProcess = batchSize ? structuresWithGaps.slice(0, batchSize) : structuresWithGaps;
  console.log(`Found ${structuresWithGaps.length} structures with gaps, processing ${toProcess.length}\n`);

  let filled = 0;
  let failed = 0;

  for (const structure of toProcess) {
    console.log(`Processing [${filled + failed + 1}/${toProcess.length}]: ${structure.name}`);

    const content = await generateContent(structure);
    if (!content) {
      console.log(`  ❌ Failed to generate`);
      failed++;
      continue;
    }

    // Only update fields that are missing AND have new content
    const updateData: any = { updatedAt: new Date() };
    
    // Array fields - only update if currently empty AND new content is not empty
    const arrayFields = ['contents', 'anastomoses', 'tributaries', 'branches', 'attachments', 'layers', 'aliases', 'surfaceLandmarks'];
    for (const field of arrayFields) {
      const currentVal = (structure as any)[field];
      const newVal = ensureArray((content as any)[field]);
      if ((!currentVal || currentVal.length === 0) && newVal.length > 0) {
        updateData[field] = newVal;
      }
    }

    // String fields - only update if currently empty AND new content exists
    const stringFields = ['abbreviation', 'autonomicFunction', 'borders', 'dermatome', 'injuryMechanism', 'insertion', 'latinName', 'motorFunction', 'myotome', 'nervePath', 'nerveRoots', 'origin', 'palpationTips', 'sensoryFunction', 'surgicalApproach', 'vesselPath'];
    for (const field of stringFields) {
      const currentVal = (structure as any)[field];
      const newVal = (content as any)[field];
      if (!currentVal && newVal && typeof newVal === 'string' && newVal.trim()) {
        updateData[field] = newVal;
      }
    }

    try {
      await prisma.anatomyStructure.update({
        where: { id: structure.id },
        data: updateData,
      });
      console.log(`  ✅ Updated (${Object.keys(updateData).length - 1} fields)`);
      filled++;
    } catch (error) {
      console.error(`  ❌ DB error:`, error);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total processed: ${toProcess.length}`);
  console.log(`Filled: ${filled}`);
  console.log(`Failed: ${failed}`);
  console.log(`Remaining: ${structuresWithGaps.length - toProcess.length}`);

  await prisma.$disconnect();
}

main().catch(console.error);
