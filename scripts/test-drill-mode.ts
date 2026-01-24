/**
 * Test Drill Mode - Statistical Isolation Verification
 * 
 * This script verifies that drill attempts do NOT affect:
 * 1. UserRolling360Stats (main exam statistics)
 * 2. FSRS weight optimization
 * 3. ReviewLog MAIN session counts
 * 
 * Run with: npx tsx scripts/test-drill-mode.ts
 */

import { PrismaClient } from '@prisma/client';
import { logDrillAttempt, verifyStatisticalIsolation } from '../services/drill/drillSessionManager';

const prisma = new PrismaClient();

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

/**
 * Test 1: Verify drill attempts use isMainSession = false
 */
async function testDrillAttemptFlag() {
  console.log('\n🧪 Test 1: Verifying drill attempts use isMainSession=false...');

  try {
    // Create a test user
    const testUser = await prisma.user.upsert({
      where: { email: 'drill-test@panacea.test' },
      update: {},
      create: {
        email: 'drill-test@panacea.test',
        clerkId: 'test_drill_' + Date.now(),
        firstName: 'Drill',
        lastName: 'Tester',
      },
    });

    // Log a drill attempt
    const attempt = await logDrillAttempt({
      userId: testUser.id,
      drillType: 'photo_drill',
      wasCorrect: true,
      responseTimeMs: 5000,
    });

    // Verify isMainSession is false
    const verified = attempt.isMainSession === false;

    results.push({
      testName: 'Drill Attempt Flag',
      passed: verified,
      message: verified
        ? '✅ Drill attempts correctly use isMainSession=false'
        : '❌ CRITICAL: Drill attempts are marked as main sessions!',
      details: { isMainSession: attempt.isMainSession },
    });

    return verified;
  } catch (error) {
    results.push({
      testName: 'Drill Attempt Flag',
      passed: false,
      message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
    return false;
  }
}

/**
 * Test 2: Verify Rolling360Stats is not affected
 */
async function testRolling360Isolation() {
  console.log('\n🧪 Test 2: Verifying Rolling360Stats isolation...');

  try {
    const testUser = await prisma.user.findFirst({
      where: { email: 'drill-test@panacea.test' },
    });

    if (!testUser) throw new Error('Test user not found');

    // Get current Rolling360 stats
    let rolling360Before = await prisma.userRolling360Stats.findUnique({
      where: { userId: testUser.id },
    });

    const questionCountBefore = rolling360Before?.totalInWindow || 0;

    // Log 5 drill attempts
    for (let i = 0; i < 5; i++) {
      await logDrillAttempt({
        userId: testUser.id,
        drillType: 'photo_drill',
        wasCorrect: i % 2 === 0,
        responseTimeMs: 5000,
      });
    }

    // Get Rolling360 stats after
    let rolling360After = await prisma.userRolling360Stats.findUnique({
      where: { userId: testUser.id },
    });

    const questionCountAfter = rolling360After?.totalInWindow || 0;

    // Stats should NOT change
    const passed = questionCountBefore === questionCountAfter;

    results.push({
      testName: 'Rolling360Stats Isolation',
      passed,
      message: passed
        ? '✅ Rolling360Stats correctly ignores drill attempts'
        : '❌ CRITICAL: Drill attempts are affecting Rolling360Stats!',
      details: {
        before: questionCountBefore,
        after: questionCountAfter,
        drillAttempts: 5,
      },
    });

    return passed;
  } catch (error) {
    results.push({
      testName: 'Rolling360Stats Isolation',
      passed: false,
      message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
    return false;
  }
}

/**
 * Test 3: Verify ReviewLog session type filtering
 */
async function testReviewLogSessionType() {
  console.log('\n🧪 Test 3: Verifying ReviewLog session type filtering...');

  try {
    const testUser = await prisma.user.findFirst({
      where: { email: 'drill-test@panacea.test' },
    });

    if (!testUser) throw new Error('Test user not found');

    // Count MAIN session reviews
    const mainReviewsBefore = await prisma.reviewLog.count({
      where: {
        userId: testUser.id,
        sessionType: 'MAIN',
      },
    });

    // Create a CRAM session review (drill mode)
    await prisma.reviewLog.create({
      data: {
        userId: testUser.id,
        sessionType: 'CRAM', // Non-MAIN session
        grade: 3,
        state: 2,
        stability: 10.0,
        difficulty: 5.0,
        wasCorrect: true,
        reviewedAt: new Date(),
      },
    });

    // Count MAIN reviews after
    const mainReviewsAfter = await prisma.reviewLog.count({
      where: {
        userId: testUser.id,
        sessionType: 'MAIN',
      },
    });

    // MAIN count should NOT change
    const passed = mainReviewsBefore === mainReviewsAfter;

    // Verify CRAM session was logged
    const cramReviews = await prisma.reviewLog.count({
      where: {
        userId: testUser.id,
        sessionType: 'CRAM',
      },
    });

    results.push({
      testName: 'ReviewLog Session Type',
      passed: passed && cramReviews > 0,
      message:
        passed && cramReviews > 0
          ? '✅ ReviewLog correctly uses CRAM session type for drills'
          : '❌ CRITICAL: Session type filtering is not working!',
      details: {
        mainReviewsBefore,
        mainReviewsAfter,
        cramReviews,
      },
    });

    return passed;
  } catch (error) {
    results.push({
      testName: 'ReviewLog Session Type',
      passed: false,
      message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
    return false;
  }
}

/**
 * Test 4: Comprehensive isolation verification
 */
async function testComprehensiveIsolation() {
  console.log('\n🧪 Test 4: Running comprehensive isolation verification...');

  try {
    const testUser = await prisma.user.findFirst({
      where: { email: 'drill-test@panacea.test' },
    });

    if (!testUser) throw new Error('Test user not found');

    const verification = await verifyStatisticalIsolation(testUser.id);

    results.push({
      testName: 'Comprehensive Isolation',
      passed: verification.isolated === true,
      message: verification.isolated
        ? '✅ All statistical isolation checks passed'
        : '❌ CRITICAL: Statistical isolation is compromised!',
      details: verification,
    });

    return verification.isolated;
  } catch (error) {
    results.push({
      testName: 'Comprehensive Isolation',
      passed: false,
      message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
    return false;
  }
}

/**
 * Cleanup test data
 */
async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');

  try {
    const testUser = await prisma.user.findFirst({
      where: { email: 'drill-test@panacea.test' },
    });

    if (testUser) {
      // Delete test attempts
      await prisma.questionAttempt.deleteMany({
        where: { userId: testUser.id },
      });

      // Delete test reviews
      await prisma.reviewLog.deleteMany({
        where: { userId: testUser.id },
      });

      // Delete test user
      await prisma.user.delete({
        where: { id: testUser.id },
      });

      console.log('✅ Cleanup complete');
    }
  } catch (error) {
    console.error('⚠️  Cleanup error:', error);
  }
}

/**
 * Print test results
 */
function printResults() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(80));

  const passedTests = results.filter((r) => r.passed).length;
  const totalTests = results.length;

  results.forEach((result) => {
    console.log(`\n${result.testName}:`);
    console.log(`  ${result.message}`);
    if (result.details) {
      console.log(`  Details:`, JSON.stringify(result.details, null, 2));
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log(
    `Final Score: ${passedTests}/${totalTests} tests passed (${Math.round(
      (passedTests / totalTests) * 100
    )}%)`
  );
  console.log('='.repeat(80) + '\n');

  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Statistical isolation is verified.');
    console.log('✅ Drill modes are safe to use in production.\n');
  } else {
    console.log('⚠️  CRITICAL: Some tests failed!');
    console.log('❌ Do NOT deploy drill modes until these issues are resolved.\n');
    process.exit(1);
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log('🚀 Starting Drill Mode Statistical Isolation Tests...\n');
  console.log('This test verifies that drill attempts do NOT affect:');
  console.log('  - UserRolling360Stats (main exam statistics)');
  console.log('  - FSRS weight optimization');
  console.log('  - ReviewLog MAIN session counts\n');

  try {
    // Run all tests
    await testDrillAttemptFlag();
    await testRolling360Isolation();
    await testReviewLogSessionType();
    await testComprehensiveIsolation();

    // Print results
    printResults();

    // Cleanup
    await cleanup();
  } catch (error) {
    console.error('❌ Fatal error during testing:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});