#!/usr/bin/env tsx
/**
 * Gated AI review of unlinked study questions. REPORT-ONLY — never mutates
 * the database. The ONLY mutation path remains
 * scripts/apply-unlinked-question-links.ts (dry-run default, --apply gated).
 *
 * Pipeline per row (logic in scripts/lib/aiReviewPipeline.ts):
 *   review packet → clinical reviewer + taxonomy reviewer (independent)
 *   → skeptical verifier (can veto) → strict gate aggregation
 *   → keep_quarantined by default.
 *
 * Model calls reuse the repo's existing AI gateway (lib/ai/aiGateway.ts,
 * gateway.callStructured with Zod schemas — never raw text). Malformed model
 * output fails schema validation and the row stays quarantined.
 *
 * Outputs:
 *   reports/unlinked-question-ai-review.json            (full audit trail)
 *   reports/unlinked-question-ai-reviewed-template.json (apply-ready template)
 *   reports/unlinked-question-ai-review.md              (summary)
 *
 * Usage:
 *   npx tsx scripts/ai-review-unlinked-questions.ts --mock          # no model, all quarantined
 *   npx tsx scripts/ai-review-unlinked-questions.ts                 # live (needs GEMINI_API_KEY; DB optional but
 *                                                                   #  links cannot pass gates without DATABASE_URL)
 *   npx tsx scripts/ai-review-unlinked-questions.ts --limit 5       # small safe run
 *   npx tsx scripts/ai-review-unlinked-questions.ts --row-id q-tax-cv-001
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  AI_REVIEWER_ID,
  ReviewerAssessmentSchema,
  VerifierAssessmentSchema,
  aggregateAssessments,
  buildClinicalReviewerPrompt,
  buildReviewPacket,
  buildTaxonomyReviewerPrompt,
  buildVerifierPrompt,
  summarizeOutcomes,
  toReviewedTemplateRow,
  type AiReviewOutcome,
  type AggregationContext,
  type ReviewPacket,
  type ReviewerAssessment,
  type VerifierAssessment,
} from './lib/aiReviewPipeline';
import type { LinkingTemplateRow } from './lib/linkingTemplate';

const TEMPLATE_PATH = path.resolve(process.cwd(), 'reports/unlinked-question-linking-template.json');
const REVIEW_JSON = path.resolve(process.cwd(), 'reports/unlinked-question-ai-review.json');
const REVIEWED_TEMPLATE = path.resolve(
  process.cwd(),
  'reports/unlinked-question-ai-reviewed-template.json'
);
const REVIEW_MD = path.resolve(process.cwd(), 'reports/unlinked-question-ai-review.md');

const args = process.argv.slice(2);
const MOCK = args.includes('--mock');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;
const rowIdIdx = args.indexOf('--row-id');
const ROW_ID = rowIdIdx >= 0 ? args[rowIdIdx + 1] : null;
const modelIdx = args.indexOf('--model');
const MODEL = modelIdx >= 0 ? args[modelIdx + 1] : undefined;

interface Reviewers {
  clinical: (packet: ReviewPacket) => Promise<unknown>;
  taxonomy: (packet: ReviewPacket) => Promise<unknown>;
  verifier: (
    packet: ReviewPacket,
    proposal: { decision: string; targetId: string | null }
  ) => Promise<unknown>;
}

/**
 * Mock reviewers: deliberately propose nothing. A mock run exercises the
 * full pipeline + report shape while guaranteeing zero prepared links.
 */
function buildMockReviewers(): Reviewers {
  const mockAssessment = {
    proposedDecision: 'keep_quarantined',
    proposedTargetId: null,
    confidence: 0,
    clinicalRationale: 'Mock mode: no model available; conservative default.',
    safetyConcern: false,
    concernNotes: '',
  };
  const mockVerifier = {
    veto: true,
    vetoReason: 'Mock mode: verifier always vetoes.',
    specificityOk: false,
    answerExplanationConsistent: false,
    confidence: 0,
  };
  return {
    clinical: async () => mockAssessment,
    taxonomy: async () => mockAssessment,
    verifier: async () => mockVerifier,
  };
}

