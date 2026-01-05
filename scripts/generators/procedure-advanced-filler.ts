/**
 * Procedure Advanced Gap Filler
 * Fills: displayName, type, preparation, positioning, anesthesia, duration
 * (~13% gaps based on complete-gap-analysis)
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

interface ProcedureAdvancedContent {
  displayName: string;
  type: string;
  preparation: string;
  positioning: string;
  anesthesia: string;
  duration: string;
}

async function generateContent(procedure: any): Promise<ProcedureAdvancedContent | null> {
  await rateLimiter.consume();

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });

  const prompt = `Generate PANCE-relevant clinical details for the medical procedure "${procedure.name}" (category: ${procedure.category}, system: ${procedure.system || 'various'}).

Current data:
- Description: ${procedure.description || 'none'}
- Indications: ${procedure.indications?.join(', ') || 'none'}
- Technique: ${procedure.technique || 'none'}

Provide the following in JSON format:
{
  "displayName": "Full clinical name as it would appear in medical documentation (e.g., 'Central Venous Catheter Insertion')",
  "type": "Procedure classification: 'diagnostic', 'therapeutic', 'surgical', 'minor_surgical', 'interventional', 'bedside', or 'imaging_guided'",
  "preparation": "Concise preparation steps including sterile technique, patient preparation, equipment setup (2-4 sentences)",
  "positioning": "Standard patient positioning for optimal access and safety (e.g., 'Supine with head turned away from insertion site', 'Lateral decubitus with knees flexed')",
  "anesthesia": "Type of anesthesia typically used: 'local infiltration', 'topical', 'conscious sedation', 'regional block', 'general anesthesia', 'none', or combination",
  "duration": "Typical procedure duration range (e.g., '10-15 minutes', '30-45 minutes', '1-2 hours')"
}

Be specific, clinically accurate, and PANCE exam-focused. Include practical information a PA student would need to know.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error(`Error generating for ${procedure.name}:`, error);
    return null;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('PROCEDURE ADVANCED GAP FILLER');
  console.log('='.repeat(60));

  // Find procedures with gaps in these specific fields
  const allProcedures = await prisma.procedure.findMany();
  const proceduresWithGaps = allProcedures.filter(p => {
    return !p.displayName ||
           !p.type ||
           !p.preparation ||
           !p.positioning ||
           !p.anesthesia ||
           !p.duration;
  });

  console.log(`Found ${proceduresWithGaps.length} procedures with gaps\n`);

  let filled = 0;
  let failed = 0;

  for (const procedure of proceduresWithGaps) {
    console.log(`Processing [${filled + failed + 1}/${proceduresWithGaps.length}]: ${procedure.name}`);

    const content = await generateContent(procedure);
    if (!content) {
      console.log(`  ❌ Failed to generate`);
      failed++;
      continue;
    }

    // Only update fields that are missing
    const updateData: any = { updatedAt: new Date() };
    
    if (!procedure.displayName && content.displayName) {
      updateData.displayName = content.displayName;
    }
    if (!procedure.type && content.type) {
      updateData.type = content.type;
    }
    if (!procedure.preparation && content.preparation) {
      updateData.preparation = content.preparation;
    }
    if (!procedure.positioning && content.positioning) {
      updateData.positioning = content.positioning;
    }
    if (!procedure.anesthesia && content.anesthesia) {
      updateData.anesthesia = content.anesthesia;
    }
    if (!procedure.duration && content.duration) {
      updateData.duration = content.duration;
    }

    try {
      await prisma.procedure.update({
        where: { id: procedure.id },
        data: updateData,
      });
      console.log(`  ✅ Updated: ${Object.keys(updateData).filter(k => k !== 'updatedAt').join(', ')}`);
      filled++;
    } catch (error) {
      console.error(`  ❌ DB error:`, error);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total processed: ${proceduresWithGaps.length}`);
  console.log(`Filled: ${filled}`);
  console.log(`Failed: ${failed}`);

  await prisma.$disconnect();
}

main().catch(console.error);
