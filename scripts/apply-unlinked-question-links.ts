#!/usr/bin/env tsx
/**
 * Apply human-reviewed links for unlinked study questions. DRY-RUN BY DEFAULT.
 *
 * Reads reports/unlinked-question-linking-template.json (produced by
 * scripts/generate-unlinked-question-linking-template.ts and completed by a
 * clinical reviewer) and applies ONLY explicit, human-filled decisions:
 *
 *   link_condition          → set conditionId (target must exist in Condition)
 *   link_medical_content    → set medicalContentId (target must exist in MedicalContent)
 *   retire                  → PreGeneratedQuestion: validationStatus 'rejected' (+ validationNotes)
 *                             Question: lifecycleStatus 'RETIRED' (valid ACTIVE→RETIRED transition)
 *   keep_quarantined        → no DB change; recorded in the report
 *   needs_more_information  → no DB change; recorded in the report
 *
 * Safety:
 *   - No mutation without --apply.
 *   - Refuses to run against production hosts without --allow-production.
 *   - Refuses the entire run if ANY reviewed row is invalid (no partial guessing).
 *   - Never deletes rows. Idempotent: already-linked/retired rows are no-ops.
 *   - Emits reports/unlinked-question-link-application-report.json with
 *     before/after counts and per-row outcomes.
 *
 * Usage:
 *   npx tsx scripts/apply-unlinked-question-links.ts            # dry-run
 *   npx tsx scripts/apply-unlinked-question-links.ts --apply    # mutate (non-prod)
 *   npx tsx scripts/apply-unlinked-question-links.ts --apply --allow-production
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { prisma, disconnectPrisma } from './helpers/prisma-client';
import {
  validateTemplate,
  type LinkingTemplateRow,
} from './lib/linkingTemplate';

const TEMPLATE_PATH = path.resolve(process.cwd(), 'reports/unlinked-question-linking-template.json');
const REPORT_PATH = path.resolve(
  process.cwd(),
  'reports/unlinked-question-link-application-report.json'
);

const APPLY = process.argv.includes('--apply');
const ALLOW_PRODUCTION = process.argv.includes('--allow-production');

/** Heuristic production guard — matches the repo's known production DB hosts. */
function looksLikeProduction(databaseUrl: string): boolean {
  return /supabase\.co|pooler\.supabase|prod/i.test(databaseUrl);
}

