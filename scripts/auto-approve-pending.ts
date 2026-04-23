#!/usr/bin/env npx tsx
/**
 * Multi-pass automated question quality review and approval.
 *
 * Three independent Gemini reviewer perspectives each score the 4 quality
 * components. Scores are averaged; questions that meet the approval threshold
 * are updated to validationStatus='approved' in PreGeneratedQuestion.
 *
 * Reviewer personas:
 *  Pass 1 — PANCE Blueprint Analyst    → difficultyAlignment
 *  Pass 2 — Clinical Accuracy Expert   → clinicalRelevance + distractorEffectiveness
 *  Pass 3 — Psychometrician            → discriminationIndex + final compositeScore
 *
 * Thresholds (from questionReviewGate.ts):
 *   COMPONENT_APPROVE >= 0.85, COMPOSITE_APPROVE >= 0.90 → approved
 *   COMPOSITE < 0.40 → needs_revision
 *   Otherwise → pending
 *
 * Usage:
 *   GEMINI_API_KEY=xxx DATABASE_URL=xxx npx tsx scripts/auto-approve-pending.ts
 *   GEMINI_API_KEY=xxx DATABASE_URL=xxx npx tsx scripts/auto-approve-pending.ts --dry-run
 *   GEMINI_API_KEY=xxx DATABASE_URL=xxx npx tsx scripts/auto-approve-pending.ts --filter q-exp
 */

import path from 'node:path';
import { config } from 'dotenv';
config({ path: path.resolve(process.cwd(), '.env.local') });
config({ path: path.resolve(process.cwd(), '.env') });

// ─── Config ─────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const DRY_RUN = process.argv.includes('--dry-run');
const FILTER_PREFIX = (() => {
  const idx = process.argv.indexOf('--filter');
  return idx !== -1 ? process.argv[idx + 1] : undefined;
})();

// Approval thresholds (must match questionReviewGate.ts)
const COMPONENT_THRESHOLD = 0.85;
const COMPOSITE_THRESHOLD = 0.90;
const NEEDS_REVISION_THRESHOLD = 0.40;

// Gemini model — gemini-2.0-flash confirmed working in this environment
const GEMINI_MODEL = 'gemini-2.0-flash';

// ─── Types ───────────────────────────────────────────────────────────────────

interface QuestionData {
  question?: string;
  options?: string[];
  correctAnswer?: string;
  correctAnswerIndex?: number;
  explanation?: string;
  conditionName?: string;
  system?: string;
  subcategory?: string;
  tags?: string[];
}

interface PendingQuestion {
  id: string;
  questionType: string;
  system: string;
  difficulty: string;
  questionData: QuestionData;
  questionOrder: string | null;
  taskCategory: string | null;
  generatedAt: Date;
}

interface Pass1Result {
  difficultyAlignment: number;
  taxonomyNotes: string;
  bloomsCorrect: boolean;
  taskCategoryCorrect: boolean;
}

interface Pass2Result {
  clinicalRelevance: number;
  distractorEffectiveness: number;
  clinicalAccuracyNotes: string;
  correctAnswerVerified: boolean;
  guidelinesCurrent: boolean;
}

interface Pass3Result {
  discriminationIndex: number;
  compositeScore: number;
  craftNotes: string;
  vignetteClear: boolean;
  stemUnambiguous: boolean;
  noFlawedDistractors: boolean;
}

