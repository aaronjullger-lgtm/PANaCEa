import fs from 'fs';
import path from 'path';
import { CONDITION_REGISTRY, buildConditionDefinition } from '../config/conditionRegistry';

const CONTENT_FILE = path.resolve('conditionContent.generated.json');

function run() {
  console.log('Syncing registry to content file...');

  if (!fs.existsSync(CONTENT_FILE)) {
    console.error(`Content file not found: ${CONTENT_FILE}`);
    process.exit(1);
  }

  const content = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
  const existingIds = new Set(content.map((c: any) => c.conditionId));

  let addedCount = 0;

  for (const meta of CONDITION_REGISTRY) {
    const def = buildConditionDefinition(meta);
    if (!existingIds.has(def.id)) {
      console.log(`Adding missing condition: ${def.condition} (${def.id})`);

      content.push({
        conditionId: def.id,
        condition: def.condition,
        content: {
          overview: 'Content pending generation.',
          etiologyPathophysiology: 'Content pending generation.',
          epidemiology: 'Content pending generation.',
          riskFactors: [],
          clinicalPresentation: 'Content pending generation.',
          symptoms: [],
          examFindings: [],
          diagnostics: {
            notes: 'Content pending generation.',
          },
          treatment: [],
          management: [],
          complications: [],
          prognosis: 'Content pending generation.',
          basicScienceLinks: [],
        },
      });
      addedCount++;
    }
  }

  if (addedCount > 0) {
    fs.writeFileSync(CONTENT_FILE, JSON.stringify(content, null, 2));
    console.log(`Successfully added ${addedCount} missing conditions to ${CONTENT_FILE}`);
  } else {
    console.log('No missing conditions found.');
  }
}

run();
