#!/usr/bin/env tsx
/**
 * Seed script for MedicalTaxonomy and SystemMapping tables.
 * Populates with NCCPA blueprint weights and system definitions.
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { ABBREVIATION_TO_TOPIC_MAP } from '../src/constants';
import { NCCPA_BLUEPRINT_WEIGHTS } from '../lib/nccpa-question-weighting';

// Load environment variables
config();

const prisma = new PrismaClient();

async function seedTaxonomy() {
  console.log('Seeding MedicalTaxonomy...');

  // Prepare taxonomy entries
  const taxonomies = Object.entries(ABBREVIATION_TO_TOPIC_MAP).map(([code, name]) => {
    const weightPercent = NCCPA_BLUEPRINT_WEIGHTS[code] || 0;
    const weight = weightPercent / 100; // Convert percentage to decimal
    return {
      code,
      name,
      description: `${name} system for PANCE preparation.`,
      weight,
      isActive: true,
    };
  });

  // Insert or update
  for (const data of taxonomies) {
    await prisma.medicalTaxonomy.upsert({
      where: { code: data.code },
      update: { name: data.name, description: data.description, weight: data.weight, isActive: data.isActive },
      create: data,
    });
    console.log(`✓ ${data.code} (${data.name})`);
  }

  console.log(`Seeded ${taxonomies.length} taxonomy entries.`);

  // Seed SystemMapping with subcategories from PANCE Blueprint (optional)
  // For now, we'll create a placeholder mapping for each taxonomy.
  // In the future, this can be populated from panceblueprint.md or other sources.
  console.log('Seeding SystemMapping (placeholder)...');
  const mappings = [
    // Example: Cardiovascular subcategories
    { taxonomyCode: 'CV', subcategory: 'Arrhythmias', canonicalName: 'Arrhythmias', aliases: [], searchKeywords: [], blueprintTags: [] },
    { taxonomyCode: 'CV', subcategory: 'Heart Failure', canonicalName: 'Heart Failure', aliases: [], searchKeywords: [], blueprintTags: [] },
    { taxonomyCode: 'CV', subcategory: 'Coronary Artery Disease', canonicalName: 'Coronary Artery Disease', aliases: [], searchKeywords: [], blueprintTags: [] },
    // Add more as needed...
  ];

  for (const mapping of mappings) {
    await prisma.systemMapping.upsert({
      where: { taxonomyCode_subcategory: { taxonomyCode: mapping.taxonomyCode, subcategory: mapping.subcategory } },
      update: mapping,
      create: mapping,
    });
  }

  console.log(`Seeded ${mappings.length} system mappings.`);
}

async function main() {
  try {
    await seedTaxonomy();
    console.log('Seed completed successfully.');
  } catch (error) {
    console.error('Error during seed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();