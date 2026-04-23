// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/services/ankiExportService.ts
 *
 * Pure (DOM-free) functions tested:
 *   getMissedQuestionsToday — filters performance records to today's incorrect answers
 *   questionToAnkiCard      — builds AnkiCard from a Question
 *   exportToAnkiText        — serialises cards to tab-separated Anki import format
 *   exportToAnkiConnect     — builds AnkiConnect API payload
 *
 * DOM-dependent functions (downloadFile, exportMissedTodayToAnki) are excluded.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getMissedQuestionsToday,
  questionToAnkiCard,
  exportToAnkiText,
  exportToAnkiConnect,
} from './ankiExportService';
import type { AnkiExportOptions } from './ankiExportService';
import type { Question, PerformanceRecord } from '../../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

const TODAY_TS = (() => {
  const d = new Date();
  d.setHours(12, 0, 0, 0); // noon today in ms
  return d.getTime();
})();

const YESTERDAY_TS = TODAY_TS - 86_400_000;

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    question: 'What is the first-line treatment for HTN?',
    options: ['Metoprolol', 'Lisinopril', 'Amlodipine', 'Hydrochlorothiazide'],
    correctAnswerIndex: 1,
    rationale: 'ACE inhibitors are first-line for most patients.',
    topic: 'Cardiology',
    system: 'Cardiology' as any,
    subcategory: 'Hypertension',
    conditionId: 'cond-htn',
    condition: 'Hypertension',
    pearls: ['Check creatinine before starting', 'Monitor potassium'],
    ...overrides,
  };
}

function makeRecord(overrides: Partial<PerformanceRecord> = {}): PerformanceRecord {
  return {
    timestamp: TODAY_TS,
    system: 'Cardiology',
    subcategory: null,
    conditionId: 'cond-htn',
    condition: 'Hypertension',
    topic: 'Cardiology',
    isCorrect: false,
    focus: 'diagnosis',
    ...overrides,
  };
}

// ─── getMissedQuestionsToday ─────────────────────────────────────────────────

