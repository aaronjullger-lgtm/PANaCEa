#!/usr/bin/env tsx
/**
 * Audit Unlinked Study Questions (DRY-RUN / READ-ONLY)
 *
 * Reproduces and classifies the set of approved/servable questions that have
 * neither conditionId nor medicalContentId. These cannot persist review state
 * (drillReviewService skips FSRS with fsrsSkippedReason='missing_condition_linkage')
 * and are already excluded from the main study path by withProgressLinkage().
 *
 * This script NEVER mutates the database. It writes:
 *   reports/unlinked-question-audit.json
 *   reports/unlinked-question-audit.md
 *
 * Usage:
 *   npx tsx scripts/audit-unlinked-questions.ts
 *
 * Classification logic lives in scripts/lib/unlinkedQuestionClassifier.ts and is
 * unit-tested in tests/scripts/unlinkedQuestionClassifier.test.ts.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { prisma, disconnectPrisma } from './helpers/prisma-client';
import {
  classifyUnlinkedQuestion,
  summarizeClassifications,
  type UnlinkedClassificationResult,
  type UnlinkedQuestionRecord,
  type UnlinkedCandidateContext,
} from './lib/unlinkedQuestionClassifier';

const REPORT_DIR = path.resolve(process.cwd(), 'reports');
const JSON_PATH = path.join(REPORT_DIR, 'unlinked-question-audit.json');
const MD_PATH = path.join(REPORT_DIR, 'unlinked-question-audit.md');

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function toOptions(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((o) =>
      typeof o === 'string'
        ? o
        : String((o as { value?: string; text?: string; label?: string })?.value ?? (o as any)?.text ?? (o as any)?.label ?? '')
    );
  }
  if (raw && typeof raw === 'object') {
    return Object.keys(raw as Record<string, unknown>)
      .sort()
      .map((k) => String((raw as Record<string, unknown>)[k] ?? ''));
  }
  return [];
}

async function main(): Promise<void> {
  console.log('🔍 Auditing unlinked study questions (read-only)...\n');

  // ── Load condition + medical-content lookup tables once (in-memory match) ──
  const conditions = await prisma.condition.findMany({
    select: { id: true, name: true, system: true, subcategory: true },
  });
  // Map Condition.id → MedicalContent.id (NOT the condition id itself —
  // link_medical_content_candidate must suggest a MedicalContent.id).
  const medicalContentIdByConditionId = new Map(
    (await prisma.medicalContent.findMany({ select: { id: true, conditionId: true } })).map((m) => [
      m.conditionId,
      m.id,
    ])
  );

  const byName = new Map<string, string[]>();
  const bySubcat = new Map<string, string[]>();
  for (const c of conditions) {
    const nameKey = c.name.trim().toLowerCase();
    byName.set(nameKey, [...(byName.get(nameKey) ?? []), c.id]);
    if (c.subcategory) {
      const subKey = `${c.system}::${c.subcategory.trim().toLowerCase()}`;
      bySubcat.set(subKey, [...(bySubcat.get(subKey) ?? []), c.id]);
    }
  }

  // ── Fetch unlinked rows from both sources ──
  const pregen = await prisma.preGeneratedQuestion.findMany({
    where: { validationStatus: 'approved', conditionId: null, medicalContentId: null },
    select: {
      id: true,
      system: true,
      difficulty: true,
      questionData: true,
      timesServed: true,
      semanticHash: true,
    },
  });

  const questions = await prisma.question.findMany({
    where: { lifecycleStatus: 'ACTIVE', qaStatus: 'APPROVED', conditionId: null, medicalContentId: null },
    select: {
      id: true,
      system: true,
      category: true,
      topic: true,
      question: true,
      vignette: true,
      options: true,
      correctAnswer: true,
      explanation: true,
      timesSeen: true,
    },
  });

  // ── Normalize ──
  const records: UnlinkedQuestionRecord[] = [];

  for (const q of pregen) {
    const data = (q.questionData ?? {}) as Record<string, unknown>;
    records.push({
      id: q.id,
      source: 'pre_generated',
      system: str(q.system),
      subcategory: str(data.subcategory) ?? str(data.topic),
      embeddedConditionName: str(data.condition),
      stem: str(data.question) ?? str(data.vignette) ?? '',
      options: toOptions(data.options ?? data.answers ?? data.choices),
      correctAnswer: str(data.correctAnswer) ?? (typeof data.correctAnswerIndex === 'number' ? String(data.correctAnswerIndex) : null),
      hasRationale: Boolean(str(data.rationale) ?? str(data.explanation) ?? (data.rationale && typeof data.rationale === 'object')),
      timesServed: q.timesServed ?? 0,
      semanticHash: str(q.semanticHash),
    });
  }

  for (const q of questions) {
    records.push({
      id: q.id,
      source: 'question',
      system: str(q.system),
      subcategory: str(q.category) ?? str(q.topic),
      embeddedConditionName: null,
      stem: str(q.question) ?? str(q.vignette) ?? '',
      options: toOptions(q.options),
      correctAnswer: str(q.correctAnswer),
      hasRationale: Boolean(str(q.explanation)),
      timesServed: q.timesSeen ?? 0,
      semanticHash: null,
    });
  }

  // ── Duplicate detection across the unlinked set ──
  const hashCounts = new Map<string, number>();
  for (const r of records) {
    if (r.semanticHash) hashCounts.set(r.semanticHash, (hashCounts.get(r.semanticHash) ?? 0) + 1);
  }

  // ── Classify ──
  const results: UnlinkedClassificationResult[] = records.map((r) => {
    const nameMatches = r.embeddedConditionName
      ? byName.get(r.embeddedConditionName.toLowerCase()) ?? []
      : [];
    const subcatMatches =
      r.system && r.subcategory
        ? bySubcat.get(`${r.system}::${r.subcategory.toLowerCase()}`) ?? []
        : [];
    const medicalContentIdByCondition =
      nameMatches.length === 1
        ? medicalContentIdByConditionId.get(nameMatches[0]!) ?? null
        : null;
    const context: UnlinkedCandidateContext = {
      conditionIdsByName: nameMatches,
      conditionIdsBySubcategory: subcatMatches,
      medicalContentIdByCondition,
      semanticHashIsDuplicated: r.semanticHash ? (hashCounts.get(r.semanticHash) ?? 0) > 1 : false,
    };
    return classifyUnlinkedQuestion(r, context);
  });

  const summary = summarizeClassifications(results);

  // ── Write reports ──
  mkdirSync(REPORT_DIR, { recursive: true });
  const generatedAt = new Date().toISOString();
  const report = { generatedAt, summary, results };
  writeFileSync(JSON_PATH, JSON.stringify(report, null, 2) + '\n');
  writeFileSync(MD_PATH, renderMarkdown(generatedAt, summary, results, records));

  console.log(`Total unlinked: ${summary.total}`);
  console.log(`  pre_generated: ${summary.bySource.pre_generated}`);
  console.log(`  question:      ${summary.bySource.question}`);
  console.log('By classification:');
  for (const [k, v] of Object.entries(summary.byClassification)) {
    if (v > 0) console.log(`  ${k}: ${v}`);
  }
  console.log(`Auto-actionable (safe to apply without review): ${summary.autoActionable}`);
  console.log(`\n📝 Reports written:\n  ${JSON_PATH}\n  ${MD_PATH}`);
}

function renderMarkdown(
  generatedAt: string,
  summary: ReturnType<typeof summarizeClassifications>,
  results: UnlinkedClassificationResult[],
  records: UnlinkedQuestionRecord[]
): string {
  const recById = new Map(records.map((r) => [r.id, r]));
  const lines: string[] = [];
  lines.push('# Unlinked Question Audit');
  lines.push('');
  lines.push(`> Generated: ${generatedAt}`);
  lines.push('> Read-only audit. No database rows were modified.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Total unlinked:** ${summary.total}`);
  lines.push(`  - pre_generated: ${summary.bySource.pre_generated}`);
  lines.push(`  - question: ${summary.bySource.question}`);
  lines.push(`- **Auto-actionable:** ${summary.autoActionable}`);
  lines.push('');
  lines.push('### By classification');
  lines.push('');
  lines.push('| Classification | Count |');
  lines.push('| --- | --- |');
  for (const [k, v] of Object.entries(summary.byClassification)) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push('');
  lines.push('## Rows requiring manual clinical review');
  lines.push('');
  lines.push('| id | source | system | subcategory | candidates | reason |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const r of results.filter((x) => x.classification === 'manual_review_required')) {
    const rec = recById.get(r.id);
    lines.push(
      `| ${r.id} | ${r.source} | ${rec?.system ?? ''} | ${rec?.subcategory ?? ''} | ${r.candidateConditionIds.length} | ${r.reason} |`
    );
  }
  lines.push('');
  const retire = results.filter((x) => x.classification === 'retire_candidate');
  if (retire.length > 0) {
    lines.push('## Retire candidates (degenerate, never served)');
    lines.push('');
    lines.push('| id | source | reason |');
    lines.push('| --- | --- | --- |');
    for (const r of retire) lines.push(`| ${r.id} | ${r.source} | ${r.reason} |`);
    lines.push('');
  }
  const linkable = results.filter(
    (x) => x.classification === 'link_condition_candidate' || x.classification === 'link_medical_content_candidate'
  );
  if (linkable.length > 0) {
    lines.push('## Link candidates (suggestion only — confirm before applying)');
    lines.push('');
    lines.push('| id | source | suggestedConditionId | suggestedMedicalContentId |');
    lines.push('| --- | --- | --- | --- |');
    for (const r of linkable) {
      lines.push(`| ${r.id} | ${r.source} | ${r.suggestedConditionId ?? ''} | ${r.suggestedMedicalContentId ?? ''} |`);
    }
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

main()
  .catch((err) => {
    console.error('Audit failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
