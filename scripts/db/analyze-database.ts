#!/usr/bin/env tsx
/**
 * COMPREHENSIVE DATABASE ANALYSIS
 * Analyzes MedicalContent and Drug tables for data quality issues
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeMedicalContent() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   MEDICALCONTENT ANALYSIS                                 ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  const total = await prisma.medicalContent.count();
  console.log(`📊 Total records: ${total}\n`);
  
  // Check for missing critical fields
  const missingGoldStandard = await prisma.medicalContent.count({
    where: { gold_standard_dx: null }
  });
  const missingFirstLine = await prisma.medicalContent.count({
    where: { first_line_rx: null }
  });
  const missingBestInitial = await prisma.medicalContent.count({
    where: { best_initial_test: null }
  });
  const missingOverview = await prisma.medicalContent.count({
    where: { overview: null }
  });
  
  console.log('🔍 Missing Critical Fields:');
  console.log(`   • gold_standard_dx:    ${missingGoldStandard} (${((missingGoldStandard/total)*100).toFixed(1)}%)`);
  console.log(`   • first_line_rx:       ${missingFirstLine} (${((missingFirstLine/total)*100).toFixed(1)}%)`);
  console.log(`   • best_initial_test:   ${missingBestInitial} (${((missingBestInitial/total)*100).toFixed(1)}%)`);
  console.log(`   • overview:            ${missingOverview} (${((missingOverview/total)*100).toFixed(1)}%)\n`);
  
  // Check system distribution
  const systems = await prisma.medicalContent.groupBy({
    by: ['system'],
    _count: true,
    orderBy: { _count: { system: 'desc' } }
  });
  
  console.log('📋 System Distribution:');
  systems.slice(0, 10).forEach(s => {
    const pct = ((s._count / total) * 100).toFixed(1);
    console.log(`   • ${s.system.padEnd(6)}: ${s._count.toString().padStart(4)} (${pct}%)`);
  });
  if (systems.length > 10) {
    console.log(`   ... and ${systems.length - 10} more systems\n`);
  }
  
  // Check status distribution
  const statuses = await prisma.medicalContent.groupBy({
    by: ['status'],
    _count: true
  });
  
  console.log('\n📊 Status Distribution:');
  statuses.forEach(s => {
    const pct = ((s._count / total) * 100).toFixed(1);
    console.log(`   • ${s.status.padEnd(15)}: ${s._count.toString().padStart(4)} (${pct}%)`);
  });
  
  // Check for records with buzzwords
  const allRecords = await prisma.medicalContent.findMany({
    select: { id: true, conditionId: true, buzzwords: true }
  });
  
  const emptyBuzzwords = allRecords.filter(r => !r.buzzwords || r.buzzwords.length === 0).length;
  console.log(`\n🏷️  Buzzwords Status:`);
  console.log(`   • Records with buzzwords:    ${total - emptyBuzzwords} (${(((total - emptyBuzzwords)/total)*100).toFixed(1)}%)`);
  console.log(`   • Records without buzzwords: ${emptyBuzzwords} (${((emptyBuzzwords/total)*100).toFixed(1)}%)`);
  
  // Sample a few records with issues
  const issueRecords = await prisma.medicalContent.findMany({
    where: {
      OR: [
        { gold_standard_dx: null },
        { first_line_rx: null },
        { overview: null }
      ]
    },
    take: 5,
    select: {
      conditionId: true,
      condition: true,
      gold_standard_dx: true,
      first_line_rx: true,
      overview: true
    }
  });
  
  if (issueRecords.length > 0) {
    console.log(`\n⚠️  Sample Records with Missing Fields:`);
    issueRecords.forEach(r => {
      console.log(`\n   ${r.condition} (${r.conditionId})`);
      if (!r.gold_standard_dx) console.log(`      ❌ Missing gold_standard_dx`);
      if (!r.first_line_rx) console.log(`      ❌ Missing first_line_rx`);
      if (!r.overview) console.log(`      ❌ Missing overview`);
    });
  }
}

async function analyzeDrugs() {
  console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   DRUG ANALYSIS                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  const total = await prisma.drug.count();
  console.log(`📊 Total records: ${total}\n`);
  
  // Check for missing critical fields
  const missingMechanism = await prisma.drug.count({
    where: { mechanismOfAction: null }
  });
  const missingDosing = await prisma.drug.count({
    where: { dosing: null }
  });
  const missingBrandName = await prisma.drug.count({
    where: { brandName: null }
  });
  
  console.log('🔍 Missing Fields:');
  console.log(`   • mechanismOfAction: ${missingMechanism} (${((missingMechanism/total)*100).toFixed(1)}%)`);
  console.log(`   • dosing:            ${missingDosing} (${((missingDosing/total)*100).toFixed(1)}%)`);
  console.log(`   • brandName:         ${missingBrandName} (${((missingBrandName/total)*100).toFixed(1)}%)\n`);
  
  // Check PANCE yield distribution
  const yieldCounts = await prisma.drug.groupBy({
    by: ['panceYield'],
    _count: true,
    orderBy: { panceYield: 'desc' }
  });
  
  console.log('🎯 PANCE Yield Distribution:');
  yieldCounts.forEach(y => {
    const label = y.panceYield === null ? 'Unset' : 
                  y.panceYield === 3 ? 'High (3)' :
                  y.panceYield === 2 ? 'Medium (2)' :
                  y.panceYield === 1 ? 'Low (1)' : `Other (${y.panceYield})`;
    const pct = ((y._count / total) * 100).toFixed(1);
    console.log(`   • ${label.padEnd(12)}: ${y._count.toString().padStart(4)} (${pct}%)`);
  });
  
  // Check first-line drugs
  const firstLineDrugs = await prisma.drug.count({
    where: { isFirstLine: true }
  });
  console.log(`\n💊 First-Line Drugs: ${firstLineDrugs} (${((firstLineDrugs/total)*100).toFixed(1)}%)`);
  
  // Check high-yield drugs
  const highYieldDrugs = await prisma.drug.count({
    where: { isHighYield: true }
  });
  console.log(`⭐ High-Yield Drugs: ${highYieldDrugs} (${((highYieldDrugs/total)*100).toFixed(1)}%)`);
  
  // Check for empty arrays in critical fields
  const allDrugs = await prisma.drug.findMany({
    select: {
      id: true,
      genericName: true,
      drugClass: true,
      indications: true,
      sideEffects: true,
      contraindications: true
    }
  });
  
  const emptyDrugClass = allDrugs.filter(d => !d.drugClass || d.drugClass.length === 0).length;
  const emptyIndications = allDrugs.filter(d => !d.indications || d.indications.length === 0).length;
  const emptySideEffects = allDrugs.filter(d => !d.sideEffects || d.sideEffects.length === 0).length;
  
  console.log(`\n📦 Array Field Completeness:`);
  console.log(`   • drugClass populated:       ${total - emptyDrugClass} (${(((total - emptyDrugClass)/total)*100).toFixed(1)}%)`);
  console.log(`   • indications populated:     ${total - emptyIndications} (${(((total - emptyIndications)/total)*100).toFixed(1)}%)`);
  console.log(`   • sideEffects populated:     ${total - emptySideEffects} (${(((total - emptySideEffects)/total)*100).toFixed(1)}%)`);
  
  // Sample drugs with issues
  const issueDrugs = await prisma.drug.findMany({
    where: {
      OR: [
        { mechanismOfAction: null },
        { panceYield: null }
      ]
    },
    take: 5,
    select: {
      genericName: true,
      mechanismOfAction: true,
      panceYield: true,
      isFirstLine: true,
      drugClass: true
    }
  });
  
  if (issueDrugs.length > 0) {
    console.log(`\n⚠️  Sample Drugs with Missing Fields:`);
    issueDrugs.forEach(d => {
      console.log(`\n   ${d.genericName}`);
      if (!d.mechanismOfAction) console.log(`      ❌ Missing mechanismOfAction`);
      if (d.panceYield === null) console.log(`      ❌ Missing panceYield`);
      if (!d.drugClass || d.drugClass.length === 0) console.log(`      ❌ Empty drugClass`);
    });
  }
}

async function main() {
  try {
    await analyzeMedicalContent();
    await analyzeDrugs();
    
    console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║   ANALYSIS COMPLETE                                       ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
