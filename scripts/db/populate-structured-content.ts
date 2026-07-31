/**
 * Populate MedicalContentStructured from MedicalContent structured fields.
 * 
 * MCStructured is completely empty (0 rows). It has columns:
 *   clinical_pearls (ARRAY), history_key_features (ARRAY), physical_exam_findings (ARRAY),
 *   diagnostic_labs (ARRAY), gold_standard (text), treatment_first_line (text),
 *   parsedAt, parserVersion, confidence
 * 
 * SAFE: only inserts where MedicalContentStructured doesn't exist for a given medicalContentId.
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
  clinical_pearls: string | null;
  physicalExam: string | null;
  treatment: string | null;
  overview: string | null;
  symptoms: string | null;
  differentialDiagnosis: string | null;
}

function parseList(field: any): string[] {
  if (!field) return [];
  if (Array.isArray(field)) {
    return field.filter(s => typeof s === 'string' && s.length > 2 && s.length < 200);
  }
  if (typeof field === 'string') {
    if (field.startsWith('[')) {
      try { return JSON.parse(field).filter((s: any) => typeof s === 'string' && s.length > 2 && s.length < 200); } catch { /* fall through */ }
    }
    return field
      .split(/[\n•\-\*]+/)
      .map(s => s.trim())
      .filter(s => s.length > 2 && s.length < 200);
  }
  return [];
}

function extractPhysicalExamFindings(pe: string | null): string[] {
  if (!pe) return [];
  return parseList(pe);
}

async function main() {
  const client = await pool.connect();
  try {
    // Get MC records that don't have structured entries
    const { rows } = await client.query<MCRow>(`
      SELECT mc.id, mc."clinical_pearls", mc."physicalExam", mc."treatment", 
             mc."overview", mc."symptoms", mc."differentialDiagnosis"
      FROM "MedicalContent" mc
      WHERE NOT EXISTS (
        SELECT 1 FROM "MedicalContentStructured" mcs 
        WHERE mcs."medicalContentId" = mc.id
      )
    `);

    console.log(`Found ${rows.length} MedicalContent records without structured entries`);

    let inserted = 0;
    const BATCH = 100;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      await client.query('BEGIN');
      try {
        for (const row of batch) {
          const clinicalPearls = parseList(row.clinical_pearls);
          const peFindings = extractPhysicalExamFindings(row.physicalExam);
          const historyFeatures = parseList(row.symptoms);

          // Extract first-line treatment from treatment text
          let firstLine = '';
          if (row.treatment) {
            const txMatch = row.treatment.match(/(?:first.?line|initial).{0,200}/i);
            firstLine = txMatch ? txMatch[0].slice(0, 200) : row.treatment.slice(0, 200);
          }

          await client.query(`
            INSERT INTO "MedicalContentStructured" (
              id, "medicalContentId", "clinical_pearls", "history_key_features",
              "physical_exam_findings", "diagnostic_labs", "gold_standard",
              "treatment_first_line", "parsedAt", "parserVersion", confidence
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, NOW(), 'db-populate-v1', 0.8
            )
            ON CONFLICT ("medicalContentId") DO NOTHING
          `, [
            `mcs_${row.id}`,
            row.id,
            clinicalPearls,
            historyFeatures,
            peFindings,
            [], // diagnostic_labs — not in current schema
            row.differentialDiagnosis?.slice(0, 200) || '',
            firstLine
          ]);
          inserted++;
        }
        await client.query('COMMIT');
      } catch (e: any) {
        await client.query('ROLLBACK');
        console.error(`Batch error: ${e.message}`);
      }

      if ((i + BATCH) % 500 === 0 || i + BATCH >= rows.length) {
        console.log(`Progress: ${Math.min(i + BATCH, rows.length)}/${rows.length} (inserted: ${inserted})`);
      }
    }

    console.log(`\n✅ Done. Inserted: ${inserted}/${rows.length}`);
  } finally {
    await client.release();
    await pool.end();
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
