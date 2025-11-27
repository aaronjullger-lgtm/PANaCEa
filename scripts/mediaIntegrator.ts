/**
 * Media Integrator Script
 *
 * This script scans media directories and automatically associates
 * supporting figures (EKGs, X-rays, CT, MRI, ultrasound, lab tables, diagrams)
 * with their corresponding medical conditions using filenames, metadata,
 * and optional annotations.
 *
 * Run with: npx tsx scripts/mediaIntegrator.ts
 * Or with: npm run media:integrate
 */

import fs from "fs";
import path from "path";
import {
  normalize,
  similarityScore,
  extractTags,
  detectMediaTypeFromFolder,
  MediaType,
} from "../lib/mediaMatcherUtils.js";

// Configuration
const MEDIA_DIRECTORIES = [
  "assets/media/ekg",
  "assets/media/labs",
  "assets/media/imaging",
  "assets/media/diagrams",
];

const CONDITION_DATASET_PATH = "output/conditionContent.transformed.json";
const OUTPUT_LINKS_PATH = "output/media_links.json";
const OUTPUT_AUDIT_PATH = "output/media_audit.json";

// Matching thresholds
const CONFIDENCE_THRESHOLD = 0.65;
const DISAMBIGUATION_MARGIN = 0.15;

// Supported image extensions
const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
]);

/**
 * Represents a media asset discovered during scanning
 */
interface MediaAsset {
  filepath: string;
  filename: string;
  type: MediaType;
  tags: string[];
}

/**
 * Represents a condition from the dataset
 */
interface Condition {
  id: string;
  name: string;
}

/**
 * Represents a successful media-condition link
 */
interface MediaLink {
  conditionId: string;
  filename: string;
  type: MediaType;
  tags: string[];
  confidence: number;
}

/**
 * Represents an entry in the audit log
 */
interface AuditEntry {
  file: string;
  reason: string;
  possibleMatches?: Array<{
    conditionId: string;
    score: number;
  }>;
}

/**
 * Recursively scans a directory for media files
 */
