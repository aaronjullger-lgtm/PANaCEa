/**
 * Media Matcher Utilities
 * Reusable functions for matching media assets to medical conditions.
 */

/**
 * Medical term aliases/synonyms mapping.
 * Maps common abbreviations and alternative spellings to canonical forms.
 */
const MEDICAL_TERM_ALIASES: Record<string, string[]> = {
  ecg: ["ekg", "electrocardiogram", "electrocardiography"],
  ekg: ["ecg", "electrocardiogram", "electrocardiography"],
  afib: ["atrial fibrillation", "atrialfibrillation", "af"],
  vfib: ["ventricular fibrillation", "ventricularfibrillation", "vf"],
  mi: ["myocardial infarction", "heart attack", "stemi", "nstemi"],
  chf: ["congestive heart failure", "heart failure", "hf"],
  copd: ["chronic obstructive pulmonary disease"],
  pe: ["pulmonary embolism"],
  dvt: ["deep vein thrombosis", "deep venous thrombosis"],
  cbc: ["complete blood count", "blood count"],
  cmp: ["comprehensive metabolic panel", "metabolic panel"],
  bmp: ["basic metabolic panel"],
  xray: ["x-ray", "radiograph", "radiography"],
  ct: ["computed tomography", "cat scan", "catscan"],
  mri: ["magnetic resonance imaging"],
};

/**
 * Expands a tag with its aliases.
 */
function expandWithAliases(tag: string): string[] {
  const normalized = tag.toLowerCase();
  const result = [normalized];

  // Check if tag matches any key or value in aliases
  for (const [key, aliases] of Object.entries(MEDICAL_TERM_ALIASES)) {
    if (normalized === key || aliases.includes(normalized)) {
      result.push(key, ...aliases);
    }
  }

  return [...new Set(result)];
}

/**
 * Normalizes text for comparison:
 * - lowercase
 * - remove punctuation, hyphens, extra whitespace
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Computes a similarity score between two strings using Levenshtein distance.
 * Returns a value between 0 (no match) and 1 (exact match).
 */
export function similarityScore(a: string, b: string): number {
  const normalizedA = normalize(a);
  const normalizedB = normalize(b);

  if (normalizedA === normalizedB) return 1.0;
  if (normalizedA.length === 0 || normalizedB.length === 0) return 0.0;

  const distance = levenshteinDistance(normalizedA, normalizedB);
  const maxLength = Math.max(normalizedA.length, normalizedB.length);

  return 1 - distance / maxLength;
}

/**
 * Computes the Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Extracts tags from a filename by splitting on common delimiters.
 * Filters out common noise words and very short tokens.
 */
export function extractTags(filename: string): string[] {
  // Remove file extension
  const baseName = filename.replace(/\.[^.]+$/, "");

  // Split on underscores, hyphens, spaces, and other common delimiters
  const tokens = baseName
    .split(/[-_\s.]+/)
    .map((token) => token.toLowerCase().trim())
    .filter((token) => token.length > 1);

  // Filter out common noise words and file-type indicators
  const noiseWords = new Set([
    "img",
    "image",
    "file",
    "scan",
    "photo",
    "pic",
    "png",
    "jpg",
    "jpeg",
    "gif",
    "svg",
    "pdf",
    "doc",
    "the",
    "and",
    "for",
    "with",
    "from",
  ]);

  return tokens.filter((token) => !noiseWords.has(token));
}

/**
 * Media type classifications
 */
export type MediaType = "ekg" | "imaging" | "labs" | "diagram" | "other";

/**
 * Detects the media type from the folder path.
 */
export function detectMediaTypeFromFolder(filepath: string): MediaType {
  const normalizedPath = filepath.toLowerCase().replace(/\\/g, "/");

  if (normalizedPath.includes("/ekg/") || normalizedPath.includes("/ecg/")) {
    return "ekg";
  }
  if (normalizedPath.includes("/labs/")) {
    return "labs";
  }
  if (normalizedPath.includes("/imaging/")) {
    return "imaging";
  }
  if (
    normalizedPath.includes("/diagrams/") ||
    normalizedPath.includes("/diagram/")
  ) {
    return "diagram";
  }

  return "other";
}

