#!/usr/bin/env tsx
/**
 * Test Drug API Endpoints
 * Verifies the drug library queries work correctly
 */

import { prisma, disconnectPrisma } from './helpers/prisma-client.js';

async function testDrugClasses() {
  console.log('\n🧪 Testing Drug Classes Query...\n');
  
  try {
    // Simulate the classes.ts logic
    const allDrugs = await prisma.drug.findMany({
      select: { drugClass: true },
    });

    const classCounts = new Map<string, number>();
    for (const { drugClass } of allDrugs) {
      if (drugClass && Array.isArray(drugClass)) {
        for (const cls of drugClass) {
          if (cls) {
            classCounts.set(cls, (classCounts.get(cls) || 0) + 1);
          }
        }
      }
    }

    const classes = Array.from(classCounts.entries())
      .map(([cls, count]) => ({
        id: cls,
        label: cls,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    console.log(`✅ Found ${classes.length} drug classes`);
    console.log(`📊 Top 10 classes by drug count:\n`);
    classes.slice(0, 10).forEach(cls => {
      console.log(`   ${cls.label.padEnd(40)} ${cls.count} drugs`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Drug classes query failed:', error);
    return false;
  }
}

async function testDrugLibrary() {
  console.log('\n🧪 Testing Drug Library Query...\n');
  
  try {
    // Simulate the library.ts logic with a specific drug class
    const testClass = 'Antibiotics';
    
    const drugs = await prisma.drug.findMany({
      where: {
        drugClass: { has: testClass },
      },
      select: {
        id: true,
        genericName: true,
        brandName: true,
        drugClass: true,
        mechanismOfAction: true,
        indications: true,
        isHighYield: true,
        isFirstLine: true,
        panceYield: true,
      },
      orderBy: [
        { isFirstLine: 'desc' },
        { panceYield: 'desc' },
        { genericName: 'asc' },
      ],
      take: 10,
    });

    console.log(`✅ Found ${drugs.length} drugs in class "${testClass}"`);
    console.log(`📋 Sample drugs:\n`);
    drugs.slice(0, 5).forEach(drug => {
      const badges = [
        drug.isFirstLine && '🥇 First-Line',
        drug.isHighYield && '⭐ High-Yield',
        drug.panceYield && `PANCE: ${drug.panceYield}/5`,
      ].filter(Boolean).join(' ');
      
      console.log(`   ${drug.genericName}${drug.brandName ? ` (${drug.brandName})` : ''}`);
      if (badges) console.log(`      ${badges}`);
      if (drug.mechanismOfAction) {
        console.log(`      Mechanism: ${drug.mechanismOfAction.substring(0, 80)}...`);
      }
      console.log();
    });
    
    return true;
  } catch (error) {
    console.error('❌ Drug library query failed:', error);
    return false;
  }
}

async function testDrugDetail() {
  console.log('\n🧪 Testing Drug Detail Query with Relations...\n');
  
  try {
    // Get the first drug to test with
    const firstDrug = await prisma.drug.findFirst({
      select: { id: true, genericName: true },
    });
    
    if (!firstDrug) {
      console.log('⚠️  No drugs found in database');
      return false;
    }
    
    // Simulate the [drugId].ts logic
    const drug = await prisma.drug.findUnique({
      where: { id: firstDrug.id },
      include: {
        DrugConditionLink: {
          include: {
            Condition: {
              select: {
                id: true,
                name: true,
                system: true,
              },
            },
          },
          take: 5,
        },
      },
    });

    if (!drug) {
      console.log('❌ Drug not found');
      return false;
    }

    console.log(`✅ Retrieved drug: ${drug.genericName}`);
    console.log(`📊 Drug details:`);
    console.log(`   Drug Classes: ${drug.drugClass.join(', ')}`);
    console.log(`   Indications: ${drug.indications.length}`);
    console.log(`   Side Effects: ${drug.sideEffects.length}`);
    console.log(`   Contraindications: ${drug.contraindications.length}`);
    console.log(`   Related Conditions: ${drug.DrugConditionLink.length}`);
    
    if (drug.DrugConditionLink.length > 0) {
      console.log(`\n   Sample related conditions:`);
      drug.DrugConditionLink.slice(0, 3).forEach(link => {
        const badge = link.isFirstLine ? '🥇' : '  ';
        console.log(`      ${badge} ${link.Condition.name} (${link.Condition.system}) - ${link.relationshipType}`);
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ Drug detail query failed:', error);
    return false;
  }
}

async function testHighYieldFilters() {
  console.log('\n🧪 Testing High-Yield and First-Line Filters...\n');
  
  try {
    const highYieldCount = await prisma.drug.count({
      where: { isHighYield: true },
    });
    
    const firstLineCount = await prisma.drug.count({
      where: { isFirstLine: true },
    });
    
    const bothCount = await prisma.drug.count({
      where: {
        AND: [
          { isHighYield: true },
          { isFirstLine: true },
        ],
      },
    });
    
    console.log(`✅ Filter counts:`);
    console.log(`   High-Yield drugs: ${highYieldCount}`);
    console.log(`   First-Line drugs: ${firstLineCount}`);
    console.log(`   Both High-Yield AND First-Line: ${bothCount}`);
    
    return true;
  } catch (error) {
    console.error('❌ Filter test failed:', error);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  Drug API Endpoints Test Suite');
  console.log('═══════════════════════════════════════════════');
  
  const results = {
    classes: await testDrugClasses(),
    library: await testDrugLibrary(),
    detail: await testDrugDetail(),
    filters: await testHighYieldFilters(),
  };
  
  console.log('\n═══════════════════════════════════════════════');
  console.log('  Test Results');
  console.log('═══════════════════════════════════════════════\n');
  
  Object.entries(results).forEach(([test, passed]) => {
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${test.padEnd(20)} ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  const allPassed = Object.values(results).every(r => r);
  console.log(`\n${allPassed ? '✅ All tests passed!' : '❌ Some tests failed'}\n`);
  
  await disconnectPrisma();
  process.exit(allPassed ? 0 : 1);
}

main();