async function countUnlinked() {
  const [pregen, question] = await Promise.all([
    prisma.preGeneratedQuestion.count({
      where: { validationStatus: 'approved', conditionId: null, medicalContentId: null },
    }),
    prisma.question.count({
      where: { lifecycleStatus: 'ACTIVE', qaStatus: 'APPROVED', conditionId: null, medicalContentId: null },
    }),
  ]);
  return { pregen, question, total: pregen + question };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || '';
  if (APPLY && looksLikeProduction(databaseUrl) && !ALLOW_PRODUCTION) {
    console.error(
      '❌ Refusing to --apply against a production-looking database without --allow-production.'
    );
    process.exitCode = 1;
    return;
  }

  if (!existsSync(TEMPLATE_PATH)) {
    console.error(`❌ Template not found: ${TEMPLATE_PATH}`);
    console.error('Run scripts/generate-unlinked-question-linking-template.ts first.');
    process.exitCode = 1;
    return;
  }

  const parsed = JSON.parse(readFileSync(TEMPLATE_PATH, 'utf8')) as { rows?: LinkingTemplateRow[] };
  const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
  console.log(`${APPLY ? '🔧 APPLY' : '🔍 DRY-RUN'} — template rows: ${rows.length}\n`);

  // Validate reviewed targets against the live tables.
  const [conditionIds, medicalContentIds] = await Promise.all([
    prisma.condition.findMany({ select: { id: true } }).then((r) => new Set(r.map((c) => c.id))),
    prisma.medicalContent.findMany({ select: { id: true } }).then((r) => new Set(r.map((m) => m.id))),
  ]);

  const summary = validateTemplate(rows, {
    knownConditionIds: conditionIds,
    knownMedicalContentIds: medicalContentIds,
  });

  if (summary.invalid.length > 0) {
    console.error(`❌ ${summary.invalid.length} invalid reviewed row(s) — refusing the entire run:\n`);
    for (const { errors } of summary.invalid) {
      for (const e of errors) console.error(`  - ${e}`);
    }
    process.exitCode = 1;
    return;
  }

  const before = await countUnlinked();
  console.log(`Before: ${before.total} unlinked (pre_generated: ${before.pregen}, question: ${before.question})`);
  console.log(
    `Reviewed: apply=${summary.toApply.length}, report-only=${summary.reportOnly.length}, unreviewed-skipped=${summary.skipped}\n`
  );

  const outcomes: Array<{
    source: string;
    id: string;
    decision: string;
    action: string;
    reviewedBy: string;
  }> = [];

  for (const row of summary.toApply) {
    const decision = row.reviewDecision;
    let action = 'dry-run (no mutation)';

    if (APPLY) {
      if (row.source === 'pre_generated') {
        if (decision === 'link_condition') {
          await prisma.preGeneratedQuestion.update({
            where: { id: row.id },
            data: { conditionId: row.reviewedConditionId.trim() },
          });
          action = `set PreGeneratedQuestion.conditionId = ${row.reviewedConditionId.trim()}`;
        } else if (decision === 'link_medical_content') {
          await prisma.preGeneratedQuestion.update({
            where: { id: row.id },
            data: { medicalContentId: row.reviewedMedicalContentId.trim() },
          });
          action = `set PreGeneratedQuestion.medicalContentId = ${row.reviewedMedicalContentId.trim()}`;
        } else if (decision === 'retire') {
          await prisma.preGeneratedQuestion.update({
            where: { id: row.id },
            data: {
              validationStatus: 'rejected',
              validationNotes: `Retired via reviewed linking workflow: ${row.reviewNotes.trim()}`,
            },
          });
          action = "set PreGeneratedQuestion.validationStatus = 'rejected'";
        }
      } else {
        if (decision === 'link_condition') {
          await prisma.question.update({
            where: { id: row.id },
            data: { conditionId: row.reviewedConditionId.trim() },
          });
          action = `set Question.conditionId = ${row.reviewedConditionId.trim()}`;
        } else if (decision === 'link_medical_content') {
          await prisma.question.update({
            where: { id: row.id },
            data: { medicalContentId: row.reviewedMedicalContentId.trim() },
          });
          action = `set Question.medicalContentId = ${row.reviewedMedicalContentId.trim()}`;
        } else if (decision === 'retire') {
          await prisma.question.update({
            where: { id: row.id },
            data: { lifecycleStatus: 'RETIRED' },
          });
          action = "set Question.lifecycleStatus = 'RETIRED'";
        }
      }
    } else {
      action = `would ${
        decision === 'retire'
          ? 'retire via existing status convention'
          : `set ${decision === 'link_condition' ? 'conditionId' : 'medicalContentId'} = ${
              (decision === 'link_condition' ? row.reviewedConditionId : row.reviewedMedicalContentId).trim()
            }`
      }`;
    }

    outcomes.push({ source: row.source, id: row.id, decision, action, reviewedBy: row.reviewedBy });
    console.log(`  [${row.source}] ${row.id}: ${decision} → ${action}`);
  }

  for (const row of summary.reportOnly) {
    outcomes.push({
      source: row.source,
      id: row.id,
      decision: row.reviewDecision,
      action: 'no DB change (decision recorded)',
      reviewedBy: row.reviewedBy,
    });
  }

  const after = APPLY ? await countUnlinked() : before;
  console.log(`\nAfter: ${after.total} unlinked (pre_generated: ${after.pregen}, question: ${after.question})`);

  mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  writeFileSync(
    REPORT_PATH,
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        mode: APPLY ? 'apply' : 'dry-run',
        before,
        after,
        applied: APPLY ? summary.toApply.length : 0,
        reportOnly: summary.reportOnly.length,
        skippedUnreviewed: summary.skipped,
        outcomes,
      },
      null,
      2
    ) + '\n'
  );
  console.log(`📝 Application report: ${REPORT_PATH}`);
  if (!APPLY) console.log('\nDry-run complete. Re-run with --apply to mutate.');
}

main()
  .catch((err) => {
    console.error('Apply failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
