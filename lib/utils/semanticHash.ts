/**
 * Lightweight semantic fingerprinting for near-duplicate question detection.
 *
 * Uses djb2 on the first 200 normalised characters of the question stem.
 * Not cryptographic — intended purely for cheap dedup checks against the
 * PreGeneratedQuestion.semanticHash column.
 *
 * Collision rate is higher than crypto hashes but acceptable for this use case:
 * a false positive means we skip generating an already-distinct variant
 * (conservative), while a false negative means we generate a near-duplicate
 * (the actual harm we're guarding against).
 *
 * Shared between:
 *   - functions/api/questions/generate-batch.ts  (pool seeding dedup)
 *   - lib/ensureDueVariant.ts                    (hot-path variant dedup)
 *   - lib/services/batchVariantService.ts        (cold-path variant dedup)
 */

/**
 * Compute a short semantic hash string from a question's text content.
 *
 * @param text - The question stem (or combined vignette + stem)
 * @returns 8-character lowercase hex string
 */
export function computeSemanticHash(text: string): string {
  const normalized = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) | 0; // djb2 with 32-bit overflow guard
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
