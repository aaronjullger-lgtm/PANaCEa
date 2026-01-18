/**
 * Session Interleaving Utility
 *
 * @deprecated DEPRECATED as of v2.0.0 - Use MainSessionQuestionSelector instead.
 *
 * The new Interleaved Assembler in lib/services/mainSessionQuestionSelector.ts
 * implements stricter interleaving (no same system twice in a row) and is
 * integrated directly into the question selection algorithm.
 *
 * This file is kept for backward compatibility with existing imports but
 * should not be used for new code.
 *
 * See: docs/plans/interleaver-upgrade.md for migration details.
 *
 * ---
 *
 * Legacy Purpose: Prevent clustering of questions from the same system, which reduces
 * learning effectiveness. Research shows interleaved practice improves long-term
 * retention compared to blocked practice.
 *
 * Legacy Rules:
 * - Maximum 2 questions from the same system in any 5-question sliding window
 * - Respects question difficulty and other properties
 * - Maintains diversity for better learning outcomes
 */

interface Question {
  id: string;
  system: string;
  [key: string]: any; // Allow other properties
}

/**
 * Check if a question sequence violates interleaving rules
 *
 * @param questions - Array of questions to check
 * @param maxSameSystem - Maximum questions from same system in window (default: 2)
 * @param windowSize - Size of sliding window to check (default: 5)
 * @returns Array of violation indices (empty if valid)
 */
export function findInterleavingViolations(
  questions: Question[],
  maxSameSystem: number = 2,
  windowSize: number = 5
): number[] {
  const violations: number[] = [];

  if (questions.length < windowSize) {
    // Too few questions to have violations
    return violations;
  }

  // Slide window through questions
  for (let i = 0; i <= questions.length - windowSize; i++) {
    const window = questions.slice(i, i + windowSize);

    // Count questions per system in this window
    const systemCounts = new Map<string, number>();

    for (const q of window) {
      systemCounts.set(q.system, (systemCounts.get(q.system) || 0) + 1);
    }

    // Check for violations
    for (const [system, count] of systemCounts.entries()) {
      if (count > maxSameSystem) {
        // Record the end of the window as violation point
        violations.push(i + windowSize - 1);
        break; // One violation per window is enough
      }
    }
  }

  return violations;
}

/**
 * Ensure questions are properly interleaved by system
 *
 * Uses a greedy algorithm:
 * 1. Select questions one at a time
 * 2. Always choose a question that doesn't violate the window constraint
 * 3. If all remaining questions would violate, choose the least-recently-used system
 *
 * @param questions - Array of questions to interleave
 * @param maxSameSystem - Maximum questions from same system in window (default: 2)
 * @param windowSize - Size of sliding window to check (default: 5)
 * @returns Reordered array of questions with proper interleaving
 */
export function ensureInterleaving<T extends Question>(
  questions: T[],
  maxSameSystem: number = 2,
  windowSize: number = 5
): T[] {
  if (questions.length <= windowSize) {
    // Too few questions to need interleaving
    return [...questions];
  }

  const result: T[] = [];
  const remaining = [...questions];

  while (remaining.length > 0) {
    // Get current window (last windowSize-1 questions)
    const windowStart = Math.max(0, result.length - (windowSize - 1));
    const currentWindow = result.slice(windowStart);

    // Count systems in current window
    const systemCounts = new Map<string, number>();
    for (const q of currentWindow) {
      systemCounts.set(q.system, (systemCounts.get(q.system) || 0) + 1);
    }

    // Find a question that doesn't violate constraint
    let selectedIndex = -1;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const currentCount = systemCounts.get(candidate.system) || 0;

      if (currentCount < maxSameSystem) {
        selectedIndex = i;
        break;
      }
    }

    // If no valid question found, choose from least-represented system
    if (selectedIndex === -1) {
      // Find system with lowest count in current window
      const systemsInRemaining = new Set(remaining.map((q) => q.system));
      let minCount = Infinity;
      let leastUsedSystem = '';

      for (const sys of systemsInRemaining) {
        const count = systemCounts.get(sys) || 0;
        if (count < minCount) {
          minCount = count;
          leastUsedSystem = sys;
        }
      }

      // Select first question from least-used system
      selectedIndex = remaining.findIndex((q) => q.system === leastUsedSystem);

      if (selectedIndex === -1) {
        // Fallback: just take first remaining question
        selectedIndex = 0;
      }
    }

    // Move selected question to result
    const [selected] = remaining.splice(selectedIndex, 1);
    result.push(selected);
  }

  return result;
}

