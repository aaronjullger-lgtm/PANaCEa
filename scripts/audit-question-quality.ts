/**
 * Sprint 7: Manual audit script for question quality.
 * Generates 50 questions via batch-style Gemini calls, then checks:
 * - Raw patient data (no diagnosis/condition name in vignette)
 * - 2+ pertinent negatives in vignette
 * - Structured rationale (object with whyCorrect and whyIncorrectA/B/C/D)
 *
 * Usage: GEMINI_API_KEY=xxx npx tsx scripts/audit-question-quality.ts
 * Optional: AUDIT_SAMPLE_SIZE=20 (default 50)
 */

import path from 'node:path';
import { config } from 'dotenv';
config({ path: path.resolve(process.cwd(), '.env.local') });
config({ path: path.resolve(process.cwd(), '.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SAMPLE_SIZE = Math.min(Number(process.env.AUDIT_SAMPLE_SIZE) || 50, 50);
const BATCH_SIZE = 10;

interface GeneratedQuestion {
  vignette?: string;
  question: string;
  options: string[];
  correctAnswer: string;
  rationale?: {
    whyCorrect?: string;
    whyIncorrectA?: string;
    whyIncorrectB?: string;
    whyIncorrectC?: string;
    whyIncorrectD?: string;
    whyIncorrectE?: string;
    [k: string]: unknown;
  };
  explanation?: string;
}

function isStructuredRationale(r: unknown): r is NonNullable<GeneratedQuestion['rationale']> {
  return (
    typeof r === 'object' &&
    r !== null &&
    'whyCorrect' in r &&
    typeof (r as { whyCorrect?: unknown }).whyCorrect === 'string'
  );
}

function countWhyIncorrect(rationale: GeneratedQuestion['rationale']): number {
  if (!rationale || typeof rationale !== 'object') return 0;
  let n = 0;
  for (const k of ['whyIncorrectA', 'whyIncorrectB', 'whyIncorrectC', 'whyIncorrectD', 'whyIncorrectE']) {
    if (rationale[k] && typeof rationale[k] === 'string') n++;
  }
  return n;
}

/** Vignette must not state the diagnosis (e.g. "patient with pneumonia"). */
function vignetteHasNoDiagnosis(vignette: string | undefined): boolean {
  if (!vignette || !vignette.trim()) return true;
  const lower = vignette.toLowerCase();
  const leakPatterns = [
    /\bwith\s+(iron\s+deficiency\s+anemia|pneumonia|hypertension|diabetes\s+mellitus|copd|asthma|heart\s+failure|kidney\s+disease)\b/i,
    /\b(patient|woman|man|person)\s+with\s+[a-z]+\s+(presents|presenting)\b.*\b(diagnosis|diagnosed|has)\b/i,
  ];
  return !leakPatterns.some((p) => p.test(lower));
}

/** Heuristic: at least 2 pertinent negatives (e.g. "No X", "rules out", "without"). */
function hasTwoPertinentNegatives(vignette: string | undefined): boolean {
  if (!vignette || !vignette.trim()) return false;
  const lower = vignette.toLowerCase();
  let count = 0;
  if (/\bno\s+[a-z]+(\s+[a-z]+)?\s*(\.|,|;|rules out)/i.test(lower)) count++;
  if (/rules\s+out\b/i.test(lower)) count++;
  if (/\bwithout\s+(significant\s+)?[a-z]+/i.test(lower)) count++;
  if (/\bdenies\s+[a-z]+/i.test(lower)) count++;
  if (/\bnegative\s+for\b/i.test(lower)) count++;
  return count >= 2;
}

async function generateBatch(apiKey: string, system: string, count: number): Promise<GeneratedQuestion[]> {
  const prompt = `Generate ${count} PANCE-style multiple choice questions for ${system}.
CRITICAL: Each question MUST have:
1. "vignette": Raw patient data ONLY. Never state the diagnosis or condition name. Example: "A 45-year-old male with fatigue. Labs: Hgb 9.2 g/dL, MCV 72 fL."
2. At least 2 pertinent negatives in the vignette (e.g. "No JVD. No pain on inspiration.").
3. "rationale" as an OBJECT: { "whyCorrect": "...", "whyIncorrectA": "...", "whyIncorrectB": "...", "whyIncorrectC": "...", "whyIncorrectD": "..." }.

Return ONLY a JSON array of questions. Each item: { "vignette": "...", "question": "...", "options": ["A","B","C","D"], "correctAnswer": "A", "rationale": { "whyCorrect": "...", "whyIncorrectA": "...", ... } }.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 16384 },
      }),
    }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${t}`);
  }
  const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return [];
  let jsonText = text.trim();
  if (jsonText.startsWith('```')) jsonText = jsonText.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
  const parsed = JSON.parse(jsonText.trim());
  return Array.isArray(parsed) ? parsed : [];
}

async function main() {
  if (!GEMINI_API_KEY) {
    console.error('Set GEMINI_API_KEY to run the audit.');
    process.exit(1);
  }
  console.log(`\n--- Question Quality Audit (sample size: ${SAMPLE_SIZE}) ---\n`);

  const allQuestions: GeneratedQuestion[] = [];
  const systems = ['CV', 'PULM', 'GI', 'NEURO', 'MSK'];
  let remaining = SAMPLE_SIZE;
  for (const system of systems) {
    if (remaining <= 0) break;
    const count = Math.min(BATCH_SIZE, remaining);
    try {
      const batch = await generateBatch(GEMINI_API_KEY, system, count);
      allQuestions.push(...batch);
      remaining -= batch.length;
      console.log(`Generated ${batch.length} questions for ${system} (${allQuestions.length} total).`);
    } catch (e) {
      console.error(`Failed to generate for ${system}:`, e);
    }
  }

  if (allQuestions.length === 0) {
    console.error('No questions generated. Aborting audit.');
    process.exit(1);
  }

  // Checks
  let rawDataOk = 0;
  let pertinentNegativesOk = 0;
  let structuredRationaleOk = 0;
  const sampleVignettes: string[] = [];

  for (const q of allQuestions) {
    const vig = q.vignette ?? '';
    if (vignetteHasNoDiagnosis(vig)) rawDataOk++;
    if (hasTwoPertinentNegatives(vig)) pertinentNegativesOk++;
    const rational = q.rationale ?? q.explanation;
    if (isStructuredRationale(rational) && countWhyIncorrect(rational as GeneratedQuestion['rationale']) >= 2)
      structuredRationaleOk++;
    if (sampleVignettes.length < 5) sampleVignettes.push(vig.slice(0, 200) + (vig.length > 200 ? '...' : ''));
  }

  const n = allQuestions.length;
  console.log('\n--- Sample vignettes (first 5) ---');
  sampleVignettes.forEach((v, i) => console.log(`${i + 1}. ${v}\n`));
  console.log('--- Audit results ---');
  console.log(`Raw data (no diagnosis in vignette): ${rawDataOk}/${n} (${((100 * rawDataOk) / n).toFixed(0)}%)`);
  console.log(`2+ pertinent negatives:             ${pertinentNegativesOk}/${n} (${((100 * pertinentNegativesOk) / n).toFixed(0)}%)`);
  console.log(`Structured rationale (whyCorrect + ≥2 whyIncorrect): ${structuredRationaleOk}/${n} (${((100 * structuredRationaleOk) / n).toFixed(0)}%)`);
  console.log('\nDone.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
