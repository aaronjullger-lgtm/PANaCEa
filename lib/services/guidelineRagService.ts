/**
 * Guideline RAG Service — Phase 4.5
 *
 * Retrieves relevant clinical guideline snippets for the Virtual Preceptor's
 * feedback generation. Uses the existing hybrid search (FTS + pgvector) to
 * find MedicalContent with guideline provenance, then formats snippets for
 * injection into the Preceptor's system prompt.
 *
 * Architecture:
 *   1. Extract condition + key findings from the student's attempt data
 *   2. Query MedicalContent WHERE guidelineSource IS NOT NULL using hybrid search
 *   3. Retrieve top 3 guideline snippets
 *   4. Format for system prompt injection
 *   5. Log which guidelines were retrieved (auditability)
 *
 * Depends on:
 *   - pgvector (Phase 4.1) for semantic search
 *   - Content provenance fields (Phase 1.4) for guideline filtering
 *
 * @module lib/services/guidelineRagService
 */

import type { PrismaClient } from '@prisma/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GuidelineSnippet {
  /** The condition this guideline pertains to */
  condition: string;
  /** Source guideline (e.g., "AHA 2025 Guidelines") */
  source: string;
  /** Year of the guideline */
  year: number | null;
  /** Evidence grade (A/B/C) */
  grade: string | null;
  /** Relevant text excerpt for the Preceptor prompt */
  text: string;
  /** MedicalContent ID for audit trail */
  contentId: string;
}

export interface GuidelineRagResult {
  snippets: GuidelineSnippet[];
  /** Formatted string ready for system prompt injection */
  promptContext: string;
  /** IDs of retrieved content (for audit logging) */
  retrievedContentIds: string[];
}

export interface AttemptContext {
  conditionId?: string | null;
  system?: string | null;
  questionText?: string;
  selectedAnswer?: string;
  wasCorrect?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_SNIPPETS = 3;
const MAX_SNIPPET_LENGTH = 500;
const EMBED_MODEL = 'text-embedding-005';
const EMBED_DIMS = 768;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a search query from attempt context for guideline retrieval.
 */
function buildSearchQuery(context: AttemptContext): string {
  const parts: string[] = [];

  if (context.conditionId) parts.push(context.conditionId);
  if (context.system) parts.push(context.system);
  if (context.questionText) {
    // Extract key clinical terms from the question (first 100 chars)
    parts.push(context.questionText.slice(0, 100));
  }

  return parts.join(' ').trim() || 'clinical guideline';
}

/**
 * Truncate text to max length at sentence boundary.
 */
function truncateAtSentence(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const truncated = text.slice(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  const breakPoint = Math.max(lastPeriod, lastNewline);

  return breakPoint > maxLength * 0.5
    ? truncated.slice(0, breakPoint + 1).trim()
    : truncated.trim() + '...';
}

/**
 * Extract the most relevant text from a MedicalContent record for guideline context.
 * Prioritizes: treatment > diagnostics > overview > symptoms.
 */
function extractRelevantText(content: Record<string, unknown>): string {
  const fields = ['treatment', 'diagnostics', 'overview', 'symptoms', 'pathophysiology'];

  for (const field of fields) {
    const value = content[field];
    if (typeof value === 'string' && value.length > 20) {
      return truncateAtSentence(value, MAX_SNIPPET_LENGTH);
    }
  }

  return '';
}

// ─── Main Service ────────────────────────────────────────────────────────────

/**
 * Retrieve guideline-backed snippets for Virtual Preceptor feedback.
 *
 * @param prisma - Prisma client instance
 * @param context - The student's attempt context (condition, system, question text)
 * @param apiKey - Gemini API key for embedding generation (optional — falls back to FTS only)
 * @returns GuidelineRagResult with snippets and formatted prompt context
 */
export async function retrieveGuidelineContext(
  prisma: PrismaClient,
  context: AttemptContext,
  apiKey?: string
): Promise<GuidelineRagResult> {
  const emptyResult: GuidelineRagResult = {
    snippets: [],
    promptContext: '',
    retrievedContentIds: [],
  };

  try {
    const searchQuery = buildSearchQuery(context);

    // Strategy 1: Direct lookup by conditionId (fastest, most precise)
    if (context.conditionId) {
      const direct = await prisma.medicalContent.findFirst({
        where: {
          conditionId: context.conditionId,
          guidelineSource: { not: null },
        },
        select: {
          id: true,
          condition: true,
          guidelineSource: true,
          guidelineYear: true,
          evidenceGrade: true,
          treatment: true,
          diagnostics: true,
          overview: true,
          symptoms: true,
          pathophysiology: true,
        },
      });

      if (direct && direct.guidelineSource) {
        const text = extractRelevantText(direct as unknown as Record<string, unknown>);
        if (text) {
          const snippet: GuidelineSnippet = {
            condition: direct.condition || context.conditionId,
            source: direct.guidelineSource,
            year: direct.guidelineYear,
            grade: direct.evidenceGrade,
            text,
            contentId: direct.id,
          };

          const promptContext = formatPromptContext([snippet]);
          return {
            snippets: [snippet],
            promptContext,
            retrievedContentIds: [direct.id],
          };
        }
      }
    }

    // Strategy 2: FTS search for guideline-annotated content
    const ftsResults = await prisma.$queryRaw<
      Array<{
        id: string;
        condition: string;
        guideline_source: string;
        guideline_year: number | null;
        evidence_grade: string | null;
        treatment: string | null;
        diagnostics: string | null;
        overview: string | null;
        symptoms: string | null;
        pathophysiology: string | null;
      }>
    >`
      SELECT
        id, condition,
        "guidelineSource" AS guideline_source,
        "guidelineYear" AS guideline_year,
        "evidenceGrade" AS evidence_grade,
        treatment, diagnostics, overview, symptoms, pathophysiology
      FROM "MedicalContent"
      WHERE "guidelineSource" IS NOT NULL
        AND search_vector IS NOT NULL
        AND search_vector @@ websearch_to_tsquery('english', ${searchQuery})
      ORDER BY ts_rank(search_vector, websearch_to_tsquery('english', ${searchQuery})) DESC
      LIMIT ${MAX_SNIPPETS}
    `;

    if (ftsResults.length === 0) return emptyResult;

    const snippets: GuidelineSnippet[] = ftsResults
      .map((r) => {
        const text = extractRelevantText(r as unknown as Record<string, unknown>);
        if (!text) return null;
        return {
          condition: r.condition,
          source: r.guideline_source,
          year: r.guideline_year,
          grade: r.evidence_grade,
          text,
          contentId: r.id,
        };
      })
      .filter((s): s is GuidelineSnippet => s !== null);

    return {
      snippets,
      promptContext: formatPromptContext(snippets),
      retrievedContentIds: snippets.map((s) => s.contentId),
    };
  } catch (error) {
    // Non-fatal — Preceptor can still generate feedback without guidelines
    console.warn('[GuidelineRAG] Retrieval failed:', error instanceof Error ? error.message : error);
    return emptyResult;
  }
}

/**
 * Format guideline snippets into a string for system prompt injection.
 */
function formatPromptContext(snippets: GuidelineSnippet[]): string {
  if (snippets.length === 0) return '';

  const header = '## Relevant Clinical Guidelines\n\n';
  const body = snippets
    .map((s, i) => {
      const gradeStr = s.grade ? ` (Grade ${s.grade})` : '';
      const yearStr = s.year ? ` ${s.year}` : '';
      return `**[${i + 1}] ${s.condition}** — ${s.source}${yearStr}${gradeStr}\n${s.text}`;
    })
    .join('\n\n');

  return header + body;
}