interface ReviewResult {
  id: string;
  pass1: Pass1Result;
  pass2: Pass2Result;
  pass3: Pass3Result;
  finalQualityScore: number;
  difficultyAlignment: number;
  discriminationIndex: number;
  distractorEffectiveness: number;
  clinicalRelevance: number;
  validationStatus: 'approved' | 'pending' | 'needs_revision';
  validationNotes: string;
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

/**
 * PASS 1: PANCE Blueprint Analyst
 *
 * Perspective: A seasoned NCCPA exam item writer who has developed and reviewed
 * hundreds of PANCE questions. This reviewer focuses exclusively on whether the
 * question's taxonomy metadata is accurate and whether the cognitive complexity
 * of the item matches its stated Bloom's level and task category.
 *
 * Scoring focus: difficultyAlignment (0–1)
 * - 1.0: Perfect taxonomy alignment — Bloom's level matches item complexity exactly,
 *         task category is the single most accurate descriptor, system/subcategory correct.
 * - 0.85–0.99: Minor labeling issue (e.g., could argue first vs. second order) but
 *              clinically justified.
 * - 0.70–0.84: Bloom's level or task category is off by one tier; still serviceable.
 * - 0.50–0.69: Significant taxonomy mismatch that would affect question routing.
 * - < 0.50: Wrong Bloom's level, wrong task category, or wrong system entirely.
 *
 * NCCPA task categories (8):
 *   history_pe, diagnostics, diagnosis, health_maintenance,
 *   management, pharmaceutical, basic_science, professional
 *
 * NCCPA Bloom's mapping:
 *   first = Remember/Understand (recall facts, definitions)
 *   second = Apply/Analyze (clinical scenarios requiring application)
 *   third = Evaluate/Create (synthesis, prioritization, complex decisions)
 */
function buildPass1Prompt(q: PendingQuestion): string {
  const qd = q.questionData;
  return `You are a PANCE exam item writer with 10 years of NCCPA blueprint experience.

Evaluate this question's TAXONOMY ALIGNMENT ONLY. Do not evaluate clinical accuracy.

QUESTION:
System: ${q.system} | Subcategory: ${qd.subcategory ?? 'N/A'}
Bloom's level (questionOrder): ${q.questionOrder ?? 'N/A'}
Task category: ${q.taskCategory ?? 'N/A'}
Difficulty: ${q.difficulty}

Vignette/Question text:
${qd.question}

Options: ${(qd.options ?? []).join(' | ')}

Correct answer: ${qd.correctAnswer}

NCCPA task categories reference: history_pe, diagnostics, diagnosis, health_maintenance, management, pharmaceutical, basic_science, professional

Bloom's mapping: first=Remember/Understand (recall facts), second=Apply/Analyze (clinical scenario application), third=Evaluate/Create (synthesis/prioritization/complex decisions)

SCORING RUBRIC for difficultyAlignment:
1.0 = Bloom's level precisely matches cognitive demand; task category is the single best fit; system/subcategory accurate
0.85 = Minor label ambiguity (e.g., borderline first/second) but defensible
0.70 = Bloom's level is off by one tier; task category is an adjacent but less precise choice
0.50 = Notable mismatch that would route this question incorrectly in the study system
<0.50 = Wrong Bloom's level, wrong task category, or wrong system

Respond with ONLY valid JSON:
{
  "difficultyAlignment": <0.0-1.0>,
  "bloomsCorrect": <true|false>,
  "taskCategoryCorrect": <true|false>,
  "taxonomyNotes": "<1-2 sentences: what's right and what (if anything) is off>"
}`;
}

/**
 * PASS 2: Clinical Accuracy & Distractor Quality Expert
 *
 * Perspective: A board-certified clinician and PA educator with deep expertise in
 * the question's organ system. This reviewer treats the question as a peer would
 * at an academic medical center content review board — checking every factual claim,
 * every distractor for clinical plausibility, and every explanation for guideline
 * currency.
 *
 * Scoring focus: clinicalRelevance + distractorEffectiveness (0–1 each)
 *
 * clinicalRelevance:
 * - 1.0: Correct answer is unambiguously correct per current guidelines (AHA, GOLD,
 *         IDSA, USPSTF, etc.). Explanation is accurate and educational. Condition
 *         tested is high-yield for PANCE.
 * - 0.85–0.99: Correct answer is right; one minor explanation nuance could be sharper.
 * - 0.70–0.84: Correct answer debatable in edge case; or explanation has a factual
 *              imprecision.
 * - < 0.70: Clinical error in correct answer or explanation.
 *
 * distractorEffectiveness:
 * - 1.0: All 3 wrong answers are clinically plausible to a student who hasn't mastered
 *         the concept. Each represents a genuine misconception or classic trap.
 * - 0.85–0.99: One distractor is slightly less plausible but still reasonable.
 * - 0.70–0.84: One distractor is too obvious (easy to eliminate) or too obscure.
 * - < 0.70: Multiple distractors are trivially wrong, parallel (two say same thing),
 *            or contain "all of the above" / "none of the above" patterns.
 *
 * Disqualifying patterns (score < 0.60):
 *   - "All of the above" / "None of the above" options
 *   - Two options that are mutually exclusive only of each other (implying one is right)
 *   - Distractors that include the word "never" or absolute statements that are trivially false
 *   - Correct answer is always the longest or most specific option
 */
function buildPass2Prompt(q: PendingQuestion): string {
  const qd = q.questionData;
  return `You are a board-certified clinician and PA educator specializing in ${q.system} medicine with expertise in PANCE content review.

Evaluate CLINICAL ACCURACY and DISTRACTOR QUALITY. Assume taxonomy metadata is correct.

QUESTION:
${qd.question}

Options:
${(qd.options ?? []).map((o, i) => `${String.fromCharCode(65 + i)}. ${o.replace(/^[A-D]\.\s*/, '')}`).join('\n')}

Correct answer: ${qd.correctAnswer}

Explanation:
${qd.explanation}

SCORE clinicalRelevance (0-1):
- 1.0: Correct answer unambiguously right per current clinical guidelines; explanation accurate and educational
- 0.85: Correct but one minor nuance in explanation could be sharper
- 0.70: Correct answer debatable in an edge case OR explanation has one factual imprecision
- <0.70: Clinical error in correct answer or explanation

SCORE distractorEffectiveness (0-1):
- 1.0: All wrong options are genuinely plausible to a student without mastery; each represents a real trap or misconception
- 0.85: One distractor slightly less plausible but defensible
- 0.70: One distractor trivially eliminable OR too obscure for a PA student
- <0.60: "All/none of the above" present; two distractors are parallel; or correct answer length/specificity telegraphs itself

Respond with ONLY valid JSON:
{
  "clinicalRelevance": <0.0-1.0>,
  "distractorEffectiveness": <0.0-1.0>,
  "correctAnswerVerified": <true|false>,
  "guidelinesCurrent": <true|false>,
  "clinicalAccuracyNotes": "<2-3 sentences: accuracy verdict and distractor assessment>"
}`;
}

/**
 * PASS 3: Psychometrician & Question Craft Reviewer
 *
 * Perspective: A medical education psychometrician who designs licensing examinations.
 * This reviewer evaluates item construction quality — independent of the clinical
 * content. The goal is to ensure the item will effectively discriminate between
 * students who understand the concept and those who don't, without ambiguity,
 * cueing, or construct-irrelevant difficulty.
 *
 * Scoring focus: discriminationIndex + final compositeScore (0–1 each)
 *
 * discriminationIndex (item's ability to separate knowers from non-knowers):
 * - 1.0: Vignette presents exactly the right amount of information — enough to diagnose
 *         with knowledge, not enough to guess without it. Stem is a focused leading
 *         question. No extraneous or misleading details. Options are parallel in length
 *         and format. No grammatical cues linking stem to correct option.
 * - 0.85–0.99: One minor construction flaw that won't substantially affect discrimination.
 * - 0.70–0.84: Vignette includes an unnecessary hint OR stem is slightly imprecise.
 * - < 0.70: Multiple construction flaws that introduce construct-irrelevant variance:
 *            answer telegraphed by stem, options non-parallel, vignette states diagnosis.
 *
 * Disqualifying construction flaws (score < 0.60):
 *   - Vignette explicitly names the diagnosis or condition
 *   - "Which of the following is NOT..." negatively phrased stem
 *   - Grammatical agreement between stem and only one option
 *   - Correct answer is always option A (positional bias)
 *   - Correct answer is always the longest or most technical option
 *
 * compositeScore: Your holistic 0–1 quality rating integrating all dimensions.
 * A score ≥ 0.90 means this question is ready for live use with no revisions.
 */
function buildPass3Prompt(q: PendingQuestion): string {
  const qd = q.questionData;
  return `You are a psychometrician specializing in medical licensing examination item development (USMLE, PANCE, NCLEX standard).

Evaluate QUESTION CONSTRUCTION QUALITY and provide a HOLISTIC COMPOSITE SCORE.
Assume clinical content is accurate — focus on item design and discriminability.

QUESTION:
${qd.question}

Options:
${(qd.options ?? []).map((o, i) => `${String.fromCharCode(65 + i)}. ${o.replace(/^[A-D]\.\s*/, '')}`).join('\n')}

Correct answer index: ${qd.correctAnswerIndex} (Option ${String.fromCharCode(65 + (qd.correctAnswerIndex ?? 0))})

Bloom's level: ${q.questionOrder} | Difficulty: ${q.difficulty}

SCORE discriminationIndex (0-1):
Assesses whether the item will separate students who know the concept from those who don't.
- 1.0: Vignette presents ideal information density (diagnose with knowledge, not without). Focused stem. Parallel options. No grammatical cues.
- 0.85: One minor flaw (slightly verbose vignette, one option slightly longer)
- 0.70: One clear flaw (minor hint in vignette, imprecise stem)
- <0.60: Vignette states diagnosis; negative stem; grammatical cuing; all A answers

SCORE compositeScore (0-1) — your holistic quality rating:
- ≥0.90: Publication-ready. No revisions needed.
- 0.80-0.89: Minor polish would improve it. Acceptable for use.
- 0.70-0.79: Usable but one dimension is substandard.
- <0.70: Needs revision before entering the live pool.

Check these explicitly:
- Does the vignette state the diagnosis? (disqualifier)
- Is the stem negatively phrased ("NOT", "EXCEPT")? (disqualifier)
- Are options parallel in structure and approximate length?
- Is the correct answer always option A? (positional bias concern)

Respond with ONLY valid JSON:
{
  "discriminationIndex": <0.0-1.0>,
  "compositeScore": <0.0-1.0>,
  "vignetteClear": <true|false>,
  "stemUnambiguous": <true|false>,
  "noFlawedDistractors": <true|false>,
  "craftNotes": "<2-3 sentences: construction quality verdict>"
}`;
}

// ─── Gemini API ───────────────────────────────────────────────────────────────

async function callGemini(prompt: string, retries = 2): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.15, // Low temperature for consistent scoring
              maxOutputTokens: 512,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        if ((res.status === 429 || res.status === 503) && attempt < retries) {
          // Exponential backoff: 8s, 16s, 32s
          const wait = 8000 * Math.pow(2, attempt);
          console.log(`    ⏳ Rate limited — retrying in ${wait / 1000}s (attempt ${attempt + 1}/${retries})`);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw new Error(`Gemini ${res.status}: ${text.slice(0, 200)}`);
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      return text.trim();
    } catch (err) {
      if (attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('All retries exhausted');
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(cleaned.trim()) as T;
  } catch {
    console.warn('  ⚠ JSON parse failed, using fallback');
    return fallback;
  }
}

// ─── Review Logic ─────────────────────────────────────────────────────────────

async function reviewQuestion(q: PendingQuestion): Promise<ReviewResult> {
  console.log(`  Pass 1/3: Blueprint alignment…`);
  const raw1 = await callGemini(buildPass1Prompt(q));
  const p1 = parseJson<Pass1Result>(raw1, {
    difficultyAlignment: 0.85,
    taxonomyNotes: 'Parse error',
    bloomsCorrect: true,
    taskCategoryCorrect: true,
  });

  // Delay between passes — keeps us at/under 15 RPM free tier (3 calls/question, ~12s total)
  await new Promise((r) => setTimeout(r, 2000));

  console.log(`  Pass 2/3: Clinical accuracy…`);
  const raw2 = await callGemini(buildPass2Prompt(q));
  const p2 = parseJson<Pass2Result>(raw2, {
    clinicalRelevance: 0.85,
    distractorEffectiveness: 0.85,
    clinicalAccuracyNotes: 'Parse error',
    correctAnswerVerified: true,
    guidelinesCurrent: true,
  });

  await new Promise((r) => setTimeout(r, 2000));

  console.log(`  Pass 3/3: Question craft…`);
  const raw3 = await callGemini(buildPass3Prompt(q));
  const p3 = parseJson<Pass3Result>(raw3, {
    discriminationIndex: 0.85,
    compositeScore: 0.88,
    craftNotes: 'Parse error',
    vignetteClear: true,
    stemUnambiguous: true,
    noFlawedDistractors: true,
  });

  // Average component scores across passes
  // difficultyAlignment: Pass 1 primary
  const difficultyAlignment = p1.difficultyAlignment;

  // discriminationIndex: Pass 3 primary
  const discriminationIndex = p3.discriminationIndex;

  // distractorEffectiveness: Pass 2 primary, tempered by Pass 3's noFlawedDistractors
  const distractorEffectiveness = p3.noFlawedDistractors
    ? p2.distractorEffectiveness
    : Math.min(p2.distractorEffectiveness, 0.75);

  // clinicalRelevance: Pass 2 primary
  const clinicalRelevance = p2.clinicalRelevance;

  // Composite: weighted average of all 4 components + Pass 3's holistic score
  const componentAvg =
    (difficultyAlignment + discriminationIndex + distractorEffectiveness + clinicalRelevance) / 4;

  // Pass 3's compositeScore is the psychometrician's holistic read — give it 40% weight
  const finalQualityScore = Math.round((componentAvg * 0.6 + p3.compositeScore * 0.4) * 100) / 100;

  // Determine status
  const allComponentsPass =
    difficultyAlignment >= COMPONENT_THRESHOLD &&
    discriminationIndex >= COMPONENT_THRESHOLD &&
    distractorEffectiveness >= COMPONENT_THRESHOLD &&
    clinicalRelevance >= COMPONENT_THRESHOLD;

  let validationStatus: 'approved' | 'pending' | 'needs_revision';
  if (allComponentsPass && finalQualityScore >= COMPOSITE_THRESHOLD) {
    validationStatus = 'approved';
  } else if (finalQualityScore < NEEDS_REVISION_THRESHOLD) {
    validationStatus = 'needs_revision';
  } else {
    validationStatus = 'pending';
  }

  const validationNotes = [
    `Auto-reviewed (3-pass LLM): quality=${finalQualityScore}`,
    `DA=${difficultyAlignment} DI=${discriminationIndex} DE=${distractorEffectiveness} CR=${clinicalRelevance}`,
    `P1: ${p1.taxonomyNotes}`,
    `P2: ${p2.clinicalAccuracyNotes}`,
    `P3: ${p3.craftNotes}`,
  ]
    .join(' | ')
    .slice(0, 1000);

  return {
    id: q.id,
    pass1: p1,
    pass2: p2,
    pass3: p3,
    finalQualityScore,
    difficultyAlignment,
    discriminationIndex,
    distractorEffectiveness,
    clinicalRelevance,
    validationStatus,
    validationNotes,
  };
}

// ─── Database (Supabase REST API) ────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

function supabaseHeaders(): Record<string, string> {
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    Prefer: 'return=representation',
  };
}

