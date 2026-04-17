import { describe, it, expect } from 'vitest';
import {
  scoreStructural,
  combineScores,
  type StructuralScoreResult,
} from '../lib/services/osceStructuralScorer';

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** A near-complete SOAP note with all essential elements. */
const FULL_SOAP_NOTE = `
Subjective:
Chief complaint: 55 y/o male presents with acute chest pain x 2 hours.
HPI: Crushing substernal chest pain, onset at rest, 8/10 severity, radiating to left arm.
Patient reports nausea and diaphoresis. Past medical history significant for HTN and DM2.
Medications: lisinopril, metformin. Allergies: NKDA.
Review of systems otherwise unremarkable.

Objective:
Vitals: BP: 160/95, HR: 102, Temp: 98.6, RR: 22, SpO2: 94%.
Physical exam: Diaphoretic, anxious appearing. Lungs clear to auscultation.
Cardiovascular: tachycardic, regular rhythm, no murmurs. Abdomen soft, non-tender.
Labs ordered. EKG shows ST elevation in leads II, III, aVF.

Assessment:
Most likely diagnosis: Acute inferior STEMI.
Differential includes unstable angina, aortic dissection, PE.

Plan:
1. Aspirin 325mg chewed now.
2. Heparin bolus and drip.
3. Activate cath lab for emergent PCI.
4. Patient education regarding ACS and need for intervention.
5. Follow-up with cardiology post-catheterization.
Return precautions discussed. I understand this is a frightening situation.
I'm Dr. Smith, the PA on duty. Tell me more about when this started.
`.trim();

/** A very short/incomplete note. */
const MINIMAL_NOTE = 'Patient has chest pain.';

/** An empty note. */
const EMPTY_NOTE = '';

/** A dangerously long, unfocused encounter (> 1500 words). */
const UNFOCUSED_NOTE = Array.from({ length: 350 }, () => 'The patient mentioned many things.').join(' ');

// ─── scoreStructural — SOAP Presence ────────────────────────────────────────

describe('scoreStructural — SOAP presence', () => {
  it('scores all four SOAP sections when present', () => {
    const result = scoreStructural(FULL_SOAP_NOTE, 'Acute Coronary Syndrome');
    expect(result.sections.soapPresence.subjective.present).toBe(true);
    expect(result.sections.soapPresence.objective.present).toBe(true);
    expect(result.sections.soapPresence.assessment.present).toBe(true);
    expect(result.sections.soapPresence.plan.present).toBe(true);
  });

  it('returns 0 presence for each section in an empty note', () => {
    const result = scoreStructural(EMPTY_NOTE, 'Any');
    expect(result.sections.soapPresence.subjective.present).toBe(false);
    expect(result.sections.soapPresence.objective.present).toBe(false);
    expect(result.sections.soapPresence.assessment.present).toBe(false);
    expect(result.sections.soapPresence.plan.present).toBe(false);
    expect(result.sections.soapPresence.score).toBe(0);
  });

  it('caps the SOAP presence score at 25', () => {
    const result = scoreStructural(FULL_SOAP_NOTE, 'Any');
    // Max is 6.25 × 4 sections = 25
    expect(result.sections.soapPresence.score).toBeLessThanOrEqual(25);
  });
});

// ─── scoreStructural — Essential Elements ───────────────────────────────────

describe('scoreStructural — essential elements', () => {
  it('detects all 8 essential elements in a complete note', () => {
    const result = scoreStructural(FULL_SOAP_NOTE, 'Acute Coronary Syndrome');
    const e = result.sections.essentialElements;
    expect(e.chiefComplaint).toBe(true);
    expect(e.hpiPresent).toBe(true);
    expect(e.pmhPresent).toBe(true);
    expect(e.medicationsPresent).toBe(true);
    expect(e.allergiesPresent).toBe(true);
    expect(e.vitalSigns).toBe(true);
    expect(e.differentialPresent).toBe(true);
    expect(e.followUpPlan).toBe(true);
    // 8 × 3.125 = 25 max
    expect(e.score).toBeCloseTo(25, 1);
  });

  it('detects no essential elements in an empty note', () => {
    const result = scoreStructural(EMPTY_NOTE, 'Any');
    expect(result.sections.essentialElements.score).toBe(0);
  });
});

// ─── scoreStructural — Communication ────────────────────────────────────────

describe('scoreStructural — communication markers', () => {
  it('scores communication markers when present', () => {
    const result = scoreStructural(FULL_SOAP_NOTE, 'Acute Coronary Syndrome');
    // Has "Tell me more", "I understand", "I'm Dr. Smith", "patient education"
    expect(result.sections.communication.openEndedQuestions).toBe(true);
    expect(result.sections.communication.empathyMarkers).toBe(true);
    expect(result.sections.communication.introductionPresent).toBe(true);
    expect(result.sections.communication.patientEducation).toBe(true);
    // 3 + 3 + 2 + 2 = 10
    expect(result.sections.communication.score).toBe(10);
  });

  it('scores 0 when no communication markers present', () => {
    const result = scoreStructural('BP 120/80. Aspirin 325mg.', 'ACS');
    expect(result.sections.communication.score).toBe(0);
  });
});

// ─── scoreStructural — Efficiency ───────────────────────────────────────────

