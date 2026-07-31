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

async function main() {
  const c = await pool.connect();
  try {
    // 1. Table counts (already have, but re-run for completeness)
    const tables = [
      'Condition', 'MedicalContent', 'MedicalContentStructured', 'MedicalContentEmbedding',
      'Question', 'PreGeneratedQuestion', 'Drug', 'Guideline', 'ClinicalPearl',
      'FirstLineTreatment', 'ImagingStudy', 'LabCase', 'ECGPattern', 'Buzzword',
      'ConfusionPair', 'AnatomyStructure', 'DifferentialDiagnosis', 'HistoryComponent',
      'VitalSignRange', 'Card', 'ReviewLog', 'QuestionAttempt', 'User', 'DrugConditionLink',
      'FindingConditionLink', 'AnatomyConditionLink', 'ImagingConditionLink', 'TreatmentConditionLink'
    ];
    
    console.log('\n=== TABLE ROW COUNTS ===');
    for (const t of tables) {
      const r = await c.query(`SELECT COUNT(*) as cnt FROM "${t}"`);
      console.log(`${t}: ${r.rows[0].cnt}`);
    }

    // 2. Condition quality
    console.log('\n=== CONDITION QUALITY ===');
    let r = await c.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE "clinicalSummary" IS NULL OR "clinicalSummary" = '') as no_summary,
        COUNT(*) FILTER (WHERE "system" IS NULL OR "system" = '') as no_system,
        COUNT(*) FILTER (WHERE "commonSymptoms" IS NULL OR cardinality("commonSymptoms") = 0) as no_symptoms,
        COUNT(*) FILTER (WHERE "commonSigns" IS NULL OR cardinality("commonSigns") = 0) as no_signs,
        COUNT(*) FILTER (WHERE "keywords" IS NULL OR cardinality("keywords") = 0) as no_keywords
      FROM "Condition"
    `);
    console.log(JSON.stringify(r.rows[0], null, 2));

    // 3. Question quality
    console.log('\n=== QUESTION QUALITY ===');
    r = await c.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE "stem" IS NULL OR length("stem") < 20) as short_stem,
        COUNT(*) FILTER (WHERE "explanation" IS NULL OR length("explanation") < 20) as short_explanation,
        COUNT(*) FILTER (WHERE "correctOptionIndex" IS NULL) as no_correct_idx,
        COUNT(*) FILTER (WHERE "conditionId" IS NULL) as no_condition
      FROM "Question"
    `);
    console.log(JSON.stringify(r.rows[0], null, 2));

    // 4. MedicalContent quality
    console.log('\n=== MEDICAL CONTENT QUALITY ===');
    r = await c.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE "conditionId" IS NULL) as no_condition_id,
        COUNT(*) FILTER (WHERE "title" IS NULL OR "title" = '') as no_title,
        COUNT(*) FILTER (WHERE "content" IS NULL OR length("content") < 50) as short_content,
        COUNT(*) FILTER (WHERE "content" LIKE '%<%') as has_html_tags,
        COUNT(*) FILTER (WHERE "content" LIKE '%**%') as has_markdown_bold
      FROM "MedicalContent"
    `);
    console.log(JSON.stringify(r.rows[0], null, 2));

    // 5. Embedding coverage
    console.log('\n=== EMBEDDING COVERAGE ===');
    r = await c.query(`
      SELECT 
        COUNT(DISTINCT "conditionId") as with_embedding,
        (SELECT COUNT(DISTINCT "conditionId") FROM "MedicalContent") as total_conditions
      FROM "MedicalContent" WHERE "embedding" IS NOT NULL
    `);
    console.log(`With embedding: ${r.rows[0].with_embedding} / ${r.rows[0].total_conditions}`);

    r = await c.query(`SELECT COUNT(*) as cnt FROM "MedicalContentEmbedding"`);
    console.log(`MedicalContentEmbedding rows: ${r.rows[0].cnt}`);

    // 6. Drug quality
    console.log('\n=== DRUG QUALITY ===');
    r = await c.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE "mechanismOfAction" IS NULL OR "mechanismOfAction" = '') as no_moa,
        COUNT(*) FILTER (WHERE "indications" IS NULL OR cardinality("indications") = 0) as no_indications,
        COUNT(*) FILTER (WHERE "contraindications" IS NULL OR cardinality("contraindications") = 0) as no_contraindications
      FROM "Drug"
    `);
    console.log(JSON.stringify(r.rows[0], null, 2));

    // 7. Guideline gap (only 4!)
    console.log('\n=== GUIDELINES (critically low) ===');
    r = await c.query(`SELECT id, "topic", "system" FROM "Guideline"`);
    console.log(`Total: ${r.rows.length}`);
    r.rows.forEach(row => console.log(`  - ${row.topic} (${row.system})`));

    // 8. Orphan FK links
    console.log('\n=== ORPHAN FK LINKS ===');
    r = await c.query(`
      SELECT
        (SELECT COUNT(*) FROM "DrugConditionLink" dcl LEFT JOIN "Condition" c ON dcl."conditionId" = c.id WHERE c.id IS NULL) as orphan_drug,
        (SELECT COUNT(*) FROM "FindingConditionLink" fcl LEFT JOIN "Condition" c ON fcl."conditionId" = c.id WHERE c.id IS NULL) as orphan_finding,
        (SELECT COUNT(*) FROM "AnatomyConditionLink" acl LEFT JOIN "Condition" c ON acl."conditionId" = c.id WHERE c.id IS NULL) as orphan_anatomy,
        (SELECT COUNT(*) FROM "ImagingConditionLink" icl LEFT JOIN "Condition" c ON icl."conditionId" = c.id WHERE c.id IS NULL) as orphan_imaging,
        (SELECT COUNT(*) FROM "TreatmentConditionLink" tcl LEFT JOIN "Condition" c ON tcl."conditionId" = c.id WHERE c.id IS NULL) as orphan_treatment
    `);
    console.log(JSON.stringify(r.rows[0], null, 2));

    // 9. Duplicate conditions
    console.log('\n=== DUPLICATE CONDITIONS ===');
    r = await c.query(`
      SELECT name, "system", COUNT(*) as cnt
      FROM "Condition"
      GROUP BY name, "system"
      HAVING COUNT(*) > 1
      ORDER BY cnt DESC
      LIMIT 10
    `);
    console.log(`Duplicate groups: ${r.rows.length}`);
    r.rows.forEach(row => console.log(`  "${row.name}" in ${row.system}: ${row.cnt}x`));

    // 10. MedicalContentStructured check
    console.log('\n=== MEDICAL CONTENT STRUCTURED ===');
    r = await c.query(`SELECT COUNT(*) as cnt FROM "MedicalContentStructured"`);
    console.log(`MCStructured rows: ${r.rows[0].cnt}`);

    // 11. Table sizes
    console.log('\n=== TOP 15 TABLE SIZES ===');
    r = await c.query(`
      SELECT relname as tbl, 
        pg_size_pretty(pg_total_relation_size(relid)) as total_size
      FROM pg_stat_user_tables 
      WHERE relname NOT LIKE '_prisma%'
      ORDER BY pg_total_relation_size(relid) DESC
      LIMIT 15
    `);
    r.rows.forEach(row => console.log(`  ${row.tbl}: ${row.total_size}`));

    // 12. System distribution across conditions
    console.log('\n=== CONDITION SYSTEM DISTRIBUTION ===');
    r = await c.query(`
      SELECT "system", COUNT(*) as cnt
      FROM "Condition"
      GROUP BY "system"
      ORDER BY cnt DESC
      LIMIT 15
    `);
    r.rows.forEach(row => console.log(`  ${row.system}: ${row.cnt}`));

  } finally {
    await c.end();
    await pool.end();
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
