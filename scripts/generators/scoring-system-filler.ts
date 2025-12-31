/**
 * ScoringSystem Gap Filler
 * 10 records need ALL fields filled - small but critical
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

interface ScoringSystemContent {
  displayName: string;
  clinicalContext: string;
  calculatorUrl: string;
  aliases: string[];
  boardYieldFacts: string[];
  validationStudies: string[];
  limitations: string[];
  commonMistakes: string[];
  mnemonics: string[];
  actionThresholds: Record<string, string>;
  clinicalPearls: string[];
  testQuestionTips: string[];
  whenNotToUse: string[];
}

async function generateContent(scoring: any): Promise<ScoringSystemContent | null> {
  await rateLimiter.consume();

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });

  const prompt = `Generate comprehensive PANCE-relevant content for the clinical scoring system "${scoring.name}" (category: ${scoring.category}, condition: ${scoring.condition || 'general'}).

Current data:
- Components: ${JSON.stringify(scoring.components)}
- Interpretation: ${JSON.stringify(scoring.interpretation)}
- Max Score: ${scoring.maxScore}
- Sensitivity: ${scoring.sensitivity || 'unknown'}
- Specificity: ${scoring.specificity || 'unknown'}

Provide the following in JSON format:
{
  "displayName": "Full clinical name of the scoring system",
  "clinicalContext": "When and why this scoring system is used clinically (2-3 sentences)",
  "calculatorUrl": "URL to MDCalc or similar calculator (e.g., https://www.mdcalc.com/...)",
  "aliases": ["array of alternative names or abbreviations"],
  "boardYieldFacts": ["3-5 high-yield facts for PANCE exam"],
  "validationStudies": ["Key validation studies with results, e.g., 'JAMA 2019: Validated in 10,000 patients'"],
  "limitations": ["Clinical limitations when the score may be inaccurate or inappropriate"],
  "commonMistakes": ["Common errors students make when applying this scoring system"],
  "mnemonics": ["Memory aids for remembering components or interpretation"],
  "actionThresholds": {
    "low": "Action for low score range",
    "moderate": "Action for moderate score range",  
    "high": "Action for high score range"
  },
  "clinicalPearls": ["3-5 clinical tips for applying this score"],
  "testQuestionTips": ["How this scoring system appears on board exams"],
  "whenNotToUse": ["Situations where this score should NOT be applied"]
}

Be clinically accurate and PANCE exam-focused.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error(`Error generating for ${scoring.name}:`, error);
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
  console.log('SCORING SYSTEM GAP FILLER');
  console.log('='.repeat(60));

  const scoringSystems = await prisma.scoringSystem.findMany();
  console.log(`Found ${scoringSystems.length} scoring systems\n`);

  let filled = 0;
  let failed = 0;

  for (const scoring of scoringSystems) {
    console.log(`Processing [${filled + failed + 1}/${scoringSystems.length}]: ${scoring.name}`);

    const content = await generateContent(scoring);
    if (!content) {
      console.log(`  ❌ Failed to generate content`);
      failed++;
      continue;
    }

    try {
      await prisma.scoringSystem.update({
        where: { id: scoring.id },
        data: {
          updatedAt: new Date(),
          displayName: content.displayName || scoring.name,
          clinicalContext: content.clinicalContext || '',
          calculatorUrl: content.calculatorUrl || '',
          aliases: ensureArray(content.aliases),
          boardYieldFacts: ensureArray(content.boardYieldFacts),
          validationStudies: ensureArray(content.validationStudies),
          limitations: ensureArray(content.limitations),
          commonMistakes: ensureArray(content.commonMistakes),
          mnemonics: ensureArray(content.mnemonics),
          actionThresholds: content.actionThresholds || {},
          clinicalPearls: ensureArray(content.clinicalPearls),
          testQuestionTips: ensureArray(content.testQuestionTips),
          whenNotToUse: ensureArray(content.whenNotToUse),
        },
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
  console.log(`Total: ${scoringSystems.length}`);
  console.log(`Filled: ${filled}`);
  console.log(`Failed: ${failed}`);

  await prisma.$disconnect();
}

main().catch(console.error);
