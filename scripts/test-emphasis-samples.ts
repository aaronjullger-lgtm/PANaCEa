import { prisma } from './_shared/db';

/**
 * Refined emphasis fixing logic
 */
function fixEmphasisRefined(text: string): string {
  let result = text;

  // 1. Fix mismatched triple-double asterisks: ***text** -> **text** (drop extra start asterisk)
  result = result.replace(/\*\*\*([^*]+)\*\*/g, '**$1**');

  // 2. Fix mismatched double-triple asterisks: **text*** -> **text** (drop extra end asterisk)
  result = result.replace(/\*\*([^*]+)\*\*\*/g, '**$1**');

  // 3. Fix missing closing asterisk: **text* -> **text**
  // Ensure the trailing * is not followed by another *
  result = result.replace(/\*\*([^*]+)\*(?!\*)/g, '**$1**');

  // 4. Fix missing opening asterisk: *text** -> **text**
  // Ensure the leading * is not preceded by *
  result = result.replace(/(?<!\*)\*([^*]+)\*\*/g, '**$1**');

  // 5. Fix mismatched underscores: __text_ -> __text__
  result = result.replace(/__([^_]+)_/g, '__$1__');

  // 6. Fix mismatched underscores: _text__ -> __text__
  result = result.replace(/_([^_]+)__/g, '__$1__');

  // 7. Preserve correct bold+italic ***text*** (do nothing)
  // 8. Preserve correct bold **text** and italic *text* / _text_

  // 9. Ensure bold uses ** (not __)?? We'll keep __ as alternative bold (maybe convert?)
  // Optional: convert __bold__ to **bold** for consistency.
  // We'll skip for now.

  return result;
}

async function fetchSamples() {
  // Get rows where any markdown column contains emphasis markers
  const columns = [
    'complications',
    'diagnostics',
    'differentialDiagnosis',
    'epidemiology',
    'etiology',
    'overview',
    'pathophysiology',
    'physicalExam',
    'prognosis',
    'riskFactors',
    'symptoms',
    'treatment',
    'first_line_rx',
    'gold_standard_dx',
    'best_initial_test',
    'classic_patient',
    'disposition',
    'gender_bias',
    'guidelines',
    'image_query',
    'mnemonic',
    'patient_education',
    'prevention',
  ];

  const conditions = columns.map(col => `${col} LIKE '%*%' OR ${col} LIKE '%_%'`).join(' OR ');
  const sql = `SELECT id, condition, ${columns.join(', ')} FROM "MedicalContent" WHERE ${conditions} LIMIT 20`;

  const samples = await prisma.$queryRawUnsafe(sql);
  return samples as any[];
}

async function main() {
  console.log('Fetching samples with emphasis markers...');
  const samples = await fetchSamples();
  console.log(`Found ${samples.length} rows`);

  for (const row of samples) {
    console.log(`\n=== ID ${row.id} ${row.condition} ===`);
    const columns = Object.keys(row).filter(k => k !== 'id' && k !== 'condition');
    for (const col of columns) {
      const val = row[col];
      if (typeof val === 'string' && (val.includes('*') || val.includes('_'))) {
        const before = val;
        const after = fixEmphasisRefined(before);
        if (before !== after) {
          console.log(`  ${col}:`);
          console.log(`    Before: ${before.substring(0, 200)}`);
          console.log(`    After:  ${after.substring(0, 200)}`);
        }
      }
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);