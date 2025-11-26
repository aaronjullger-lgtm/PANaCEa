#!/usr/bin/env node
/**
 * Media Integrator Script
 *
 * Scans media directories and automatically associates media files
 * with corresponding medical conditions using filename matching,
 * metadata, and fuzzy similarity.
 *
 * Usage: npx tsx scripts/mediaIntegrator.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  normalize,
  similarityScore,
  extractTags,
  detectMediaTypeFromFolder,
  combinedMatchScore,
  type MediaType,
} from "../lib/mediaMatcherUtils";

import type {
  MediaLink,
  MediaAuditEntry,
  MediaSidecarMetadata,
  ConditionEntry,
  ConditionsDataset,
  MatchingConfig,
} from "../types/media";

// ============================================================
// CONFIGURATION
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const MEDIA_DIRS = [
  path.join(PROJECT_ROOT, "assets", "media", "ekg"),
  path.join(PROJECT_ROOT, "assets", "media", "labs"),
  path.join(PROJECT_ROOT, "assets", "media", "imaging"),
  path.join(PROJECT_ROOT, "assets", "media", "diagrams"),
];
const CONDITIONS_PATH = path.join(
  PROJECT_ROOT,
  "output",
  "conditionContent.transformed.json"
);
const OUTPUT_DIR = path.join(PROJECT_ROOT, "output");
const MEDIA_LINKS_PATH = path.join(OUTPUT_DIR, "media_links.json");
const MEDIA_AUDIT_PATH = path.join(OUTPUT_DIR, "media_audit.json");

const MATCHING_CONFIG: MatchingConfig = {
  autoMatchThreshold: 0.55,  // Lowered from 0.65 to catch more valid matches
  ambiguityGap: 0.15,
  maxCandidates: 5,
};

// Supported media file extensions
const MEDIA_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".pdf",
  ".bmp",
  ".tiff",
]);

// ============================================================
// TYPES
// ============================================================

interface MediaFileInfo {
  filepath: string;
  filename: string;
  type: MediaType;
  tags: string[];
}

interface MatchCandidate {
  conditionId: string;
  conditionName: string;
  score: number;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Recursively scans a directory for media files.
 */
