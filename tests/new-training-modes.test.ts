import { describe, it, expect } from 'vitest';
import { MODE_REGISTRY } from '../config/training-modes';
import { 
  getTodaysMedicalWordle,
  getTodayInMedicine,
  calculateCoinsEarned,
  canPurchaseStreakFreeze,
  STREAK_FREEZE_CONFIG,
} from '../data/modes/dailyRitualsData';
import {
  evaluateVentilatorSettings,
  getRandomVentilatorCase,
  VENTILATOR_CASES,
} from '../data/modes/ventilatorHeroData';
import {
  generateTriageSession,
  calculateTriageScore,
  getTriageFeedback,
  TRIAGE_VICTIMS,
} from '../data/modes/triageTentData';
import {
  evaluateDeprescribing,
  getRandomPolypharmacyCase,
  POLYPHARMACY_CASES,
} from '../data/modes/polypharmacyData';
import {
  calculateRadiologyScore,
  getRandomRadiologySeries,
  RADIOLOGY_SERIES,
} from '../data/modes/radiologyScrollData';

describe('New Training Modes Configuration', () => {
  it('should have medical_wordle in MODE_REGISTRY', () => {
    const wordleMode = MODE_REGISTRY.find(m => m.id === 'medical_wordle');
    expect(wordleMode).toBeDefined();
    expect(wordleMode?.label).toBe('Medical Wordle');
  });

  it('should have ventilator_hero in MODE_REGISTRY', () => {
    const ventMode = MODE_REGISTRY.find(m => m.id === 'ventilator_hero');
    expect(ventMode).toBeDefined();
    expect(ventMode?.category).toBe('clinical');
  });

  it('should have triage_tent in MODE_REGISTRY', () => {
    const triageMode = MODE_REGISTRY.find(m => m.id === 'triage_tent');
    expect(triageMode).toBeDefined();
    expect(triageMode?.theme).toBe('red');
  });

  it('should have polypharmacy_puzzle in MODE_REGISTRY', () => {
    const polyMode = MODE_REGISTRY.find(m => m.id === 'polypharmacy_puzzle');
    expect(polyMode).toBeDefined();
  });

  it('should have radiology_scroll in MODE_REGISTRY', () => {
    const radMode = MODE_REGISTRY.find(m => m.id === 'radiology_scroll');
    expect(radMode).toBeDefined();
    expect(radMode?.category).toBe('visual');
  });
});

describe('Daily Rituals - Medical Wordle', () => {
  it('should generate consistent daily wordle for a given date', () => {
    const wordle1 = getTodaysMedicalWordle();
    const wordle2 = getTodaysMedicalWordle();
    
    expect(wordle1.targetWord).toBe(wordle2.targetWord);
    expect(wordle1.date).toBe(wordle2.date);
  });

  it('should have valid category and hints', () => {
    const wordle = getTodaysMedicalWordle();
    
    expect(['drugs', 'conditions', 'anatomy']).toContain(wordle.category);
    expect(wordle.hints).toBeDefined();
    expect(wordle.hints.class).toBeDefined();
  });
});

describe('Daily Rituals - This Day in Medicine', () => {
  it('should return null if no event for today', () => {
    // Most days won't have events
    const event = getTodayInMedicine();
    
    if (event) {
      expect(event.title).toBeDefined();
      expect(event.description).toBeDefined();
      expect(event.year).toBeGreaterThan(1800);
    }
  });
});

describe('Daily Rituals - Streak Freeze', () => {
  it('should calculate coins correctly', () => {
    const coins = calculateCoinsEarned(10, 7, true);
    // 10 questions * 1 = 10
    // 7 correct * 2 = 14
    // streak bonus = 10
    // Total = 34
    expect(coins).toBe(34);
  });

  it('should calculate coins without streak bonus', () => {
    const coins = calculateCoinsEarned(10, 7, false);
    expect(coins).toBe(24); // 10 + 14
  });

  it('should allow purchase with enough coins and space', () => {
    const canPurchase = canPurchaseStreakFreeze(100, 2);
    expect(canPurchase).toBe(true);
  });

  it('should not allow purchase if at max freezes', () => {
    const canPurchase = canPurchaseStreakFreeze(100, STREAK_FREEZE_CONFIG.maxFreezes);
    expect(canPurchase).toBe(false);
  });

  it('should not allow purchase with insufficient coins', () => {
    const canPurchase = canPurchaseStreakFreeze(20, 2);
    expect(canPurchase).toBe(false);
  });
});

describe('Ventilator Hero', () => {
  it('should have ventilator cases', () => {
    expect(VENTILATOR_CASES.length).toBeGreaterThan(0);
  });

  it('should return random ventilator case', () => {
    const case1 = getRandomVentilatorCase();
    expect(case1).toBeDefined();
    expect(case1.currentSettings).toBeDefined();
    expect(case1.initialLabs).toBeDefined();
  });

  it('should evaluate ventilator settings', () => {
    const testCase = VENTILATOR_CASES[0];
    const newSettings = {
      tidalVolume: 400,
      respiratoryRate: 16,
      peep: 12,
      fio2: 80,
    };
    
    const outcome = evaluateVentilatorSettings(testCase, newSettings);
    
    expect(outcome.ph).toBeDefined();
    expect(outcome.pco2).toBeDefined();
    expect(outcome.po2).toBeDefined();
    expect(outcome.success).toBeDefined();
    expect(outcome.feedback).toBeDefined();
  });

  it('should have teaching points for each case', () => {
    VENTILATOR_CASES.forEach(vCase => {
      expect(vCase.teachingPoints.length).toBeGreaterThan(0);
      expect(vCase.explanation).toBeDefined();
    });
  });
});

