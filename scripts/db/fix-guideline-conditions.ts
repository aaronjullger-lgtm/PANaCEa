/**
 * Generate high-yield PANCE guidelines and link existing ones.
 * 
 * Phase 1: Link existing 4 guidelines to their Conditions by name matching.
 * Phase 2: Generate ~50 treatment/diagnostic guidelines via Gemini API.
 * 
 * Uses the Google Generative AI REST API directly (no SDK dependency).
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

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash';

// NCCPA high-yield guideline topics by organ system
const GUIDELINE_TOPICS = [
  // Cardiovascular
  { system: 'CV', topic: 'Hypertension', guideline: 'ACC/AHA 2017 Hypertension Guidelines', type: 'treatment' },
  { system: 'CV', topic: 'Heart Failure', guideline: 'ACC/AHA 2022 Heart Failure Guidelines', type: 'treatment' },
  { system: 'CV', topic: 'Atrial Fibrillation', guideline: 'AHA/ACC/HRS 2019 AF Guidelines', type: 'treatment' },
  { system: 'CV', topic: 'Chest Pain', guideline: 'ACC/AHA 2021 Chest Pain Evaluation', type: 'diagnostic' },
  { system: 'CV', topic: 'ACS', guideline: 'ACC/AHA STEMI/NSTEMI Guidelines', type: 'treatment' },
  { system: 'CV', topic: 'DVT/PE', guideline: 'CHEST 2021 VTE Guidelines', type: 'treatment' },
  { system: 'CV', topic: 'Lipid Management', guideline: 'ACC/AHA 2018 Cholesterol Guidelines', type: 'treatment' },
  { system: 'CV', topic: 'Aortic Stenosis', guideline: 'ACC/AHA 2020 Valvular Heart Disease', type: 'treatment' },
  // Pulmonary
  { system: 'PULM', topic: 'Asthma', guideline: 'GINA 2023 Asthma Management', type: 'treatment' },
  { system: 'PULM', topic: 'COPD', guideline: 'GOLD 2023 COPD Guidelines', type: 'treatment' },
  { system: 'PULM', topic: 'Community-Acquired Pneumonia', guideline: 'IDSA/ATS 2019 CAP Guidelines', type: 'treatment' },
  { system: 'PULM', topic: 'Pulmonary Embolism', guideline: 'ESC 2019 PE Guidelines', type: 'treatment' },
  { system: 'PULM', topic: 'Sarcoidosis', guideline: 'ATS/ERS/JRS/ALAT 2020', type: 'treatment' },
  // GI
  { system: 'GI', topic: 'GERD', guideline: 'ACG 2022 GERD Guidelines', type: 'treatment' },
  { system: 'GI', topic: 'Cirrhosis', guideline: 'AASLD 2024 Cirrhosis Management', type: 'treatment' },
  { system: 'GI', topic: 'IBD', guideline: 'ACG 2024 Ulcerative Colitis / Crohn\'s', type: 'treatment' },
  { system: 'GI', topic: 'Pancreatitis', guideline: 'AGA 2018 Acute Pancreatitis', type: 'treatment' },
  { system: 'GI', topic: 'Hepatitis C', guideline: 'AASLD/IDSA 2023 HCV Guidelines', type: 'treatment' },
  // Endocrine
  { system: 'ENDO', topic: 'Diabetes Type 2', guideline: 'ADA 2024 Standards of Care', type: 'treatment' },
  { system: 'ENDO', topic: 'Thyroid Nodules', guideline: 'ATA 2015 Thyroid Nodule Management', type: 'diagnostic' },
  { system: 'ENDO', topic: 'Hyperthyroidism', guideline: 'ATA 2016 Hyperthyroidism', type: 'treatment' },
  { system: 'ENDO', topic: 'Adrenal Insufficiency', guideline: 'ES 2016 Adrenal Insufficiency', type: 'treatment' },
  { system: 'ENDO', topic: 'Osteoporosis', guideline: 'Endocrine Society 2020', type: 'treatment' },
  // ID
  { system: 'ID', topic: 'Sepsis', guideline: 'Surviving Sepsis Campaign 2021', type: 'treatment' },
  { system: 'ID', topic: 'UTI', guideline: 'IDSA 2010 UTI Guidelines', type: 'treatment' },
  { system: 'ID', topic: 'HIV', guideline: 'DHHS 2023 ART Guidelines', type: 'treatment' },
  { system: 'ID', topic: 'MRSA', guideline: 'IDSA 2011 MRSA Guidelines', type: 'treatment' },
  { system: 'ID', topic: 'Lyme Disease', guideline: 'IDSA/AAN 2020 Lyme', type: 'treatment' },
  // Nephrology
  { system: 'RENAL', topic: 'CKD', guideline: 'KDIGO 2024 CKD Guidelines', type: 'treatment' },
  { system: 'RENAL', topic: 'AKI', guideline: 'KDIGO 2012 AKI Guidelines', type: 'treatment' },
  { system: 'RENAL', topic: 'Nephrotic Syndrome', guideline: 'KDIGO 2021 Glomerular Diseases', type: 'treatment' },
  // Neuro
  { system: 'NEURO', topic: 'Stroke', guideline: 'AHA/ASA 2019 Stroke Guidelines', type: 'treatment' },
  { system: 'NEURO', topic: 'Epilepsy', guideline: 'AAN 2015 Epilepsy Guidelines', type: 'treatment' },
  { system: 'NEURO', topic: 'Migraine', guideline: 'AHS 2019 Migraine Prevention', type: 'treatment' },
  { system: 'NEURO', topic: 'GBS', guideline: 'AAN 2022 GBS Guidelines', type: 'treatment' },
  // HEME
  { system: 'HEME', topic: 'Iron Deficiency Anemia', guideline: 'ASH 2020 Iron Deficiency', type: 'treatment' },
  { system: 'HEME', topic: 'DVT Anticoagulation', guideline: 'ASH 2020 VTE Treatment', type: 'treatment' },
  { system: 'HEME', topic: 'Sickle Cell', guideline: 'NHLBI 2014 SCD Guidelines', type: 'treatment' },
  // MSK
  { system: 'MSK', topic: 'Gout', guideline: 'ACR 2020 Gout Guidelines', type: 'treatment' },
  { system: 'MSK', topic: 'RA', guideline: 'ACR 2021 RA Treatment', type: 'treatment' },
  { system: 'MSK', topic: 'LBP', guideline: 'ACP 2017 Low Back Pain', type: 'treatment' },
  // Psych
  { system: 'PSYCH', topic: 'Depression', guideline: 'APA 2019 MDD Guidelines', type: 'treatment' },
  { system: 'PSYCH', topic: 'Anxiety', guideline: 'APA 2023 GAD Guidelines', type: 'treatment' },
  { system: 'PSYCH', topic: 'Bipolar', guideline: 'APA 2002 Bipolar Guidelines', type: 'treatment' },
  { system: 'PSYCH', topic: 'Schizophrenia', guideline: 'APA 2020 Schizophrenia', type: 'treatment' },
  // Derm
  { system: 'DERM', topic: 'Psoriasis', guideline: 'AAD/NPF 2021 Psoriasis', type: 'treatment' },
  { system: 'DERM', topic: 'Melanoma', guideline: 'NCCN 2024 Melanoma', type: 'diagnostic' },
  // GU/REPRO
  { system: 'GU', topic: 'BPH', guideline: 'AUA 2021 BPH Guidelines', type: 'treatment' },
  { system: 'GU', topic: 'Kidney Stones', guideline: 'AUA/Endourology 2023 Stones', type: 'treatment' },
  { system: 'REPRO', topic: 'Prenatal Care', guideline: 'ACOG 2023 Prenatal Care', type: 'treatment' },
];

interface ConditionRow { id: string; name: string; system: string; }

async function linkExistingGuidelines(client: any): Promise<number> {
  const { rows: guidelines } = await client.query('SELECT id, name FROM "Guideline" WHERE "conditionId" IS NULL');
  const { rows: conditions } = await client.query<ConditionRow>('SELECT id, name, "system" FROM "Condition"');
  
  let linked = 0;
  for (const g of guidelines) {
    const nameLower = g.name.toLowerCase();
    // Try to find matching condition
    const match = conditions.find(c => 
      nameLower.includes(c.name.toLowerCase()) || 
      c.name.toLowerCase().includes(nameLower.split(' ')[0])
    );
    if (match) {
      await client.query('UPDATE "Guideline" SET "conditionId" = $1 WHERE id = $2', [match.id, g.id]);
      console.log(`  Linked: ${g.name} → ${match.name}`);
      linked++;
    }
  }
  return linked;
}

async function generateGuidelinesViaGemini(topics: typeof GUIDELINE_TOPICS): Promise<any[]> {
  const batchSize = 10;
  const results: any[] = [];

  for (let i = 0; i < topics.length; i += batchSize) {
    const batch = topics.slice(i, i + batchSize);
    
    const prompt = `For each of these PANCE-high-yield medical topics, provide a clinical guideline entry as JSON array.
Each entry should have:
- "name": guideline name (e.g., "ACC/AHA Heart Failure Guidelines")
- "organization": issuing body
- "type": "treatment" or "diagnostic" or "screening"
- "grade": evidence grade (A, B, C)
- "frequency": key recommendation
- "targetPopulation": who it applies to
- "evidenceLevel": level of evidence
- "panceYield": 1-5 PANCE relevance score
- "conditionSearch": the condition name to match in our database

Topics:
${batch.map((t, idx) => `${idx + 1}. ${t.topic} (${t.system} system) — ${t.guideline} — type: ${t.type}`).join('\n')}

Return ONLY valid JSON array, no markdown, no explanation.`;

    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 4000 }
          })
        }
      );

      const data = await resp.json() as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        results.push(...parsed);
        console.log(`  Gemini batch ${i / batchSize + 1}: got ${parsed.length} guidelines`);
      }
    } catch (e: any) {
      console.error(`  Gemini batch ${i / batchSize + 1} failed: ${e.message}`);
    }

    // Rate limit: 15 RPM for free tier
    if (i + batchSize < topics.length) {
      await new Promise(r => setTimeout(r, 4500));
    }
  }

  return results;
}

async function main() {
  const client = await pool.connect();
  try {
    // Phase 1: Link existing guidelines
    console.log('=== Phase 1: Link existing guidelines ===');
    const linked = await linkExistingGuidelines(client);
    console.log(`Linked ${linked} existing guidelines\n`);

    // Phase 2: Generate new guidelines via Gemini
    console.log('=== Phase 2: Generate guidelines via Gemini ===');
    
    // Get all conditions for name matching
    const { rows: conditions } = await client.query<ConditionRow>(
      'SELECT id, name, "system" FROM "Condition"'
    );

    const generated = await generateGuidelinesViaGemini(GUIDELINE_TOPICS);
    console.log(`\nGenerated ${generated.length} guidelines from Gemini\n`);

    // Phase 3: Insert into database
    console.log('=== Phase 3: Insert guidelines ===');
    let inserted = 0;
    await client.query('BEGIN');
    try {
      for (const g of generated) {
        // Find matching condition
        const searchName = (g.conditionSearch || g.name || '').toLowerCase();
        const match = conditions.find(c => 
          c.name.toLowerCase() === searchName ||
          searchName.includes(c.name.toLowerCase()) ||
          c.name.toLowerCase().includes(searchName.split(' ')[0])
        );

        const id = `guideline_${(g.name || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 60)}`;

        await client.query(`
          INSERT INTO "Guideline" (id, name, type, organization, "conditionId", grade, frequency, 
            "targetPopulation", "evidenceLevel", "panceYield", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
        `, [
          id,
          g.name || g.guideline || '',
          g.type || 'treatment',
          g.organization || '',
          match?.id || null,
          g.grade || 'C',
          g.frequency || '',
          g.targetPopulation || '',
          g.evidenceLevel || '',
          g.panceYield || 3
        ]);
        inserted++;
      }
      await client.query('COMMIT');
    } catch (e: any) {
      await client.query('ROLLBACK');
      console.error(`Insert error: ${e.message}`);
    }

    console.log(`✅ Inserted ${inserted} new guidelines`);

    // Final count
    const { rows: [{ cnt }] } = await client.query('SELECT COUNT(*) as cnt FROM "Guideline"');
    console.log(`Total guidelines: ${cnt}`);
  } finally {
    await client.release();
    await pool.end();
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