function scanDirectory(dir: string, basePath: string): MediaAsset[] {
  const assets: MediaAsset[] = [];
  const fullPath = path.resolve(basePath, dir);

  if (!fs.existsSync(fullPath)) {
    console.log(`Directory does not exist, skipping: ${fullPath}`);
    return assets;
  }

  const entries = fs.readdirSync(fullPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(fullPath, entry.name);

    if (entry.isDirectory()) {
      // Recursively scan subdirectories
      const relativePath = path.join(dir, entry.name);
      assets.push(...scanDirectory(relativePath, basePath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (IMAGE_EXTENSIONS.has(ext)) {
        // Load tags from filename
        let tags = extractTags(entry.name);

        // Check for sidecar metadata file
        const metadataPath = entryPath.replace(/\.[^.]+$/, ".json");
        if (fs.existsSync(metadataPath)) {
          try {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
            if (Array.isArray(metadata.tags)) {
              const metadataTags = metadata.tags
                .map((t: unknown) => (typeof t === "string" ? normalize(t) : ""))
                .filter((t: string) => t.length > 0);
              tags = [...new Set([...tags, ...metadataTags])];
            }
          } catch (err) {
            console.warn(`Warning: Failed to parse metadata file: ${metadataPath}`);
          }
        }

        assets.push({
          filepath: entryPath,
          filename: entry.name,
          type: detectMediaTypeFromFolder(entryPath),
          tags,
        });
      }
    }
  }

  return assets;
}

/**
 * Loads conditions from the dataset file
 */
function loadConditions(basePath: string): Condition[] {
  const fullPath = path.resolve(basePath, CONDITION_DATASET_PATH);

  if (!fs.existsSync(fullPath)) {
    console.error(`Condition dataset not found: ${fullPath}`);
    return [];
  }

  try {
    const data = JSON.parse(fs.readFileSync(fullPath, "utf8"));

    // The dataset is an object with condition IDs as keys
    return Object.entries(data).map(([id, value]) => {
      // Extract condition name from the ID or the value object
      let name = id;
      if (typeof value === "object" && value !== null && "condition" in value) {
        name = (value as { condition: string }).condition;
      }
      return { id, name };
    });
  } catch (err) {
    console.error(`Failed to parse condition dataset: ${err}`);
    return [];
  }
}

/**
 * Computes matching scores for a media asset against all conditions
 */
function computeMatchScores(
  asset: MediaAsset,
  conditions: Condition[]
): Array<{ conditionId: string; score: number }> {
  const scores: Array<{ conditionId: string; score: number }> = [];

  for (const condition of conditions) {
    // Compute scores based on filename and condition ID/name
    const filenameNormalized = normalize(asset.filename.replace(/\.[^.]+$/, ""));
    const conditionIdNormalized = normalize(condition.id);
    const conditionNameNormalized = normalize(condition.name);

    // Score against condition ID
    const idScore = similarityScore(filenameNormalized, conditionIdNormalized);

    // Score against condition name
    const nameScore = similarityScore(filenameNormalized, conditionNameNormalized);

    // Check if any tag matches the condition
    let tagScore = 0;
    for (const tag of asset.tags) {
      const tagIdScore = similarityScore(tag, conditionIdNormalized);
      const tagNameScore = similarityScore(tag, conditionNameNormalized);
      tagScore = Math.max(tagScore, tagIdScore, tagNameScore);
    }

    // Combined score: take the best score from all matching methods
    const combinedScore = Math.max(idScore, nameScore, tagScore);

    if (combinedScore > 0) {
      scores.push({
        conditionId: condition.id,
        score: combinedScore,
      });
    }
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  return scores;
}

/**
 * Determines the best match for a media asset
 */
function findBestMatch(
  asset: MediaAsset,
  conditions: Condition[]
): { link: MediaLink | null; audit: AuditEntry | null } {
  const scores = computeMatchScores(asset, conditions);

  if (scores.length === 0) {
    return {
      link: null,
      audit: {
        file: asset.filename,
        reason: "no suitable match",
        possibleMatches: [],
      },
    };
  }

  const bestScore = scores[0];

  // Check if best score meets the confidence threshold
  if (bestScore.score < CONFIDENCE_THRESHOLD) {
    return {
      link: null,
      audit: {
        file: asset.filename,
        reason: "no suitable match",
        possibleMatches: scores.slice(0, 3).map((s) => ({
          conditionId: s.conditionId,
          score: Math.round(s.score * 100) / 100,
        })),
      },
    };
  }

  // Check for ambiguity
  if (scores.length > 1) {
    const secondBestScore = scores[1];
    const margin = bestScore.score - secondBestScore.score;

    if (margin < DISAMBIGUATION_MARGIN) {
      return {
        link: null,
        audit: {
          file: asset.filename,
          reason: "ambiguous match",
          possibleMatches: scores.slice(0, 3).map((s) => ({
            conditionId: s.conditionId,
            score: Math.round(s.score * 100) / 100,
          })),
        },
      };
    }
  }

  // Successful match
  return {
    link: {
      conditionId: bestScore.conditionId,
      filename: asset.filename,
      type: asset.type,
      tags: asset.tags,
      confidence: Math.round(bestScore.score * 100) / 100,
    },
    audit: null,
  };
}

/**
 * Main execution function
 */
function run(): void {
  const basePath = process.cwd();

  console.log("Media Integrator - Starting...\n");

  // Step 1: Scan media directories
  console.log("Step 1: Scanning media directories...");
  const assets: MediaAsset[] = [];

  for (const dir of MEDIA_DIRECTORIES) {
    console.log(`  Scanning: ${dir}`);
    const dirAssets = scanDirectory(dir, basePath);
    assets.push(...dirAssets);
    console.log(`    Found ${dirAssets.length} media files`);
  }

  console.log(`\nTotal media files found: ${assets.length}\n`);

  // Step 2: Load conditions
  console.log("Step 2: Loading condition dataset...");
  const conditions = loadConditions(basePath);
  console.log(`  Loaded ${conditions.length} conditions\n`);

  if (conditions.length === 0) {
    console.warn("Warning: No conditions loaded. Creating empty output files.");
  }

  // Step 3: Match media to conditions
  console.log("Step 3: Matching media to conditions...");
  const links: MediaLink[] = [];
  const audits: AuditEntry[] = [];

  for (const asset of assets) {
    const result = findBestMatch(asset, conditions);

    if (result.link) {
      links.push(result.link);
    }
    if (result.audit) {
      audits.push(result.audit);
    }
  }

  console.log(`  Successful matches: ${links.length}`);
  console.log(`  Unresolved/Ambiguous: ${audits.length}\n`);

  // Step 4: Write output files
  console.log("Step 4: Writing output files...");

  // Ensure output directory exists
  const outputDir = path.resolve(basePath, "output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`  Created output directory: ${outputDir}`);
  }

  // Write media links
  const linksPath = path.resolve(basePath, OUTPUT_LINKS_PATH);
  fs.writeFileSync(linksPath, JSON.stringify(links, null, 2));
  console.log(`  Written: ${linksPath}`);

  // Write audit file
  const auditPath = path.resolve(basePath, OUTPUT_AUDIT_PATH);
  fs.writeFileSync(auditPath, JSON.stringify(audits, null, 2));
  console.log(`  Written: ${auditPath}`);

  console.log("\nMedia Integrator - Complete!");
}

// Execute the script
run();