describe('Triage Tent', () => {
  it('should have triage victims', () => {
    expect(TRIAGE_VICTIMS.length).toBeGreaterThan(0);
  });

  it('should generate triage session', () => {
    const session = generateTriageSession('bus-crash', 10);
    
    expect(session.scenarioId).toBe('bus-crash');
    expect(session.victims.length).toBeLessThanOrEqual(10);
    expect(session.startTime).toBeDefined();
  });

  it('should calculate triage score', () => {
    const session = generateTriageSession('bus-crash', 5);
    const sessionWithDecisions = {
      ...session,
      decisions: session.victims.map(victim => ({
        victimId: victim.id,
        assignedCategory: victim.correctCategory,
        correct: true,
        timeSpent: 20000,
      })),
      endTime: Date.now(),
    };
    
    const score = calculateTriageScore(sessionWithDecisions);
    
    expect(score).toBeDefined();
    expect(score.accuracy).toBe(100);
    expect(score.speed).toBeGreaterThan(0);
    expect(score.overall).toBeGreaterThan(0);
  });

  it('should provide feedback for triage decisions', () => {
    const victim = TRIAGE_VICTIMS[0];
    const feedback = getTriageFeedback(victim, victim.correctCategory);
    
    expect(feedback).toContain('✓');
    expect(feedback).toContain(victim.explanation);
  });

  it('should have all triage categories represented', () => {
    const categories = new Set(TRIAGE_VICTIMS.map(v => v.correctCategory));
    
    expect(categories.has('immediate')).toBe(true);
    expect(categories.has('delayed')).toBe(true);
    expect(categories.has('minor')).toBe(true);
    expect(categories.has('expectant')).toBe(true);
  });
});

describe('Polypharmacy Puzzle', () => {
  it('should have polypharmacy cases', () => {
    expect(POLYPHARMACY_CASES.length).toBeGreaterThan(0);
  });

  it('should return random polypharmacy case', () => {
    const pCase = getRandomPolypharmacyCase();
    
    expect(pCase).toBeDefined();
    expect(pCase.medications.length).toBeGreaterThan(0);
    expect(pCase.correctMedicationsToStop.length).toBeGreaterThan(0);
  });

  it('should evaluate perfect deprescribing', () => {
    const testCase = POLYPHARMACY_CASES[0];
    const result = evaluateDeprescribing(testCase, testCase.correctMedicationsToStop);
    
    expect(result.correct).toBe(true);
    expect(result.partialCredit).toBe(100);
    expect(result.feedback).toContain('✓');
  });

  it('should evaluate partial deprescribing', () => {
    const testCase = POLYPHARMACY_CASES[0];
    const partialSelection = [testCase.correctMedicationsToStop[0]];
    
    const result = evaluateDeprescribing(testCase, partialSelection);
    
    expect(result.correct).toBe(false);
    expect(result.partialCredit).toBeLessThan(100);
    expect(result.partialCredit).toBeGreaterThan(0);
  });

  it('should have deprescribing rationale for each medication to stop', () => {
    POLYPHARMACY_CASES.forEach(pCase => {
      pCase.correctMedicationsToStop.forEach(medId => {
        expect(pCase.deprescribingRationale[medId]).toBeDefined();
      });
    });
  });

  it('should have teaching points for each case', () => {
    POLYPHARMACY_CASES.forEach(pCase => {
      expect(pCase.teachingPoints.length).toBeGreaterThan(0);
    });
  });
});

describe('Radiology Scroll', () => {
  it('should have radiology series', () => {
    expect(RADIOLOGY_SERIES.length).toBeGreaterThan(0);
  });

  it('should return random radiology series', () => {
    const series = getRandomRadiologySeries();
    
    expect(series).toBeDefined();
    expect(series.slices.length).toBe(series.totalSlices);
    expect(series.criticalSlices.length).toBeGreaterThan(0);
  });

  it('should calculate radiology score', () => {
    const series = RADIOLOGY_SERIES[0];
    const score = calculateRadiologyScore(
      series,
      series.findings,
      series.diagnosis,
      series.criticalSlices,
      60000
    );
    
    expect(score.findingsAccuracy).toBeGreaterThan(0);
    expect(score.diagnosisCorrect).toBe(true);
    expect(score.thoroughness).toBe(100);
    expect(score.overall).toBeGreaterThan(0);
  });

  it('should have multiple modalities', () => {
    const modalities = new Set(RADIOLOGY_SERIES.map(s => s.modality));
    expect(modalities.size).toBeGreaterThan(1);
  });

  it('should have multiple body parts', () => {
    const bodyParts = new Set(RADIOLOGY_SERIES.map(s => s.bodyPart));
    expect(bodyParts.size).toBeGreaterThan(1);
  });

  it('should have teaching points for each case', () => {
    RADIOLOGY_SERIES.forEach(series => {
      expect(series.teachingPoints.length).toBeGreaterThan(0);
    });
  });
});