async function buildLiveReviewers(): Promise<Reviewers> {
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ Live mode requires GEMINI_API_KEY. Missing env:');
    console.error('   - GEMINI_API_KEY (set in .env or shell)');
    console.error('   Re-run with --mock to exercise the pipeline without a model.');
    process.exit(1);
  }
  const { gateway } = await import('../lib/ai/aiGateway');
  const context = { env: { GEMINI_API_KEY: process.env.GEMINI_API_KEY } };

  const callReviewer = async (systemPrompt: string, userPrompt: string) => {
    const response = await gateway.callStructured(context, {
      mode: 'structured',
      task: 'extraction',
      ...(MODEL ? { model: MODEL as never } : {}),
      systemPrompt,
      userPrompt,
      schema: ReviewerAssessmentSchema,
      schemaDescription:
        'Review assessment: proposedDecision (link_condition|link_medical_content|retire|keep_quarantined|needs_more_information), proposedTargetId (candidate conditionId or null), confidence (0-1), clinicalRationale, safetyConcern (boolean), concernNotes.',
    });
    return response.data;
  };

  return {
    clinical: (packet) =>
      callReviewer(
        'You are a conservative clinical content reviewer. Output strictly matches the schema.',
        buildClinicalReviewerPrompt(packet)
      ),
    taxonomy: (packet) =>
      callReviewer(
        'You are a conservative clinical taxonomy reviewer. Output strictly matches the schema.',
        buildTaxonomyReviewerPrompt(packet)
      ),
    verifier: async (packet, proposal) => {
      const response = await gateway.callStructured(context, {
        mode: 'structured',
        task: 'extraction',
        ...(MODEL ? { model: MODEL as never } : {}),
        systemPrompt:
          'You are a skeptical clinical verifier. Veto anything not unambiguous. Output strictly matches the schema.',
        userPrompt: buildVerifierPrompt(packet, proposal),
        schema: VerifierAssessmentSchema,
        schemaDescription:
          'Verifier assessment: veto (boolean), vetoReason, specificityOk (boolean), answerExplanationConsistent (boolean), confidence (0-1).',
      });
      return response.data;
    },
  };
}

/** Set when the prisma helper was imported, so main() can disconnect its pool. */
let prismaCleanup: (() => Promise<void>) | null = null;

/** Load live Condition/MedicalContent ids when a DB is reachable; else null. */
async function loadAggregationContext(): Promise<AggregationContext> {
  if (!process.env.DATABASE_URL && !process.env.DIRECT_DATABASE_URL) {
    console.warn(
      '⚠️  No DATABASE_URL — target validation unavailable. Link decisions cannot pass gates this run.'
    );
    return { knownConditionIds: null, knownMedicalContentIds: null };
  }
  const { prisma, disconnectPrisma } = await import('./helpers/prisma-client');
  prismaCleanup = disconnectPrisma;
  const [conditions, content] = await Promise.all([
    prisma.condition.findMany({ select: { id: true } }),
    prisma.medicalContent.findMany({ select: { id: true } }),
  ]);
  return {
    knownConditionIds: new Set(conditions.map((c) => c.id)),
    knownMedicalContentIds: new Set(content.map((m) => m.id)),
  };
}

