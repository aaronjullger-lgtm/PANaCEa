import { describe, it, expect, beforeEach } from 'vitest';
import { OSCEScoringEngine } from '@/services/domain/osceScoringEngine';
import type { PatientEncounterCase, ExamFinding } from '@/types/drill-modes';

const mockCase: PatientEncounterCase = {
  id: 'test-case-1',
  patientName: 'John Doe',
  chiefComplaint: 'Chest pain',
  age: 55,
  sex: 'M',
  vitalSigns: {
    bp: '120/80',
    hr: 80,
    rr: 16,
    temp: 98.6,
    o2sat: 98,
  },
  historyData: {
    'history_of_present_illness': 'Gradual onset',
    'past_medical_history': 'Hypertension',
  },
  physicalExamData: {
    'heart': 'Regular rate and rhythm',
    'lungs': 'Clear to auscultation bilaterally',
  },
  labData: {
    'troponin': 'negative',
    'ecg': 'normal sinus rhythm',
  },
  essentialQuestions: ['chest pain', 'shortness of breath'],
  helpfulQuestions: ['radiation', 'nausea'],
  unnecessaryQuestions: ['headache'],
  correctDiagnosis: 'acute coronary syndrome',
  differentialDiagnoses: ['GERD', 'Costochondritis'],
  idealWorkup: ['ECG', 'Troponin'],
  teachingPoints: ['Always rule out ACS'],
};

const mockExamFinding: ExamFinding = {
  region: 'chest',
  maneuverId: 'auscultation_heart',
  maneuverName: 'Cardiac auscultation',
  finding: 'Normal S1, S2',
  isAbnormal: false,
  timestamp: Date.now(),
};

describe('OSCEScoringEngine', () => {
  let engine: OSCEScoringEngine;

  beforeEach(() => {
    engine = new OSCEScoringEngine(mockCase);
  });

  describe('initialization', () => {
    it('should load universal critical actions', () => {
      // Universal actions include verify_patient_id, hand_hygiene, etc.
      const actions = engine['criticalActions'];
      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some(a => a.id === 'verify_patient_id')).toBe(true);
      expect(actions.some(a => a.id === 'hand_hygiene')).toBe(true);
    });

    it('should add condition-specific critical actions', () => {
      // Condition-specific actions for ACS
      const actions = engine['criticalActions'];
      const acsActions = actions.filter(a => a.id.startsWith('acs_'));
      expect(acsActions.length).toBeGreaterThan(0);
      expect(acsActions.some(a => a.id === 'acs_ecg')).toBe(true);
    });
  });

  describe('trackExam', () => {
    it('should record exam in timeline', () => {
      const initialTimelineLength = engine['timeline'].length;
      engine.trackExam(mockExamFinding);
      expect(engine['timeline'].length).toBe(initialTimelineLength + 2);
      const lastEntry = engine['timeline'][engine['timeline'].length - 1];
      expect(lastEntry.action).toContain('Performed');
      expect(lastEntry.phase).toBe('physical');
    });

    it('should trigger critical action for RLQ exam', () => {
      const appendicitisCase: PatientEncounterCase = {
        ...mockCase,
        correctDiagnosis: 'appendicitis',
      };
      const engine = new OSCEScoringEngine(appendicitisCase);
      const rlqFinding: ExamFinding = {
        region: 'abdomen',
        maneuverId: 'palpation_rlq',
        maneuverName: 'RLQ palpation',
        finding: 'Tenderness',
        isAbnormal: true,
        timestamp: Date.now(),
      };
      const event = engine.trackExam(rlqFinding);
      // Should trigger appy_rbq action
      expect(event).not.toBeNull();
      expect(event?.description).toContain('Completed');
    });
  });

  describe('trackQuestion', () => {
    it('should record question in timeline', () => {
      engine.trackQuestion('Do you have any allergies?', 'history');
      const timeline = engine['timeline'];
      expect(timeline.length).toBe(1);
      expect(timeline[0].action).toContain('Asked');
    });

    it('should trigger critical action for allergy question', () => {
      const event = engine.trackQuestion('Any medication allergies?', 'history');
      expect(event).not.toBeNull();
      expect(event?.criticalActionId).toBe('medication_allergies');
    });

    it('should trigger critical action for pain assessment', () => {
      const event = engine.trackQuestion('Where does it hurt?', 'history');
      expect(event).not.toBeNull();
      expect(event?.criticalActionId).toBe('assess_pain');
    });
  });

  describe('calculateCompetencyScores', () => {
    it('should return scores between 0 and 100', () => {
      const scores = engine.calculateCompetencyScores();
      expect(scores.history).toBeGreaterThanOrEqual(0);
      expect(scores.history).toBeLessThanOrEqual(100);
      expect(scores.physicalExam).toBeGreaterThanOrEqual(0);
      expect(scores.physicalExam).toBeLessThanOrEqual(100);
      expect(scores.diagnosticReasoning).toBeGreaterThanOrEqual(0);
      expect(scores.diagnosticReasoning).toBeLessThanOrEqual(100);
      expect(scores.treatment).toBeGreaterThanOrEqual(0);
      expect(scores.treatment).toBeLessThanOrEqual(100);
      expect(scores.communication).toBeGreaterThanOrEqual(0);
      expect(scores.communication).toBeLessThanOrEqual(100);
      expect(scores.efficiency).toBeGreaterThanOrEqual(0);
      expect(scores.efficiency).toBeLessThanOrEqual(100);
    });

    it('should increase history score after questions', () => {
      engine.trackQuestion('What brings you in today?', 'history');
      engine.trackQuestion('Any chest pain?', 'history');
      const scores = engine.calculateCompetencyScores();
      expect(scores.history).toBeGreaterThan(50); // baseline is 50
    });
  });

  describe('generateReport', () => {
    it('should generate a report with overall score', () => {
      const report = engine.generateReport();
      expect(report.overallScore).toBeDefined();
      expect(typeof report.overallScore).toBe('number');
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
      expect(report.competencyScores).toBeDefined();
      expect(report.criticalActions).toBeDefined();
      expect(report.timeline).toBeDefined();
      expect(report.expertComparisons).toBeDefined();
      expect(report.learningGaps).toBeDefined();
      expect(report.strengths).toBeDefined();
      expect(report.areasForImprovement).toBeDefined();
      expect(report.acgmeMilestoneLevel).toBeDefined();
    });

    it('should include correct diagnosis evaluation', () => {
      const report = engine.generateReport('acute coronary syndrome');
      // Since diagnosis matches, strengths should include 'Correct final diagnosis'
      expect(report.strengths).toContain('Correct final diagnosis');
    });

    it('should include missed diagnosis in areas for improvement', () => {
      const report = engine.generateReport('GERD');
      expect(report.areasForImprovement).toContain(
        `Correct diagnosis was: ${mockCase.correctDiagnosis}`
      );
    });
  });

  describe('learning gaps', () => {
    it('should generate gaps for missed critical actions', () => {
      // Simulate missing some actions
      const gaps = engine.generateLearningGaps();
      // Initially no actions triggered, there should be gaps
      expect(gaps.length).toBeGreaterThan(0);
      gaps.forEach(gap => {
        expect(gap.category).toBeDefined();
        expect(gap.topic).toBeDefined();
        expect(gap.severity).toBeDefined();
        expect(gap.recommendation).toBeDefined();
      });
    });
  });
});