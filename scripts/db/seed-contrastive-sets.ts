import { prisma, runScript } from '../_shared/db.js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

interface ContrastiveSetData {
  symptom: string;
  conditions: string[];
  distinguishers: Record<string, string[]>;
  system?: string;
  difficulty?: string;
  highYield?: boolean;
}

async function main() {
  console.log('Seeding Contrastive Sets...');

  const dataPath = path.join(process.cwd(), 'data', 'contrastive-sets.json');
  const rawData = fs.readFileSync(dataPath, 'utf-8');
  const sets: ContrastiveSetData[] = JSON.parse(rawData);

  for (const set of sets) {
    console.log(`Processing set for: ${set.symptom}`);

    // Try to find IDs for the conditions
    // In a real scenario, we would look up MedicalContent or Condition IDs.
    // Since we don't have easy access to the exact IDs of mapped conditions in this context,
    // and the schema defines conditionIds as String[], we will store the names for now if IDs aren't found,
    // OR we could try to look them up.

    // I will attempt to lookup MedicalContent or Condition by name (case insensitive).
    const resolvedIds: string[] = [];

    for (const conditionName of set.conditions) {
      // Try to find a Condition by name
      const condition = await prisma.condition.findFirst({
        where: {
          name: { equals: conditionName, mode: 'insensitive' },
        },
      });

      let idToUse = conditionName; // Fallback

      if (condition) {
        idToUse = condition.id;
      } else {
        // Try MedicalContent? The schema for Condition relates to MedicalContent via MedicalContent ID?
        // Actually Condition has `content Json?`.
        // There is a MedicalContent model implied by "Array of 5 MedicalContent IDs".
        // Let's check if MedicalContent model exists in the schema I viewed earlier.
        // It does: `model MedicalContent`.
        const content = await prisma.medicalContent.findFirst({
          where: {
            condition: { equals: conditionName, mode: 'insensitive' },
          },
        });
        if (content) {
          idToUse = content.id;
        }
      }

      resolvedIds.push(idToUse);
    }

    // Upsert the set
    await prisma.contrastiveSet.deleteMany({
      where: { symptom: set.symptom },
    });

    await prisma.contrastiveSet.create({
      data: {

        id: uuidv4(),


        symptom: set.symptom,
        conditionIds: resolvedIds, // Using resolved IDs or names as fallback
        distinguishers: set.distinguishers,
        system: set.system || deriveSystem(set.symptom),
        difficulty: set.difficulty || 'medium',
        highYield: set.highYield || false,
      },
    });
  }

  console.log('Seeding completed.');
}

function deriveSystem(symptom: string): string {
  const s = symptom.toLowerCase();
  if (s.includes('chest') || s.includes('htn') || s.includes('palpitations')) return 'CARDIO';
  if (s.includes('dyspnea') || s.includes('cough') || s.includes('wheez')) return 'PULM';
  if (s.includes('abdominal') || s.includes('nausea') || s.includes('vomit')) return 'GI';
  if (s.includes('headache') || s.includes('neuro') || s.includes('seizure')) return 'NEURO';
  if (s.includes('back')) return 'MSK';
  return 'GEN';
}

// Use the runScript helper for proper connection handling
runScript(main);