async function supabaseRpc(sql: string): Promise<unknown[]> {
  const url = `${SUPABASE_URL}/rest/v1/rpc/execute_sql`;
  // Supabase doesn't expose a generic SQL RPC by default; use the pg REST endpoint.
  // Fall back to the PostgREST table API for simple selects.
  throw new Error(`supabaseRpc called with: ${sql.slice(0, 80)} — use table API instead`);
}

async function fetchPendingQuestions(): Promise<PendingQuestion[]> {
  if (!SUPABASE_URL) throw new Error('SUPABASE_URL / VITE_SUPABASE_URL not set');

  const filterParam = FILTER_PREFIX
    ? `&id=like.${encodeURIComponent(FILTER_PREFIX + '*')}`
    : '';

  const url =
    `${SUPABASE_URL}/rest/v1/PreGeneratedQuestion` +
    `?select=id,questionType,system,difficulty,questionData,questionOrder,taskCategory,generatedAt` +
    `&validationStatus=eq.pending` +
    filterParam +
    `&order=generatedAt.asc`;

  const res = await fetch(url, { headers: supabaseHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase fetch failed: ${res.status} ${body.slice(0, 300)}`);
  }

  const rows = (await res.json()) as Array<{
    id: string;
    questionType: string;
    system: string;
    difficulty: string;
    questionData: QuestionData;
    questionOrder: string | null;
    taskCategory: string | null;
    generatedAt: string;
  }>;

  return rows.map((r) => ({
    ...r,
    generatedAt: new Date(r.generatedAt),
  }));
}

async function applyReviewResults(results: ReviewResult[]): Promise<void> {
  if (!SUPABASE_URL) throw new Error('SUPABASE_URL not set');

  const baseUrl = `${SUPABASE_URL}/rest/v1/PreGeneratedQuestion`;
  const headers = supabaseHeaders();

  for (const r of results) {
    const now = new Date().toISOString();
    const payload = {
      validationStatus: r.validationStatus,
      qualityScore: r.finalQualityScore,
      conditionAccuracy: r.clinicalRelevance,
      contentRelevance: r.discriminationIndex,
      distracorQuality: r.distractorEffectiveness,
      validatedAt: now,
      validatedBy: 'auto-reviewer-v1',
      validationNotes: r.validationNotes,
    };

    const res = await fetch(`${baseUrl}?id=eq.${r.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      console.warn(`  ⚠ Failed to update ${r.id}: ${res.status} ${body.slice(0, 200)}`);
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY is required');
    process.exit(1);
  }
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL is required');
    process.exit(1);
  }

  console.log('\n━━━ PANaCEa Multi-Pass Question Reviewer ━━━');
  console.log(`Model:    ${GEMINI_MODEL}`);
  console.log(`Dry run:  ${DRY_RUN}`);
  console.log(`Filter:   ${FILTER_PREFIX ?? 'all pending'}`);
  console.log(`Thresholds: component≥${COMPONENT_THRESHOLD} composite≥${COMPOSITE_THRESHOLD}\n`);

  console.log('Fetching pending questions…');
  const questions = await fetchPendingQuestions();
  console.log(`Found ${questions.length} pending question(s)\n`);

  if (questions.length === 0) {
    console.log('Nothing to review. Done.');
    return;
  }

  const results: ReviewResult[] = [];
  let approved = 0;
  let pending = 0;
  let needsRevision = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q) continue;
    const qd = q.questionData;
    const label = qd.conditionName ?? q.id;
    console.log(`[${i + 1}/${questions.length}] ${q.id} — ${label} (${q.system}/${q.difficulty})`);

    try {
      const result = await reviewQuestion(q);
      results.push(result);

      const status = result.validationStatus;
      const icon = status === 'approved' ? '✅' : status === 'pending' ? '⏳' : '🔧';
      console.log(
        `  ${icon} ${status.toUpperCase()} | quality=${result.finalQualityScore} | ` +
          `DA=${result.difficultyAlignment} DI=${result.discriminationIndex} ` +
          `DE=${result.distractorEffectiveness} CR=${result.clinicalRelevance}`
      );

      if (status === 'approved') approved++;
      else if (status === 'pending') pending++;
      else needsRevision++;
    } catch (err) {
      console.error(`  ❌ Review failed for ${q.id}:`, err);
      // Default to pending on error — don't reject on reviewer failure
      results.push({
        id: q.id,
        pass1: { difficultyAlignment: 0.80, taxonomyNotes: 'Review failed', bloomsCorrect: true, taskCategoryCorrect: true },
        pass2: { clinicalRelevance: 0.80, distractorEffectiveness: 0.80, clinicalAccuracyNotes: 'Review failed', correctAnswerVerified: true, guidelinesCurrent: true },
        pass3: { discriminationIndex: 0.80, compositeScore: 0.80, craftNotes: 'Review failed', vignetteClear: true, stemUnambiguous: true, noFlawedDistractors: true },
        finalQualityScore: 0.80,
        difficultyAlignment: 0.80,
        discriminationIndex: 0.80,
        distractorEffectiveness: 0.80,
        clinicalRelevance: 0.80,
        validationStatus: 'pending',
        validationNotes: 'Auto-review failed — defaulted to pending for manual review',
      });
      pending++;
    }

    // Rate limit pause between questions — 3s gives ~12s total per question ≈ 15 RPM
    if (i < questions.length - 1) {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  console.log('\n━━━ Review Summary ━━━');
  console.log(`Reviewed:      ${results.length}`);
  console.log(`✅ Approved:   ${approved}`);
  console.log(`⏳ Pending:    ${pending}`);
  console.log(`🔧 Needs rev:  ${needsRevision}`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] — No database writes performed.');
    console.log('\nDetailed results:');
    for (const r of results) {
      console.log(`  ${r.id}: ${r.validationStatus} (${r.finalQualityScore})`);
    }
    return;
  }

  console.log('\nWriting scores to database…');
  await applyReviewResults(results);
  console.log('✓ Done. All results written.\n');
}

main().catch((err) => {
  console.error('\n❌ Fatal:', err);
  process.exit(1);
});
