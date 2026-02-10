/**
 * PhysicalExamFinding Gap Filler
 * Fills moderate gaps: normalVariants, aliases, equipmentNeeded, LR values, etc.
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Rate limiting
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
  async consume(): Promise<void> {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
    if (this.tokens < 1) {
      const waitTime = ((1 - this.tokens) / this.refillRate) * 1000;
      await new Promise((r) => setTimeout(r, waitTime));
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
  }
}

const rateLimiter = new TokenBucket(5, 0.5);

interface FindingContent {
  normalVariants: string[];
  aliases: string[];
  equipmentNeeded: string[];
  positiveLR: number | null;
  negativeLR: number | null;
  associatedFindings: string[];
  eponymousName: string;
  evidenceQuality: string;
  findingType: string;
  gradingScale: string;
  howToDocument: string;
  patientPosition: string;
  negativeIndicates: string[];
}

async function generateContent(finding: any): Promise<FindingContent | null> {
  await rateLimiter.consume();

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });

  const prompt = `Generate PANCE-relevant content for the physical exam finding "${finding.name}" (system: ${finding.system}).

Current data:
- Description: ${finding.description || 'none'}
- Clinical Significance: ${finding.clinicalSignificance || 'none'}
- How to Elicit: ${finding.howToElicit || 'none'}

Provide the following in JSON format:
{
  "normalVariants": ["Array of 2-4 normal variants that can mimic this finding or affect its interpretation"],
  "aliases": ["Array of alternative names for this finding"],
  "equipmentNeeded": ["Array of equipment needed to properly elicit this finding, e.g., 'Stethoscope', '128 Hz tuning fork'"],
  "positiveLR": number (positive likelihood ratio if known, null if unknown or not applicable),
  "negativeLR": number (negative likelihood ratio if known, null if unknown or not applicable),
  "associatedFindings": ["Array of other findings commonly associated with this one"],
  "eponymousName": "Eponymous name if applicable (e.g., 'Murphy sign'), empty string if none",
  "evidenceQuality": "Level of evidence: 'High', 'Moderate', 'Low', or 'Expert consensus'",
  "findingType": "Type: 'Inspection', 'Palpation', 'Percussion', 'Auscultation', or 'Special maneuver'",
  "gradingScale": "Grading scale if applicable (e.g., '0-4+ scale' for edema), empty string if none",
  "howToDocument": "How to properly document this finding in a note",
  "patientPosition": "Optimal patient position for eliciting this finding",
  "negativeIndicates": ["Array of conditions/states a NEGATIVE finding helps rule out"]
}

Be clinically accurate and PANCE exam-focused. Use null for LR values if unknown.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error(`Error generating for ${finding.name}:`, error);
    return null;
  }
}

function ensureArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') return [val];
  return [];
}

async function main() {
  console.log('='.repeat(60));
  console.log('PHYSICAL EXAM FINDING GAP FILLER');
  console.log('='.repeat(60));

  const args = process.argv.slice(2);
  const batchArg = args.find((a) => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : undefined;

  // Find findings with gaps
  const allFindings = await prisma.physicalExamFinding.findMany();
  const findingsWithGaps = allFindings.filter((f) => {
    return (
      !f.normalVariants ||
      f.normalVariants.length === 0 ||
      !f.aliases ||
      f.aliases.length === 0 ||
      !f.equipmentNeeded ||
      f.equipmentNeeded.length === 0 ||
      f.positiveLR === null ||
      f.negativeLR === null ||
      !f.associatedFindings ||
      f.associatedFindings.length === 0
    );
  });

  const toProcess = batchSize ? findingsWithGaps.slice(0, batchSize) : findingsWithGaps;
  console.log(
    `Found ${findingsWithGaps.length} findings with gaps, processing ${toProcess.length}\n`
  );

  let filled = 0;
  let failed = 0;

  for (const finding of toProcess) {
    console.log(`Processing [${filled + failed + 1}/${toProcess.length}]: ${finding.name}`);

    const content = await generateContent(finding);
    if (!content) {
      console.log(`  ❌ Failed to generate`);
      failed++;
      continue;
    }

    // Only update fields that are missing
    const updateData: any = {};
    if (!finding.normalVariants || finding.normalVariants.length === 0) {
      updateData.normalVariants = ensureArray(content.normalVariants);
    }
    if (!finding.aliases || finding.aliases.length === 0) {
      updateData.aliases = ensureArray(content.aliases);
    }
    if (!finding.equipmentNeeded || finding.equipmentNeeded.length === 0) {
      updateData.equipmentNeeded = ensureArray(content.equipmentNeeded);
    }
    if (finding.positiveLR === null && content.positiveLR !== null) {
      updateData.positiveLR = content.positiveLR;
    }
    if (finding.negativeLR === null && content.negativeLR !== null) {
      updateData.negativeLR = content.negativeLR;
    }
    if (!finding.associatedFindings || finding.associatedFindings.length === 0) {
      updateData.associatedFindings = ensureArray(content.associatedFindings);
    }
    if (!finding.eponymousName && content.eponymousName) {
      updateData.eponymousName = content.eponymousName;
    }
    if (!finding.evidenceQuality && content.evidenceQuality) {
      updateData.evidenceQuality = content.evidenceQuality;
    }
    if (!finding.findingType && content.findingType) {
      updateData.findingType = content.findingType;
    }
    if (!finding.gradingScale && content.gradingScale) {
      updateData.gradingScale = content.gradingScale;
    }
    if (!finding.howToDocument && content.howToDocument) {
      updateData.howToDocument = content.howToDocument;
    }
    if (!finding.patientPosition && content.patientPosition) {
      updateData.patientPosition = content.patientPosition;
    }
    if (!finding.negativeIndicates || finding.negativeIndicates.length === 0) {
      updateData.negativeIndicates = ensureArray(content.negativeIndicates);
    }

    try {
      await prisma.physicalExamFinding.update({
        where: { id: finding.id },
        data: updateData,
      });
      console.log(`  ✅ Updated`);
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
  console.log(`Remaining: ${findingsWithGaps.length - toProcess.length}`);

  await prisma.$disconnect();
}

main().catch(console.error);
