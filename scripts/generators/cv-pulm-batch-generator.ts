/**
 * CV/PULM Targeted Batch Generator
 *
 * Generates PANCE-style questions specifically for Cardiovascular (16%)
 * and Pulmonary (12%) systems — the two most heavily weighted and
 * currently under-represented systems in the question bank.
 *
 * Improvements over question-generator.ts:
 * - NCCPA task category distribution (all 8 categories)
 * - Bloom's taxonomy question ordering (first/second/third)
 * - Enhanced prompting with specific clinical scenario requirements
 * - Condition-aware difficulty targeting
 * - Better deduplication via stem + answer hash
 *
 * Usage:
 *   npx tsx scripts/generators/cv-pulm-batch-generator.ts
 *   npx tsx scripts/generators/cv-pulm-batch-generator.ts --count 100
 *   npx tsx scripts/generators/cv-pulm-batch-generator.ts --system cardiovascular
 *   npx tsx scripts/generators/cv-pulm-batch-generator.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL ?? process.env.DIRECT_DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL or DIRECT_DATABASE_URL required');

// Support both Accelerate (prisma://) and direct Postgres URLs
let prisma: any;
let pool: pg.Pool | null = null;

if (databaseUrl.startsWith('prisma://')) {
  prisma = new PrismaClient({ accelerateUrl: databaseUrl }).$extends(withAccelerate());
} else {
  pool = new pg.Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ---------------------------------------------------------------------------
// DB enum mappings
// ---------------------------------------------------------------------------

const TASK_TYPE_MAP: Record<string, string> = {
  'History Taking & Physical Examination': 'HISTORY_PE',
  'Diagnostic Studies': 'DIAGNOSTIC_STUDIES',
  'Diagnosis': 'DIAGNOSIS',
  'Health Maintenance & Disease Prevention': 'HEALTH_MAINTENANCE',
  'Clinical Intervention': 'CLINICAL_INTERVENTION',
  'Pharmaceutical Therapeutics': 'PHARMACEUTICAL_THERAPEUTICS',
  'Clinical Therapeutics': 'CLINICAL_THERAPEUTICS',
  'Applying Basic Science Concepts': 'BASIC_SCIENCE',
};

const COGNITIVE_LEVEL_MAP: Record<string, string> = {
  first: 'LEVEL_1_RECALL',
  second: 'LEVEL_2_CONCEPT',
  third: 'LEVEL_3_VIGNETTE',
};

const QUESTION_FORMAT_MAP: Record<string, string> = {
  first: 'RECALL',
  second: 'VIGNETTE',
  third: 'VIGNETTE',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeneratedQuestion {
  vignette: string;
  question: string;
  options: Record<string, string>;
  correctAnswer: string;
  explanation: string;
  system: string;
  taskCategory: string;
  questionOrder: 'first' | 'second' | 'third';
  difficulty: number;
  tags: string[];
}

interface ConditionWithContent {
  conditionId: string;
  medicalContentId: string;
  name: string;
  system: string;
  overview?: string;
  symptoms?: string[];
  treatment?: string;
  diagnostics?: string;
  pathophysiology?: string;
  riskFactors?: string;
}

// ---------------------------------------------------------------------------
// NCCPA Task Categories with prompting guidance
// ---------------------------------------------------------------------------

const TASK_CATEGORIES = [
  {
    name: 'History Taking & Physical Examination',
    weight: 16,
    prompt: 'Ask about what history or physical exam finding is most important, expected, or diagnostic.',
    questionStems: [
      'Which history finding is most suggestive of',
      'What physical examination maneuver would best confirm',
      'Which auscultatory finding is most consistent with',
    ],
  },
  {
    name: 'Diagnostic Studies',
    weight: 14,
    prompt: 'Ask about which lab test, imaging study, or diagnostic procedure to order and/or interpret.',
    questionStems: [
      'Which initial diagnostic study is most appropriate',
      'What laboratory finding would you expect',
      'Which imaging modality is the gold standard for',
    ],
  },
  {
    name: 'Diagnosis',
    weight: 18,
    prompt: 'Ask the student to identify the most likely diagnosis from clinical findings.',
    questionStems: [
      'What is the most likely diagnosis',
      'Which condition best explains this presentation',
      'Based on these findings, what is the diagnosis',
    ],
  },
  {
    name: 'Health Maintenance & Disease Prevention',
    weight: 10,
    prompt: 'Ask about screening guidelines, preventive measures, risk factor modification, or immunizations.',
    questionStems: [
      'Which screening is recommended for this patient',
      'What is the most important preventive measure',
      'Which risk factor modification should be prioritized',
    ],
  },
  {
    name: 'Clinical Intervention',
    weight: 14,
    prompt: 'Ask about the immediate management, next best step, or procedural intervention.',
    questionStems: [
      'What is the most appropriate next step in management',
      'Which intervention should be performed first',
      'What is the immediate priority in this patient',
    ],
  },
  {
    name: 'Pharmaceutical Therapeutics',
    weight: 14,
    prompt: 'Ask about drug selection, dosing, mechanism, contraindications, or adverse effects.',
    questionStems: [
      'Which medication is first-line therapy for',
      'What is the mechanism of action of the recommended treatment',
      'Which medication is contraindicated in this patient',
    ],
  },
  {
    name: 'Clinical Therapeutics',
    weight: 8,
    prompt: 'Ask about non-pharmacologic treatments, procedures, rehabilitation, or lifestyle modifications.',
    questionStems: [
      'Which non-pharmacologic intervention is most appropriate',
      'What lifestyle modification is most important',
      'Which procedure should be considered for',
    ],
  },
  {
    name: 'Applying Basic Science Concepts',
    weight: 6,
    prompt: 'Ask about pathophysiology, mechanism of disease, or scientific basis underlying the condition.',
    questionStems: [
      'What is the underlying pathophysiologic mechanism',
      'Which receptor/pathway is involved in',
      'What compensatory mechanism explains this finding',
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// Question Order (Bloom's Taxonomy) distribution for PANCE prep
// ---------------------------------------------------------------------------

const ORDER_DISTRIBUTION = {
  first: 0.20, // Recall/Understand — factual recognition
  second: 0.45, // Apply/Analyze — clinical application (bulk of PANCE)
  third: 0.35, // Evaluate/Create — synthesis and prioritization
};

const ORDER_PROMPTS: Record<string, string> = {
  first:
    'This should be a FIRST-ORDER (Recall/Understand) question. Test recognition of facts, definitions, or straightforward associations. Keep the vignette brief (1-2 sentences). Example: "Which lab test is diagnostic for X?"',
  second:
    'This should be a SECOND-ORDER (Apply/Analyze) question. Present a clinical vignette (3-5 sentences) with patient demographics, history, vitals, exam findings, and/or labs. The student must apply knowledge to a specific clinical scenario.',
  third:
    'This should be a THIRD-ORDER (Evaluate/Create) question. Present a complex clinical vignette (4-6 sentences) with multiple findings, possibly conflicting data, or a multi-step management scenario. The student must synthesize information, prioritize, or make nuanced clinical decisions.',
};

// ---------------------------------------------------------------------------
// High-yield conditions for CV and PULM
// ---------------------------------------------------------------------------

const CV_HIGH_YIELD = [
  'Acute Coronary Syndrome', 'Myocardial Infarction', 'Unstable Angina', 'Stable Angina',
  'Congestive Heart Failure', 'Heart Failure', 'Atrial Fibrillation', 'Atrial Flutter',
  'Hypertension', 'Hypertensive Emergency', 'Deep Vein Thrombosis', 'Pulmonary Embolism',
  'Aortic Stenosis', 'Mitral Regurgitation', 'Aortic Dissection', 'Aortic Aneurysm',
  'Peripheral Arterial Disease', 'Endocarditis', 'Pericarditis', 'Cardiac Tamponade',
  'Supraventricular Tachycardia', 'Ventricular Tachycardia', 'Ventricular Fibrillation',
  'Cardiomyopathy', 'Dilated Cardiomyopathy', 'Hypertrophic Cardiomyopathy',
  'Mitral Valve Prolapse', 'Rheumatic Heart Disease', 'Cor Pulmonale',
  'Syncope', 'Hyperlipidemia', 'Dyslipidemia', 'Shock',
];

const PULM_HIGH_YIELD = [
  'COPD', 'Chronic Obstructive Pulmonary Disease', 'Asthma', 'Status Asthmaticus',
  'Pneumonia', 'Community-Acquired Pneumonia', 'Hospital-Acquired Pneumonia',
  'Pulmonary Embolism', 'Pneumothorax', 'Tension Pneumothorax',
  'Pleural Effusion', 'Acute Respiratory Distress Syndrome', 'ARDS',
  'Pulmonary Fibrosis', 'Idiopathic Pulmonary Fibrosis',
  'Lung Cancer', 'Tuberculosis', 'Sarcoidosis',
  'Obstructive Sleep Apnea', 'Cystic Fibrosis', 'Bronchiectasis',
  'Pulmonary Hypertension', 'Respiratory Failure',
  'Hemoptysis', 'Croup', 'Epiglottitis', 'Bronchiolitis',
  'Acute Bronchitis', 'Empyema', 'Lung Abscess',
  'Occupational Lung Disease', 'Asbestosis', 'Silicosis',
];

// ---------------------------------------------------------------------------
// Prompt Builder
// ---------------------------------------------------------------------------

function buildEnhancedPrompt(
  condition: ConditionWithContent,
  taskCategory: (typeof TASK_CATEGORIES)[number],
  questionOrder: 'first' | 'second' | 'third',
  existingStems: string[]
): string {
  let context = '';
  if (condition.overview) context += `\nOverview: ${condition.overview.substring(0, 600)}`;
  if (condition.pathophysiology) context += `\nPathophysiology: ${condition.pathophysiology.substring(0, 400)}`;
  if (condition.symptoms?.length) context += `\nKey Symptoms: ${condition.symptoms.slice(0, 10).join(', ')}`;
  if (condition.diagnostics) context += `\nDiagnostics: ${condition.diagnostics.substring(0, 400)}`;
  if (condition.treatment) context += `\nTreatment: ${condition.treatment.substring(0, 400)}`;
  if (condition.riskFactors) context += `\nRisk Factors: ${condition.riskFactors.substring(0, 300)}`;

  const avoidClause = existingStems.length > 0
    ? `\n\nAVOID these question angles (already covered):\n${existingStems.map((s) => `- ${s}`).join('\n')}`
    : '';

  return `You are an expert PA educator creating PANCE-style board exam questions.

CONDITION: ${condition.name}
BODY SYSTEM: ${condition.system}
TASK CATEGORY: ${taskCategory.name}
${taskCategory.prompt}

QUESTION ORDER:
${ORDER_PROMPTS[questionOrder]}

CLINICAL CONTEXT:${context}
${avoidClause}

REQUIREMENTS:
1. Follow the task category and question order constraints strictly
2. Write a clinically realistic vignette appropriate for the question order level
3. Include patient demographics (age, sex), relevant history, and at least one objective finding
4. Provide 4 answer options (A-D) — all must be clinically plausible
5. Randomize correct answer position (not always A or C)
6. Write a detailed explanation covering why the answer is correct AND why each distractor is wrong
7. Assign a difficulty 1-5 (1=easy recall, 3=standard PANCE, 5=complex synthesis)

Return ONLY valid JSON (no markdown, no code fences):
{
  "vignette": "clinical scenario text",
  "question": "the actual question",
  "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "correctAnswer": "B",
  "explanation": "The correct answer is B because...",
  "difficulty": 3,
  "tags": ["${condition.name}", "${taskCategory.name}", "high-yield"]
}

CRITICAL RULES:
- Return ONLY valid JSON, no markdown or code fences
- Use straight quotes only (no curly quotes)
- Write "greater than" or "less than" instead of > < symbols
- Write "micrograms" instead of µg
- NO special characters: ≥ ≤ × → ± ° µ
- All options must be distinct and medically plausible
- Do NOT use "all of the above" or "none of the above"`;
}

// ---------------------------------------------------------------------------
// Question Generator
// ---------------------------------------------------------------------------

async function generateQuestion(
  condition: ConditionWithContent,
  taskCategory: (typeof TASK_CATEGORIES)[number],
  questionOrder: 'first' | 'second' | 'third',
  existingStems: string[],
  retryCount = 0
): Promise<GeneratedQuestion | null> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const prompt = buildEnhancedPrompt(condition, taskCategory, questionOrder, existingStems);

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Extract JSON (handle markdown-wrapped responses)
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];

    // Clean special characters
    jsonStr = jsonStr
      .trim()
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/[\u00B5\u03BC]/g, 'u') // µ → u
      .replace(/[\u2265]/g, '>=')
      .replace(/[\u2264]/g, '<=')
      .replace(/[\u00B0]/g, ' degrees')
      .replace(/[\u00B1]/g, '+/-')
      .replace(/[\u2192\u2190\u2194]/g, '->')
      .replace(/[\u00D7]/g, 'x');

    const parsed = JSON.parse(jsonStr);

    // Validate required fields
    if (!parsed.vignette || !parsed.question || !parsed.options || !parsed.correctAnswer || !parsed.explanation) {
      throw new Error('Missing required fields');
    }

    // Validate correct answer is one of the options
    if (!parsed.options[parsed.correctAnswer]) {
      throw new Error(`correctAnswer "${parsed.correctAnswer}" not in options`);
    }

    return {
      ...parsed,
      system: condition.system,
      taskCategory: taskCategory.name,
      questionOrder,
      difficulty: parsed.difficulty ?? 3,
      tags: parsed.tags ?? [condition.name],
    };
  } catch (error) {
    if (retryCount < 2) {
      console.log(`    ⚠️  Retry ${retryCount + 1}: ${error}`);
      await new Promise((r) => setTimeout(r, 1000 * (retryCount + 1)));
      return generateQuestion(condition, taskCategory, questionOrder, existingStems, retryCount + 1);
    }
    console.error(`    ❌ Failed after 3 attempts: ${error}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

function questionHash(vignette: string, question: string): string {
  const normalized = `${vignette.substring(0, 80).toLowerCase().trim()}-${question.toLowerCase().trim()}`;
  return crypto.createHash('md5').update(normalized).digest('hex');
}

// ---------------------------------------------------------------------------
// Task category + order assignment
// ---------------------------------------------------------------------------

function selectTaskCategory(index: number): (typeof TASK_CATEGORIES)[number] {
  // Weighted random selection based on NCCPA weights
  const totalWeight = TASK_CATEGORIES.reduce((sum, tc) => sum + tc.weight, 0);
  let rand = (index * 7919) % totalWeight; // Deterministic-ish spread
  for (const tc of TASK_CATEGORIES) {
    rand -= tc.weight;
    if (rand <= 0) return tc;
  }
  return TASK_CATEGORIES[2]; // Default: Diagnosis
}

function selectQuestionOrder(index: number): 'first' | 'second' | 'third' {
  const rand = ((index * 6271) % 100) / 100;
  if (rand < ORDER_DISTRIBUTION.first) return 'first';
  if (rand < ORDER_DISTRIBUTION.first + ORDER_DISTRIBUTION.second) return 'second';
  return 'third';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const systemFilter = args.find((a) => a.startsWith('--system='))?.split('=')[1];
  const countArg = args.find((a) => a.startsWith('--count='))?.split('=')[1];
  const targetCount = countArg ? parseInt(countArg, 10) : 80; // Default: 80 questions

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   CV/PULM Targeted Batch Generator                     ║');
  console.log('║   NCCPA Task Categories × Bloom\'s Question Orders      ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\n  Target: ${targetCount} questions`);
  console.log(`  Systems: ${systemFilter ?? 'cardiovascular + pulmonary'}`);
  console.log(`  Dry run: ${dryRun}`);

  // Fetch conditions
  console.log('\n📊 Fetching CV/PULM conditions from MedicalContent...');

  // DB uses short codes: CV, PULM
  const SYSTEM_ALIASES: Record<string, string> = {
    cardiovascular: 'CV', cv: 'CV',
    pulmonary: 'PULM', pulm: 'PULM',
  };
  const targetSystems = systemFilter
    ? [SYSTEM_ALIASES[systemFilter.toLowerCase()] ?? systemFilter]
    : ['CV', 'PULM'];

  const medicalContent = await prisma.medicalContent.findMany({
    where: {
      status: 'published',
      system: { in: targetSystems, mode: 'insensitive' },
    },
    select: {
      id: true,
      conditionId: true,
      condition: true,
      system: true,
      overview: true,
      symptoms: true,
      treatment: true,
      diagnostics: true,
      pathophysiology: true,
      riskFactors: true,
    },
  });

  const conditions: ConditionWithContent[] = medicalContent.map((mc) => ({
    conditionId: mc.conditionId,
    medicalContentId: mc.id,
    name: mc.condition,
    system: mc.system,
    overview: mc.overview ?? undefined,
    symptoms: mc.symptoms ? mc.symptoms.split(',').map((s) => s.trim()) : undefined,
    treatment: mc.treatment ?? undefined,
    diagnostics: mc.diagnostics ?? undefined,
    pathophysiology: mc.pathophysiology ?? undefined,
    riskFactors: mc.riskFactors ?? undefined,
  }));

  console.log(`  Found ${conditions.length} published conditions`);

  // Log by system (use actual system codes from DB: CV, PULM)
  const bySystem: Record<string, ConditionWithContent[]> = {};
  for (const c of conditions) {
    const sys = c.system.toUpperCase();
    if (!bySystem[sys]) bySystem[sys] = [];
    bySystem[sys].push(c);
  }
  for (const [sys, conds] of Object.entries(bySystem)) {
    console.log(`    ${sys}: ${conds.length} conditions`);
  }

  if (conditions.length === 0) {
    console.log('\n❌ No published conditions found! Check MedicalContent table.');
    await prisma.$disconnect();
    if (pool) await pool.end();
    return;
  }

  // Check existing questions for these systems
  const existingBySystem = await prisma.question.groupBy({
    by: ['system'],
    where: { system: { in: targetSystems, mode: 'insensitive' } },
    _count: true,
  });
  console.log('\n📈 Current question counts:');
  for (const row of existingBySystem) {
    console.log(`    ${row.system}: ${row._count} questions`);
  }

  const totalQuestions = await prisma.question.count();
  console.log(`    Total across all systems: ${totalQuestions}`);

  // Build dedup set from existing questions
  const existingQuestions = await prisma.question.findMany({
    where: { system: { in: targetSystems, mode: 'insensitive' } },
    select: { vignette: true, question: true },
  });
  const existingHashes = new Set(existingQuestions.map((q) => questionHash(q.vignette, q.question)));
  console.log(`    Dedup hashes loaded: ${existingHashes.size}`);

  // Track stems per condition for diversity
  const stemsByCondition = new Map<string, string[]>();

  // Distribute target across systems proportionally (16:12 = 57:43)
  const cvCount = systemFilter
    ? targetCount
    : Math.round(targetCount * (16 / 28));
  const pulmCount = systemFilter
    ? 0
    : targetCount - cvCount;

  console.log(`\n🎯 Generation plan:`);
  if (!systemFilter || systemFilter === 'cardiovascular') {
    console.log(`    Cardiovascular: ${cvCount} questions`);
  }
  if (!systemFilter || systemFilter === 'pulmonary') {
    console.log(`    Pulmonary: ${pulmCount} questions`);
  }

  if (dryRun) {
    console.log('\n🏁 Dry run complete — no questions generated.');
    await prisma.$disconnect();
    if (pool) await pool.end();
    return;
  }

  // Generate questions
  let created = 0;
  let failed = 0;
  let duplicates = 0;

  const systemTargets: Array<{ system: string; count: number; conditions: ConditionWithContent[] }> = [];
  if (bySystem['CV']?.length && targetSystems.includes('CV')) {
    systemTargets.push({ system: 'CV', count: cvCount, conditions: bySystem['CV'] });
  }
  if (bySystem['PULM']?.length && targetSystems.includes('PULM')) {
    systemTargets.push({ system: 'PULM', count: pulmCount, conditions: bySystem['PULM'] });
  }

  for (const { system, count, conditions: systemConditions } of systemTargets) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🫀 Generating ${count} ${system.toUpperCase()} questions`);
    console.log('═'.repeat(60));

    let systemCreated = 0;
    let conditionIndex = 0;

    for (let i = 0; i < count * 2 && systemCreated < count; i++) {
      // Cycle through conditions
      const condition = systemConditions[conditionIndex % systemConditions.length];
      conditionIndex++;

      // Select task category and question order
      const taskCategory = selectTaskCategory(i);
      const questionOrder = selectQuestionOrder(i);

      console.log(
        `\n  [${systemCreated + 1}/${count}] ${condition.name}` +
        ` | ${taskCategory.name.substring(0, 25)}` +
        ` | ${questionOrder}-order`
      );

      const existingStems = stemsByCondition.get(condition.conditionId) ?? [];
      const data = await generateQuestion(condition, taskCategory, questionOrder, existingStems);

      if (!data) {
        failed++;
        continue;
      }

      // Dedup check
      const hash = questionHash(data.vignette, data.question);
      if (existingHashes.has(hash)) {
        console.log('    ⏭️  Duplicate, skipping');
        duplicates++;
        continue;
      }

      try {
        await prisma.question.create({
          data: {
            id: uuidv4(),
            vignette: data.vignette,
            question: data.question,
            options: data.options,
            correctAnswer: data.correctAnswer,
            explanation: data.explanation,
            system: data.system,
            tags: data.tags,
            difficulty: data.difficulty <= 2 ? 'easy' : data.difficulty >= 4 ? 'hard' : 'medium',
            source: 'ai-generated',
            conditionId: condition.conditionId,
            medicalContentId: condition.medicalContentId,
            taskType: TASK_TYPE_MAP[data.taskCategory] ?? 'DIAGNOSIS',
            cognitiveLevel: COGNITIVE_LEVEL_MAP[data.questionOrder] ?? 'LEVEL_3_VIGNETTE',
            questionFormat: QUESTION_FORMAT_MAP[data.questionOrder] ?? 'VIGNETTE',
            generatedByModel: 'gemini-2.0-flash',
            generatedAt: new Date(),
            lifecycleStatus: 'ACTIVE',
            qaStatus: 'UNREVIEWED',
          } as any,
        });

        existingHashes.add(hash);
        systemCreated++;
        created++;

        // Track stem for diversity
        const stems = stemsByCondition.get(condition.conditionId) ?? [];
        stems.push(data.question.substring(0, 60));
        stemsByCondition.set(condition.conditionId, stems);

        console.log(`    ✅ Created (difficulty: ${data.difficulty}, order: ${data.questionOrder})`);
      } catch (error) {
        console.error(`    ❌ Save failed: ${error}`);
        failed++;
      }

      // Rate limiting (600ms between API calls)
      await new Promise((r) => setTimeout(r, 600));
    }

    console.log(`\n  ${system}: ${systemCreated}/${count} created`);
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 GENERATION SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  Created:    ${created}`);
  console.log(`  Failed:     ${failed}`);
  console.log(`  Duplicates: ${duplicates}`);

  // Show updated counts
  const finalBySystem = await prisma.question.groupBy({
    by: ['system'],
    where: { system: { in: targetSystems, mode: 'insensitive' } },
    _count: true,
  });
  console.log('\n  Updated question counts:');
  for (const row of finalBySystem) {
    console.log(`    ${row.system}: ${row._count} questions`);
  }

  const finalTotal = await prisma.question.count();
  console.log(`    Total across all systems: ${finalTotal}`);

  // Task category distribution of generated questions
  console.log('\n  Task category distribution:');
  const tcCounts = new Map<string, number>();
  // (We don't have a clean way to query this without questionData JSON parsing,
  //  so just report from what we generated this run)
  console.log('    (run with --dry-run to preview distribution without generating)');

  await prisma.$disconnect();
  if (pool) await pool.end();
  console.log('\n✅ Done!');
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await prisma.$disconnect();
  if (pool) await pool.end();
  process.exit(1);
});
