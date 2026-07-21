/**
 * renderStructuredRationale.ts
 *
 * Converts a structured rationale object (bottomLine, whyCorrect, whyIncorrectA-E,
 * clinicalPearl, highYieldImageOrTable) into a rich, readable plain-text explanation
 * string. Used wherever the full rationale needs to be displayed as text (Socratic
 * Tutor, alternate explanation generation, conceptQuestionSelector normalization).
 *
 * Clinical Content Quality Agent — May 2026
 * @module lib/study/renderStructuredRationale
 */

export interface StructuredRationaleInput {
  bottomLine?: string;
  whyCorrect?: string;
  whyIncorrectA?: string;
  whyIncorrectB?: string;
  whyIncorrectC?: string;
  whyIncorrectD?: string;
  whyIncorrectE?: string;
  clinicalPearl?: string;
  highYieldImageOrTable?: string;
  commonPitfalls?: string[];
  groundingSources?: Array<{ uri: string; title: string }>;
  pubmedCitations?: Array<{ pmid: string; title: string; authors: string; journal: string; year: number; url: string }>;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

/**
 * Render the full structured rationale into a single formatted text block.
 * Includes: Bottom Line → Why Correct → Why Each Distractor Is Wrong → Clinical Pearl → High-Yield Info.
 */
export function renderStructuredRationale(rationale: StructuredRationaleInput): string {
  const sections: string[] = [];

  // 1. Bottom Line
  const bottomLine = cleanText(rationale.bottomLine);
  if (bottomLine) {
    sections.push(bottomLine);
  }

  // 2. Why Correct
  const whyCorrect = cleanText(rationale.whyCorrect);
  if (whyCorrect) {
    sections.push(whyCorrect);
  }

  // 3. Why Each Distractor Is Wrong (teaching moment)
  const whyIncorrectLines: string[] = [];
  for (const letter of OPTION_LETTERS) {
    const key = `whyIncorrect${letter}` as const;
    const text = cleanText(rationale[key]);
    if (text) {
      whyIncorrectLines.push(`Why option ${letter} is incorrect: ${text}`);
    }
  }
  if (whyIncorrectLines.length > 0) {
    sections.push(whyIncorrectLines.join('\n'));
  }

  // 4. Clinical Pearl
  const clinicalPearl = cleanText(rationale.clinicalPearl);
  if (clinicalPearl) {
    sections.push(`Clinical Pearl: ${clinicalPearl}`);
  }

  // 5. High-Yield Image / Table reference
  const highYield = cleanText(rationale.highYieldImageOrTable);
  if (highYield && highYield !== 'N/A') {
    sections.push(`High-Yield: ${highYield}`);
  }

  // 6. Common Pitfalls
  if (rationale.commonPitfalls?.length) {
    sections.push(`PANCE Trap: ${rationale.commonPitfalls.join('; ')}`);
  }

  return sections.join('\n\n') || 'See rationale in the explanation panel.';
}

/**
 * Render only the bottom-line + why-correct summary, for contexts where
 * brevity is required (e.g., pre-Socratic-tutor quick preview).
 */
export function renderBriefRationale(rationale: StructuredRationaleInput): string {
  const parts = [cleanText(rationale.bottomLine), cleanText(rationale.whyCorrect)].filter(Boolean);
  return parts.join(' ') || 'See explanation panel for details.';
}

/**
 * Render the distractor analysis only — useful for the Socratic tutor when
 * the student chose a wrong answer.
 */
export function renderDistractorRationale(
  rationale: StructuredRationaleInput,
  userAnswerIndex?: number
): string {
  const lines: string[] = [];
  let hasContent = false;

  for (let i = 0; i < OPTION_LETTERS.length; i++) {
    const letter = OPTION_LETTERS[i]!;
    const key = `whyIncorrect${letter}` as const;
    const text = cleanText(rationale[key]);
    if (!text) continue;

    const isUserChoice = userAnswerIndex !== undefined && i === userAnswerIndex;
    const prefix = isUserChoice ? `Your answer (${letter}) was wrong because` : `Option ${letter} is incorrect because`;
    lines.push(`${prefix}: ${text}`);
    hasContent = true;
  }

  if (!hasContent) return '';

  // Add clinical pearl as a closer if available
  const pearl = cleanText(rationale.clinicalPearl);
  if (pearl) {
    lines.push(`\nRemember: ${pearl}`);
  }

  return lines.join('\n');
}

/**
 * Resolve rationale from a Question object into a StructuredRationaleInput.
 * Handles: object directly, JSON string, or plain string.
 */
export function resolveStructuredRationale(rationale: unknown): StructuredRationaleInput | null {
  if (!rationale) return null;

  // Already an object with the right shape
  if (typeof rationale === 'object' && rationale !== null) {
    const r = rationale as Record<string, unknown>;
    if ('whyCorrect' in r || 'bottomLine' in r) {
      return r as StructuredRationaleInput;
    }
  }

  // JSON string
  if (typeof rationale === 'string') {
    try {
      const parsed = JSON.parse(rationale) as unknown;
      if (parsed && typeof parsed === 'object') {
        const p = parsed as Record<string, unknown>;
        if ('whyCorrect' in p || 'bottomLine' in p) {
          return p as StructuredRationaleInput;
        }
      }
    } catch {
      // Not JSON — treat as plain string rationale
    }
  }

  return null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const HTML_TAG_RE = /<[^>]+>/g;
const WHITESPACE_RE = /\s+/g;

function cleanText(value?: string): string {
  if (!value || typeof value !== 'string') return '';
  return value.replace(HTML_TAG_RE, ' ').replace(WHITESPACE_RE, ' ').trim();
}
