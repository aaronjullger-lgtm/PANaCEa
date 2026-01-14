import 'dotenv/config';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const pool = new Pool({
  connectionString: process.env.DIRECT_DATABASE_URL,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the families JSON file
const FAMILIES_PATH = path.join(process.cwd(), 'data', 'condition-families.json');

interface ConditionFamily {
  subtypes?: string[];
  complications?: string[];
  manifestations?: string[];
  variants?: string[];
}

async function consolidateHierarchy() {
  console.log('Starting condition hierarchy consolidation (using pg)...');
  const client = await pool.connect();

  try {
    const familiesData = fs.readFileSync(FAMILIES_PATH, 'utf-8');
    const families: Record<string, ConditionFamily> = JSON.parse(familiesData);

    await client.query('BEGIN');

    for (const [parentName, family] of Object.entries(families)) {
      console.log(`Processing family: ${parentName}`);

      // 1. Find the parent condition
      // Try exact match first
      let res = await client.query(
        'SELECT id, condition FROM "MedicalContent" WHERE lower(condition) = lower($1)',
        [parentName]
      );

      // If not found, try contains
      if (res.rows.length === 0) {
        res = await client.query(
          'SELECT id, condition FROM "MedicalContent" WHERE condition ILIKE $1',
          [`%${parentName}%`]
        );
      }

      if (res.rows.length === 0) {
        console.warn(`⚠️ Parent condition not found: "${parentName}". Skipping family.`);
        continue;
      }

      const parent = res.rows[0];
      console.log(`Found parent: ${parent.condition} (${parent.id})`);

      // Update parent canonical name
      await client.query(
        'UPDATE "MedicalContent" SET "canonicalName" = $1 WHERE id = $2',
        [parentName, parent.id]
      );

      // Helper to link children
      const linkChildren = async (children: string[], type: string) => {
        for (const childName of children) {
          const childRes = await client.query(
            'SELECT id, condition, "parentId" FROM "MedicalContent" WHERE lower(condition) = lower($1)',
            [childName]
          );

          if (childRes.rows.length > 0) {
            const child = childRes.rows[0];

            if (child.parentId && child.parentId !== parent.id) {
              console.warn(`  ⚠️ Child "${childName}" already has a different parent. Skipping.`);
              continue;
            }

            console.log(`  Linking ${type}: ${child.condition} -> ${parent.condition}`);
            await client.query(
              'UPDATE "MedicalContent" SET "parentId" = $1, "relationshipType" = $2, "canonicalName" = $3 WHERE id = $4',
              [parent.id, type, parentName, child.id]
            );
          } else {
            console.warn(`  Has child listed but not found in DB: "${childName}"`);
          }
        }
      };

      if (family.subtypes) await linkChildren(family.subtypes, 'subtype');
      if (family.complications) await linkChildren(family.complications, 'complication');
      if (family.manifestations) await linkChildren(family.manifestations, 'manifestation');
      if (family.variants) await linkChildren(family.variants, 'variant');
    }

    await client.query('COMMIT');
    console.log('Hierarchy consolidation complete!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error consolidating hierarchy:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

consolidateHierarchy();
