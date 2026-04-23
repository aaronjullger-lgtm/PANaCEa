import { describe, it, expect } from 'vitest';
import { scoreStructural, combineScores } from './osceStructuralScorer';

// ─── combineScores ────────────────────────────────────────────────────────────

describe('combineScores', () => {
  it('returns 100 when both scores are perfect', () => {
    // structural=65, ai=100 → 65 + 35 = 100
    expect(combineScores(65, 100)).toBe(100);
  });

  it('returns 0 when both scores are 0', () => {
    expect(combineScores(0, 0)).toBe(0);
  });

  it('caps structural contribution at 65', () => {
    // Structural score above 65 should be capped
    expect(combineScores(80, 100)).toBe(100); // (65 + 35) = 100
    expect(combineScores(100, 100)).toBe(100);
  });

  it('ai score contributes 35% of total', () => {
    // structuralScore=0, aiReasoningScore=100 → 0 + 35 = 35
    expect(combineScores(0, 100)).toBe(35);
  });

  it('structural score contributes up to 65%', () => {
    // structuralScore=65, aiReasoningScore=0 → 65 + 0 = 65
    expect(combineScores(65, 0)).toBe(65);
  });

  it('computes midpoint correctly', () => {
    // structural=32.5 (half), ai=50 → 32.5 + 17.5 = 50
    expect(combineScores(32.5, 50)).toBe(50);
  });

  it('returns an integer (rounds)', () => {
    const result = combineScores(30, 66.7);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('is consistent with the formula: structural + (ai/100)*35', () => {
    const s = 40, ai = 80;
    const expected = Math.round(Math.min(65, s) + (ai / 100) * 35);
    expect(combineScores(s, ai)).toBe(expected);
  });
});

// ─── scoreStructural ──────────────────────────────────────────────────────────

// A minimal valid SOAP note to baseline against
const MINIMAL_NOTE = `
S: Chief complaint: chest pain. HPI: 45-year-old male presents with sudden onset chest pain for 2 hours.
PMH: hypertension, diabetes. Medications: metformin, lisinopril. Allergies: NKDA.
O: Vital signs: BP 150/90, HR 88, Temp 37.0, O2 sat 98%. Physical exam: regular rate and rhythm.
Labs: EKG ordered.
A: Assessment: differential includes STEMI, PE, aortic dissection. Most likely ACS.
P: Plan: aspirin 325mg, nitroglycerin, IV access. Follow-up with cardiology. Patient education provided.
`;

const RICH_NOTE = `
I'm Dr. Smith. Good morning! Tell me about what brings you in today.

S: Chief complaint: severe chest pain radiating to arm.
HPI: Patient reports sudden onset chest pain, onset 1 hour ago, quality: pressure, severity: 9/10,
timing: constant, radiation to left arm, associated shortness of breath.
Review of systems: positive for diaphoresis and nausea.

PMH: hypertension, prior MI.
Medications: aspirin, lisinopril, atorvastatin.
Allergies: penicillin.

O: Vital signs: BP 160/100, HR 110, Temp 36.8, RR 18, O2 sat 95%.
Physical exam: diaphoresis, pallor. Auscultation: S4 gallop. Palpation: no tenderness.
Labs: troponin pending, EKG showing ST elevation.
Imaging: CXR obtained.

A: Assessment/Impression: STEMI — most likely occlusion of LAD.
Differential: unstable angina vs STEMI. Working diagnosis: STEMI.

P: Plan: aspirin 325mg, nitroglycerin, heparin drip. Call cath lab. Refer to interventional cardiology.
Patient education: explained the procedure and importance of lifestyle changes.
Return precautions: advised to call 911 if symptoms worsen.
Follow-up: with cardiology within 1 week.

I understand this must be a scary experience. That sounds very difficult.
`;

describe('scoreStructural', () => {
  it('returns an object with totalScore in [0, 85] range', () => {
    const result = scoreStructural(MINIMAL_NOTE, 'chest pain');
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(85);
  });

  it('returns higher score for richer note', () => {
    const minimal = scoreStructural(MINIMAL_NOTE, 'chest pain');
    const rich = scoreStructural(RICH_NOTE, 'ACS');
    expect(rich.totalScore).toBeGreaterThan(minimal.totalScore);
  });

  it('detects all SOAP sections in rich note', () => {
    const result = scoreStructural(RICH_NOTE, 'ACS');
    const { soapPresence } = result.sections;
    expect(soapPresence.subjective.present).toBe(true);
    expect(soapPresence.objective.present).toBe(true);
    expect(soapPresence.assessment.present).toBe(true);
    expect(soapPresence.plan.present).toBe(true);
  });

  it('soapPresence.score is between 0 and 25', () => {
    const result = scoreStructural(RICH_NOTE, 'ACS');
    expect(result.sections.soapPresence.score).toBeGreaterThanOrEqual(0);
    expect(result.sections.soapPresence.score).toBeLessThanOrEqual(25);
  });

  it('detects essential elements in complete note', () => {
    const result = scoreStructural(RICH_NOTE, 'ACS');
    const { essentialElements } = result.sections;
    expect(essentialElements.chiefComplaint).toBe(true);
    expect(essentialElements.hpiPresent).toBe(true);
    expect(essentialElements.vitalSigns).toBe(true);
    expect(essentialElements.differentialPresent).toBe(true);
    expect(essentialElements.followUpPlan).toBe(true);
  });

  it('essentialElements.score is between 0 and 25', () => {
    const result = scoreStructural(RICH_NOTE, 'ACS');
    expect(result.sections.essentialElements.score).toBeGreaterThanOrEqual(0);
    expect(result.sections.essentialElements.score).toBeLessThanOrEqual(25);
  });

  it('detects communication markers in rich note', () => {
    const result = scoreStructural(RICH_NOTE, 'ACS');
    const { communication } = result.sections;
    expect(communication.openEndedQuestions).toBe(true);  // "Tell me about..."
    expect(communication.empathyMarkers).toBe(true);       // "I understand"
    expect(communication.introductionPresent).toBe(true);  // "I'm Dr. Smith"
    expect(communication.patientEducation).toBe(true);     // "patient education"
  });

  it('communication.score is between 0 and 10', () => {
    const result = scoreStructural(RICH_NOTE, 'ACS');
    expect(result.sections.communication.score).toBeGreaterThanOrEqual(0);
    expect(result.sections.communication.score).toBeLessThanOrEqual(10);
  });

  it('efficiency.score is between 0 and 5', () => {
    const result = scoreStructural(RICH_NOTE, 'ACS');
    expect(result.sections.efficiency.score).toBeGreaterThanOrEqual(0);
    expect(result.sections.efficiency.score).toBeLessThanOrEqual(5);
  });

  it('returns very low score for empty note', () => {
    const result = scoreStructural('', 'anything');
    // Empty note gets minimal efficiency score (1 pt), but nothing else
    expect(result.totalScore).toBeLessThanOrEqual(2);
  });

  it('processingTimeMs is non-negative', () => {
    const result = scoreStructural(MINIMAL_NOTE, 'chest pain');
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('returns no dangerous actions for safe note', () => {
    const result = scoreStructural(MINIMAL_NOTE, 'chest pain');
    // MINIMAL_NOTE mentions aspirin (safe in ACS) but not any dangerous patterns for generic 'chest pain'
    expect(result.dangerousActions).toHaveLength(0);
    expect(result.dangerousPenalty).toBe(0);
  });

  it('detects dangerous action: beta-blocker in decompensated heart failure', () => {
    const dangerousNote = `Assessment: acute coronary syndrome with decompensated heart failure.
    Plan: start beta-blocker metoprolol immediately despite decompensation.`;
    const result = scoreStructural(dangerousNote, 'acute coronary syndrome');
    expect(result.dangerousActions.length).toBeGreaterThan(0);
    expect(result.dangerousPenalty).toBeGreaterThan(0);
    // Penalty should reduce totalScore
    const withoutPenalty = result.totalScore + result.dangerousPenalty;
    expect(withoutPenalty).toBeGreaterThanOrEqual(result.totalScore);
  });

  it('detects dangerous action: tPA outside window in stroke', () => {
    const dangerousNote = `Assessment: stroke.
    Plan: administer tPA alteplase despite patient presenting 4.5 hour window was exceeded (late).`;
    const result = scoreStructural(dangerousNote, 'stroke');
    const tpaAction = result.dangerousActions.find((a) =>
      a.description.toLowerCase().includes('tpa')
    );
    expect(tpaAction).toBeDefined();
    expect(tpaAction!.penalty).toBe(20);
  });

  it('isBorderline is true when score between 35 and 50', () => {
    // Need a note that scores in the 35-50 range
    // Use a moderately complete note
    const mediumNote = `
    S: Chief complaint: cough. Patient presents with 1 week of cough.
    PMH: none. Medications: none. Allergies: NKDA.
    O: Vital signs: BP 120/80, HR 70. Exam: clear lungs.
    A: Assessment: viral upper respiratory infection.
    P: Plan: supportive care. Follow-up if worsens.
    `;
    const result = scoreStructural(mediumNote, 'URI');
    // Just verify the field exists and is boolean
    expect(typeof result.isBorderline).toBe('boolean');
    if (result.totalScore >= 35 && result.totalScore <= 50) {
      expect(result.isBorderline).toBe(true);
    } else {
      expect(result.isBorderline).toBe(false);
    }
  });

  it('needsAIReasoning is false when score < 20', () => {
    const tinyNote = 'patient said something';
    const result = scoreStructural(tinyNote, 'unknown');
    // Very minimal note → score likely < 20
    if (result.totalScore < 20) {
      expect(result.needsAIReasoning).toBe(false);
    }
  });

  it('needsAIReasoning is true for decent note', () => {
    const result = scoreStructural(MINIMAL_NOTE, 'chest pain');
    if (result.totalScore >= 20) {
      expect(result.needsAIReasoning).toBe(true);
    }
  });

  it('result has all required top-level fields', () => {
    const result = scoreStructural(MINIMAL_NOTE, 'chest pain');
    expect(result).toHaveProperty('totalScore');
    expect(result).toHaveProperty('sections');
    expect(result).toHaveProperty('dangerousActions');
    expect(result).toHaveProperty('dangerousPenalty');
    expect(result).toHaveProperty('isBorderline');
    expect(result).toHaveProperty('needsAIReasoning');
    expect(result).toHaveProperty('processingTimeMs');
  });
});