function scanDirectory(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...scanDirectory(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (MEDIA_EXTENSIONS.has(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Reads sidecar metadata if it exists.
 */
function readSidecarMetadata(filepath: string): MediaSidecarMetadata | null {
  const sidecarPath = filepath + ".json";

  if (!fs.existsSync(sidecarPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(sidecarPath, "utf-8");
    return JSON.parse(content) as MediaSidecarMetadata;
  } catch (error) {
    console.warn(`Warning: Could not parse sidecar file ${sidecarPath}`);
    return null;
  }
}

/**
 * Builds a MediaFileInfo object from a filepath.
 */
function buildMediaFileInfo(filepath: string): MediaFileInfo {
  const filename = path.basename(filepath);
  const type = detectMediaTypeFromFolder(filepath);
  const baseTags = extractTags(filename);

  // Try to read sidecar metadata
  const sidecar = readSidecarMetadata(filepath);
  const sidecarTags = [
    ...(sidecar?.tags || []),
    ...(sidecar?.annotations || []),
  ];

  // Combine tags from filename and sidecar
  const allTags = [...new Set([...baseTags, ...sidecarTags])];

  return {
    filepath,
    filename,
    type,
    tags: allTags,
  };
}

/**
 * Loads the conditions dataset.
 */
function loadConditions(): ConditionsDataset | null {
  // First try the transformed JSON path
  if (fs.existsSync(CONDITIONS_PATH)) {
    try {
      const content = fs.readFileSync(CONDITIONS_PATH, "utf-8");
      return JSON.parse(content) as ConditionsDataset;
    } catch (error) {
      console.error(`Error reading conditions from ${CONDITIONS_PATH}:`, error);
    }
  }

  // Fall back to the generated JSON in the project root
  const fallbackPath = path.join(
    PROJECT_ROOT,
    "conditionContent.generated.json"
  );
  if (fs.existsSync(fallbackPath)) {
    try {
      const content = fs.readFileSync(fallbackPath, "utf-8");
      return JSON.parse(content) as ConditionsDataset;
    } catch (error) {
      console.error(`Error reading conditions from ${fallbackPath}:`, error);
    }
  }

  return null;
}

/**
 * Computes match score for a media file against a condition.
 */
function computeMatchScore(
  media: MediaFileInfo,
  conditionId: string,
  condition: ConditionEntry
): number {
  const conditionName = condition.condition || conditionId;

  // Extract tags from condition ID (e.g., "CV__ecg__atrial_fibrillation")
  const conditionIdTags = conditionId.split("__").flatMap((part) =>
    part.split("_")
  );

  // Get combined score from utility function
  let score = combinedMatchScore(media.tags, conditionName, conditionIdTags);

  // Additional scoring based on direct ID matching
  const normalizedFilename = normalize(media.filename);
  const normalizedConditionId = normalize(conditionId);

  // Check if condition ID parts appear in filename
  const idParts = conditionId.split("__");
  const matchingParts = idParts.filter((part) =>
    normalizedFilename.includes(normalize(part))
  );

  if (matchingParts.length > 0) {
    score = Math.max(score, matchingParts.length / idParts.length);
  }

  // Direct string similarity between filename and condition name
  const directSimilarity = similarityScore(media.filename, conditionName);
  score = Math.max(score, directSimilarity);

  return score;
}

/**
 * Finds the best matching conditions for a media file.
 */
function findMatchCandidates(
  media: MediaFileInfo,
  conditions: ConditionsDataset
): MatchCandidate[] {
  const candidates: MatchCandidate[] = [];

  for (const [conditionId, condition] of Object.entries(conditions)) {
    if (!condition) continue;

    const score = computeMatchScore(media, conditionId, condition);

    if (score > 0) {
      candidates.push({
        conditionId,
        conditionName: condition.condition || conditionId,
        score,
      });
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Return top candidates
  return candidates.slice(0, MATCHING_CONFIG.maxCandidates);
}

/**
 * Determines the match result for a media file.
 */
function determineMatch(
  media: MediaFileInfo,
  candidates: MatchCandidate[]
): { link: MediaLink | null; audit: MediaAuditEntry | null } {
  if (candidates.length === 0) {
    // No candidates found
    return {
      link: null,
      audit: {
        file: media.filename,
        filepath: media.filepath,
        type: media.type,
        reason: "unresolved",
        possibleMatches: [],
        tags: media.tags,
      },
    };
  }

  const topCandidate = candidates[0];

  // Check if top candidate meets threshold
  if (topCandidate.score < MATCHING_CONFIG.autoMatchThreshold) {
    return {
      link: null,
      audit: {
        file: media.filename,
        filepath: media.filepath,
        type: media.type,
        reason: "unresolved",
        possibleMatches: candidates.map((c) => ({
          conditionId: c.conditionId,
          conditionName: c.conditionName,
          score: Math.round(c.score * 100) / 100,
        })),
        tags: media.tags,
      },
    };
  }

  // Check for ambiguity
  if (candidates.length > 1) {
    const secondCandidate = candidates[1];
    const gap = topCandidate.score - secondCandidate.score;

    if (gap < MATCHING_CONFIG.ambiguityGap) {
      return {
        link: null,
        audit: {
          file: media.filename,
          filepath: media.filepath,
          type: media.type,
          reason: "ambiguous",
          possibleMatches: candidates.map((c) => ({
            conditionId: c.conditionId,
            conditionName: c.conditionName,
            score: Math.round(c.score * 100) / 100,
          })),
          tags: media.tags,
        },
      };
    }
  }

  // Successful match
  return {
    link: {
      filename: media.filename,
      filepath: media.filepath,
      conditionId: topCandidate.conditionId,
      type: media.type,
      confidence: Math.round(topCandidate.score * 100) / 100,
      tags: media.tags,
    },
    audit: null,
  };
}

// ============================================================
// MAIN EXECUTION
// ============================================================

function main() {
  console.log("🔍 Media Integrator - Starting...\n");

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created output directory: ${OUTPUT_DIR}`);
  }

  // Load conditions
  console.log("📚 Loading conditions dataset...");
  const conditions = loadConditions();

  if (!conditions) {
    console.error("❌ Could not load conditions dataset.");
    console.error("   Expected at: " + CONDITIONS_PATH);
    console.error(
      "   Or fallback: " +
        path.join(PROJECT_ROOT, "conditionContent.generated.json")
    );
    process.exit(1);
  }

  const conditionCount = Object.keys(conditions).length;
  console.log(`   ✅ Loaded ${conditionCount} conditions.\n`);

  // Scan media directories
  console.log("📂 Scanning media directories...");
  const allMediaFiles: string[] = [];

  for (const dir of MEDIA_DIRS) {
    const files = scanDirectory(dir);
    if (files.length > 0) {
      console.log(`   📁 ${dir}: ${files.length} files`);
      allMediaFiles.push(...files);
    } else {
      console.log(`   📁 ${dir}: (directory not found or empty)`);
    }
  }

  console.log(`   ✅ Total media files found: ${allMediaFiles.length}\n`);

  if (allMediaFiles.length === 0) {
    console.log("ℹ️  No media files found. Creating empty output files.\n");
    fs.writeFileSync(MEDIA_LINKS_PATH, JSON.stringify([], null, 2));
    fs.writeFileSync(
      MEDIA_AUDIT_PATH,
      JSON.stringify({ message: "No media files found to process" }, null, 2)
    );
    console.log("✅ Output files created:");
    console.log(`   📄 ${MEDIA_LINKS_PATH}`);
    console.log(`   📄 ${MEDIA_AUDIT_PATH}`);
    return;
  }

  // Process each media file
  console.log("🔄 Processing media files...\n");
  const links: MediaLink[] = [];
  const audits: MediaAuditEntry[] = [];

  for (const filepath of allMediaFiles) {
    const media = buildMediaFileInfo(filepath);
    const candidates = findMatchCandidates(media, conditions);
    const { link, audit } = determineMatch(media, candidates);

    if (link) {
      links.push(link);
      console.log(
        `   ✅ Matched: ${media.filename} → ${link.conditionId} (${link.confidence})`
      );
    } else if (audit) {
      audits.push(audit);
      console.log(`   ⚠️  ${audit.reason}: ${media.filename}`);
    }
  }

  // Write output files
  console.log("\n📝 Writing output files...");

  fs.writeFileSync(MEDIA_LINKS_PATH, JSON.stringify(links, null, 2));
  console.log(`   ✅ ${MEDIA_LINKS_PATH} (${links.length} links)`);

  fs.writeFileSync(MEDIA_AUDIT_PATH, JSON.stringify(audits, null, 2));
  console.log(`   ✅ ${MEDIA_AUDIT_PATH} (${audits.length} audit entries)`);

  // Summary
  console.log("\n📊 Summary:");
  console.log(`   Total files processed: ${allMediaFiles.length}`);
  console.log(`   Successful matches:    ${links.length}`);
  console.log(`   Unresolved/Ambiguous:  ${audits.length}`);

  const matchRate =
    allMediaFiles.length > 0
      ? ((links.length / allMediaFiles.length) * 100).toFixed(1)
      : "0";
  console.log(`   Match rate:            ${matchRate}%`);

  console.log("\n🎉 Media integration complete!");
}

// Run the main function
main();
