#!/usr/bin/env tsx
/**
 * SPRINT 10: Database Validation & Health Check
 * 
 * Validates:
 * 1. Hierarchy integrity (parent_category references valid subcategories)
 * 2. System-subcategory consistency
 * 3. Coverage statistics
 * 4. Duplicate detection
 */

import { prisma, disconnectPrisma } from './helpers/prisma-client';

async function validateDatabase() {
  console.log('🔍 SPRINT 10: Database Validation & Health Check\n');
  
  // Get all conditions
  const conditions = await prisma.condition.findMany({
    select: {
      id: true,
      name: true,
      system: true,
      subcategory: true,
      parent_category: true
    }
  });
  
  console.log(`📊 Database Overview:`);
  console.log(`  Total Conditions: ${conditions.length}\n`);
  
  // 1. Hierarchy integrity check
  console.log('🔗 Hierarchy Integrity:\n');
  
  const withSubcategory = conditions.filter(c => c.subcategory);
  const withParent = conditions.filter(c => c.parent_category);
  const with4Level = conditions.filter(c => c.subcategory && c.parent_category);
  
  console.log(`  Conditions with subcategory: ${withSubcategory.length} (${((withSubcategory.length / conditions.length) * 100).toFixed(1)}%)`);
  console.log(`  Conditions with parent_category: ${withParent.length} (${((withParent.length / conditions.length) * 100).toFixed(1)}%)`);
  console.log(`  Conditions with 4-level hierarchy: ${with4Level.length} (${((with4Level.length / conditions.length) * 100).toFixed(1)}%)\n`);
  
  // 2. System distribution
  console.log('📈 Distribution by System:\n');
  
  const bySystem = conditions.reduce((acc, c) => {
    acc[c.system] = (acc[c.system] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const sortedSystems = Object.entries(bySystem).sort((a, b) => b[1] - a[1]);
  
  for (const [system, count] of sortedSystems) {
    const pct = ((count / conditions.length) * 100).toFixed(1);
    console.log(`  ${system}: ${count} (${pct}%)`);
  }
  
  console.log('\n');
  
  // 3. Hierarchy validation - check for orphaned parent categories
  console.log('🔍 Validating Parent Categories:\n');
  
  const parentCategoryIssues: string[] = [];
  
  for (const condition of withParent) {
    // Parent category should match another condition's subcategory in same system
    // OR be a valid blueprint top-level category
    const validTopLevel = [
      'Eye Disorders', 'Ear Disorders', 'Nose/Sinus Disorders', 'Oropharyngeal Disorders',
      'Lower Extremity Disorders', 'Upper Extremity Disorders', 'Spinal Disorders',
      'Infectious Diseases', 'Coronary Artery Disease', 'Pneumonias', 'Inflammatory Bowel Disease'
    ];
    
    if (!validTopLevel.includes(condition.parent_category!)) {
      // Check if it matches a subcategory
      const matchingSubcat = conditions.find(c => 
        c.system === condition.system && 
        c.subcategory === condition.parent_category
      );
      
      if (!matchingSubcat) {
        parentCategoryIssues.push(`${condition.name} → parent: "${condition.parent_category}" (${condition.system})`);
      }
    }
  }
  
  if (parentCategoryIssues.length > 0) {
    console.log(`  ⚠️  Found ${parentCategoryIssues.length} potential issues:`);
    parentCategoryIssues.slice(0, 10).forEach(issue => console.log(`    ${issue}`));
    if (parentCategoryIssues.length > 10) {
      console.log(`    ... and ${parentCategoryIssues.length - 10} more`);
    }
  } else {
    console.log(`  ✅ All parent categories are valid`);
  }
  
  console.log('\n');
  
  // 4. Check for duplicates
  console.log('🔎 Checking for Duplicates:\n');
  
  const nameMap: Record<string, string[]> = {};
  for (const condition of conditions) {
    const key = condition.name.toLowerCase().replace(/[^\w\s]/g, '').trim();
    if (!nameMap[key]) nameMap[key] = [];
    nameMap[key].push(condition.name);
  }
  
  const duplicates = Object.entries(nameMap).filter(([_, names]) => names.length > 1);
  
  if (duplicates.length > 0) {
    console.log(`  ⚠️  Found ${duplicates.length} potential duplicates:`);
    duplicates.slice(0, 5).forEach(([key, names]) => {
      console.log(`    "${names[0]}" (${names.length} variations)`);
    });
  } else {
    console.log(`  ✅ No duplicates found`);
  }
  
  console.log('\n');
  
  // 5. 4-Level hierarchy breakdown
  console.log('📊 4-Level Hierarchy Details:\n');
  
  const hierarchyGroups = with4Level.reduce((acc, c) => {
    const key = `${c.system} → ${c.parent_category} → ${c.subcategory}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const sortedHierarchy = Object.entries(hierarchyGroups).sort((a, b) => b[1] - a[1]);
  
  for (const [path, count] of sortedHierarchy.slice(0, 20)) {
    console.log(`  ${path}: ${count}`);
  }
  
  if (sortedHierarchy.length > 20) {
    console.log(`  ... and ${sortedHierarchy.length - 20} more paths`);
  }
  
  console.log('\n');
  
  // 6. Sync check - Condition vs MedicalContent
  console.log('🔄 Checking Condition ↔ MedicalContent Sync:\n');
  
  const medicalContentCount = await prisma.medicalContent.count();
  const conditionsWithContent = await prisma.medicalContent.groupBy({
    by: ['conditionId'],
    _count: true
  });
  
  console.log(`  Condition table: ${conditions.length} records`);
  console.log(`  MedicalContent table: ${medicalContentCount} records`);
  console.log(`  Conditions with content: ${conditionsWithContent.length}`);
  console.log(`  Conditions without content: ${conditions.length - conditionsWithContent.length}\n`);
  
  // Final summary
  console.log('✅ Validation Complete\n');
  console.log('📋 Summary:');
  console.log(`  - ${conditions.length} total conditions across ${Object.keys(bySystem).length} systems`);
  console.log(`  - ${with4Level.length} conditions with 4-level hierarchy (${((with4Level.length / conditions.length) * 100).toFixed(1)}%)`);
  console.log(`  - ${parentCategoryIssues.length} parent category issues`);
  console.log(`  - ${duplicates.length} potential duplicates`);
  console.log(`  - ${conditions.length - conditionsWithContent.length} conditions need content\n`);
}

async function main() {
  try {
    await validateDatabase();
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await disconnectPrisma();
  }
}

main().catch(console.error);
