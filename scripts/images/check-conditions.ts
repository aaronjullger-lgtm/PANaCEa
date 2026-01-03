import { Client } from 'pg';
import { config } from 'dotenv';

config();

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_DATABASE_URL });
  await client.connect();
  
  const result = await client.query(`SELECT id FROM "Condition" ORDER BY id`);
  const existingIds = new Set(result.rows.map(r => r.id));
  
  // These are the IDs we're trying to use
  const mappedIds = [
    'CV__ecg__brugada_syndrome',
    'CV__conduction_disorders__left_bundle_branch_block',
    'CV__conduction_disorders__right_bundle_branch_block',
    'MSK__trauma__shoulder_dislocation',
    'MSK__trauma__hip_dislocation',
    'MSK__pediatric__developmental_dysplasia_hip',
    'MSK__pediatric__genu_valgum',
    'MSK__pediatric__genu_varum',
    'RENAL__congenital__horseshoe_kidney',
    'MSK__pediatric__legg_calve_perthes',
  ];
  
  console.log('Checking mapped condition IDs against database...\n');
  
  const missing: string[] = [];
  for (const id of mappedIds) {
    if (!existingIds.has(id)) {
      missing.push(id);
    }
  }
  
  if (missing.length > 0) {
    console.log('Missing condition IDs (need to be created or remapped):');
    missing.forEach(id => console.log(' -', id));
  } else {
    console.log('All mapped IDs exist in database');
  }
  
  await client.end();
}

main().catch(console.error);
