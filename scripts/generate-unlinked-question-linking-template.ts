#!/usr/bin/env tsx
/**
 * Generate the human-review linking template for unlinked study questions.
 *
 * Reads the same unlinked sets as scripts/audit-unlinked-questions.ts (approved
 * PreGeneratedQuestion + ACTIVE/APPROVED Question rows with neither conditionId
 * nor medicalContentId), surfaces candidate conditions for each, and writes
 *
 *   reports/unlinked-question-linking-template.json
 *
 * A clinical reviewer fills in reviewedConditionId / reviewedMedicalContentId /
 * reviewDecision / reviewNotes / reviewedBy per row, then runs
 * scripts/apply-unlinked-question-links.ts (dry-run by default).
 *
 * READ-ONLY against the database. Idempotent: re-running merges fresh source
 * data with any reviewer-filled fields already present in the template file —
 * human work is never clobbered. Output ordering is deterministic.
 *
 * Usage:
 *   npx tsx scripts/generate-unlinked-question-linking-template.ts
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { prisma, disconnectPrisma } from './helpers/prisma-client';
import {
  buildLinkingTemplate,
  buildPreGeneratedFingerprintSource,
  buildQuestionFingerprintSource,
  computeSourceFingerprint,
  type LinkingCandidate,
  type LinkingTemplateRow,
  type LinkingTemplateSourceRow,
} from './lib/linkingTemplate';

const TEMPLATE_PATH = path.resolve(process.cwd(), 'reports/unlinked-question-linking-template.json');

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
  console.log('📋 Generating unlinked-question linking template (read-only)...\n');

  const conditions = await prisma.condition.findMany({
    select: { id: true, name: true, system: true, subcategory: true },
  });
  const medicalContentByConditionId = new Map(
    (await prisma.medicalContent.findMany({ select: { id: true, conditionId: true } })).map((m) => [
      m.conditionId,
      m.id,
    ])
  );

  const byName = new Map<string, typeof conditions>();
  const bySubcat = new Map<string, typeof conditions>();
  for (const c of conditions) {
    const nameKey = c.name.trim().toLowerCase();
    byName.set(nameKey, [...(byName.get(nameKey) ?? []), c]);
    if (c.subcategory) {
      const subKey = `${c.system}::${c.subcategory.trim().toLowerCase()}`;
      bySubcat.set(subKey, [...(bySubcat.get(subKey) ?? []), c]);
    }
  }

  const candidatesFor = (
    system: string | null,
    subcategory: string | null,
    embeddedName: string | null
  ): LinkingCandidate[] => {
    const matched =
      (embeddedName ? byName.get(embeddedName.toLowerCase()) : undefined) ??
      (system && subcategory ? bySubcat.get(`${system}::${subcategory.toLowerCase()}`) : undefined) ??
      [];
    return matched.map((c) => ({
      conditionId: c.id,
      conditionName: c.name,
      medicalContentId: medicalContentByConditionId.get(c.id) ?? null,
    }));
  };

  const pregen = await prisma.preGeneratedQuestion.findMany({
    where: { validationStatus: 'approved', conditionId: null, medicalContentId: null },
    select: {
      id: true,
      system: true,
      difficulty: true,
      questionData: true,
      validationStatus: true,
      conditionId: true,
      medicalContentId: true,
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
      difficulty: true,
      lifecycleStatus: true,
      qaStatus: true,
      conditionId: true,
      medicalContentId: true,
    },
  });

  const sourceRows: LinkingTemplateSourceRow[] = [];

  for (const q of pregen) {
    const data = (q.questionData ?? {}) as Record<string, unknown>;
    const system = str(q.system);
    const subcategory = str(data.subcategory) ?? str(data.topic);
    const embeddedName = str(data.condition);
    sourceRows.push({
      source: 'pre_generated',
      id: q.id,
      stem: str(data.question) ?? str(data.vignette) ?? '',
      options: toOptions(data.options ?? data.answers ?? data.choices),
      correctAnswer:
        str(data.correctAnswer) ??
        (typeof data.correctAnswerIndex === 'number' ? String(data.correctAnswerIndex) : null),
      rationale: str(data.rationale) ?? str(data.explanation),
      system,
      subcategory,
      difficulty: str(q.difficulty),
      embeddedConditionName: embeddedName,
      candidates: candidatesFor(system, subcategory, embeddedName),
      sourceFingerprint: computeSourceFingerprint(buildPreGeneratedFingerprintSource(q)),
    });
  }

  for (const q of questions) {
    const system = str(q.system);
    const subcategory = str(q.category) ?? str(q.topic);
    sourceRows.push({
      source: 'question',
      id: q.id,
      stem: str(q.question) ?? str(q.vignette) ?? '',
      options: toOptions(q.options),
      correctAnswer: str(q.correctAnswer),
      rationale: str(q.explanation),
      system,
      subcategory,
      difficulty: str(q.difficulty),
      embeddedConditionName: null,
      candidates: candidatesFor(system, subcategory, null),
      sourceFingerprint: computeSourceFingerprint(buildQuestionFingerprintSource(q)),
    });
  }

  // Preserve reviewer-filled fields from a previously generated template.
  let previous: LinkingTemplateRow[] = [];
  if (existsSync(TEMPLATE_PATH)) {
    try {
      const parsed = JSON.parse(readFileSync(TEMPLATE_PATH, 'utf8')) as { rows?: LinkingTemplateRow[] };
      previous = Array.isArray(parsed.rows) ? parsed.rows : [];
      console.log(`Merging reviewer fields from existing template (${previous.length} rows).`);
    } catch (err) {
      console.error('Existing template is not valid JSON — refusing to overwrite human work.');
      throw err;
    }
  }

  const rows = buildLinkingTemplate(sourceRows, previous);

  mkdirSync(path.dirname(TEMPLATE_PATH), { recursive: true });
  writeFileSync(
    TEMPLATE_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        instructions:
          'Fill reviewDecision (link_condition | link_medical_content | retire | keep_quarantined | needs_more_information), ' +
          'exactly one reviewed target for link decisions, reviewNotes for non-link decisions, and reviewedBy. ' +
          'Then run: npx tsx scripts/apply-unlinked-question-links.ts (dry-run) and add --apply to mutate.',
        rows,
      },
      null,
      2
    ) + '\n'
  );

  const reviewed = rows.filter((r) => r.reviewDecision !== '').length;
  console.log(`Template rows: ${rows.length} (pre_generated: ${rows.filter((r) => r.source === 'pre_generated').length}, question: ${rows.filter((r) => r.source === 'question').length})`);
  console.log(`Already reviewed (preserved): ${reviewed}`);
  console.log(`\n📝 Written: ${TEMPLATE_PATH}`);
}

main()
  .catch((err) => {
    console.error('Template generation failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
