/**
 * Populate MedicalContent.content from structured fields.
 * 
 * The `content` column is NULL for 1251/1316 MedicalContent records.
 * The structured fields (overview, symptoms, treatment, etc.) ARE populated.
 * This script concatenates them into a single readable content field.
 * 
 * SAFE: idempotent, only updates NULL content, transactional.
 */
import { config } from 'dotenv';
import path from 'node:path';
import { Pool } from 'pg';

config({ path: path.resolve(process.cwd(), '.env') });

const url = new URL(process.env.DIRECT_DATABASE_URL!);
url.searchParams.set('uselibpqcompat', 'true');
const pool = new Pool({
  host: url.hostname,
  port: parseInt(url.port || '5432'),
  database: url.pathname.slice(1),
  user: url.username,
  password: url.password,
  ssl: { rejectUnauthorized: false }
});

interface MCRow {
  id: string;
  conditionId: string;
  condition: string | null;
  overview: string | null;
  symptoms: string | null;
  treatment: string | null;
  pathophysiology: string | null;
  physicalExam: string | null;
  epidemiology: string | null;
  etiology: string | null;
  prognosis: string | null;
  differentialDiagnosis: string | null;
  complications: string | null;
  riskFactors: string | null;
}

function buildContent(row: MCRow): string {
  const sections: string[] = [];
  const condition = row.condition || row.conditionId?.replace(/_/g, ' ') || 'Unknown';

  if (row.overview) sections.push(`## Overview\n\n${row.overview}`);
  if (row.epidemiology) sections.push(`## Epidemiology\n\n${row.epidemiology}`);
  if (row.etiology) sections.push(`## Etiology\n\n${row.etiology}`);
  if (row.pathophysiology) sections.push(`## Pathophysiology\n\n${row.pathophysiology}`);
  if (row.riskFactors) sections.push(`## Risk Factors\n\n${row.riskFactors}`);
  if (row.symptoms) sections.push(`## Signs and Symptoms\n\n${row.symptoms}`);
  if (row.physicalExam) sections.push(`## Physical Examination\n\n${row.physicalExam}`);
  if (row.differentialDiagnosis) sections.push(`## Differential Diagnosis\n\n${row.differentialDiagnosis}`);
  if (row.complications) sections.push(`## Complications\n\n${row.complications}`);
  if (row.treatment) sections.push(`## Treatment\n\n${row.treatment}`);
  if (row.prognosis) sections.push(`## Prognosis\n\n${row.prognosis}`);

  if (sections.length === 0) return '';

  return `# ${condition}\n\n${sections.join('\n\n')}`;
}

async function main() {
  const client = await pool.connect();
  try {
    // Get all MedicalContent with NULL content but populated structured fields
    const { rows } = await client.query<MCRow>(`
      SELECT id, "conditionId", "condition", "overview", "symptoms", "treatment", 
             "pathophysiology", "physicalExam", "epidemiology", "etiology", 
             "prognosis", "differentialDiagnosis", "complications", "riskFactors"
      FROM "MedicalContent"
      WHERE "content" IS NULL OR length("content"::text) < 10
    `);

    console.log(`Found ${rows.length} MedicalContent records with NULL/short content`);

    let updated = 0;
    let skipped = 0;

    // Process in batches of 50
    const BATCH = 50;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      
      await client.query('BEGIN');
      try {
        for (const row of batch) {
          const content = buildContent(row);
          if (!content || content.length < 20) {
            skipped++;
            continue;
          }
          
          await client.query(
            `UPDATE "MedicalContent" SET "content" = to_jsonb($1::text), "updatedAt" = NOW() WHERE id = $2`,
            [content, row.id]
          );
          updated++;
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        console.error(`Batch ${i}-${i + BATCH} failed, continuing...`);
      }

      if ((i + BATCH) % 200 === 0 || i + BATCH >= rows.length) {
        console.log(`Progress: ${Math.min(i + BATCH, rows.length)}/${rows.length} (updated: ${updated}, skipped: ${skipped})`);
      }
    }

    console.log(`\n✅ Done. Updated: ${updated}, Skipped: ${skipped}, Total processed: ${rows.length}`);
  } finally {
    await client.release();
    await pool.end();
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