/**
 * Computes keyword overlap score between two sets of tags/keywords.
 * Uses medical term aliases to improve matching.
 * Returns a value between 0 and 1.
 */
export function keywordOverlapScore(
  tagsA: string[],
  tagsB: string[]
): number {
  if (tagsA.length === 0 || tagsB.length === 0) return 0;

  // Expand both sets with aliases
  const expandedA = new Set(
    tagsA.flatMap((t) => expandWithAliases(normalize(t)))
  );
  const expandedB = new Set(
    tagsB.flatMap((t) => expandWithAliases(normalize(t)))
  );

  let matches = 0;
  const originalTagsA = new Set(tagsA.map((t) => normalize(t)));

  for (const tag of originalTagsA) {
    const tagWithAliases = expandWithAliases(tag);
    // Check if any alias matches anything in expanded B
    if (tagWithAliases.some((alias) => expandedB.has(alias))) {
      matches++;
    }
  }

  // Use a modified similarity that prioritizes coverage of file tags
  // rather than strict Jaccard similarity
  const coverageOfFileTags = matches / originalTagsA.size;
  const jaccardSimilarity = matches / new Set([...expandedA, ...expandedB]).size;

  // Weight coverage higher since we care if file tags match condition
  return coverageOfFileTags * 0.7 + jaccardSimilarity * 0.3;
}

/**
 * Computes a combined score using both string similarity and keyword overlap.
 * Uses medical term aliases to improve matching.
 * Weights can be adjusted based on use case.
 */
export function combinedMatchScore(
  filenameOrTags: string | string[],
  conditionName: string,
  conditionTags: string[] = []
): number {
  const fileTags = Array.isArray(filenameOrTags)
    ? filenameOrTags
    : extractTags(filenameOrTags);

  if (fileTags.length === 0) return 0;

  // String similarity between filename and condition name
  const nameScore = Array.isArray(filenameOrTags)
    ? 0
    : similarityScore(filenameOrTags, conditionName);

  // Keyword overlap between file tags and condition name tags (uses aliases internally)
  const conditionNameTags = extractTags(conditionName);
  const allConditionTags = [...new Set([...conditionNameTags, ...conditionTags])];
  const keywordScore = keywordOverlapScore(fileTags, allConditionTags);

  // Count tag matches using aliases (most important for medical terms)
  const expandedConditionTags = new Set(
    allConditionTags.flatMap((t) => expandWithAliases(normalize(t)))
  );
  
  let aliasMatches = 0;
  for (const tag of fileTags) {
    const tagWithAliases = expandWithAliases(normalize(tag));
    if (tagWithAliases.some((alias) => expandedConditionTags.has(alias))) {
      aliasMatches++;
    }
  }
  
  // Alias match ratio (very strong signal)
  const aliasMatchRatio = fileTags.length > 0 ? aliasMatches / fileTags.length : 0;

  // Also check for substring matches (important for medical terms)
  const normalizedCondition = normalize(conditionName);
  let substringMatches = 0;
  for (const tag of fileTags) {
    const normalized = normalize(tag);
    if (normalized.length >= 3 && normalizedCondition.includes(normalized)) {
      substringMatches++;
    }
  }
  const substringRatio = fileTags.length > 0 ? substringMatches / fileTags.length : 0;

  // Combine scores with weights prioritizing alias/exact matches
  const score =
    aliasMatchRatio * 0.5 +      // Alias/exact tag matches are most important
    substringRatio * 0.25 +      // Substring matches are also valuable
    keywordScore * 0.15 +        // General keyword overlap
    nameScore * 0.1;             // String similarity (less important)

  return Math.min(1, score);
}
