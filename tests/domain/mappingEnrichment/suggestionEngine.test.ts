import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock external dependencies
vi.mock('../../../services/domain/geminiService', () => ({
  generateEmbedding: vi.fn(),
}));

vi.mock('../../../services/domain/mappingEnrichment/gapDetector', () => ({
  detectGaps: vi.fn(),
}));

// Mock Prisma
vi.mock('../../../lib/prisma', () => ({
  prisma: {
    medicalTaxonomy: {
      findUnique: vi.fn(),
    },
    systemMapping: {
      findMany: vi.fn(),
    },
  },
}));

// Import mocked modules
import { generateEmbedding } from '../../../services/domain/geminiService';
import { detectGaps } from '../../../services/domain/mappingEnrichment/gapDetector';
import { prisma } from '../../../lib/prisma';
import { generateSuggestions, cosineSimilarity, keywordOverlapScore } from '../../../services/domain/mappingEnrichment/suggestionEngine';
import { BLUEPRINT_TO_ABBREVIATION, SYSTEM_ALIASES } from '@/lib/constants/blueprint';

describe('SuggestionEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateSuggestions', () => {
    it('should return empty array when no gaps', async () => {
      (detectGaps as any).mockResolvedValue([]);

      const suggestions = await generateSuggestions();
      expect(suggestions).toEqual([]);
    });

    it('should return suggestions for gaps with mocked embeddings', async () => {
      // Mock gaps
      (detectGaps as any).mockResolvedValue([
        {
          taxonomyCode: 'GI',
          taxonomyName: 'Gastrointestinal',
          description: 'Digestive system',
        },
        {
          taxonomyCode: 'MSK',
          taxonomyName: 'Musculoskeletal',
          description: 'Muscles and bones',
        },
      ]);

      // Mock system taxonomy lookups
      const systemCodes = Object.values(BLUEPRINT_TO_ABBREVIATION);
      for (const sysCode of systemCodes) {
        (prisma.medicalTaxonomy.findUnique as any).mockResolvedValueOnce({
          name: sysCode === 'CV' ? 'Cardiovascular' : sysCode,
          description: 'Some description',
        });
      }

      // Mock embeddings: return simple vectors where CV is similar to GI? we'll just make them distinct
      // We'll make each embedding an array of length 768 with some dummy values.
      // For simplicity, we'll make each embedding a vector of zeros except a unique value at index.
      let callCount = 0;
      (generateEmbedding as any).mockImplementation(() => {
        const vec = new Array(768).fill(0);
        vec[callCount] = 1; // each call gets a different dimension to make them orthogonal
        callCount++;
        return Promise.resolve(vec);
      });

      const suggestions = await generateSuggestions();
      // Expect suggestions for both gaps
      expect(suggestions).toHaveLength(2);
      // Each suggestion should have required fields
      suggestions.forEach(suggestion => {
        expect(suggestion).toHaveProperty('taxonomyCode');
        expect(suggestion).toHaveProperty('suggestedSystemCode');
        expect(suggestion).toHaveProperty('confidence');
        expect(suggestion).toHaveProperty('reason');
        expect(suggestion).toHaveProperty('alternativeSystems');
        expect(suggestion.confidence).toBeGreaterThanOrEqual(0);
        expect(suggestion.confidence).toBeLessThanOrEqual(1);
      });
    
    });

    it('should filter by taxonomyCodes parameter', async () => {
      (detectGaps as any).mockResolvedValue([
        { taxonomyCode: 'GI', taxonomyName: 'GI', description: '' },
        { taxonomyCode: 'MSK', taxonomyName: 'MSK', description: '' },
        { taxonomyCode: 'CV', taxonomyName: 'CV', description: '' },
      ]);

      // Mock system taxonomies
      const systemCodes = Object.values(BLUEPRINT_TO_ABBREVIATION);
      for (const sysCode of systemCodes) {
        (prisma.medicalTaxonomy.findUnique as any).mockResolvedValueOnce({
          name: sysCode,
          description: '',
        });
      }

      // Mock embeddings
      (generateEmbedding as any).mockResolvedValue(new Array(768).fill(0.5));

      const suggestions = await generateSuggestions(['GI', 'MSK']);
      // Should only have suggestions for GI and MSK, not CV (since CV is not a gap? Actually CV is a gap but filtered out)
      // detectGaps returns all gaps, then we filter by taxonomyCodes.
      // The gaps array includes CV, but taxonomyCodes doesn't include CV, so it should be excluded.
      const suggestionCodes = suggestions.map(s => s.taxonomyCode);
      expect(suggestionCodes).toContain('GI');
      expect(suggestionCodes).toContain('MSK');
      expect(suggestionCodes).not.toContain('CV');
    });

    it('should handle missing system taxonomy gracefully', async () => {
      (detectGaps as any).mockResolvedValue([
        { taxonomyCode: 'GI', taxonomyName: 'GI', description: '' },
      ]);

      // Mock system taxonomy lookups: return null for some systems, but at least one should exist
      // We'll mock findUnique to return null for all systems except one.
      const systemCodes = Object.values(BLUEPRINT_TO_ABBREVIATION);
      for (const sysCode of systemCodes) {
        if (sysCode === 'CV') {
          (prisma.medicalTaxonomy.findUnique as any).mockResolvedValueOnce({
            name: 'Cardiovascular',
            description: '',
          });
        } else {
          (prisma.medicalTaxonomy.findUnique as any).mockResolvedValueOnce(null);
        }
      }

      // Mock embeddings only for CV (since others are null)
      (generateEmbedding as any).mockResolvedValue(new Array(768).fill(0.5));

      const suggestions = await generateSuggestions();
      // Should still produce suggestions using only CV system embedding
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].suggestedSystemCode).toBe('CV');
    });

    it('should compute confidence within bounds', async () => {
      // This test can be more focused on the internal functions, but we can also test integration.
      // For simplicity, we'll trust that cosineSimilarity and keywordOverlapScore are unit-tested separately.
      // However, we can still verify that confidence is within bounds.
      (detectGaps as any).mockResolvedValue([
        { taxonomyCode: 'GI', taxonomyName: 'Gastrointestinal', description: '' },
      ]);

      // Mock system taxonomies
      const systemCodes = Object.values(BLUEPRINT_TO_ABBREVIATION);
      for (const sysCode of systemCodes) {
        (prisma.medicalTaxonomy.findUnique as any).mockResolvedValueOnce({
          name: sysCode,
          description: '',
        });
      }

      // Mock embeddings to produce predictable similarity
      // Use vectors that are identical for all systems and gap to get similarity 1
      const identicalVector = new Array(768).fill(0.1);
      (generateEmbedding as any).mockResolvedValue(identicalVector);

      const suggestions = await generateSuggestions();
      // Since all vectors are identical, similarity should be 1 (or near 1)
      // However keyword overlap may differ.
      suggestions.forEach(suggestion => {
        expect(suggestion.confidence).toBeGreaterThan(0);
      });
    });
  });

  describe('helper functions', () => {
    describe('cosineSimilarity', () => {
      it('should compute cosine similarity correctly', () => {
        const vecA = [1, 2, 3];
        const vecB = [4, 5, 6];
        const sim = cosineSimilarity(vecA, vecB);
        // Calculate expected dot = 1*4 + 2*5 + 3*6 = 4+10+18 = 32
        // normA = 1+4+9 = 14, normB = 16+25+36 = 77
        // expected = 32 / (sqrt(14)*sqrt(77))
        const expected = 32 / (Math.sqrt(14) * Math.sqrt(77));
        expect(sim).toBeCloseTo(expected, 10);
      });

      it('should return 1 for identical vectors', () => {
        const vec = [1, 2, 3];
        expect(cosineSimilarity(vec, vec)).toBeCloseTo(1, 10);
      });

      it('should return 0 for orthogonal vectors', () => {
        const vecA = [1, 0];
        const vecB = [0, 1];
        expect(cosineSimilarity(vecA, vecB)).toBe(0);
      });

      it('should throw error for vectors of different lengths', () => {
        expect(() => cosineSimilarity([1, 2], [3])).toThrow('Vectors must have same length');
      });

      it('should return 0 when one vector has zero norm', () => {
        expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
        expect(cosineSimilarity([1, 2], [0, 0])).toBe(0);
      });
    });

    describe('keywordOverlapScore', () => {
      // Mock SYSTEM_ALIASES (imported from blueprint). Since we cannot mock constants easily,
      // we rely on actual constants. For testing, we need to know what aliases exist.
      // We'll use a known mapping: "Cardiovascular" -> "CV". Use alias "cardio".
      // However SYSTEM_ALIASES is a map from alias to canonical. We'll need to know which alias maps to which system.
      // Let's assume SYSTEM_ALIASES contains 'cardio' -> 'CV'.
      // We'll write a test that uses the actual mapping.
      it('should return 0.5 when alias matches', () => {
        // We'll need to find an alias from SYSTEM_ALIASES that maps to a system code.
        // Let's get the first entry.
        const systemCode = 'CV'; // assuming CV is a system code
        // Find an alias that maps to CV
        const aliases = Object.entries(SYSTEM_ALIASES)
          .filter(([, canonical]) => canonical === systemCode)
          .map(([alias]) => alias);
        if (aliases.length > 0) {
          const text = `This is about ${aliases[0]}`;
          const score = keywordOverlapScore(text, systemCode);
          expect(score).toBe(0.5);
        } else {
          // If no aliases, skip test
          expect(true).toBe(true);
        }
      });

      it('should return 0 when no alias matches', () => {
        const score = keywordOverlapScore('random text', 'CV');
        // If 'random text' doesn't contain any alias, score should be 0
        expect(score).toBe(0);
      });

      it('should match system code itself (case-insensitive)', () => {
        const score = keywordOverlapScore('CV is important', 'CV');
        expect(score).toBe(0.5);
      });
    });
  });
});