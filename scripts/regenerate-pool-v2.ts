/**
 * Regenerate Question Pool V2 - "Describe, Don't Diagnose" Methodology
 *
 * This script regenerates the entire question pool using the enhanced
 * question generation methodology that follows gold-standard PANCE/Kaplan patterns.
 *
 * Key improvements:
 * - Clinical descriptions instead of buzzwords
 * - Second-order thinking questions
 * - Imaging-as-text (radiologist's report)
 * - Proper vignette structure
 *
 * Usage:
 *   npx tsx scripts/regenerate-pool-v2.ts          # Regenerate all
 *   npx tsx scripts/regenerate-pool-v2.ts --add 50 # Add 50 more questions
 *   npx tsx scripts/regenerate-pool-v2.ts --system CV  # Only CV system
 */

import { Prisma } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as crypto from 'crypto';
import { prisma, disconnect } from './_shared/db';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEMS = [
  'CV',
  'PULM',
  'GI',
  'NEURO',
  'MSK',
  'DERM',
  'HEME',
  'ENDO',
  'HEENT',
  'RENAL',
  'REPRO',
  'PSYCH',
  'ID',
  'GU',
];

const QUESTIONS_PER_CONDITION = 3;
const MAX_CONDITIONS_PER_SYSTEM = 15;
const RATE_LIMIT_MS = 2000;

interface ConditionInfo {
  conditionId: string;
  medicalContentId: string;
  name: string;
  system: string;
  subcategory: string;
  overview?: string;
  symptoms?: string;
  treatment?: string;
  diagnostics?: string;
  pathophysiology?: string;
  buzzwords?: string[];
}

interface GeneratedQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  conditionName: string;
}

/**
 * Fetch conditions from database for a given system
 */
async function getConditionsForSystem(system: string): Promise<ConditionInfo[]> {
  const medicalContent = await prisma.medicalContent.findMany({
    where: {
      system,
      status: 'published',
    },
    select: {
      id: true,
      conditionId: true,
      condition: true,
      system: true,
      subcategory: true,
      overview: true,
      symptoms: true,
      treatment: true,
      diagnostics: true,
      pathophysiology: true,
      buzzwords: true,
    },
    take: MAX_CONDITIONS_PER_SYSTEM,
    orderBy: { updatedAt: 'desc' },
  });

  return medicalContent.map((mc) => ({
    conditionId: mc.conditionId,
    medicalContentId: mc.id,
    name: mc.condition,
    system: mc.system,
    subcategory: mc.subcategory,
    overview: mc.overview || undefined,
    symptoms: mc.symptoms || undefined,
    treatment: mc.treatment || undefined,
    diagnostics: mc.diagnostics || undefined,
    pathophysiology: mc.pathophysiology || undefined,
    buzzwords: (mc.buzzwords as string[]) || undefined,
  }));
}

/**
 * Robust JSON parser
 */
function robustJsonParse(jsonString: string): any {
  let cleaned = jsonString.trim();

  // Remove markdown code blocks
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  // Remove trailing commas
  cleaned = cleaned.replace(/,(?=\s*?([\]}]))/g, '$1');

  // Fix common HTML-table newline issues
  cleaned = cleaned.replace(/>\s*\n\s*</g, '><');

  try {
    return JSON.parse(cleaned);
  } catch (error: any) {
    console.error('  ❌ JSON parse failed:', error.message);
    console.error('  First 300 chars:', cleaned.substring(0, 300));
    return null;
  }
}

/**
 * Generate questions using the enhanced "Describe, Don't Diagnose" methodology
 */
