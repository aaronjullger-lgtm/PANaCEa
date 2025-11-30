/**
 * Infographic Matcher Script
 *
 * This script automatically associates image files (PNG, JPG, PDF, SVG, WEBP)
 * with the correct medical condition entry based on filename keywords and tags.
 *
 * Matches images to conditions using fuzzy comparison between:
 * - condition ID
 * - condition name
 * - slug/formatted name
 * - keywords inside filenames
 * - optional tags
 *
 * Run with: npx tsx scripts/infographicMatcher.ts
 */

import fs from "fs";
import path from "path";
import {
  normalize,
  similarityScore,
  parseBracketTags,
  extractBaseName,
  normalizeForMatch,
} from "../lib/infographicMatcherUtils.js";
import { extractTags } from "../lib/mediaMatcherUtils.js";

// ============================================================================
// Configuration
// ============================================================================

const INFOGRAPHICS_DIR = "assets/infographics";
const CONDITION_DATASET_PATH = "output/conditionContent.transformed.json";
const OUTPUT_LINKS_PATH = "output/infographic_links.json";
const OUTPUT_AUDIT_PATH = "output/infographic_audit.json";

// Matching thresholds
const CONFIDENCE_THRESHOLD = 0.65;
const AMBIGUITY_MARGIN = 0.1; // If second best is within 10% of best, flag as ambiguous

// Supported image extensions
const SUPPORTED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".pdf",
  ".svg",
  ".webp",
]);

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a condition from the dataset
 */
interface Condition {
  id: string;
  name: string;
  slug?: string;
  keywords?: string[];
}

/**
 * Represents a successful infographic-condition link
 */
export interface InfographicLink {
  conditionId: string;
  conditionName: string;
  file: string;
  confidence: number;
  tags: string[];
}

/**
 * Represents a candidate match during scoring
 */
interface MatchCandidate {
  conditionId: string;
  conditionName: string;
  score: number;
}

/**
 * Represents an entry in the audit log
 */
export interface AuditEntry {
  file: string;
  reason: "unmatched" | "ambiguous";
  topCandidates?: Array<{ conditionId: string; conditionName: string; score: number }>;
}

/**
 * Represents a condition that has no infographic
 */
export interface MissingInfographicEntry {
  conditionId: string;
  conditionName: string;
}

/**
 * Full audit report structure
 */
export interface AuditReport {
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
 * Scans the infographics directory for image files
 */
function scanInfographics(basePath: string): string[] {
  const fullPath = path.resolve(basePath, INFOGRAPHICS_DIR);
  const files: string[] = [];

  if (!fs.existsSync(fullPath)) {
    console.log(`Infographics directory does not exist: ${fullPath}`);
    console.log("Creating empty directory...");
    fs.mkdirSync(fullPath, { recursive: true });
    return files;
  }

  const entries = fs.readdirSync(fullPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTENSIONS.has(ext)) {
        files.push(entry.name);
      }
    }
  }

  return files;
}

/**
 * Loads conditions from the dataset file
 */
function loadConditions(basePath: string): Condition[] {
  const fullPath = path.resolve(basePath, CONDITION_DATASET_PATH);

  if (!fs.existsSync(fullPath)) {
    console.error(`Condition dataset not found: ${fullPath}`);
    console.log("Returning empty condition list.");
    return [];
  }

  try {
    const data = JSON.parse(fs.readFileSync(fullPath, "utf8"));

    // The dataset is an object with condition IDs as keys
    return Object.entries(data).map(([id, value]) => {
      // Extract condition name from the value object
      let name = id;
      let keywords: string[] = [];

      if (typeof value === "object" && value !== null) {
        if ("condition" in value) {
          name = (value as { condition: string }).condition;
        }
        if ("keywords" in value && Array.isArray((value as { keywords: string[] }).keywords)) {
          keywords = (value as { keywords: string[] }).keywords;
        }
      }

      // Generate slug from name
      const slug = normalize(name).replace(/\s+/g, "-");

      return { id, name, slug, keywords };
    });
  } catch (err) {
    console.error(`Failed to parse condition dataset: ${err}`);
    return [];
  }
}