describe('getMissedQuestionsToday', () => {
  it('returns empty array when no records exist', () => {
    const q = makeQuestion();
    expect(getMissedQuestionsToday([], [q])).toHaveLength(0);
  });

  it('returns empty array when no questions exist', () => {
    const rec = makeRecord();
    expect(getMissedQuestionsToday([rec], [])).toHaveLength(0);
  });

  it('includes question missed today (matched by conditionId)', () => {
    const q = makeQuestion({ conditionId: 'cond-htn' });
    const rec = makeRecord({ conditionId: 'cond-htn', isCorrect: false, timestamp: TODAY_TS });
    const result = getMissedQuestionsToday([rec], [q]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(q);
  });

  it('excludes questions answered correctly today', () => {
    const q = makeQuestion({ conditionId: 'cond-htn' });
    const rec = makeRecord({ conditionId: 'cond-htn', isCorrect: true, timestamp: TODAY_TS });
    expect(getMissedQuestionsToday([rec], [q])).toHaveLength(0);
  });

  it('excludes questions missed yesterday (not today)', () => {
    const q = makeQuestion({ conditionId: 'cond-htn' });
    const rec = makeRecord({ conditionId: 'cond-htn', isCorrect: false, timestamp: YESTERDAY_TS });
    expect(getMissedQuestionsToday([rec], [q])).toHaveLength(0);
  });

  it('matches by condition name when conditionId is empty', () => {
    const q = makeQuestion({ conditionId: '', condition: 'Hypertension' });
    const rec = makeRecord({
      conditionId: '',
      condition: 'Hypertension',
      isCorrect: false,
      timestamp: TODAY_TS,
    });
    const result = getMissedQuestionsToday([rec], [q]);
    expect(result).toHaveLength(1);
  });

  it('matches by topic when conditionId and condition are empty', () => {
    const q = makeQuestion({ conditionId: '', condition: '', topic: 'Cardiology' });
    const rec = makeRecord({
      conditionId: '',
      condition: '',
      topic: 'Cardiology',
      isCorrect: false,
      timestamp: TODAY_TS,
    });
    const result = getMissedQuestionsToday([rec], [q]);
    expect(result).toHaveLength(1);
  });

  it('does not duplicate questions when multiple missed records for same condition', () => {
    const q = makeQuestion({ conditionId: 'cond-htn' });
    const rec1 = makeRecord({ conditionId: 'cond-htn', isCorrect: false, timestamp: TODAY_TS });
    const rec2 = makeRecord({ conditionId: 'cond-htn', isCorrect: false, timestamp: TODAY_TS });
    // Set de-duplicates — both records produce same id so question appears once
    const result = getMissedQuestionsToday([rec1, rec2], [q]);
    expect(result).toHaveLength(1);
  });

  it('returns only the subset of questions that were missed today', () => {
    const q1 = makeQuestion({ conditionId: 'cond-htn' });
    const q2 = makeQuestion({ conditionId: 'cond-dm', condition: 'Diabetes' });
    const rec = makeRecord({ conditionId: 'cond-htn', isCorrect: false, timestamp: TODAY_TS });
    const result = getMissedQuestionsToday([rec], [q1, q2]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(q1);
  });
});

// ─── questionToAnkiCard ──────────────────────────────────────────────────────

describe('questionToAnkiCard', () => {
  it('front contains the question text', () => {
    const q = makeQuestion();
    const card = questionToAnkiCard(q);
    expect(card.front).toContain(q.question);
  });

  it('front lists options as A) B) C) D)', () => {
    const q = makeQuestion();
    const card = questionToAnkiCard(q);
    expect(card.front).toContain('A) Metoprolol');
    expect(card.front).toContain('B) Lisinopril');
    expect(card.front).toContain('C) Amlodipine');
    expect(card.front).toContain('D) Hydrochlorothiazide');
  });

  it('back begins with bolded answer in "Answer: X) text" format', () => {
    const q = makeQuestion({ correctAnswerIndex: 1 }); // B) Lisinopril
    const card = questionToAnkiCard(q);
    expect(card.back).toContain('<strong>Answer: B) Lisinopril</strong>');
  });

  it('back includes rationale when includeRationale=true (default)', () => {
    const q = makeQuestion({ rationale: 'ACE inhibitors are first-line.' });
    const card = questionToAnkiCard(q);
    expect(card.back).toContain('ACE inhibitors are first-line.');
    expect(card.back).toContain('<strong>Explanation:</strong>');
  });

  it('back omits rationale when includeRationale=false', () => {
    const q = makeQuestion();
    const card = questionToAnkiCard(q, { includeRationale: false });
    expect(card.back).not.toContain('Explanation');
    expect(card.back).not.toContain('ACE inhibitors');
  });

  it('back includes pearls when includePearls=true (default)', () => {
    const q = makeQuestion({ pearls: ['Check creatinine', 'Monitor potassium'] });
    const card = questionToAnkiCard(q);
    expect(card.back).toContain('<strong>Key Pearls:</strong>');
    expect(card.back).toContain('• Check creatinine');
    expect(card.back).toContain('• Monitor potassium');
  });

  it('back omits pearls when includePearls=false', () => {
    const q = makeQuestion({ pearls: ['Check creatinine'] });
    const card = questionToAnkiCard(q, { includePearls: false });
    expect(card.back).not.toContain('Key Pearls');
    expect(card.back).not.toContain('Check creatinine');
  });

  it('back omits pearl section when pearls array is empty', () => {
    const q = makeQuestion({ pearls: [] });
    const card = questionToAnkiCard(q);
    expect(card.back).not.toContain('Key Pearls');
  });

  it('back omits rationale section when rationale is falsy', () => {
    const q = makeQuestion({ rationale: '' });
    const card = questionToAnkiCard(q);
    expect(card.back).not.toContain('Explanation');
  });

  it('tags always include PANaCEa and PANCE', () => {
    const q = makeQuestion({ system: undefined, condition: '', subcategory: undefined });
    const card = questionToAnkiCard(q);
    expect(card.tags).toContain('PANaCEa');
    expect(card.tags).toContain('PANCE');
  });

  it('includes system tag when tagWithSystem=true (default) and system is set', () => {
    const q = makeQuestion({ system: 'Cardiology' as any });
    const card = questionToAnkiCard(q);
    expect(card.tags).toContain('Cardiology');
  });

  it('omits system tag when tagWithSystem=false', () => {
    const q = makeQuestion({ system: 'Cardiology' as any });
    const card = questionToAnkiCard(q, { tagWithSystem: false });
    expect(card.tags).not.toContain('Cardiology');
  });

  it('includes sanitized condition tag when tagWithCondition=true (default)', () => {
    const q = makeQuestion({ condition: 'Type 2 Diabetes' });
    const card = questionToAnkiCard(q);
    // spaces → underscores
    expect(card.tags).toContain('Type_2_Diabetes');
  });

  it('omits condition tag when tagWithCondition=false', () => {
    // Use a unique condition name that won't collide with the default subcategory
    const q = makeQuestion({ condition: 'Hypertension', subcategory: 'HTN_Management' });
    const card = questionToAnkiCard(q, { tagWithCondition: false });
    expect(card.tags).not.toContain('Hypertension');
  });

  it('strips special characters from condition tag', () => {
    const q = makeQuestion({ condition: 'Crohn\'s Disease (IBD)' });
    const card = questionToAnkiCard(q);
    // apostrophe and parens removed; space → underscore
    expect(card.tags.some((t) => t.includes('_'))).toBe(true);
    expect(card.tags.some((t) => t.includes("'"))).toBe(false);
    expect(card.tags.some((t) => t.includes('('))).toBe(false);
  });

  it('includes subcategory tag when subcategory is set', () => {
    const q = makeQuestion({ subcategory: 'Heart Failure' });
    const card = questionToAnkiCard(q);
    expect(card.tags).toContain('Heart_Failure');
  });

  it('guid equals conditionId when conditionId is set', () => {
    const q = makeQuestion({ conditionId: 'cond-htn' });
    const card = questionToAnkiCard(q);
    expect(card.guid).toBe('cond-htn');
  });

  it('guid is undefined when conditionId is empty string', () => {
    const q = makeQuestion({ conditionId: '' });
    const card = questionToAnkiCard(q);
    expect(card.guid).toBeUndefined();
  });
});

// ─── exportToAnkiText ────────────────────────────────────────────────────────

describe('exportToAnkiText', () => {
  it('output starts with #separator:tab header', () => {
    const result = exportToAnkiText([]);
    expect(result).toContain('#separator:tab');
  });

  it('output contains #html:true header', () => {
    const result = exportToAnkiText([]);
    expect(result).toContain('#html:true');
  });

  it('uses default deck name PANaCEa_Missed_Questions', () => {
    const result = exportToAnkiText([]);
    expect(result).toContain('PANaCEa_Missed_Questions');
  });

  it('uses custom deck name from options', () => {
    const result = exportToAnkiText([], { deckName: 'My Custom Deck' });
    expect(result).toContain('My Custom Deck');
  });

  it('output contains #tags column:3', () => {
    const result = exportToAnkiText([]);
    expect(result).toContain('#tags column:3');
  });

  it('returns only header for empty questions array', () => {
    const result = exportToAnkiText([]);
    // Header is 4 lines + blank line; no card rows
    const lines = result.split('\n').filter((l) => l.trim().length > 0);
    expect(lines.every((l) => l.startsWith('#'))).toBe(true);
  });

  it('each card row is tab-separated with 3 columns (front, back, tags)', () => {
    const q = makeQuestion();
    const result = exportToAnkiText([q]);
    const cardLines = result.split('\n').filter((l) => l.includes('\t'));
    expect(cardLines).toHaveLength(1);
    const cols = cardLines[0].split('\t');
    expect(cols).toHaveLength(3);
  });

  it('replaces newlines in front with <br>', () => {
    const q = makeQuestion();
    const result = exportToAnkiText([q]);
    const cardLines = result.split('\n').filter((l) => l.includes('\t'));
    const front = cardLines[0].split('\t')[0];
    expect(front).toContain('<br>');
    expect(front).not.toMatch(/(?<!>)\n/); // no raw newlines in front
  });

  it('replaces newlines in back with <br>', () => {
    const q = makeQuestion();
    const result = exportToAnkiText([q]);
    const cardLines = result.split('\n').filter((l) => l.includes('\t'));
    const back = cardLines[0].split('\t')[1];
    expect(back).toContain('<br>');
  });

  it('tags column is space-separated tag values', () => {
    const q = makeQuestion({ system: 'Cardiology' as any });
    const result = exportToAnkiText([q]);
    const cardLines = result.split('\n').filter((l) => l.includes('\t'));
    const tags = cardLines[0].split('\t')[2];
    expect(tags).toContain('PANaCEa');
    expect(tags).toContain('PANCE');
    expect(tags).toContain('Cardiology');
  });

  it('produces one card row per question', () => {
    const questions = [makeQuestion({ conditionId: 'q1' }), makeQuestion({ conditionId: 'q2' })];
    const result = exportToAnkiText(questions);
    const cardLines = result.split('\n').filter((l) => l.includes('\t'));
    expect(cardLines).toHaveLength(2);
  });
});

// ─── exportToAnkiConnect ─────────────────────────────────────────────────────

describe('exportToAnkiConnect', () => {
  it('returns object with action="addNotes"', () => {
    const result = exportToAnkiConnect([]) as any;
    expect(result.action).toBe('addNotes');
  });

  it('returns version=6', () => {
    const result = exportToAnkiConnect([]) as any;
    expect(result.version).toBe(6);
  });

  it('returns params.notes as empty array for empty input', () => {
    const result = exportToAnkiConnect([]) as any;
    expect(Array.isArray(result.params.notes)).toBe(true);
    expect(result.params.notes).toHaveLength(0);
  });

  it('each note has correct deckName (default)', () => {
    const q = makeQuestion();
    const result = exportToAnkiConnect([q]) as any;
    expect(result.params.notes[0].deckName).toBe('PANaCEa_Missed_Questions');
  });

  it('each note uses custom deckName from options', () => {
    const q = makeQuestion();
    const result = exportToAnkiConnect([q], { deckName: 'My Deck' }) as any;
    expect(result.params.notes[0].deckName).toBe('My Deck');
  });

  it('each note has modelName="Basic"', () => {
    const q = makeQuestion();
    const result = exportToAnkiConnect([q]) as any;
    expect(result.params.notes[0].modelName).toBe('Basic');
  });

  it('each note has fields.Front and fields.Back', () => {
    const q = makeQuestion();
    const result = exportToAnkiConnect([q]) as any;
    const note = result.params.notes[0];
    expect(typeof note.fields.Front).toBe('string');
    expect(note.fields.Front.length).toBeGreaterThan(0);
    expect(typeof note.fields.Back).toBe('string');
    expect(note.fields.Back.length).toBeGreaterThan(0);
  });

  it('fields.Front uses <br> instead of newlines', () => {
    const q = makeQuestion();
    const result = exportToAnkiConnect([q]) as any;
    const front = result.params.notes[0].fields.Front;
    expect(front).toContain('<br>');
  });

  it('fields.Back uses <br> instead of newlines', () => {
    const q = makeQuestion();
    const result = exportToAnkiConnect([q]) as any;
    const back = result.params.notes[0].fields.Back;
    expect(back).toContain('<br>');
  });

  it('each note has tags array', () => {
    const q = makeQuestion();
    const result = exportToAnkiConnect([q]) as any;
    expect(Array.isArray(result.params.notes[0].tags)).toBe(true);
    expect(result.params.notes[0].tags).toContain('PANaCEa');
  });

  it('each note has options.allowDuplicate=false', () => {
    const q = makeQuestion();
    const result = exportToAnkiConnect([q]) as any;
    expect(result.params.notes[0].options.allowDuplicate).toBe(false);
  });

  it('each note has options.duplicateScope="deck"', () => {
    const q = makeQuestion();
    const result = exportToAnkiConnect([q]) as any;
    expect(result.params.notes[0].options.duplicateScope).toBe('deck');
  });

  it('produces one note per question', () => {
    const questions = [makeQuestion({ conditionId: 'a' }), makeQuestion({ conditionId: 'b' })];
    const result = exportToAnkiConnect(questions) as any;
    expect(result.params.notes).toHaveLength(2);
  });
});