/**
 * Validate that a question sequence meets interleaving requirements
 *
 * @param questions - Array of questions to validate
 * @param maxSameSystem - Maximum questions from same system in window (default: 2)
 * @param windowSize - Size of sliding window to check (default: 5)
 * @returns true if valid, false if violations found
 */
export function validateInterleaving(
  questions: Question[],
  maxSameSystem: number = 2,
  windowSize: number = 5
): boolean {
  const violations = findInterleavingViolations(questions, maxSameSystem, windowSize);
  return violations.length === 0;
}

/**
 * Get interleaving quality metrics for a question sequence
 *
 * @param questions - Array of questions to analyze
 * @param windowSize - Size of sliding window to check (default: 5)
 * @returns Metrics about interleaving quality
 */
export function getInterleavingMetrics(
  questions: Question[],
  windowSize: number = 5
): {
  totalQuestions: number;
  uniqueSystems: number;
  maxConsecutiveSameSystem: number;
  avgSystemsPerWindow: number;
  violations: number;
} {
  if (questions.length === 0) {
    return {
      totalQuestions: 0,
      uniqueSystems: 0,
      maxConsecutiveSameSystem: 0,
      avgSystemsPerWindow: 0,
      violations: 0,
    };
  }

  // Count unique systems
  const uniqueSystems = new Set(questions.map((q) => q.system)).size;

  // Find max consecutive same system
  let maxConsecutive = 1;
  let currentConsecutive = 1;

  for (let i = 1; i < questions.length; i++) {
    if (questions[i].system === questions[i - 1].system) {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 1;
    }
  }

  // Calculate average unique systems per window
  let totalUniqueSystems = 0;
  let windowCount = 0;

  if (questions.length >= windowSize) {
    for (let i = 0; i <= questions.length - windowSize; i++) {
      const window = questions.slice(i, i + windowSize);
      const systemsInWindow = new Set(window.map((q) => q.system));
      totalUniqueSystems += systemsInWindow.size;
      windowCount++;
    }
  }

  const avgSystemsPerWindow = windowCount > 0 ? totalUniqueSystems / windowCount : 0;

  // Count violations (windows with more than 2 from same system)
  const violations = findInterleavingViolations(questions, 2, windowSize);

  return {
    totalQuestions: questions.length,
    uniqueSystems,
    maxConsecutiveSameSystem: maxConsecutive,
    avgSystemsPerWindow: Math.round(avgSystemsPerWindow * 10) / 10,
    violations: violations.length,
  };
}

/**
 * Get a human-readable report of interleaving quality
 *
 * @param questions - Array of questions to analyze
 * @returns String report
 */
export function getInterleavingReport(questions: Question[]): string {
  const metrics = getInterleavingMetrics(questions);

  const lines = [
    `📊 Interleaving Quality Report`,
    ``,
    `Total Questions: ${metrics.totalQuestions}`,
    `Unique Systems: ${metrics.uniqueSystems}`,
    `Max Consecutive (Same System): ${metrics.maxConsecutiveSameSystem}`,
    `Avg Systems per 5Q Window: ${metrics.avgSystemsPerWindow}`,
    `Violations (>2 in 5Q window): ${metrics.violations}`,
    ``,
    `Quality: ${metrics.violations === 0 ? '✅ PASS' : '❌ NEEDS IMPROVEMENT'}`,
  ];

  if (metrics.violations > 0) {
    lines.push(
      ``,
      `⚠️  Warning: This sequence has ${metrics.violations} violation(s).`,
      `Consider calling ensureInterleaving() to fix.`
    );
  }

  return lines.join('\n');
}

/**
 * Shuffle questions while maintaining interleaving constraints
 * Useful for adding variety while respecting learning science
 *
 * @param questions - Array of questions to shuffle
 * @param maxSameSystem - Maximum questions from same system in window (default: 2)
 * @param windowSize - Size of sliding window to check (default: 5)
 * @returns Shuffled and interleaved array
 */
export function shuffleWithInterleaving<T extends Question>(
  questions: T[],
  maxSameSystem: number = 2,
  windowSize: number = 5
): T[] {
  // First shuffle randomly
  const shuffled = [...questions].sort(() => Math.random() - 0.5);

  // Then apply interleaving
  return ensureInterleaving(shuffled, maxSameSystem, windowSize);
}

/**
 * Group questions by system for analysis
 * Useful for debugging and understanding session composition
 *
 * @param questions - Array of questions to group
 * @returns Map of system -> question IDs
 */
export function groupQuestionsBySystem(questions: Question[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const q of questions) {
    if (!groups.has(q.system)) {
      groups.set(q.system, []);
    }
    groups.get(q.system)!.push(q.id);
  }

  return groups;
}