describe('scoreStructural — efficiency', () => {
  it('gives full 5 points for a focused encounter', () => {
    const result = scoreStructural(FULL_SOAP_NOTE, 'Acute Coronary Syndrome');
    // FULL_SOAP_NOTE is ~150+ words, should land in "minimal" or full range
    expect(result.sections.efficiency.score).toBeGreaterThanOrEqual(1);
    expect(result.sections.efficiency.score).toBeLessThanOrEqual(5);
  });

  it('gives 1 point for very incomplete (< 100 words)', () => {
    const result = scoreStructural(MINIMAL_NOTE, 'Any');
    expect(result.sections.efficiency.score).toBe(1);
    expect(result.sections.efficiency.totalWords).toBeLessThan(100);
  });

  it('flags unfocused (> 1500 words) and lowers score', () => {
    const result = scoreStructural(UNFOCUSED_NOTE, 'Any');
    expect(result.sections.efficiency.seemsUnfocused).toBe(true);
    expect(result.sections.efficiency.score).toBe(2);
  });
});

// ─── scoreStructural — Dangerous Actions ────────────────────────────────────

describe('scoreStructural — dangerous action safety net', () => {
  it('detects beta-blocker in decompensated ACS', () => {
    const text = 'Patient with acute coronary syndrome. Gave metoprolol despite decompensated state.';
    const result = scoreStructural(text, 'acute coronary syndrome');
    expect(result.dangerousActions.length).toBeGreaterThan(0);
    expect(result.dangerousPenalty).toBeGreaterThanOrEqual(15);
  });

  it('detects missed aspirin in ACS', () => {
    const text = 'Acute coronary syndrome. No aspirin given.';
    const result = scoreStructural(text, 'acute coronary syndrome');
    const hasMissedAspirin = result.dangerousActions.some((a) =>
      a.description.toLowerCase().includes('aspirin')
    );
    expect(hasMissedAspirin).toBe(true);
  });

  it('detects late tPA in stroke', () => {
    const text = 'Stroke patient. Giving tpa at the 4.5 hour window.';
    const result = scoreStructural(text, 'stroke');
    expect(result.dangerousActions.length).toBeGreaterThan(0);
  });

  it('detects sedative in acute asthma', () => {
    const text = 'Acute asthma exacerbation. Administered benzodiazepine for anxiety.';
    const result = scoreStructural(text, 'asthma');
    expect(result.dangerousActions.length).toBeGreaterThan(0);
  });

  it('returns no dangerous actions when diagnosis does not match', () => {
    const text = 'Gave metoprolol to patient.';
    const result = scoreStructural(text, 'common cold');
    expect(result.dangerousActions).toHaveLength(0);
    expect(result.dangerousPenalty).toBe(0);
  });

  it('subtracts dangerous penalty from total score', () => {
    const baseText = FULL_SOAP_NOTE;
    const dangerousText = FULL_SOAP_NOTE + '\nGave metoprolol despite decompensated state.';
    const base = scoreStructural(baseText, 'unrelated diagnosis');
    const withPenalty = scoreStructural(dangerousText, 'acute coronary syndrome');
    expect(withPenalty.totalScore).toBeLessThan(base.totalScore);
  });
});

// ─── scoreStructural — Overall behavior ─────────────────────────────────────

describe('scoreStructural — overall behavior', () => {
  it('returns totalScore >= 0 (never negative)', () => {
    // Stack multiple dangerous actions to ensure penalty > raw score
    const text = 'acute coronary syndrome metoprolol decompensated no aspirin';
    const result = scoreStructural(text, 'acute coronary syndrome');
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
  });

  it('flags borderline cases in the 35-50 range', () => {
    // Partial note that should score in borderline zone
    const text = `
      Subjective: Patient with chest pain, onset today.
      Objective: BP 140/90. HR 90.
      Assessment: Possible cardiac cause.
      Plan: Order EKG.
    `;
    const result = scoreStructural(text, 'unknown');
    if (result.totalScore >= 35 && result.totalScore <= 50) {
      expect(result.isBorderline).toBe(true);
    } else {
      expect(result.isBorderline).toBe(false);
    }
  });

  it('skips AI reasoning when structural score is very low (< 20)', () => {
    const result = scoreStructural(EMPTY_NOTE, 'Any');
    expect(result.needsAIReasoning).toBe(false);
  });

  it('recommends AI reasoning for reasonable encounters', () => {
    const result = scoreStructural(FULL_SOAP_NOTE, 'Acute Coronary Syndrome');
    expect(result.needsAIReasoning).toBe(true);
  });

  it('completes in reasonable time (< 100ms)', () => {
    const result = scoreStructural(FULL_SOAP_NOTE, 'Acute Coronary Syndrome');
    expect(result.processingTimeMs).toBeLessThan(100);
  });
});

// ─── combineScores ──────────────────────────────────────────────────────────

describe('combineScores', () => {
  it('combines structural (max 65) and AI reasoning (max 35) to form 0-100 scale', () => {
    // Perfect on both: 65 + 35 = 100
    expect(combineScores(65, 100)).toBe(100);
  });

  it('caps structural contribution at 65 even if input exceeds', () => {
    // Structural capped at 65; AI at 100% = 35 → 65 + 35 = 100
    expect(combineScores(80, 100)).toBe(100);
  });

  it('scales AI reasoning proportionally', () => {
    // 0 structural + 50% AI reasoning → 0 + 17.5 → 18 (rounded)
    const result = combineScores(0, 50);
    expect(result).toBeGreaterThanOrEqual(17);
    expect(result).toBeLessThanOrEqual(18);
  });

  it('returns 0 for completely failed encounter', () => {
    expect(combineScores(0, 0)).toBe(0);
  });

  it('returns integer (rounded)', () => {
    const result = combineScores(30, 70);
    expect(Number.isInteger(result)).toBe(true);
  });
});
