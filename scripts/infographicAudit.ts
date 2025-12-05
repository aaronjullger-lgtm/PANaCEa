/**
 * Infographic Audit Script
 *
 * This script analyzes the output of the infographicMatcher and provides
 * a detailed audit report including:
 * - Unmatched files that need manual review
 * - Files with multiple probable matches (ambiguous)
 * - Conditions missing infographics
 *
 * Run with: npx tsx scripts/infographicAudit.ts
 */

import fs from "fs";
import path from "path";

// ============================================================================
// Configuration
// ============================================================================

const OUTPUT_LINKS_PATH = "output/infographic_links.json";
const OUTPUT_AUDIT_PATH = "output/infographic_audit.json";

// ============================================================================
// Types (imported conceptually from infographicMatcher)
// ============================================================================

interface InfographicLink {
  conditionId: string;
  conditionName: string;
  file: string;
  confidence: number;
  tags: string[];
}

interface AuditEntry {
  file: string;
  reason: "unmatched" | "ambiguous";
  topCandidates?: Array<{ conditionId: string; conditionName: string; score: number }>;
}

interface MissingInfographicEntry {
  conditionId: string;
  conditionName: string;
}

interface AuditReport {
  unmatchedFiles: AuditEntry[];
  ambiguousFiles: AuditEntry[];
  conditionsMissingInfographics: MissingInfographicEntry[];
  summary: {
    totalInfographics: number;
    matchedCount: number;
    unmatchedCount: number;
    ambiguousCount: number;
    conditionsWithInfographics: number;
    conditionsWithoutInfographics: number;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Loads the infographic links from the output file
 */
function loadLinks(basePath: string): InfographicLink[] {
  const fullPath = path.resolve(basePath, OUTPUT_LINKS_PATH);

  if (!fs.existsSync(fullPath)) {
    console.log(`Links file not found: ${fullPath}`);
    console.log("Run infographicMatcher first.");
    return [];
  }

  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (err) {
    console.error(`Failed to parse links file: ${err}`);
    return [];
  }
}

/**
 * Loads the audit report from the output file
 */
function loadAuditReport(basePath: string): AuditReport | null {
  const fullPath = path.resolve(basePath, OUTPUT_AUDIT_PATH);

  if (!fs.existsSync(fullPath)) {
    console.log(`Audit file not found: ${fullPath}`);
    console.log("Run infographicMatcher first.");
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (err) {
    console.error(`Failed to parse audit file: ${err}`);
    return null;
  }
}

/**
 * Format a number as a percentage string
 */
function formatPercent(value: number, total: number): string {
  if (total === 0) return "N/A";
  return `${((value / total) * 100).toFixed(1)}%`;
}

/**
 * Prints a separator line
 */
function printSeparator(char: string = "=", length: number = 70): void {
  console.log(char.repeat(length));
}

/**
 * Prints a section header
 */
function printHeader(title: string): void {
  console.log("");
  printSeparator();
  console.log(` ${title}`);
  printSeparator();
  console.log("");
}

// ============================================================================
// Analysis Functions
// ============================================================================

/**
 * Analyzes confidence distribution of matched links
 */
function analyzeConfidenceDistribution(links: InfographicLink[]): void {
  if (links.length === 0) {
    console.log("No links to analyze.\n");
    return;
  }

  const buckets = {
    perfect: links.filter((l) => l.confidence >= 1.0).length,
    high: links.filter((l) => l.confidence >= 0.85 && l.confidence < 1.0).length,
    medium: links.filter((l) => l.confidence >= 0.7 && l.confidence < 0.85).length,
    low: links.filter((l) => l.confidence >= 0.65 && l.confidence < 0.7).length,
  };

  console.log("  Confidence Distribution:");
  console.log(`    Perfect (100%)     : ${buckets.perfect.toString().padStart(4)} ${formatPercent(buckets.perfect, links.length).padStart(7)}`);
  console.log(`    High (85-99%)      : ${buckets.high.toString().padStart(4)} ${formatPercent(buckets.high, links.length).padStart(7)}`);
  console.log(`    Medium (70-84%)    : ${buckets.medium.toString().padStart(4)} ${formatPercent(buckets.medium, links.length).padStart(7)}`);
  console.log(`    Low (65-69%)       : ${buckets.low.toString().padStart(4)} ${formatPercent(buckets.low, links.length).padStart(7)}`);
  console.log("");
}

/**
 * Analyzes tag usage across matched links
 */
function analyzeTagUsage(links: InfographicLink[]): void {
  const tagCounts: Record<string, number> = {};

  for (const link of links) {
    for (const tag of link.tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  const sortedTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (sortedTags.length === 0) {
    console.log("  No tags found in matched links.\n");
    return;
  }

  console.log("  Most Common Tags (Top 10):");
  for (const [tag, count] of sortedTags) {
    console.log(`    ${tag.padEnd(25)} : ${count}`);
  }
  console.log("");
}

/**
 * Displays unmatched files with their best candidates
 */
function displayUnmatchedFiles(entries: AuditEntry[]): void {
  if (entries.length === 0) {
    console.log("  No unmatched files.\n");
    return;
  }

  console.log(`  Found ${entries.length} unmatched file(s):\n`);

  for (const entry of entries.slice(0, 20)) {
    console.log(`  File: ${entry.file}`);
    if (entry.topCandidates && entry.topCandidates.length > 0) {
      console.log("    Top candidates:");
      for (const candidate of entry.topCandidates) {
        console.log(`      - ${candidate.conditionName} (${candidate.conditionId}): ${(candidate.score * 100).toFixed(0)}%`);
      }
    } else {
      console.log("    No suitable candidates found");
    }
    console.log("");
  }

  if (entries.length > 20) {
    console.log(`  ... and ${entries.length - 20} more unmatched files.\n`);
  }
}

/**
 * Displays ambiguous files with competing candidates
 */
function displayAmbiguousFiles(entries: AuditEntry[]): void {
  if (entries.length === 0) {
    console.log("  No ambiguous files.\n");
    return;
  }

  console.log(`  Found ${entries.length} ambiguous file(s):\n`);

  for (const entry of entries.slice(0, 20)) {
    console.log(`  File: ${entry.file}`);
    if (entry.topCandidates && entry.topCandidates.length > 0) {
      console.log("    Competing candidates:");
      for (const candidate of entry.topCandidates) {
        console.log(`      - ${candidate.conditionName} (${candidate.conditionId}): ${(candidate.score * 100).toFixed(0)}%`);
      }
    }
    console.log("");
  }

  if (entries.length > 20) {
    console.log(`  ... and ${entries.length - 20} more ambiguous files.\n`);
  }
}

/**
 * Displays conditions without infographics
 */
function displayMissingInfographics(entries: MissingInfographicEntry[]): void {
  if (entries.length === 0) {
    console.log("  All conditions have infographics!\n");
    return;
  }

  console.log(`  Found ${entries.length} condition(s) without infographics:\n`);

  // Group by first letter for easier reading
  const grouped: Record<string, MissingInfographicEntry[]> = {};

  for (const entry of entries) {
    const firstLetter = entry.conditionName.charAt(0).toUpperCase();
    if (!grouped[firstLetter]) {
      grouped[firstLetter] = [];
    }
    grouped[firstLetter].push(entry);
  }

  const sortedLetters = Object.keys(grouped).sort();
  let displayedCount = 0;
  const maxDisplay = 50;

  for (const letter of sortedLetters) {
    if (displayedCount >= maxDisplay) break;

    const conditions = grouped[letter].slice(0, maxDisplay - displayedCount);
    displayedCount += conditions.length;

    for (const condition of conditions) {
      console.log(`    - ${condition.conditionName} (${condition.conditionId})`);
    }
  }

  if (entries.length > maxDisplay) {
    console.log(`\n  ... and ${entries.length - maxDisplay} more conditions without infographics.`);
  }
  console.log("");
}

// ============================================================================
// Main Execution
// ============================================================================

/**
 * Main function to run the audit analysis
 */
export function runInfographicAudit(): void {
  const basePath = process.cwd();

  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║              INFOGRAPHIC MATCHER - AUDIT REPORT                      ║");
  console.log("╚══════════════════════════════════════════════════════════════════════╝");
  console.log("");

  // Load data
  const links = loadLinks(basePath);
  const auditReport = loadAuditReport(basePath);

  if (!auditReport) {
    console.log("Cannot generate audit report without data. Run infographicMatcher first.");
    return;
  }

  // Summary Section
  printHeader("SUMMARY");
  console.log("  Overall Statistics:");
  console.log(`    Total Infographics    : ${auditReport.summary.totalInfographics}`);
  console.log(`    Successfully Matched  : ${auditReport.summary.matchedCount} (${formatPercent(auditReport.summary.matchedCount, auditReport.summary.totalInfographics)})`);
  console.log(`    Unmatched             : ${auditReport.summary.unmatchedCount} (${formatPercent(auditReport.summary.unmatchedCount, auditReport.summary.totalInfographics)})`);
  console.log(`    Ambiguous             : ${auditReport.summary.ambiguousCount} (${formatPercent(auditReport.summary.ambiguousCount, auditReport.summary.totalInfographics)})`);
  console.log("");
  console.log("  Condition Coverage:");
  const totalConditions = auditReport.summary.conditionsWithInfographics + auditReport.summary.conditionsWithoutInfographics;
  console.log(`    Conditions with Infographics    : ${auditReport.summary.conditionsWithInfographics}`);
  console.log(`    Conditions without Infographics : ${auditReport.summary.conditionsWithoutInfographics}`);
  console.log(`    Coverage Rate                   : ${formatPercent(auditReport.summary.conditionsWithInfographics, totalConditions)}`);
  console.log("");

  // Confidence Analysis
  printHeader("CONFIDENCE ANALYSIS");
  analyzeConfidenceDistribution(links);

  // Tag Analysis
  printHeader("TAG ANALYSIS");
  analyzeTagUsage(links);

  // Unmatched Files
  printHeader("UNMATCHED FILES (Require Manual Review)");
  displayUnmatchedFiles(auditReport.unmatchedFiles);

  // Ambiguous Files
  printHeader("AMBIGUOUS FILES (Multiple Possible Matches)");
  displayAmbiguousFiles(auditReport.ambiguousFiles);

  // Missing Infographics
  printHeader("CONDITIONS WITHOUT INFOGRAPHICS");
  displayMissingInfographics(auditReport.conditionsMissingInfographics);

  // Recommendations
  printHeader("RECOMMENDATIONS");
  console.log("  Actions to improve matching quality:\n");

  if (auditReport.summary.unmatchedCount > 0) {
    console.log("  1. UNMATCHED FILES:");
    console.log("     - Review filenames and rename to match condition IDs or names");
    console.log("     - Use format: condition_name.png or condition-name[tag1-tag2].svg");
    console.log("");
  }

  if (auditReport.summary.ambiguousCount > 0) {
    console.log("  2. AMBIGUOUS FILES:");
    console.log("     - Make filenames more specific to differentiate conditions");
    console.log("     - Consider adding condition ID prefix to filename");
    console.log("");
  }

  if (auditReport.summary.conditionsWithoutInfographics > 0) {
    console.log("  3. MISSING INFOGRAPHICS:");
    console.log("     - Create infographics for conditions without visual content");
    console.log("     - Prioritize commonly tested or high-yield conditions");
    console.log("");
  }

  console.log("\n" + "=".repeat(70) + "\n");
  console.log("Audit complete. Review the above sections for detailed analysis.");
  console.log("\n");
}

// Run if executed directly
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() || '');
if (isMainModule) {
  runInfographicAudit();
}
