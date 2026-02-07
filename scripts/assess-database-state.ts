#!/usr/bin/env tsx
/**
 * Database State Assessment
 * Analyzes current content state before production readiness sprint
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

// Prisma v7 requires adapter for PostgreSQL (Node.js scripts)
const directUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!directUrl) {
  console.error('❌ ERROR: DATABASE_URL not set in environment variables');
  process.exit(1);
}

// Initialize PrismaClient with PrismaPg adapter
const pool = new Pool({ connectionString: directUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function assessDatabaseState() {
  console.log('🔍 DATABASE STATE ASSESSMENT\n');
  console.log('='.repeat(60));

  try {
    // 1. MedicalContent Assessment
    console.log('\n📚 MEDICAL CONTENT');
    const totalContent = await prisma.medicalContent.count();
    const contentBySystem = await prisma.medicalContent.groupBy({
      by: ['system'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    console.log(`Total Entries: ${totalContent}`);
    console.log('\nBy System:');
    contentBySystem.forEach(({ system, _count }) => {
      console.log(`  ${system}: ${_count.id} entries`);
    });

    // 2. PreGeneratedQuestion Pool Assessment
    console.log('\n\n🎯 PRE-GENERATED QUESTION POOL');
    const totalPoolQuestions = await prisma.preGeneratedQuestion.count();
    const unusedPoolQuestions = await prisma.preGeneratedQuestion.count({
      where: { usedAt: null },
    });
    const usedPoolQuestions = totalPoolQuestions - unusedPoolQuestions;

    console.log(`Total Questions: ${totalPoolQuestions}`);
    console.log(`Unused (Available): ${unusedPoolQuestions}`);
    console.log(`Used: ${usedPoolQuestions}`);
    console.log(
      `Usage Rate: ${totalPoolQuestions > 0 ? ((usedPoolQuestions / totalPoolQuestions) * 100).toFixed(1) : 0}%`
    );

    if (unusedPoolQuestions > 0) {
      const poolBySystem = await prisma.preGeneratedQuestion.groupBy({
        by: ['system'],
        where: { usedAt: null },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      });

      console.log('\nUnused Pool by System:');
      poolBySystem.forEach(({ system, _count }) => {
        console.log(`  ${system}: ${_count.id} questions`);
      });
    }

    // 3. Question Seeds Assessment
    console.log('\n\n🌱 QUESTION SEEDS');
    const totalSeeds = await prisma.questionSeed.count();
    const seedsBySystem = await prisma.questionSeed.groupBy({
      by: ['system'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    console.log(`Total Seeds: ${totalSeeds}`);
    if (totalSeeds > 0) {
      console.log('\nBy System:');
      seedsBySystem.forEach(({ system, _count }) => {
        console.log(`  ${system}: ${_count.id} seeds`);
      });
    }

    // 4. Main Question Table Assessment
    console.log('\n\n❓ MAIN QUESTIONS TABLE');
    const totalQuestions = await prisma.question.count();
    console.log(`Total Questions: ${totalQuestions}`);

    if (totalQuestions > 0) {
      const questionsBySystem = await prisma.question.groupBy({
        by: ['system'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      });

      console.log('\nBy System:');
      questionsBySystem.forEach(({ system, _count }) => {
        console.log(`  ${system}: ${_count.id} questions`);
      });
    }

    // 5. Clinical Pearls Assessment (for Rapid Recall)
    console.log('\n\n💎 CLINICAL PEARLS (Rapid Recall)');
    const totalPearls = await prisma.clinicalPearl.count();
    console.log(`Total Pearls: ${totalPearls}`);

    if (totalPearls > 0) {
      const pearlsBySystem = await prisma.clinicalPearl.groupBy({
        by: ['system'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      });

      console.log('\nBy System:');
      pearlsBySystem.forEach(({ system, _count }) => {
        console.log(`  ${system}: ${_count.id} pearls`);
      });
    }

    // 6. User Activity Assessment
    console.log('\n\n👤 USER ACTIVITY');
    const totalUsers = await prisma.user.count();
    const totalAttempts = await prisma.questionAttempt.count();
    const totalProgress = await prisma.userProgress.count();

    console.log(`Total Users: ${totalUsers}`);
    console.log(`Total Question Attempts: ${totalAttempts}`);
    console.log(`Total UserProgress Records: ${totalProgress}`);

    if (totalAttempts > 0) {
      const { Prisma } = await import('@prisma/client');
      const attemptsWithTelemetry = await prisma.questionAttempt.count({
        where: {
          telemetryJson: { not: Prisma.DbNull },
        },
      });
      console.log(
        `Attempts with Telemetry: ${attemptsWithTelemetry} (${((attemptsWithTelemetry / totalAttempts) * 100).toFixed(1)}%)`
      );
    }

    // 7. NCCPA 2025 Blueprint Compliance Check
    console.log('\n\n📋 NCCPA 2025 BLUEPRINT COMPLIANCE');
    console.log('Expected Weights (from blueprint.ts):');
    console.log('  Cardiovascular: 11%');
    console.log('  Pulmonary: 9%');
    console.log('  GI/Nutrition: 9%');
    console.log('  Musculoskeletal: 8%');

    if (unusedPoolQuestions > 0) {
      const poolBySystemMap = (
        await prisma.preGeneratedQuestion.groupBy({
          by: ['system'],
          where: { usedAt: null },
          _count: { id: true },
        })
      ).reduce(
        (acc, { system, _count }) => {
          if (system != null) acc[system] = _count.id;
          return acc;
        },
        {} as Record<string, number>
      );

      console.log('\nCurrent Pool Distribution:');
      const cardioCount = poolBySystemMap['Cardiovascular'] || 0;
      const pulmoCount = poolBySystemMap['Pulmonary'] || 0;
      const giCount = poolBySystemMap['GI/Nutrition'] || 0;
      const musculoCount = poolBySystemMap['Musculoskeletal'] || 0;

      if (unusedPoolQuestions > 0) {
        console.log(
          `  Cardiovascular: ${cardioCount} (${((cardioCount / unusedPoolQuestions) * 100).toFixed(1)}%) - Target: 11%`
        );
        console.log(
          `  Pulmonary: ${pulmoCount} (${((pulmoCount / unusedPoolQuestions) * 100).toFixed(1)}%) - Target: 9%`
        );
        console.log(
          `  GI/Nutrition: ${giCount} (${((giCount / unusedPoolQuestions) * 100).toFixed(1)}%) - Target: 9%`
        );
        console.log(
          `  Musculoskeletal: ${musculoCount} (${((musculoCount / unusedPoolQuestions) * 100).toFixed(1)}%) - Target: 8%`
        );
      }
    }

    // 8. Production Readiness Summary
    console.log('\n\n' + '='.repeat(60));
    console.log('🎯 PRODUCTION READINESS ASSESSMENT');
    console.log('='.repeat(60));

    const readinessChecks = [
      {
        name: 'Medical Content Exists',
        pass: totalContent > 0,
        value: totalContent,
        threshold: 50,
      },
      {
        name: 'Question Pool Available',
        pass: unusedPoolQuestions >= 30,
        value: unusedPoolQuestions,
        threshold: 30,
      },
      {
        name: 'Clinical Pearls for Rapid Recall',
        pass: totalPearls > 0,
        value: totalPearls,
        threshold: 20,
      },
      {
        name: 'Cardiovascular Content (Priority)',
        pass: contentBySystem.some((s) => s.system === 'Cardiovascular' && s._count.id >= 5),
        value: contentBySystem.find((s) => s.system === 'Cardiovascular')?._count.id || 0,
        threshold: 5,
      },
      {
        name: 'Pulmonary Content (Priority)',
        pass: contentBySystem.some((s) => s.system === 'Pulmonary' && s._count.id >= 5),
        value: contentBySystem.find((s) => s.system === 'Pulmonary')?._count.id || 0,
        threshold: 5,
      },
    ];

    readinessChecks.forEach((check) => {
      const status = check.pass ? '✅' : '❌';
      console.log(`${status} ${check.name}: ${check.value} (need ≥${check.threshold})`);
    });

    const allPass = readinessChecks.every((c) => c.pass);

    console.log('\n' + '='.repeat(60));
    if (allPass) {
      console.log('✅ READY FOR PRODUCTION');
      console.log('\nNext Steps:');
      console.log(
        '  1. Test session generation: curl localhost:8788/api/questions/session?count=10'
      );
      console.log('  2. Verify Rapid Recall mode works');
      console.log('  3. Generate Prisma Client: npm run db:generate');
      console.log('  4. Deploy: npm run deploy:hook');
    } else {
      console.log('⚠️  NEEDS CONTENT SEEDING');
      console.log('\nRecommended Actions:');
      if (unusedPoolQuestions < 30) {
        console.log('  • Run: npm run orchestrate:full -- --systems Cardiovascular,Pulmonary');
      }
      if (totalPearls === 0) {
        console.log('  • Ensure content enrichment includes pearl extraction');
      }
      console.log('  • Target: 50+ questions per priority system (Cardiovascular, Pulmonary)');
    }
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('❌ Assessment failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Execute
assessDatabaseState().catch(console.error);