async function generateQuestionsV2(
  condition: ConditionInfo,
  count: number
): Promise<GeneratedQuestion[]> {
  // Pass findings-only for vignette-building; withhold condition name and overview from vignette text
  const findingsContext = [
    condition.symptoms ? `Clinical Features: ${condition.symptoms.slice(0, 400)}` : '',
    condition.diagnostics ? `Lab/Imaging Patterns: ${condition.diagnostics.slice(0, 400)}` : '',
    condition.pathophysiology ? `Pathophysiology (for answer accuracy): ${condition.pathophysiology.slice(0, 300)}` : '',
    condition.treatment ? `Treatment (for answer accuracy): ${condition.treatment.slice(0, 400)}` : '',
    condition.buzzwords?.length
      ? `Key Features (DO NOT USE DIRECTLY in vignette - describe findings instead): ${condition.buzzwords.join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const prompt = `You are a Senior Medical Board Question Writer for the PANCE. Generate ${count} unique PANCE-style questions based on these clinical findings (${condition.system} system - ${condition.subcategory}).

Findings for vignette (RAW PATIENT DATA ONLY):
${findingsContext || 'Use typical findings for a common condition.'}

=== CRITICAL: RAW PATIENT DATA - NEVER GIVE AWAY THE ANSWER ===
You are STRICTLY FORBIDDEN from stating the diagnosis or condition name in the vignette. Provide raw patient data only (demographics, symptoms, labs, vitals). Example: "A 45-year-old male with fatigue. Labs: Hgb 9.2 g/dL, MCV 72 fL, ferritin 10 ng/mL" — NOT "A patient with iron deficiency anemia." Do not use classic "buzzwords" that give away the answer; DESCRIBE clinical findings as they would appear to a provider.

BUZZWORD POLICY (Mixed Mode):
- For 2 of every 3 questions: Strictly DESCRIBE the finding without naming it.
  - BAD: "Patient has a butterfly rash."
  - GOOD: "Physical exam reveals an erythematous, maculopapular eruption over the malar eminences, sparing the nasolabial folds."
- For 1 of every 3 questions: You MAY include a classic finding, but ask about TREATMENT/MECHANISM/COMPLICATION, not the diagnosis.

UNCALCULATED LABS: Provide raw BMP (Na, Cl, HCO3, etc.) in a table only; do NOT state "anion gap 20" or other derived values—the student must calculate.

HIDDEN IMAGE: When an image/radiograph is referenced or shown, do NOT state the finding or diagnosis in text. Use only scenario + "Radiograph is shown" (e.g. "Patient fell on outstretched hand. Radiograph is shown.").

IMAGING-AS-TEXT RULE (text-only): Provide the "Radiologist's Report" as descriptive text, not interpretation. BAD: "X-ray shows pneumonia." GOOD: "Chest radiography demonstrates a focal consolidation in the right lower lobe with associated air bronchograms."

VIGNETTE STRUCTURE (follow this order) – Vignette Evolution:
1. Patient Demographics & Chief Complaint: Age, gender, complaint, duration.
2. History of Present Illness: Character of symptoms, modifying factors, relevant negatives.
3. PERTINENT NEGATIVES (MANDATORY - at least 2): Explicitly rule out top differentials. Example: "No JVD (rules out tamponade). No pain on inspiration (rules out pleuritis)."
4. Vitals: CLUES not filler. Use relative baselines when relevant (e.g. "normal" BP 110/70 in a patient normally hypertensive 160/90 = relative hypotension). Realistic numbers in a table.
5. Physical Exam: Focused findings described ANATOMICALLY.
6. Diagnostics: Raw labs only (no anion gap/osmolar gap in text); for imaging either descriptive report or "Radiograph/Image is shown" without stating the finding.

Context for answer accuracy (do not include in vignette):
${findingsContext || 'Use your medical knowledge about this condition.'}

Gold standard vs. initial: For "best initial step" or "next test" questions, include the gold standard as a distractor; rationale must clarify why wrong for this step. Next best step: For "next step in management," state what has already been done first, then ask for the immediate next action. Pertinent negatives: Include at least 2 that rule out top differentials. Pharmacological contraindications: For therapeutics, include comorbidity that contraindicates first-line (e.g. HTN + gout; otitis + penicillin allergy).
Task distribution: Vary question types per NCCPA (diagnosis ~18%, history & physical ~16%, clinical intervention ~16%, pharmaceutical ~15%, health maintenance ~11%, diagnostic lab ~10%).
Red flag (optional): For about 10% of questions when batch >= 10, include a subtle red flag that changes management. Do not make it obvious.

REQUIREMENTS:
1. Prefer THIRD-ORDER stems: Vignette → Diagnosis → Complication/next step → Answer. Avoid first-order "What is the diagnosis?" Each question MUST test second-order or third-order thinking (not just recall)
2. Include 4 options with ONE clearly correct answer and THREE plausible distractors
3. Distractors should be common misconceptions or treatments for similar conditions
4. Include a subtle "red herring" detail in each vignette
5. PERTINENT NEGATIVES: Rule out look-alikes in the vignette (e.g. no tenderness → rules out costochondritis). VITALS AS CLUES: Vitals must be meaningful; use relative baselines when relevant (e.g. normal BP in a hypertensive patient = relative hypotension).
6. Format vitals and labs in an HTML table if included
7. The explanation should teach WHY the answer is correct

Return ONLY a JSON array with this exact structure (no markdown, no prose):
[
  {
    "question": "Full vignette with demographics, HPI, vitals table, physical exam, and diagnostics, ending with the actual question stem",
    "options": ["A. First option", "B. Second option", "C. Third option", "D. Fourth option"],
    "correctAnswerIndex": 0,
    "explanation": "Educational explanation with HTML formatting (<b>, <i>) explaining why the correct answer is right and why distractors are wrong",
    "conditionName": "${condition.name}"
  }
]`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    if (!text) {
      console.error('    No response from Gemini');
      return [];
    }

    const questions = robustJsonParse(text);

    if (!questions || !Array.isArray(questions)) {
      return [];
    }

    return questions
      .filter(
        (q: any) =>
          q.question &&
          Array.isArray(q.options) &&
          q.options.length === 4 &&
          typeof q.correctAnswerIndex === 'number' &&
          q.explanation
      )
      .map((q: any) => ({
        ...q,
        conditionName: condition.name,
      }));
  } catch (error: any) {
    console.error(`    Gemini error: ${error.message}`);
    return [];
  }
}

/**
 * Generate a unique question ID
 */
function generateQuestionId(system: string): string {
  return `q-v2-${system.toLowerCase()}-${crypto.randomUUID()}`;
}

async function main() {
  const args = process.argv.slice(2);
  const addMode = args.includes('--add');
  const addCount = addMode ? parseInt(args[args.indexOf('--add') + 1] || '50', 10) : 0;
  const systemFilter = args.includes('--system') ? args[args.indexOf('--system') + 1] : null;
  const clearFirst = !addMode && !args.includes('--no-clear');

  console.log('═'.repeat(70));
  console.log('🔄 Question Pool Regeneration V2 - "Describe, Don\'t Diagnose"');
  console.log('═'.repeat(70));

  if (clearFirst) {
    console.log('\n⚠️  This will DELETE all existing questions and regenerate them.');
    console.log('   Press Ctrl+C within 5 seconds to cancel...\n');
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  // Get current stats
  const currentCount = await prisma.preGeneratedQuestion.count();
  console.log(`📊 Current pool: ${currentCount} questions`);

  if (clearFirst) {
    console.log('\n🗑️  Clearing existing pool...');
    const deleted = await prisma.preGeneratedQuestion.deleteMany({});
    console.log(`   Deleted ${deleted.count} questions`);
  }

  const systemsToProcess = systemFilter ? [systemFilter] : SYSTEMS;
  let totalGenerated = 0;
  let totalFailed = 0;

  for (const system of systemsToProcess) {
    console.log(`\n📋 Processing ${system} system...`);

    const conditions = await getConditionsForSystem(system);
    if (conditions.length === 0) {
      console.log('   ⚠️ No published conditions found');
      continue;
    }

    console.log(`   Found ${conditions.length} conditions`);

    for (const condition of conditions) {
      // In add mode, check existing count
      if (addMode) {
        const existing = await prisma.preGeneratedQuestion.count({
          where: { conditionId: condition.conditionId, usedAt: null },
        });
        if (existing >= QUESTIONS_PER_CONDITION) {
          continue;
        }
      }

      if (addMode && totalGenerated >= addCount) {
        console.log(`\n✅ Reached target of ${addCount} new questions`);
        break;
      }

      console.log(`   ⏳ ${condition.name}...`);

      const questions = await generateQuestionsV2(condition, QUESTIONS_PER_CONDITION);

      if (questions.length > 0) {
        const records = questions.map((q) => ({
          id: generateQuestionId(system),
          questionType: 'clinical-vignette',
          system,
          conditionId: condition.conditionId,
          medicalContentId: condition.medicalContentId,
          difficulty: 'medium',
          questionData: {
            question: q.question,
            options: q.options,
            correctAnswerIndex: q.correctAnswerIndex,
            correctAnswer: ['A', 'B', 'C', 'D'][q.correctAnswerIndex] || 'A',
            explanation: q.explanation,
            conditionName: condition.name,
            system: system,
            subcategory: condition.subcategory,
            tags: [system, condition.subcategory, condition.name].filter(Boolean),
            generatedWith: 'describe-dont-diagnose-v2',
          } as unknown as Prisma.InputJsonValue,
          generatedAt: new Date(),
        }));

        try {
          const result = await prisma.preGeneratedQuestion.createMany({
            data: records,
            skipDuplicates: true,
          });
          console.log(`      ✓ Created ${result.count} questions`);
          totalGenerated += result.count;
        } catch (error: any) {
          console.error(`      ❌ DB error: ${error.message}`);
          totalFailed += questions.length;
        }
      } else {
        console.log(`      ⚠️ No questions generated`);
        totalFailed += QUESTIONS_PER_CONDITION;
      }

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS));
    }

    if (addMode && totalGenerated >= addCount) break;
  }

  // Final stats
  const finalCount = await prisma.preGeneratedQuestion.count();
  // Count V2 questions by checking questionData JSON for generatedWith marker
  // Note: Prisma doesn't support JSON field queries in count, so we use raw
  const v2Result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM "PreGeneratedQuestion" 
    WHERE "questionData"->>'generatedWith' = 'describe-dont-diagnose-v2'
  `;
  const v2Count = Number(v2Result[0]?.count || 0);

  console.log('\n' + '═'.repeat(70));
  console.log('📊 Regeneration Complete:');
  console.log(`   Questions generated: ${totalGenerated}`);
  console.log(`   Failed: ${totalFailed}`);
  console.log(`   Final pool size: ${finalCount}`);
  console.log(`   V2 "Describe, Don't Diagnose" questions: ${v2Count}`);
  console.log('═'.repeat(70));
}

main()
  .catch(console.error)
  .finally(() => disconnect());