/**
 * Computes match score for a filename against a condition
 * Uses matching priority:
 * 1. exact conditionId match
 * 2. exact normalized name match
 * 3. substring inclusion score
 * 4. similarity score fallback
 */
function computeMatchScoreForCondition(
  filename: string,
  condition: Condition
): number {
  const baseName = extractBaseName(filename);
  const normalizedFilename = normalizeForMatch(baseName);
  const normalizedId = normalizeForMatch(condition.id);
  const normalizedName = normalizeForMatch(condition.name);

  // Priority 1: Exact ID match
  if (normalizedFilename === normalizedId && normalizedFilename.length > 0) {
    return 1.0;
  }

  // Priority 2: Exact normalized name match
  if (normalizedFilename === normalizedName && normalizedFilename.length > 0) {
    return 1.0;
  }

  // Priority 3: Check against slug if available
  if (condition.slug) {
    const normalizedSlug = normalizeForMatch(condition.slug);
    if (normalizedFilename === normalizedSlug && normalizedFilename.length > 0) {
      return 0.95;
    }
  }

  // Extract tags from filename
  const filenameTags = [...extractTags(filename), ...parseBracketTags(filename)];

  // Check if any tag matches the condition ID or name
  for (const tag of filenameTags) {
    const normalizedTag = normalizeForMatch(tag);
    if (normalizedTag === normalizedId || normalizedTag === normalizedName) {
      return 0.9;
    }
  }

  // Priority 4: Substring inclusion check
  if (normalizedFilename.includes(normalizedId) && normalizedId.length > 3) {
    const coverage = normalizedId.length / normalizedFilename.length;
    return 0.6 + coverage * 0.3; // 0.6-0.9
  }

  if (normalizedFilename.includes(normalizedName) && normalizedName.length > 3) {
    const coverage = normalizedName.length / normalizedFilename.length;
    return 0.55 + coverage * 0.3; // 0.55-0.85
  }

  // Check if filename keywords exist within condition name/id
  const filenameWords = baseName.toLowerCase().split(/[_\-\s]+/).filter(w => w.length > 2);
  let keywordMatchCount = 0;
  for (const word of filenameWords) {
    if (normalizedName.includes(word) || normalizedId.includes(word)) {
      keywordMatchCount++;
    }
  }

  if (keywordMatchCount > 0 && filenameWords.length > 0) {
    const keywordScore = keywordMatchCount / filenameWords.length;
    if (keywordScore >= 0.5) {
      return 0.5 + keywordScore * 0.3; // 0.5-0.8
    }
  }

  // Priority 5: Similarity score fallback
  const idSimilarity = similarityScore(baseName, condition.id);
  const nameSimilarity = similarityScore(baseName, condition.name);

  return Math.max(idSimilarity, nameSimilarity);
}

/**
 * Find the best matching condition for an infographic file
 */
function findBestMatch(
  filename: string,
  conditions: Condition[]
): { link: InfographicLink | null; audit: AuditEntry | null } {
  if (conditions.length === 0) {
    return {
      link: null,
      audit: {
        file: filename,
        reason: "unmatched",
        topCandidates: [],
      },
    };
  }

  // Score all conditions
  const candidates: MatchCandidate[] = conditions.map((condition) => ({
    conditionId: condition.id,
    conditionName: condition.name,
    score: computeMatchScoreForCondition(filename, condition),
  }));

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Get top candidates for reporting
  const topCandidates = candidates.slice(0, 3).map((c) => ({
    conditionId: c.conditionId,
    conditionName: c.conditionName,
    score: Math.round(c.score * 100) / 100,
  }));

  const best = candidates[0];

  // Check if best score meets confidence threshold
  if (best.score < CONFIDENCE_THRESHOLD) {
    return {
      link: null,
      audit: {
        file: filename,
        reason: "unmatched",
        topCandidates,
      },
    };
  }

  // Check for ambiguity
  if (candidates.length > 1) {
    const secondBest = candidates[1];
    const margin = best.score - secondBest.score;

    if (margin < AMBIGUITY_MARGIN) {
      return {
        link: null,
        audit: {
          file: filename,
          reason: "ambiguous",
          topCandidates,
        },
      };
    }
  }

  // Successful match - extract tags
  const tags = [...extractTags(filename), ...parseBracketTags(filename)];

  return {
    link: {
      conditionId: best.conditionId,
      conditionName: best.conditionName,
      file: filename,
      confidence: Math.round(best.score * 100) / 100,
      tags,
    },
    audit: null,
  };
}

