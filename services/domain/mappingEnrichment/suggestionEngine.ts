/**
 * Suggestion Engine for System Mapping Enrichment Assistant.
 * Proposes NCCPA system assignments for unmapped taxonomy nodes using semantic similarity.
 */

import { generateEmbedding } from '../geminiService';
import { detectGaps } from './gapDetector';
import { prisma } from '@/lib/prisma';
import { BLUEPRINT_TO_ABBREVIATION, SYSTEM_ALIASES } from '@/lib/constants/blueprint';

/**
 * Cosine similarity between two vectors.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have same length');
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Keyword overlap score between a text and a system's aliases.
 */
export function keywordOverlapScore(text: string, systemCode: string): number {
  const textLower = text.toLowerCase();
  const aliases = Object.entries(SYSTEM_ALIASES)
    .filter(([, canonical]) => canonical === systemCode)
    .map(([alias]) => alias.toLowerCase());
  // Also include the abbreviation itself
  aliases.push(systemCode.toLowerCase());
  let matches = 0;
  for (const alias of aliases) {
    if (textLower.includes(alias)) {
      matches++;
    }
  }
  // Normalize by number of aliases considered (max 1 per alias)
  return matches > 0 ? 0.5 : 0; // simple binary score, can be refined
}

/**
 * Represents a suggested system assignment for a taxonomy node.
 */
export interface MappingSuggestion {
  taxonomyCode: string;
  taxonomyName: string;
  suggestedSystemCode: string; // e.g., "CV", "PULM"
  confidence: number; // 0-1
  reason: string; // human‑readable explanation
  alternativeSystems: Array<{
    systemCode: string;
    confidence: number;
    reason: string;
  }>;
}

/**
 * Generate embedding for a taxonomy node (name + description).
 */
async function getTaxonomyEmbedding(taxonomy: { name: string; description: string | null }): Promise<number[]> {
  const text = `${taxonomy.name}. ${taxonomy.description || ''}`.trim();
  return generateEmbedding(text);
}

/**
 * Compute centroid embedding of existing subcategories for a given taxonomy code.
 * Returns null if no subcategories exist.
 */
async function getSystemCentroidEmbedding(taxonomyCode: string): Promise<number[] | null> {
  const mappings = await prisma.systemMapping.findMany({
    where: { taxonomyCode },
    select: { canonicalName: true, subcategory: true },
    take: 10, // limit to avoid too many embeddings
  });
  if (mappings.length === 0) {
    return null;
  }
  // For simplicity, we'll just embed the taxonomy name/description (since subcategories may be many)
  // Alternatively, we could embed each subcategory and average, but that's costly.
  // For now, fallback to taxonomy embedding (we'll compute separately).
  return null;
}

/**
 * Generate suggestions for unmapped taxonomy nodes.
 * @param taxonomyCodes Optional list of taxonomy codes to process; if omitted, all gaps are used.
 * @returns List of mapping suggestions.
 */
export async function generateSuggestions(taxonomyCodes?: string[]): Promise<MappingSuggestion[]> {
  // 1. Identify gaps
  const gaps = await detectGaps();
  const targetGaps = taxonomyCodes
    ? gaps.filter(gap => taxonomyCodes.includes(gap.taxonomyCode))
    : gaps;
  
  if (targetGaps.length === 0) {
    return [];
  }

  // 2. Pre‑compute embeddings for each NCCPA system (blueprint categories)
  // We'll use the taxonomy's own embedding (since each system is a taxonomy node)
  const systemCodes = Object.values(BLUEPRINT_TO_ABBREVIATION);
  const systemEmbeddings = new Map<string, number[]>();
  for (const sysCode of systemCodes) {
    const taxonomy = await prisma.medicalTaxonomy.findUnique({
      where: { code: sysCode },
      select: { name: true, description: true },
    });
    if (taxonomy) {
      const embedding = await getTaxonomyEmbedding(taxonomy);
      systemEmbeddings.set(sysCode, embedding);
    }
  }

  // 3. For each gap, compute similarity with each system
  const suggestions: MappingSuggestion[] = [];
  for (const gap of targetGaps) {
    const gapEmbedding = await getTaxonomyEmbedding({
      name: gap.taxonomyName,
      description: gap.description || null,
    });
    
    const scores: Array<{ systemCode: string; similarity: number; keywordScore: number }> = [];
    for (const [sysCode, sysEmbedding] of systemEmbeddings.entries()) {
      const similarity = cosineSimilarity(gapEmbedding, sysEmbedding);
      const keywordScore = keywordOverlapScore(gap.taxonomyName, sysCode);
      // Combine scores (weighted)
      const combined = similarity * 0.7 + keywordScore * 0.3;
      scores.push({ systemCode: sysCode, similarity, keywordScore, confidence: combined });
    }
    
    // Sort by combined confidence
    scores.sort((a, b) => b.confidence - a.confidence);
    
    const top = scores[0];
    if (!top) continue;
    
    const alternatives = scores.slice(1, 4).map(s => ({
      systemCode: s.systemCode,
      confidence: s.confidence,
      reason: `Semantic similarity ${(s.similarity * 100).toFixed(1)}%, keyword match ${s.keywordScore > 0 ? 'yes' : 'no'}`,
    }));
    
    suggestions.push({
      taxonomyCode: gap.taxonomyCode,
      taxonomyName: gap.taxonomyName,
      suggestedSystemCode: top.systemCode,
      confidence: top.confidence,
      reason: `Semantic similarity ${(top.similarity * 100).toFixed(1)}%, keyword match ${top.keywordScore > 0 ? 'yes' : 'no'}`,
      alternativeSystems: alternatives,
    });
  }

  return suggestions;
}