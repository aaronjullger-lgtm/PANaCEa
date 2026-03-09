#!/usr/bin/env tsx
/**
 * Seed diagnostic puzzles for the daily mini-game.
 * Creates a set of DiagnosticPuzzle entries linked to existing Conditions.
 */

import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { v4 as uuidv4 } from 'uuid';

// Helper to generate deterministic placeholder clues for a condition
function generateClues(conditionName: string, system: string): string[] {
  const clues = [
    `A patient presents with symptoms related to ${conditionName}.`, // clue1
    `History includes typical risk factors for ${conditionName}.`, // clue2
    `Associated symptoms may include common manifestations of ${conditionName}.`, // clue3
    `Physical exam findings consistent with ${conditionName}.`, // clue4
    `Lab and imaging results support the diagnosis of ${conditionName}.`, // clue5
    `Pathophysiology involves characteristic mechanisms of ${conditionName}.`, // clue6
  ];
  return clues;
}

async function ensureConditions() {
  const existingCount = await prisma.condition.count();
  if (existingCount > 0) {
    console.log(`Found ${existingCount} existing conditions, skipping creation.`);
    return;
  }

  const highYieldConditions = [
    { id: uuidv4(), name: 'Myocardial Infarction', system: 'Cardiovascular', status: 'published' },
    { id: uuidv4(), name: 'Heart Failure', system: 'Cardiovascular', status: 'published' },
    { id: uuidv4(), name: 'Asthma', system: 'Pulmonary', status: 'published' },
    { id: uuidv4(), name: 'COPD', system: 'Pulmonary', status: 'published' },
    { id: uuidv4(), name: 'Gastroesophageal Reflux Disease', system: 'Gastrointestinal', status: 'published' },
    { id: uuidv4(), name: 'Inflammatory Bowel Disease', system: 'Gastrointestinal', status: 'published' },
    { id: uuidv4(), name: 'Osteoarthritis', system: 'Musculoskeletal', status: 'published' },
    { id: uuidv4(), name: 'Rheumatoid Arthritis', system: 'Musculoskeletal', status: 'published' },
    { id: uuidv4(), name: 'Stroke', system: 'Neurological', status: 'published' },
    { id: uuidv4(), name: 'Migraine', system: 'Neurological', status: 'published' },
    { id: uuidv4(), name: 'Diabetes Mellitus', system: 'Endocrine', status: 'published' },
    { id: uuidv4(), name: 'Hypertension', system: 'Cardiovascular', status: 'published' },
    { id: uuidv4(), name: 'Pneumonia', system: 'Pulmonary', status: 'published' },
    { id: uuidv4(), name: 'Appendicitis', system: 'Gastrointestinal', status: 'published' },
    { id: uuidv4(), name: 'Deep Vein Thrombosis', system: 'Hematologic', status: 'published' },
  ];

  console.log('Creating high-yield conditions...');
  for (const condition of highYieldConditions) {
    try {
      await prisma.condition.create({
        data: condition,
      });
      console.log(`Created condition: ${condition.name} (${condition.system})`);
    } catch (error) {
      console.error(`Failed to create condition ${condition.name}:`, error.message);
    }
  }
  console.log('Condition seeding complete.');
}

async function seedDiagnosticPuzzles() {
  console.log('Seeding diagnostic puzzles...');

  // Ensure we have some conditions
  await ensureConditions();

  // Fetch some high-yield conditions (limit 30)
  const conditions = await prisma.condition.findMany({
    where: {
      // status: 'published', // many conditions may have null status, so we ignore for now
      // system filter removed to include all systems for initial seeding
    },
    take: 30,
    select: { id: true, name: true, system: true },
  });

  console.log(`Found ${conditions.length} conditions.`);

  const puzzles = [];
  for (const condition of conditions) {
    const clues = generateClues(condition.name, condition.system);
    const puzzle = {
      id: uuidv4(),
      conditionId: condition.id,
      clue1: clues[0],
      clue2: clues[1],
      clue3: clues[2],
      clue4: clues[3],
      clue5: clues[4],
      clue6: clues[5],
      title: `Daily Diagnostic: ${condition.name}`,
      difficulty: Math.floor(Math.random() * 5) + 1, // 1-5
      system: condition.system,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    puzzles.push(puzzle);
  }

  // Insert puzzles
  for (const puzzle of puzzles) {
    try {
      await prisma.diagnosticPuzzle.create({
        data: puzzle,
      });
      console.log(`Created puzzle for ${puzzle.title}`);
    } catch (error) {
      // Possibly duplicate conditionId (ignore)
      console.error(`Failed to create puzzle for ${puzzle.conditionId}:`, error.message);
    }
  }

  console.log('Diagnostic puzzles seeded.');
}

seedDiagnosticPuzzles()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });