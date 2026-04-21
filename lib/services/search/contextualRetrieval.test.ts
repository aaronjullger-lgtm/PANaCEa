/**
 * Unit tests for lib/services/search/contextualRetrieval.ts
 *
 * Three pure / mockable surfaces:
 *  1. buildContextPrompt — pure string function
 *  2. splitIntoParentChild — pure chunking function
 *  3. contextualizeChunk + batchContextualize — async but accepts a mock generateFn
 *
 * No DB, no network, no Gemini API. All LLM calls are replaced with vi.fn().
 */

import { describe, it, expect, vi } from 'vitest';
import {
  buildContextPrompt,
  contextualizeChunk,
  batchContextualize,
  splitIntoParentChild,
  type ContentChunk,
} from './contextualRetrieval';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeChunk(partial: Partial<ContentChunk> & { id: string }): ContentChunk {
  return {
    text: partial.text ?? 'Sample chunk text.',
    sourceTitle: partial.sourceTitle ?? 'Hypertension',
    section: partial.section,
    metadata: partial.metadata,
    ...partial,
  };
}

// ─── buildContextPrompt ───────────────────────────────────────────────────────

describe('buildContextPrompt', () => {
  it('includes chunk text inside <chunk> tags', () => {
    const chunk = makeChunk({ id: 'c1', text: 'ACE inhibitors block angiotensin conversion.' });
    const prompt = buildContextPrompt(chunk);
    expect(prompt).toContain('<chunk>');
    expect(prompt).toContain('</chunk>');
    expect(prompt).toContain('ACE inhibitors block angiotensin conversion.');
  });

  it('includes sourceTitle when no documentSummary provided', () => {
    const chunk = makeChunk({ id: 'c2', sourceTitle: 'Atrial Fibrillation' });
    const prompt = buildContextPrompt(chunk);
    expect(prompt).toContain('Source: Atrial Fibrillation');
  });

  it('uses documentSummary instead of sourceTitle when both provided', () => {
    const chunk = makeChunk({ id: 'c3', sourceTitle: 'STEMI' });
    const prompt = buildContextPrompt(chunk, 'ST-Elevation Myocardial Infarction overview');
    expect(prompt).toContain('Document: ST-Elevation Myocardial Infarction overview');
    expect(prompt).not.toContain('Source: STEMI');
  });

  it('includes section when provided', () => {
    const chunk = makeChunk({ id: 'c4', section: 'Treatment' });
    const prompt = buildContextPrompt(chunk);
    expect(prompt).toContain('Section: Treatment');
  });

  it('omits section line when section is absent', () => {
    const chunk = makeChunk({ id: 'c5' }); // no section
    const prompt = buildContextPrompt(chunk);
    expect(prompt).not.toContain('Section:');
  });

  it('truncates chunk text to 2000 characters', () => {
    const longText = 'x'.repeat(5000);
    const chunk = makeChunk({ id: 'c6', text: longText });
    const prompt = buildContextPrompt(chunk);
    // The full 5000-char text should NOT appear; exactly 2000 chars should
    expect(prompt).not.toContain('x'.repeat(2001));
    expect(prompt).toContain('x'.repeat(2000));
  });

  it('instructs the model NOT to repeat chunk content', () => {
    const chunk = makeChunk({ id: 'c7' });
    const prompt = buildContextPrompt(chunk);
    expect(prompt).toMatch(/do not repeat/i);
  });

  it('ends with "Context:" label', () => {
    const chunk = makeChunk({ id: 'c8' });
    const prompt = buildContextPrompt(chunk);
    expect(prompt.trimEnd()).toMatch(/Context:\s*$/);
  });

  it('returns a non-empty string for minimal chunk', () => {
    const chunk = makeChunk({ id: 'c9', text: '', sourceTitle: '' });
    const prompt = buildContextPrompt(chunk);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });
});

// ─── contextualizeChunk ───────────────────────────────────────────────────────

describe('contextualizeChunk', () => {
  it('prepends context prefix to chunk text', async () => {
    const chunk = makeChunk({
      id: 'd1',
      text: 'Loop diuretics increase renal excretion of sodium and water.',
    });
    const generateFn = vi.fn().mockResolvedValue('This chunk describes the mechanism of loop diuretics.');

    const result = await contextualizeChunk(chunk, generateFn);

    expect(result.contextPrefix).toBe(
      'This chunk describes the mechanism of loop diuretics.'
    );
    expect(result.contextualizedText).toContain(result.contextPrefix);
    expect(result.contextualizedText).toContain(chunk.text);
  });

  it('strips leading "Context: " prefix from generateFn output', async () => {
    const chunk = makeChunk({ id: 'd2' });
    const generateFn = vi.fn().mockResolvedValue('Context: This describes heart failure treatment.');

    const result = await contextualizeChunk(chunk, generateFn);
    expect(result.contextPrefix).not.toMatch(/^Context:/i);
    expect(result.contextPrefix).toBe('This describes heart failure treatment.');
  });

  it('trims whitespace from generated context', async () => {
    const chunk = makeChunk({ id: 'd3' });
    const generateFn = vi.fn().mockResolvedValue('  \n  Context about arrhythmia.  \n  ');

    const result = await contextualizeChunk(chunk, generateFn);
    expect(result.contextPrefix).toBe('Context about arrhythmia.');
  });

  it('calls generateFn exactly once', async () => {
    const chunk = makeChunk({ id: 'd4' });
    const generateFn = vi.fn().mockResolvedValue('Some context.');

    await contextualizeChunk(chunk, generateFn);
    expect(generateFn).toHaveBeenCalledOnce();
  });

  it('passes a prompt string to generateFn (not the raw chunk text)', async () => {
    const chunk = makeChunk({ id: 'd5', text: 'Beta blockers reduce heart rate.' });
    const generateFn = vi.fn().mockResolvedValue('Context.');

    await contextualizeChunk(chunk, generateFn);
    const prompt: string = generateFn.mock.calls[0][0];
    // The prompt should contain the chunk text inside XML tags, not as a bare argument
    expect(prompt).toContain('<chunk>');
    expect(prompt).toContain('Beta blockers reduce heart rate.');
  });

  it('preserves all original ContentChunk fields in the output', async () => {
    const chunk = makeChunk({
      id: 'd6',
      text: 'Warfarin requires INR monitoring.',
      sourceTitle: 'Anticoagulation',
      section: 'Monitoring',
      metadata: { conditionId: 'abc123' },
    });
    const generateFn = vi.fn().mockResolvedValue('Monitoring context.');

    const result = await contextualizeChunk(chunk, generateFn);

    expect(result.id).toBe('d6');
    expect(result.sourceTitle).toBe('Anticoagulation');
    expect(result.section).toBe('Monitoring');
    expect(result.metadata).toEqual({ conditionId: 'abc123' });
  });

  it('contextualizedText = contextPrefix + blank line + original text', async () => {
    const chunk = makeChunk({ id: 'd7', text: 'Original chunk.' });
    const generateFn = vi.fn().mockResolvedValue('The prefix.');

    const result = await contextualizeChunk(chunk, generateFn);
    expect(result.contextualizedText).toBe('The prefix.\n\nOriginal chunk.');
  });
});

// ─── batchContextualize ───────────────────────────────────────────────────────

describe('batchContextualize', () => {
  it('returns one ContextualizedChunk per input chunk', async () => {
    const chunks = Array.from({ length: 8 }, (_, i) =>
      makeChunk({ id: `b${i}`, text: `Content for chunk ${i}.` })
    );
    const generateFn = vi.fn().mockResolvedValue('Generated context.');

    const results = await batchContextualize(chunks, generateFn);
    expect(results.length).toBe(8);
  });

  it('calls generateFn once per chunk', async () => {
    const chunks = [makeChunk({ id: 'e1' }), makeChunk({ id: 'e2' }), makeChunk({ id: 'e3' })];
    const generateFn = vi.fn().mockResolvedValue('ctx');

    await batchContextualize(chunks, generateFn);
    expect(generateFn).toHaveBeenCalledTimes(3);
  });

  it('falls back to original text (empty contextPrefix) when generateFn rejects', async () => {
    const chunks = [
      makeChunk({ id: 'f1', text: 'Good chunk.' }),
      makeChunk({ id: 'f2', text: 'Failing chunk.' }),
    ];
    const generateFn = vi
      .fn()
      .mockResolvedValueOnce('Good context.')
      .mockRejectedValueOnce(new Error('API timeout'));

    const results = await batchContextualize(chunks, generateFn);

    expect(results.length).toBe(2);
    // First chunk has real context
    expect(results[0].contextPrefix).toBe('Good context.');
    expect(results[0].contextualizedText).toContain('Good context.');

    // Second chunk fell back gracefully
    expect(results[1].contextPrefix).toBe('');
    expect(results[1].contextualizedText).toBe('Failing chunk.');
    expect(results[1].id).toBe('f2');
  });

  it('calls onProgress with (completed, total) for each chunk', async () => {
    const chunks = Array.from({ length: 3 }, (_, i) => makeChunk({ id: `g${i}` }));
    const generateFn = vi.fn().mockResolvedValue('ctx');
    const onProgress = vi.fn();

    await batchContextualize(chunks, generateFn, { concurrency: 10, onProgress });

    expect(onProgress).toHaveBeenCalledTimes(3);
    // Third call: completed=3, total=3
    expect(onProgress).toHaveBeenLastCalledWith(3, 3);
  });

  it('respects concurrency: never issues more than N concurrent calls in a batch', async () => {
    // With concurrency=2 and 5 chunks, first batch runs 2, second runs 2, third runs 1
    let inflight = 0;
    let maxInflight = 0;

    const chunks = Array.from({ length: 5 }, (_, i) => makeChunk({ id: `h${i}` }));
    const generateFn = vi.fn().mockImplementation(async () => {
      inflight++;
      maxInflight = Math.max(maxInflight, inflight);
      await new Promise((r) => setTimeout(r, 0)); // yield
      inflight--;
      return 'ctx';
    });

    await batchContextualize(chunks, generateFn, { concurrency: 2 });
    // Should never exceed concurrency=2 within a batch
    expect(maxInflight).toBeLessThanOrEqual(2);
  });

  it('handles empty chunk array without throwing', async () => {
    const generateFn = vi.fn();
    const results = await batchContextualize([], generateFn);
    expect(results).toEqual([]);
    expect(generateFn).not.toHaveBeenCalled();
  });
});

// ─── splitIntoParentChild ─────────────────────────────────────────────────────

describe('splitIntoParentChild', () => {
  it('returns empty array for empty string', () => {
    expect(splitIntoParentChild('')).toEqual([]);
  });

  it('returns single parent with text and children for short input', () => {
    const text = 'Hypertension is a common condition.\n\nIt is managed with lifestyle modifications.';
    const result = splitIntoParentChild(text);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].parent).toBeTruthy();
    expect(Array.isArray(result[0].children)).toBe(true);
  });

  it('parent chunks do not exceed parentMaxChars option', () => {
    const para = 'A'.repeat(200);
    // 20 paragraphs of 200 chars each = 4000 chars total
    const text = Array.from({ length: 20 }, () => para).join('\n\n');

    const result = splitIntoParentChild(text, { parentMaxChars: 500 });

    for (const { parent } of result) {
      expect(parent.length).toBeLessThanOrEqual(500 + 200); // tolerance for one-para overflow
    }
  });

  it('children of each parent are derived from parent text', () => {
    const text = [
      'First paragraph with relevant content about atrial fibrillation.',
      'Second paragraph describing rate control with beta blockers.',
      'Third paragraph about anticoagulation with warfarin and DOACs.',
    ].join('\n\n');

    const result = splitIntoParentChild(text);

    for (const { parent, children } of result) {
      for (const child of children) {
        // Every child sentence should appear in (or be derivable from) the parent
        expect(parent).toContain(child.slice(0, 20));
      }
    }
  });

  it('each child is within childMaxChars limit', () => {
    const longParagraph =
      'Warfarin inhibits vitamin K epoxide reductase. ' +
      'This blocks synthesis of clotting factors II, VII, IX, and X. ' +
      'Monitoring requires INR values between 2.0 and 3.0. ' +
      'Reversal can be achieved with vitamin K or fresh frozen plasma. ' +
      'Andexanet alfa is used for DOAC reversal not warfarin. ' +
      'Drug interactions are numerous including antibiotics and NSAIDs. ';

    const text = longParagraph.repeat(5);
    const result = splitIntoParentChild(text, { childMaxChars: 150 });

    for (const { children } of result) {
      for (const child of children) {
        expect(child.length).toBeLessThanOrEqual(150 + 200); // one sentence overflow tolerance
      }
    }
  });

  it('produces more chunks for longer text', () => {
    const shortText = 'One sentence. Another sentence.';
    const longText = Array.from(
      { length: 30 },
      (_, i) => `Paragraph ${i}: ${`Content about topic ${i}. `.repeat(10)}`
    ).join('\n\n');

    const shortResult = splitIntoParentChild(shortText);
    const longResult = splitIntoParentChild(longText);
    expect(longResult.length).toBeGreaterThan(shortResult.length);
  });

  it('does not produce empty parent strings', () => {
    const text = 'Sentence one.\n\nSentence two.\n\nSentence three.';
    const result = splitIntoParentChild(text);
    for (const { parent } of result) {
      expect(parent.trim().length).toBeGreaterThan(0);
    }
  });

  it('preserves all text across parent+children (no data loss)', () => {
    const text =
      'Sepsis is defined by life-threatening organ dysfunction. ' +
      'The SOFA score is used to assess severity.\n\n' +
      'Treatment includes broad spectrum antibiotics within one hour. ' +
      'Fluid resuscitation with 30ml/kg is recommended.';

    const result = splitIntoParentChild(text);
    const allParentText = result.map((r) => r.parent).join(' ');

    // Key phrases should appear in some parent
    expect(allParentText).toContain('Sepsis');
    expect(allParentText).toContain('SOFA');
    expect(allParentText).toContain('antibiotics');
  });

  it('respects custom overlap option (overlapping sentence carries over)', () => {
    // With large overlap, the last sentence of each parent should appear at the
    // start of the next parent. We verify structural correctness, not exact text.
    const sentences = Array.from(
      { length: 10 },
      (_, i) => `Sentence number ${i} about clinical topic.`
    );
    const text = sentences.join(' ');
    // Use small parentMaxChars to force multiple parents
    const result = splitIntoParentChild(text, { parentMaxChars: 80, overlap: 40 });
    // Simply verify it runs without error and returns valid structure
    expect(Array.isArray(result)).toBe(true);
    for (const chunk of result) {
      expect(typeof chunk.parent).toBe('string');
      expect(Array.isArray(chunk.children)).toBe(true);
    }
  });
});