/**
 * Find conditions that have no infographics
 */
function findConditionsWithoutInfographics(
  conditions: Condition[],
  links: InfographicLink[]
): MissingInfographicEntry[] {
  const linkedConditionIds = new Set(links.map((l) => l.conditionId));

  return conditions
    .filter((c) => !linkedConditionIds.has(c.id))
    .map((c) => ({
      conditionId: c.id,
      conditionName: c.name,
    }));
}

// ============================================================================
// Main Execution
// ============================================================================

/**
 * Main function to run the infographic matcher
 */
export function runInfographicMatcher(): {
  links: InfographicLink[];
  auditReport: AuditReport;
} {
  const basePath = process.cwd();

  console.log("Infographic Matcher - Starting...\n");

  // Step 1: Scan infographics directory
  console.log("Step 1: Scanning infographics directory...");
  const infographicFiles = scanInfographics(basePath);
  console.log(`  Found ${infographicFiles.length} infographic files\n`);

  // Step 2: Load conditions
  console.log("Step 2: Loading condition dataset...");
  const conditions = loadConditions(basePath);
  console.log(`  Loaded ${conditions.length} conditions\n`);

  // Step 3: Match infographics to conditions
  console.log("Step 3: Matching infographics to conditions...");
  const links: InfographicLink[] = [];
  const unmatchedFiles: AuditEntry[] = [];
  const ambiguousFiles: AuditEntry[] = [];

  for (const filename of infographicFiles) {
    const result = findBestMatch(filename, conditions);

    if (result.link) {
      links.push(result.link);
    }

    if (result.audit) {
      if (result.audit.reason === "ambiguous") {
        ambiguousFiles.push(result.audit);
      } else {
        unmatchedFiles.push(result.audit);
      }
    }
  }

  console.log(`  Successful matches: ${links.length}`);
  console.log(`  Unmatched files: ${unmatchedFiles.length}`);
  console.log(`  Ambiguous files: ${ambiguousFiles.length}\n`);

  // Step 4: Find conditions without infographics
  console.log("Step 4: Identifying conditions without infographics...");
  const conditionsMissingInfographics = findConditionsWithoutInfographics(
    conditions,
    links
  );
  console.log(`  Conditions without infographics: ${conditionsMissingInfographics.length}\n`);

  // Build audit report
  const auditReport: AuditReport = {
    unmatchedFiles,
    ambiguousFiles,
    conditionsMissingInfographics,
    summary: {
      totalInfographics: infographicFiles.length,
      matchedCount: links.length,
      unmatchedCount: unmatchedFiles.length,
      ambiguousCount: ambiguousFiles.length,
      conditionsWithInfographics: links.length,
      conditionsWithoutInfographics: conditionsMissingInfographics.length,
    },
  };

  // Step 5: Write output files
  console.log("Step 5: Writing output files...");

  // Ensure output directory exists
  const outputDir = path.resolve(basePath, "output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`  Created output directory: ${outputDir}`);
  }

  // Write infographic links
  const linksPath = path.resolve(basePath, OUTPUT_LINKS_PATH);
  fs.writeFileSync(linksPath, JSON.stringify(links, null, 2));
  console.log(`  Written: ${linksPath}`);

  // Write audit report
  const auditPath = path.resolve(basePath, OUTPUT_AUDIT_PATH);
  fs.writeFileSync(auditPath, JSON.stringify(auditReport, null, 2));
  console.log(`  Written: ${auditPath}`);

  console.log("\nInfographic Matcher - Complete!");

  return { links, auditReport };
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runInfographicMatcher();
}
