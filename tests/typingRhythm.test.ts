/**
 * Tests for lib/typing-rhythm.ts
 *
 * Tests keystroke dynamics analysis: pause classification, burst detection,
 * rhythm classification, and cognitive load inference.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyPause,
  extractPauses,
  extractBursts,
  analyzeTypingSession,
  serializeTypingAnalysis,
  type KeystrokeEvent,
} from '@/lib/typing-rhythm';

// Helper: build a keystroke sequence with uniform IKI
function makeKeystrokes(keys: string[], baseTime: number, iki: number): KeystrokeEvent[] {
  return keys.map((key, i) => ({
    key,
    timestamp: baseTime + i * iki,
    type: 'keydown' as const,
    isDeletion: false,
    position: i,
  }));
}

describe('classifyPause', () => {
  it('returns physical for < 200ms', () => {
    expect(classifyPause(100)).toBe('physical');
    expect(classifyPause(0)).toBe('physical');
    expect(classifyPause(199)).toBe('physical');
  });

  it('returns lexical for 200-499ms', () => {
    expect(classifyPause(200)).toBe('lexical');
    expect(classifyPause(350)).toBe('lexical');
    expect(classifyPause(499)).toBe('lexical');
  });

  it('returns cognitive for 500-1999ms', () => {
    expect(classifyPause(500)).toBe('cognitive');
    expect(classifyPause(1000)).toBe('cognitive');
    expect(classifyPause(1999)).toBe('cognitive');
  });

  it('returns reflective for 2000-4999ms', () => {
    expect(classifyPause(2000)).toBe('reflective');
    expect(classifyPause(3500)).toBe('reflective');
    expect(classifyPause(4999)).toBe('reflective');
  });

  it('returns stuck for >= 5000ms', () => {
    expect(classifyPause(5000)).toBe('stuck');
    expect(classifyPause(10000)).toBe('stuck');
  });
});

describe('extractPauses', () => {
  it('returns empty for fewer than 2 keydowns', () => {
    expect(extractPauses([])).toEqual([]);
    expect(extractPauses([{ key: 'a', timestamp: 0, type: 'keydown', isDeletion: false, position: 0 }])).toEqual([]);
  });

  it('filters out deletion keystrokes', () => {
    const events: KeystrokeEvent[] = [
      { key: 'a', timestamp: 0, type: 'keydown', isDeletion: false, position: 0 },
      { key: 'Backspace', timestamp: 100, type: 'keydown', isDeletion: true, position: 0 },
      { key: 'b', timestamp: 300, type: 'keydown', isDeletion: false, position: 1 },
    ];
    // Only 'a' and 'b' are non-deletion keydowns, IKI = 300ms → lexical pause
    const pauses = extractPauses(events);
    expect(pauses.length).toBe(1);
    expect(pauses[0].type).toBe('lexical');
  });

  it('filters out pauses below physical threshold', () => {
    const events = makeKeystrokes(['a', 'b', 'c'], 0, 100);
    // IKI = 100ms → physical, below threshold → no pause recorded
    const pauses = extractPauses(events);
    expect(pauses.length).toBe(0);
  });

  it('detects cognitive pauses', () => {
    const events: KeystrokeEvent[] = [
      { key: 'a', timestamp: 0, type: 'keydown', isDeletion: false, position: 0 },
      { key: 'b', timestamp: 800, type: 'keydown', isDeletion: false, position: 1 },
    ];
    const pauses = extractPauses(events);
    expect(pauses.length).toBe(1);
    expect(pauses[0].type).toBe('cognitive');
    expect(pauses[0].durationMs).toBe(800);
  });

  it('detects word boundary pauses', () => {
    const events: KeystrokeEvent[] = [
      { key: 'h', timestamp: 0, type: 'keydown', isDeletion: false, position: 0 },
      { key: 'i', timestamp: 100, type: 'keydown', isDeletion: false, position: 1 },
      { key: ' ', timestamp: 500, type: 'keydown', isDeletion: false, position: 2 },
    ];
    const pauses = extractPauses(events);
    // IKI between 'i' and ' ' = 400ms → lexical
    // Previous key is 'i' (not word boundary), next is ' ' at position 2
    expect(pauses.length).toBeGreaterThanOrEqual(1);
  });
});

describe('extractBursts', () => {
  it('returns empty for fewer than MIN_BURST_LENGTH keys', () => {
    const events = makeKeystrokes(['a', 'b', 'c'], 0, 100);
    const bursts = extractBursts(events);
    expect(bursts.length).toBe(0);
  });

  it('detects burst of 4+ fast keystrokes', () => {
    const events = makeKeystrokes(['h', 'e', 'l', 'l', 'o'], 0, 80);
    // IKI = 80ms < 150ms threshold, length 5 >= MIN_BURST_LENGTH(4)
    const bursts = extractBursts(events);
    expect(bursts.length).toBe(1);
    expect(bursts[0].content).toBe('hello');
    expect(bursts[0].length).toBe(5);
  });

  it('splits burst on slow keystroke', () => {
    const events: KeystrokeEvent[] = [
      { key: 'h', timestamp: 0, type: 'keydown', isDeletion: false, position: 0 },
      { key: 'i', timestamp: 80, type: 'keydown', isDeletion: false, position: 1 },
      { key: ' ', timestamp: 80 + 400, type: 'keydown', isDeletion: false, position: 2 },
      { key: 't', timestamp: 80 + 400 + 80, type: 'keydown', isDeletion: false, position: 3 },
      { key: 'h', timestamp: 80 + 400 + 160, type: 'keydown', isDeletion: false, position: 4 },
      { key: 'e', timestamp: 80 + 400 + 240, type: 'keydown', isDeletion: false, position: 5 },
      { key: 'r', timestamp: 80 + 400 + 320, type: 'keydown', isDeletion: false, position: 6 },
      { key: 'e', timestamp: 80 + 400 + 400, type: 'keydown', isDeletion: false, position: 7 },
    ];
    const bursts = extractBursts(events);
    // 'hi' is only 2 chars → below min burst. The keystroke *at* the slow gap
    // (the space) starts a new potential burst, so the captured content is
    // ' there' (6 chars) once the subsequent fast keystrokes extend it.
    expect(bursts.length).toBe(1);
    expect(bursts[0].content).toBe(' there');
    expect(bursts[0].length).toBe(6);
  });

  it('computes avgIKI within burst', () => {
    const events = makeKeystrokes(['a', 'b', 'c', 'd'], 0, 100);
    const bursts = extractBursts(events);
    expect(bursts.length).toBe(1);
    expect(bursts[0].avgIKI).toBe(100);
  });

  it('returns empty for empty events', () => {
    expect(extractBursts([])).toEqual([]);
  });
});

describe('analyzeTypingSession', () => {
  it('returns valid analysis for fluent typing', () => {
    const events = makeKeystrokes(
      Array.from({ length: 50 }, (_, i) => String.fromCharCode(97 + (i % 26))),
      0,
      120,
    );
    const result = analyzeTypingSession(events);
    expect(result.totalKeystrokes).toBe(50);
    expect(result.finalLength).toBe(50);
    expect(result.rhythm).toBeDefined();
    expect(result.cognitiveLoad).toBeGreaterThanOrEqual(0);
    expect(result.cognitiveLoad).toBeLessThanOrEqual(1);
    expect(result.fluencyScore).toBeGreaterThanOrEqual(0);
    expect(result.fluencyScore).toBeLessThanOrEqual(1);
  });

  it('returns valid analysis for empty events', () => {
    const result = analyzeTypingSession([]);
    expect(result.totalKeystrokes).toBe(0);
    expect(result.rhythm).toBeDefined();
  });

  it('detects fragmented rhythm with many deletions', () => {
    const events: KeystrokeEvent[] = [];
    let pos = 0;
    for (let i = 0; i < 20; i++) {
      events.push({ key: 'a', timestamp: i * 100, type: 'keydown', isDeletion: false, position: pos++ });
      events.push({ key: 'Backspace', timestamp: i * 100 + 50, type: 'keydown', isDeletion: true, position: --pos });
    }
    const result = analyzeTypingSession(events);
    expect(result.deletionRatio).toBeGreaterThan(0.3);
    expect(result.rhythm).toBe('fragmented');
  });

  it('computes CPM correctly', () => {
    const events = makeKeystrokes(
      Array.from({ length: 60 }, (_, i) => String.fromCharCode(97 + (i % 26))),
      0,
      100,
    );
    const result = analyzeTypingSession(events);
    expect(result.cpm).toBeGreaterThan(0);
  });

  it('includes pause analysis', () => {
    const events: KeystrokeEvent[] = [
      { key: 'a', timestamp: 0, type: 'keydown', isDeletion: false, position: 0 },
      { key: 'b', timestamp: 100, type: 'keydown', isDeletion: false, position: 1 },
      { key: 'c', timestamp: 100 + 1000, type: 'keydown', isDeletion: false, position: 2 },
      { key: 'd', timestamp: 100 + 1000 + 100, type: 'keydown', isDeletion: false, position: 3 },
    ];
    const result = analyzeTypingSession(events);
    expect(result.pauses.totalPauses).toBeGreaterThan(0);
    expect(result.pauses.distribution.cognitive).toBeGreaterThanOrEqual(1);
  });

  it('includes burst analysis', () => {
    const events = makeKeystrokes(
      Array.from({ length: 20 }, (_, i) => String.fromCharCode(97 + (i % 26))),
      0,
      80,
    );
    const result = analyzeTypingSession(events);
    expect(result.bursts.totalBursts).toBeGreaterThanOrEqual(1);
    expect(result.bursts.burstCoverage).toBeGreaterThan(0);
  });
});

describe('serializeTypingAnalysis', () => {
  it('returns plain object with all fields', () => {
    const events = makeKeystrokes(['a', 'b', 'c', 'd', 'e'], 0, 120);
    const analysis = analyzeTypingSession(events);
    const serialized = serializeTypingAnalysis(analysis);

    expect(typeof serialized).toBe('object');
    // Serialized output must be a plain object (no class prototype) so it can
    // safely cross a Worker/postMessage boundary or be persisted as JSON.
    expect(Object.getPrototypeOf(serialized)).toBe(Object.prototype);
    // Only the compact storage-oriented fields are exposed; the full nested
    // pauses/bursts objects are intentionally flattened into scalars.
    expect(serialized.rhythm).toBeDefined();
    expect(serialized.confidence).toBeDefined();
    expect(serialized.cpm).toBeDefined();
    expect(serialized.pauseCount).toBeDefined();
    expect(serialized.burstCoverage).toBeDefined();
  });
});
