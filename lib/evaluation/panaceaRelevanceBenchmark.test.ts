import { describe, it, expect } from 'vitest';
import {
  PANACEA_RELEVANCE_QUERIES,
  scoreSingleQuery,
  summarize,
  formatSummary,
  type RankedHit,
  type RelevanceQuery,
} from './panaceaRelevanceBenchmark';

const sampleQuery: RelevanceQuery = {
  id: 'test-01',
  query: 'crushing chest pain radiating to left arm',
  intent: 'lookup',
  system: 'Cardiovascular',
  relevantConditions: ['Acute myocardial infarction'],
  relevantSynonyms: ['MI', 'Heart attack'],
};

describe('panaceaRelevanceBenchmark', () => {
  describe('PANACEA_RELEVANCE_QUERIES', () => {
    it('has at least 30 queries spanning multiple systems and intents', () => {
      expect(PANACEA_RELEVANCE_QUERIES.length).toBeGreaterThanOrEqual(30);
      const systems = new Set(PANACEA_RELEVANCE_QUERIES.map((q) => q.system));
      const intents = new Set(PANACEA_RELEVANCE_QUERIES.map((q) => q.intent));
      expect(systems.size).toBeGreaterThanOrEqual(10);
      expect(intents.size).toBeGreaterThanOrEqual(4);
    });

    it('has unique ids and non-empty relevantConditions on every query', () => {
      const ids = new Set<string>();
      for (const q of PANACEA_RELEVANCE_QUERIES) {
        expect(ids.has(q.id)).toBe(false);
        ids.add(q.id);
        expect(q.relevantConditions.length).toBeGreaterThan(0);
        expect(q.query.trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe('scoreSingleQuery', () => {
    it('records hit@1 when the first hit matches', () => {
      const hits: RankedHit[] = [
        { id: '1', condition: 'Acute Myocardial Infarction' },
        { id: '2', condition: 'Pericarditis' },
      ];
      const s = scoreSingleQuery(sampleQuery, hits);
      expect(s.hitAt1).toBe(true);
      expect(s.hitAt5).toBe(true);
      expect(s.hitAt10).toBe(true);
      expect(s.firstHitRank).toBe(1);
    });

    it('accepts synonyms (case/punctuation insensitive)', () => {
      const hits: RankedHit[] = [
        { id: '9', condition: 'Unrelated' },
        { id: '1', condition: 'heart attack' },
      ];
      const s = scoreSingleQuery(sampleQuery, hits);
      expect(s.hitAt1).toBe(false);
      expect(s.hitAt5).toBe(true);
      expect(s.firstHitRank).toBe(2);
    });

    it('returns firstHitRank=null when nothing matches', () => {
      const hits: RankedHit[] = Array.from({ length: 10 }, (_, i) => ({
        id: `x${i}`,
        condition: `Irrelevant ${i}`,
      }));
      const s = scoreSingleQuery(sampleQuery, hits);
      expect(s.hitAt1).toBe(false);
      expect(s.hitAt5).toBe(false);
      expect(s.hitAt10).toBe(false);
      expect(s.firstHitRank).toBeNull();
    });

    it('only considers the top 10 — rank 11 counts as a miss', () => {
      const hits: RankedHit[] = [
        ...Array.from({ length: 10 }, (_, i) => ({ id: `x${i}`, condition: 'Unrelated' })),
        { id: 'real', condition: 'MI' },
      ];
      const s = scoreSingleQuery(sampleQuery, hits);
      expect(s.firstHitRank).toBeNull();
      expect(s.hitAt10).toBe(false);
    });
  });

  describe('summarize', () => {
    it('computes Hit@K and MRR across a mixed set', () => {
      const hitQ1: RankedHit[] = [{ id: '1', condition: 'Acute myocardial infarction' }];
      const hitQ3: RankedHit[] = [
        { id: 'a', condition: 'Unrelated' },
        { id: 'b', condition: 'Unrelated' },
        { id: 'c', condition: 'Heart attack' },
      ];
      const miss: RankedHit[] = [{ id: 'z', condition: 'Irrelevant' }];

      const scores = [
        scoreSingleQuery(sampleQuery, hitQ1),
        scoreSingleQuery(sampleQuery, hitQ3),
        scoreSingleQuery(sampleQuery, miss),
      ];
      const s = summarize(scores);
      expect(s.hitAt1).toBeCloseTo(1 / 3, 5);
      expect(s.hitAt5).toBeCloseTo(2 / 3, 5);
      // MRR = (1/1 + 1/3 + 0) / 3
      expect(s.mrr).toBeCloseTo((1 + 1 / 3 + 0) / 3, 5);
      expect(s.perIntent.lookup.n).toBe(3);
      expect(s.perSystem.Cardiovascular.n).toBe(3);
    });

    it('formatSummary renders a human-readable report without crashing', () => {
      const s = summarize([
        scoreSingleQuery(sampleQuery, [{ id: '1', condition: 'MI' }]),
      ]);
      const text = formatSummary(s);
      expect(text).toContain('PANaCEa Relevance Benchmark');
      expect(text).toContain('Hit@5');
      expect(text).toContain('Cardiovascular');
    });
  });
});