async function main(): Promise<void> {
  if (!existsSync(TEMPLATE_PATH)) {
    console.error(`❌ Worklist not found: ${TEMPLATE_PATH}`);
    console.error('Run scripts/generate-unlinked-question-linking-template.ts first.');
    process.exit(1);
  }

  const parsed = JSON.parse(readFileSync(TEMPLATE_PATH, 'utf8')) as { rows?: LinkingTemplateRow[] };
  const allRows = Array.isArray(parsed.rows) ? parsed.rows : [];
  let rows = ROW_ID ? allRows.filter((r) => r.id === ROW_ID) : allRows;
  if (Number.isFinite(LIMIT)) rows = rows.slice(0, LIMIT);

  console.log(
    `${MOCK ? '🧪 MOCK' : '🤖 LIVE'} AI review — ${rows.length}/${allRows.length} rows (report-only, no DB mutation)\n`
  );

  const reviewers = MOCK ? buildMockReviewers() : await buildLiveReviewers();
  const aggregationContext = MOCK
    ? { knownConditionIds: null, knownMedicalContentIds: null }
    : await loadAggregationContext();

  const reviewedAt = new Date().toISOString();
  const outcomes: AiReviewOutcome[] = [];
  const malformed: Array<{ id: string; error: string }> = [];
  const reviewedRowsById = new Map<string, LinkingTemplateRow>();

  for (const row of rows) {
    const packet = buildReviewPacket(row);
    try {
      // Independent reviewer passes — both run before aggregation so neither
      // sees the other's proposal. Schema-parse EVERY model output.
      const [clinicalRaw, taxonomyRaw] = await Promise.all([
        reviewers.clinical(packet),
        reviewers.taxonomy(packet),
      ]);
      const clinical: ReviewerAssessment = ReviewerAssessmentSchema.parse(clinicalRaw);
      const taxonomy: ReviewerAssessment = ReviewerAssessmentSchema.parse(taxonomyRaw);

      const verifierRaw = await reviewers.verifier(packet, {
        decision: clinical.proposedDecision,
        targetId: clinical.proposedTargetId,
      });
      const verifier: VerifierAssessment = VerifierAssessmentSchema.parse(verifierRaw);

      const outcome = aggregateAssessments(packet, clinical, taxonomy, verifier, aggregationContext);
      outcomes.push(outcome);
      reviewedRowsById.set(row.id, toReviewedTemplateRow(row, outcome, reviewedAt));
      console.log(`  [${row.source}] ${row.id}: ${outcome.decision}`);
    } catch (error) {
      // Malformed/failed model output → row stays quarantined with the error recorded.
      const message = error instanceof Error ? error.message : String(error);
      malformed.push({ id: row.id, error: message });
      reviewedRowsById.set(row.id, {
        ...row,
        reviewedConditionId: '',
        reviewedMedicalContentId: '',
        reviewDecision: 'keep_quarantined',
        reviewNotes: `AI review failed (malformed or unavailable model output): ${message.slice(0, 300)}`,
        reviewedBy: AI_REVIEWER_ID,
        reviewedAt,
      });
      console.warn(`  [${row.source}] ${row.id}: MALFORMED (${message.slice(0, 80)})`);
    }
  }

  // Rows outside --limit/--row-id scope pass through unreviewed (skip on apply).
  const reviewedTemplateRows = allRows.map((row) => reviewedRowsById.get(row.id) ?? row);

  const summary = summarizeOutcomes(outcomes, malformed.length);

  mkdirSync(path.dirname(REVIEW_JSON), { recursive: true });
  writeFileSync(
    REVIEW_JSON,
    JSON.stringify(
      { ranAt: reviewedAt, mode: MOCK ? 'mock' : 'live', reviewedBy: AI_REVIEWER_ID, summary, malformed, outcomes },
      null,
      2
    ) + '\n'
  );
  writeFileSync(
    REVIEWED_TEMPLATE,
    JSON.stringify(
      {
        generatedAt: reviewedAt,
        seededFrom: 'reports/unlinked-question-linking-template.json',
        reviewedBy: AI_REVIEWER_ID,
        mode: MOCK ? 'mock' : 'live',
        instructions:
          'AI-reviewed template. Validate + apply ONLY via scripts/apply-unlinked-question-links.ts (dry-run default; --apply to mutate).',
        rows: reviewedTemplateRows,
      },
      null,
      2
    ) + '\n'
  );

  const md: string[] = [];
  md.push('# AI Review of Unlinked Questions', '');
  md.push(`> Ran: ${reviewedAt} — mode: ${MOCK ? 'mock (no model; all rows quarantined by design)' : 'live'}`);
  md.push('> Report-only. No database rows were modified.', '');
  md.push('## Summary', '');
  md.push(`- Rows reviewed: ${summary.total} of ${allRows.length}`);
  md.push(`- Prepared links (passed ALL gates): ${summary.preparedLinks}`);
  md.push(`- retire: ${summary.byDecision.retire}`);
  md.push(`- keep_quarantined: ${summary.byDecision.keep_quarantined}`);
  md.push(`- needs_more_information: ${summary.byDecision.needs_more_information}`);
  md.push(`- malformed model output: ${summary.malformedRows}`, '');
  if (summary.preparedLinks > 0) {
    md.push('## Prepared links', '', '| id | decision | target | gates passed |', '| --- | --- | --- | --- |');
    for (const o of outcomes.filter((x) => x.decision === 'link_condition' || x.decision === 'link_medical_content')) {
      md.push(
        `| ${o.id} | ${o.decision} | ${o.reviewedConditionId ?? o.reviewedMedicalContentId} | ${o.gatesPassed.join(', ')} |`
      );
    }
    md.push('');
  }
  md.push('## Next step', '');
  md.push('```', 'npx tsx scripts/apply-unlinked-question-links.ts   # dry-run against the AI-reviewed template', '```', '');
  writeFileSync(REVIEW_MD, md.join('\n'));

  console.log(`\nPrepared links: ${summary.preparedLinks}; quarantined: ${summary.byDecision.keep_quarantined}; retire: ${summary.byDecision.retire}; needs-more-info: ${summary.byDecision.needs_more_information}; malformed: ${summary.malformedRows}`);
  console.log(`📝 Reports:\n  ${REVIEW_JSON}\n  ${REVIEWED_TEMPLATE}\n  ${REVIEW_MD}`);
}

main()
  .catch((err) => {
    console.error('AI review failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Close the pg pool when the prisma helper was loaded (live mode);
    // otherwise the open pool keeps the process alive after the run.
    if (prismaCleanup) await prismaCleanup();
  });
