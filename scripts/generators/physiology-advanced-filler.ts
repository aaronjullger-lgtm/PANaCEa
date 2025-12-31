/**
 * PhysiologyConcept Advanced Gap Filler
 * Fills: molecularBasis, signalTransduction, compareContrast, curveShifts, drugEffects, keyEquations, labChanges
 * (~32% gaps based on complete-gap-analysis)
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

interface PhysiologyAdvancedContent {
  molecularBasis: string;
  signalTransduction: string;
  compareContrast: Record<string, any>;
  curveShifts: Record<string, any>;
  drugEffects: Record<string, any>;
  keyEquations: Record<string, any>;
  labChanges: Record<string, any>;
}

async function generateContent(concept: any): Promise<PhysiologyAdvancedContent | null> {
  await rateLimiter.consume();

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });

  const prompt = `Generate PANCE-relevant advanced physiology content for "${concept.name}" (category: ${concept.category}, system: ${concept.system || 'general'}).

Current data:
- Description: ${concept.description || 'none'}
- Mechanism: ${concept.mechanism || 'none'}
- Clinical Significance: ${concept.clinicalSignificance || 'none'}

Provide the following in JSON format:
{
  "molecularBasis": "1-2 sentence description of the molecular/cellular mechanism underlying this concept (receptors, channels, enzymes involved)",
  "signalTransduction": "Description of signal transduction pathway if applicable, or 'Not directly applicable' if not a signaling concept",
  "compareContrast": {
    "vs_1": {"concept": "related concept name", "similarities": ["sim1", "sim2"], "differences": ["diff1", "diff2"]},
    "vs_2": {"concept": "another related concept", "similarities": ["sim1"], "differences": ["diff1", "diff2"]}
  },
  "curveShifts": {
    "rightShift": {"causes": ["cause1", "cause2"], "effect": "clinical effect of right shift"},
    "leftShift": {"causes": ["cause1", "cause2"], "effect": "clinical effect of left shift"}
  },
  "drugEffects": {
    "drug1Name": {"mechanism": "how it affects this physiology", "clinicalUse": "why used"},
    "drug2Name": {"mechanism": "how it affects this physiology", "clinicalUse": "why used"}
  },
  "keyEquations": {
    "equation1": {"formula": "mathematical expression", "variables": {"var1": "meaning", "var2": "meaning"}, "clinicalUse": "when/why this matters"}
  },
  "labChanges": {
    "increased": {"causes": ["cause1", "cause2"], "clinicalSignificance": "what it means"},
    "decreased": {"causes": ["cause1", "cause2"], "clinicalSignificance": "what it means"}
  }
}

IMPORTANT: 
- For curveShifts, only include if relevant to this concept (e.g., oxygen-hemoglobin curve, cardiac function curves). Use {"notApplicable": true} if no relevant curves.
- For keyEquations, include clinically relevant formulas like Fick equation, Henderson-Hasselbalch, etc. Use {"notApplicable": true} if no key equations.
- For compareContrast, pick the 1-2 most clinically relevant comparisons.
- Be PANCE exam-focused and clinically practical.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error(`Error generating for ${concept.name}:`, error);
    return null;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('PHYSIOLOGY CONCEPT ADVANCED GAP FILLER');
  console.log('='.repeat(60));

  // Find concepts with gaps in these specific fields
  const allConcepts = await prisma.physiologyConcept.findMany();
  const conceptsWithGaps = allConcepts.filter(c => {
    return !c.molecularBasis ||
           !c.signalTransduction ||
           !c.compareContrast ||
           !c.curveShifts ||
           !c.drugEffects ||
           !c.keyEquations ||
           !c.labChanges;
  });

  console.log(`Found ${conceptsWithGaps.length} concepts with gaps\n`);

  let filled = 0;
  let failed = 0;

  for (const concept of conceptsWithGaps) {
    console.log(`Processing [${filled + failed + 1}/${conceptsWithGaps.length}]: ${concept.name}`);

    const content = await generateContent(concept);
    if (!content) {
      console.log(`  ❌ Failed to generate`);
      failed++;
      continue;
    }

    // Only update fields that are missing
    const updateData: any = { updatedAt: new Date() };
    const updatedFields: string[] = [];
    
    if (!concept.molecularBasis && content.molecularBasis) {
      updateData.molecularBasis = content.molecularBasis;
      updatedFields.push('molecularBasis');
    }
    if (!concept.signalTransduction && content.signalTransduction) {
      updateData.signalTransduction = content.signalTransduction;
      updatedFields.push('signalTransduction');
    }
    if (!concept.compareContrast && content.compareContrast) {
      updateData.compareContrast = content.compareContrast;
      updatedFields.push('compareContrast');
    }
    if (!concept.curveShifts && content.curveShifts) {
      updateData.curveShifts = content.curveShifts;
      updatedFields.push('curveShifts');
    }
    if (!concept.drugEffects && content.drugEffects) {
      updateData.drugEffects = content.drugEffects;
      updatedFields.push('drugEffects');
    }
    if (!concept.keyEquations && content.keyEquations) {
      updateData.keyEquations = content.keyEquations;
      updatedFields.push('keyEquations');
    }
    if (!concept.labChanges && content.labChanges) {
      updateData.labChanges = content.labChanges;
      updatedFields.push('labChanges');
    }

    if (updatedFields.length === 0) {
      console.log(`  ⏭️  No fields needed update`);
      continue;
    }

    try {
      await prisma.physiologyConcept.update({
        where: { id: concept.id },
        data: updateData,
      });
      console.log(`  ✅ Updated: ${updatedFields.join(', ')}`);
      filled++;
    } catch (error) {
      console.error(`  ❌ DB error:`, error);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total processed: ${conceptsWithGaps.length}`);
  console.log(`Filled: ${filled}`);
  console.log(`Failed: ${failed}`);

  await prisma.$disconnect();
}

main().catch(console.error);
