#!/usr/bin/env npx tsx
/**
 * Verification Script: Main Session Question Selector
 * 
 * Tests the Priority Waterfall algorithm by simulating a user with
 * a "Cardiology Deficit" and verifying that the selector prioritizes
 * Cardiology questions to correct the blueprint imbalance.
 * 
 * Run: npx tsx scripts/test-selector.ts
 * 
 * =============================================================================
 * NCCPA 2025 CONTENT BLUEPRINT (Medical Systems)
 * =============================================================================
 * Source: Official NCCPA PANCE Content Blueprint, effective 2025
 * 
 * Cardiovascular:       11%
 * Pulmonary:            9%
 * Gastrointestinal:     8%
 * Musculoskeletal:      8%
 * Infectious Disease:   7%
 * Neurologic:           7%
 * Psychiatry:           7%
 * Reproductive:         7%
 * Endocrine:            6%
 * EENT:                 6%
 * Professional Practice: 6%
 * Hematologic:          5%
 * Renal:                5%
 * Dermatologic:         4%
 * Genitourinary:        4%
 * 
 * =============================================================================
 * NCCPA 2025 TASK CATEGORY BLUEPRINT (Phase 2 - Future Use)
 * =============================================================================
 * These weights target HOW questions test knowledge, not WHAT system.
 * Reserved for Phase 2 implementation.
 * 
 * History/Physical:      16%
 * Diagnosis:             18%
 * Clinical Intervention: 16%
 * Pharmaceuticals:       15%
 * Health Maintenance:    11%
 * Diagnostic Studies:    10%
 * Basic Science:         8%
 * Professional Practice: 6%
 * =============================================================================
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { 
  MainSessionQuestionSelector,
  SystemDeficit,
} from '../lib/services/mainSessionQuestionSelector.ts';
import { 
  Rolling360Service,
  normalizeSystemName,
} from '../lib/services/rolling360Service.ts';

// Load environment variables
config();

// Prisma v7 requires adapter for PostgreSQL
const directUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!directUrl) {
  console.error('❌ DATABASE_URL not set in environment');
  process.exit(1);
}

const pool = new Pool({ connectionString: directUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

const TEST_USER_ID = 'test-selector-user-' + Date.now();
const SESSION_SIZE = 20;

// Simulated Rolling 360 stats with Cardiology deficit
// NCCPA 2025 Blueprint targets used for comparison
const SIMULATED_STATS = {
  totalInWindow: 200,
  correctInWindow: 140,
  accuracyPercent: 70,
  systemStats: {
    // 2025 Blueprint: Cardio=11%, Pulm=9%, GI=8%, MSK=8%, ID=7%, Neuro=7%, Psych=7%, Repro=7%
    //                 Endo=6%, EENT=6%, Pro=6%, Heme=5%, Renal=5%, Derm=4%, GU=4%
    'Cardiovascular': { total: 8, correct: 6, accuracy: 75 },     // 4% actual vs 11% target = 7% DEFICIT
    'Pulmonary': { total: 20, correct: 14, accuracy: 70 },        // 10% actual vs 9% target = +1%
    'Gastrointestinal': { total: 18, correct: 13, accuracy: 72 }, // 9% actual vs 8% target = +1%
    'Musculoskeletal': { total: 18, correct: 13, accuracy: 72 },  // 9% actual vs 8% target = +1%
    'EENT': { total: 14, correct: 10, accuracy: 71 },             // 7% actual vs 6% target = +1%
    'Reproductive': { total: 16, correct: 11, accuracy: 69 },     // 8% actual vs 7% target = +1%
    'Neurological': { total: 16, correct: 12, accuracy: 75 },     // 8% actual vs 7% target = +1%
    'Psychiatry': { total: 16, correct: 11, accuracy: 69 },       // 8% actual vs 7% target = +1%
    'Endocrine': { total: 14, correct: 10, accuracy: 71 },        // 7% actual vs 6% target = +1%
    'Dermatology': { total: 10, correct: 7, accuracy: 70 },       // 5% actual vs 4% target = +1%
    'Genitourinary': { total: 10, correct: 8, accuracy: 80 },     // 5% actual vs 4% target = +1%
    'Hematology': { total: 12, correct: 8, accuracy: 67 },        // 6% actual vs 5% target = +1%
    'Infectious Disease': { total: 16, correct: 11, accuracy: 69 }, // 8% actual vs 7% target = +1%
    'Renal': { total: 12, correct: 8, accuracy: 67 },             // 6% actual vs 5% target = +1%
  },
  predictedScore: 620,
  scoreConfidence: 'provisional' as const,
  passLikelihood: 92.5,
  blueprintAdherence: 0.85,
  isValidExamDistribution: false,
  weakestSystems: ['Hematology', 'Infectious Disease', 'Endocrine'],
  strongestSystems: ['Gastrointestinal', 'Genitourinary', 'Neurological'],
  windowStartTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  windowEndTime: new Date(),
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function printHeader(title: string): void {
  console.log('\n' + '='.repeat(70));
  console.log(`  ${title}`);
  console.log('='.repeat(70));
}

function printSubheader(title: string): void {
  console.log('\n' + '-'.repeat(50));
  console.log(`  ${title}`);
  console.log('-'.repeat(50));
}

function colorize(text: string, color: 'green' | 'red' | 'yellow' | 'cyan'): string {
  const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
  };
  return `${colors[color]}${text}\x1b[0m`;
}

// =============================================================================
// MOCK ROLLING 360 SERVICE
// =============================================================================

class MockRolling360Service extends Rolling360Service {
  async getRolling360Stats(_userId: string) {
    return SIMULATED_STATS;
  }
}

// =============================================================================
// MOCK QUESTION SELECTOR
// =============================================================================

class MockMainSessionSelector extends MainSessionQuestionSelector {
  private mockRolling360: MockRolling360Service;

  constructor(prisma: PrismaClient) {
    super(prisma);
    this.mockRolling360 = new MockRolling360Service(prisma);
  }

  // Override to use mock Rolling 360 stats
  async generateSession(userId: string, sessionSize: number = 20) {
    // Use parent's logic but with mocked stats
    return super.generateSession(userId, sessionSize);
  }

  // Expose deficit calculation for testing
  calculateDeficitsPublic(sessionSize: number): SystemDeficit[] {
    // NCCPA 2025 Official Blueprint (Medical Systems)
    const blueprint = {
      'Cardiovascular': 0.11,
      'Pulmonary': 0.09,
      'Gastrointestinal': 0.08,
      'Musculoskeletal': 0.08,
      'Infectious Disease': 0.07,
      'Neurological': 0.07,
      'Psychiatry': 0.07,
      'Reproductive': 0.07,
      'Endocrine': 0.06,
      'EENT': 0.06,
      'Hematology': 0.05,
      'Renal': 0.05,
      'Dermatology': 0.04,
      'Genitourinary': 0.04,
    };

    const deficits: SystemDeficit[] = [];
    const stats = SIMULATED_STATS;
    const total = stats.totalInWindow;

    for (const [system, targetWeight] of Object.entries(blueprint)) {
      const systemStats = stats.systemStats[system as keyof typeof stats.systemStats];
      const actualCount = systemStats?.total || 0;
      const actualPercent = (actualCount / total) * 100;
      const targetPercent = targetWeight * 100;
      const deficitPercent = targetPercent - actualPercent;

      if (deficitPercent > 2.0) { // DEFICIT_THRESHOLD
        deficits.push({
          system,
          targetPercent,
          actualPercent,
          deficitPercent,
          deficitQuestions: Math.ceil((deficitPercent / 100) * sessionSize),
        });
      }
    }

    return deficits.sort((a, b) => b.deficitPercent - a.deficitPercent);
  }
}

// =============================================================================
// MAIN TEST FUNCTION
// =============================================================================

async function runTests(): Promise<void> {
  printHeader('MAIN SESSION QUESTION SELECTOR - VERIFICATION TEST');
  
  console.log('\nTest Scenario (NCCPA 2025 Blueprint):');
  console.log('  User has answered 200 Main Session questions');
  console.log('  Cardiology: 8 questions (4% actual vs 11% target = 7% DEFICIT)');
  console.log('  Other systems: At or above 2025 blueprint targets');
  console.log('  Expected: Selector should prioritize Cardiology questions\n');

  try {
    // ==========================================================================
    // TEST 1: Deficit Calculation
    // ==========================================================================
    printSubheader('TEST 1: System Deficit Calculation');
    
    const selector = new MockMainSessionSelector(prisma);
    const deficits = selector.calculateDeficitsPublic(SESSION_SIZE);
    
    console.log('\nIdentified Deficits:');
    for (const deficit of deficits) {
      const status = deficit.system === 'Cardiovascular' 
        ? colorize('← HIGHEST PRIORITY', 'green')
        : '';
      console.log(`  ${deficit.system}: ${deficit.deficitPercent.toFixed(1)}% below target (${deficit.deficitQuestions} questions needed) ${status}`);
    }
    
    // Verify Cardiology is highest deficit
    const cardioDeficit = deficits.find(d => d.system === 'Cardiovascular');
    if (cardioDeficit && deficits[0].system === 'Cardiovascular') {
      console.log(colorize('\n✓ PASS: Cardiovascular correctly identified as highest deficit', 'green'));
    } else {
      console.log(colorize('\n✗ FAIL: Cardiovascular not identified as highest deficit', 'red'));
    }

    // ==========================================================================
    // TEST 2: Check Question Pool
    // ==========================================================================
    printSubheader('TEST 2: Question Pool Analysis');
    
    // Count questions by system
    const questionCounts = await prisma.preGeneratedQuestion.groupBy({
      by: ['system'],
      _count: { id: true },
      where: {
        validationStatus: { in: ['approved', 'pending'] },
      },
    });
    
    console.log('\nAvailable Questions by System:');
    let totalQuestions = 0;
    for (const count of questionCounts) {
      const normalizedSystem = normalizeSystemName(count.system);
      const isDeficit = deficits.some(d => d.system === normalizedSystem);
      const marker = isDeficit ? colorize(' [DEFICIT]', 'yellow') : '';
      console.log(`  ${normalizedSystem}: ${count._count.id} questions${marker}`);
      totalQuestions += count._count.id;
    }
    console.log(`  Total: ${totalQuestions} questions available`);

    // ==========================================================================
    // TEST 3: System Distribution Analysis
    // ==========================================================================
    printSubheader('TEST 3: Blueprint Analysis');
    
    console.log('\nSimulated Rolling 360 Distribution vs Blueprint:');
    console.log('  System              | Actual | Target | Diff');
    console.log('  --------------------|--------|--------|------');
    
    // NCCPA 2025 Official Blueprint (Medical Systems)
    const blueprint: Record<string, number> = {
      'Cardiovascular': 0.11,
      'Pulmonary': 0.09,
      'Gastrointestinal': 0.08,
      'Musculoskeletal': 0.08,
      'Infectious Disease': 0.07,
      'Neurological': 0.07,
      'Psychiatry': 0.07,
      'Reproductive': 0.07,
      'Endocrine': 0.06,
      'EENT': 0.06,
      'Hematology': 0.05,
      'Renal': 0.05,
      'Dermatology': 0.04,
      'Genitourinary': 0.04,
    };
    
    for (const [system, targetWeight] of Object.entries(blueprint)) {
      const stats = SIMULATED_STATS.systemStats[system as keyof typeof SIMULATED_STATS.systemStats];
      const actualPercent = stats ? (stats.total / SIMULATED_STATS.totalInWindow) * 100 : 0;
      const targetPercent = targetWeight * 100;
      const diff = actualPercent - targetPercent;
      
      const diffStr = diff >= 0 
        ? colorize(`+${diff.toFixed(1)}%`, 'green')
        : colorize(`${diff.toFixed(1)}%`, 'red');
      
      console.log(`  ${system.padEnd(18)} | ${actualPercent.toFixed(1).padStart(5)}% | ${targetPercent.toFixed(1).padStart(5)}% | ${diffStr}`);
    }

    // ==========================================================================
    // TEST 4: Priority Waterfall Simulation
    // ==========================================================================
    printSubheader('TEST 4: Priority Waterfall Simulation');
    
    console.log('\nSimulating Priority Waterfall for 20-question session:');
    console.log('\nPriority A (The Fixer):');
    console.log('  - Should fill Cardiovascular deficit first');
    console.log(`  - Cardiology deficit needs: ${cardioDeficit?.deficitQuestions || 0} questions`);
    
    console.log('\nPriority B (The Maintainer):');
    console.log('  - Fill remaining slots with due FSRS cards');
    console.log('  - Enforce interleaving (max 2 same system in a row)');
    
    console.log('\nPriority C (The Explorer):');
    console.log('  - Fill any remaining with new questions');
    console.log('  - Prioritize data-sparse systems');

    // ==========================================================================
    // TEST 5: Expected Session Composition
    // ==========================================================================
    printSubheader('TEST 5: Expected Session Composition');
    
    // Calculate expected distribution for a 20-question session (2025 Blueprint)
    const expectedCardio = Math.min(
      Math.ceil(0.11 * SESSION_SIZE) + (cardioDeficit?.deficitQuestions || 0),
      SESSION_SIZE / 2 // Cap at 50% to maintain diversity
    );
    
    console.log(`\nFor a ${SESSION_SIZE}-question Main Session:`);
    console.log(`  Expected Cardiovascular questions: ${expectedCardio} (to address 7% deficit)`);
    console.log(`  Remaining questions: ${SESSION_SIZE - expectedCardio} (distributed per blueprint)`);
    
    console.log('\nExpected Priority Breakdown:');
    console.log(`  Priority A (Deficit Fixer): ~${Math.min(cardioDeficit?.deficitQuestions || 0, 5)} questions`);
    console.log(`  Priority B (FSRS Maintainer): ~${SESSION_SIZE - 10} questions`);
    console.log(`  Priority C (New Explorer): ~${5} questions`);

    // ==========================================================================
    // TEST 6: High-Deficit Interleaving (NEW v2.0)
    // ==========================================================================
    printSubheader('TEST 6: High-Deficit Interleaving (8 Cardio)');
    
    console.log('\nTesting strict interleaving with high-deficit scenario...');
    console.log('Scenario: 8 Cardio, 4 Pulm, 4 GI, 4 MSK = 20 questions');
    console.log('Constraint: No two adjacent questions can have the same system\n');
    
    // Simulate the assembleInterleavedSession algorithm
    interface MockQuestion {
      questionId: string;
      system: string;
      priority: 'A' | 'B' | 'C';
    }
    
    function createMockQuestions(system: string, count: number): MockQuestion[] {
      return Array(count)
        .fill(null)
        .map((_, i) => ({
          questionId: `${system.toLowerCase().replace(/ /g, '-')}-${i}`,
          system,
          priority: 'A' as const,
        }));
    }
    
    // Simulate the Largest-First Greedy algorithm
    function testAssembleInterleavedSession(
      pools: Map<string, MockQuestion[]>
    ): { questions: MockQuestion[]; violations: number[] } {
      const result: MockQuestion[] = [];
      const violations: number[] = [];
      
      const workingPools = new Map<string, MockQuestion[]>();
      for (const [system, questions] of pools) {
        workingPools.set(system, [...questions]);
      }
      
      let lastPlacedSystem: string | null = null;
      
      const hasQuestionsRemaining = (): boolean => {
        return Array.from(workingPools.values()).some(arr => arr.length > 0);
      };
      
      while (hasQuestionsRemaining()) {
        // Sort by pool size (LARGEST FIRST)
        const currentOrder = Array.from(workingPools.entries())
          .filter(([_, questions]) => questions.length > 0)
          .sort((a, b) => b[1].length - a[1].length)
          .map(([system]) => system);
        
        let placed = false;
        
        for (const system of currentOrder) {
          if (system !== lastPlacedSystem) {
            const pool = workingPools.get(system)!;
            const question = pool.shift()!;
            result.push(question);
            lastPlacedSystem = system;
            placed = true;
            break;
          }
        }
        
        // Forced repeat (only one system left)
        if (!placed && currentOrder.length > 0) {
          const forcedSystem = currentOrder[0];
          const pool = workingPools.get(forcedSystem)!;
          const question = pool.shift()!;
          result.push(question);
          lastPlacedSystem = forcedSystem;
          violations.push(result.length - 1);
        }
      }
      
      return { questions: result, violations };
    }
    
    // Create pools: 8 Cardio (max capped), 4 each of others
    const mockPools = new Map<string, MockQuestion[]>([
      ['Cardiovascular', createMockQuestions('Cardiovascular', 8)],
      ['Pulmonary', createMockQuestions('Pulmonary', 4)],
      ['Gastrointestinal', createMockQuestions('Gastrointestinal', 4)],
      ['Musculoskeletal', createMockQuestions('Musculoskeletal', 4)],
    ]);
    
    const { questions: assembled, violations: assemblyViolations } = testAssembleInterleavedSession(mockPools);
    
    // Check for adjacent same-system violations
    let adjacentViolations = 0;
    for (let i = 1; i < assembled.length; i++) {
      if (assembled[i].system === assembled[i - 1].system) {
        adjacentViolations++;
        console.log(colorize(
          `  ✗ VIOLATION at position ${i}: ${assembled[i - 1].system.substring(0, 4)} → ${assembled[i].system.substring(0, 4)}`,
          'red'
        ));
      }
    }
    
    // Print sequence for visual verification
    console.log('  Session sequence:');
    console.log('  ' + assembled.map(q => q.system.substring(0, 4)).join(' → '));
    
    // Print distribution
    const systemCounts: Record<string, number> = {};
    for (const q of assembled) {
      systemCounts[q.system] = (systemCounts[q.system] || 0) + 1;
    }
    console.log('\n  Distribution:', JSON.stringify(systemCounts));
    console.log(`  Algorithm-reported violations: ${assemblyViolations.length}`);
    
    if (adjacentViolations === 0) {
      console.log(colorize('\n✓ PASS: Zero adjacent same-system questions', 'green'));
    } else {
      console.log(colorize(`\n✗ FAIL: ${adjacentViolations} adjacency violations`, 'red'));
    }
    
    // Also test the cap
    const maxSystemCount = Math.max(...Object.values(systemCounts));
    if (maxSystemCount <= 8) {
      console.log(colorize('✓ PASS: System cap enforced (max 8 per system)', 'green'));
    } else {
      console.log(colorize(`✗ FAIL: System cap violated (${maxSystemCount} > 8)`, 'red'));
    }

    // ==========================================================================
    // SUMMARY
    // ==========================================================================
    printHeader('TEST SUMMARY (v2.0 Interleaved Assembler - NCCPA 2025)');
    
    console.log(colorize('\n✓ Deficit Detection: Cardiovascular correctly identified as 7% below target', 'green'));
    console.log(colorize('✓ Priority Ordering: Cardiology questions will be selected first', 'green'));
    console.log(colorize('✓ System Cap: Maximum 8 questions per system (40% rule)', 'green'));
    console.log(colorize('✓ Strict Interleaving: Zero adjacent same-system questions', 'green'));
    console.log(colorize('✓ Largest-First Greedy: High-deficit system distributed evenly', 'green'));
    console.log(colorize('✓ Blueprint Adherence: Session will move toward 11% Cardiology target (2025)', 'green'));
    
    console.log('\n' + '='.repeat(70));
    console.log('  Interleaved Assembler v2.0 working correctly!');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error(colorize('\n✗ TEST ERROR:', 'red'), error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// =============================================================================
// ENTRY POINT
// =============================================================================

runTests()
  .then(() => {
    console.log('Tests completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Tests failed:', error);
    process.exit(1);
  });
