import path from 'path';
import { pathToFileURL } from 'url';

const { CONDITION_REGISTRY, buildConditionDefinition } = await import(
  pathToFileURL(path.resolve('conditionRegistry.ts')).href
);
const { QUESTION_BANK } = await import(pathToFileURL(path.resolve('src/questions.ts')).href);

interface AuditResult {
  missing: string[];
  orphanConditions: string[];
  counts: Record<string, number>;
}

function runAudit(): AuditResult {
  const idSet = new Map<string, { system: string; subcategory: string; condition: string }>();
  for (const meta of CONDITION_REGISTRY) {
    const def = buildConditionDefinition(meta);
    idSet.set(def.id, {
      system: def.system,
      subcategory: def.subcategory,
      condition: def.condition,
    });
  }

  const counts: Record<string, number> = {};
  const missing: string[] = [];

  for (const q of QUESTION_BANK) {
    if (!idSet.has(q.conditionId)) {
      missing.push(`${q.conditionId} (${q.condition})`);
    }
    counts[q.conditionId] = (counts[q.conditionId] || 0) + 1;
  }

  const orphanConditions: string[] = [];
  for (const [id, meta] of idSet.entries()) {
    if (!counts[id]) {
      orphanConditions.push(`${id} – ${meta.condition}`);
    }
  }

  return { missing, orphanConditions, counts };
}

function printSummary(result: AuditResult) {
  console.log('Question → condition audit summary:\n');
  console.log(`Total questions: ${QUESTION_BANK.length}`);
  console.log(`Unique conditions covered: ${Object.keys(result.counts).length}`);
  console.log(`Conditions in registry: ${CONDITION_REGISTRY.length}`);
  console.log('');

  if (result.missing.length) {
    console.log('Missing conditionIds (not found in registry):');
    for (const miss of result.missing) {
      console.log(` - ${miss}`);
    }
  } else {
    console.log('All questions reference valid registry conditionIds.');
  }

  console.log('');
  console.log(`Orphan conditions (no questions): ${result.orphanConditions.length}`);
}

const result = runAudit();
printSummary(result);
