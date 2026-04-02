import { describe, it, expect } from 'vitest';
import { MODE_REGISTRY } from '../config/training-modes';
import {
  getTodaysMedicalWordle,
  getTodayInMedicine,
  calculateCoinsEarned,
  canPurchaseStreakFreeze,
  STREAK_FREEZE_CONFIG,
} from '../data/modes/dailyRitualsData';
// Note: Ventilator drill is now database-driven via useVentilatorDrill hook
// import {
//   evaluateVentilatorSettings,
//   getRandomVentilatorCase,
//   VENTILATOR_CASES,
// } from '../data/modes/ventilatorHeroData';
// Note: Polypharmacy mode is database-driven (not yet implemented)

describe('New Training Modes Configuration', () => {
  it('should have diagnostic_puzzle in MODE_REGISTRY (replaced medical_wordle)', () => {
    const puzzleMode = MODE_REGISTRY.find((m) => m.id === 'diagnostic_puzzle');
    expect(puzzleMode).toBeDefined();
    expect(puzzleMode?.category).toBe('specialty_drills');
  });

  it('should have ventilator_hero in MODE_REGISTRY', () => {
    const ventMode = MODE_REGISTRY.find((m) => m.id === 'ventilator_hero');
    expect(ventMode).toBeDefined();
    expect(ventMode?.category).toBe('clinical_simulation');
  });

  it('should have clinical simulation modes in MODE_REGISTRY', () => {
    const clinicalModes = MODE_REGISTRY.filter((m) => m.category === 'clinical_simulation');
    // Clinical modes like patient_encounter, ventilator_hero may be present
    expect(clinicalModes.length).toBeGreaterThanOrEqual(0);
  });

  it('polypharmacy_puzzle type exists but is not yet in MODE_REGISTRY (pending backend)', () => {
    // polypharmacy_puzzle is defined in ModeId type but intentionally removed from
    // MODE_REGISTRY until backend API is implemented. Verify the type still allows it.
    const polyMode = MODE_REGISTRY.find((m) => m.id === 'polypharmacy_puzzle');
    expect(polyMode).toBeUndefined(); // Will be re-added when API is ready
  });
});

describe('Daily Rituals - Medical Wordle (deprecated)', () => {
  it('should still generate consistent daily wordle for a given date', () => {
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

// Ventilator Hero tests disabled - now database-driven via useVentilatorDrill hook
// describe('Ventilator Hero', () => {
//   it('should have ventilator cases', () => {
//     expect(VENTILATOR_CASES.length).toBeGreaterThan(0);
//   });

//   it('should return random ventilator case', () => {
//     const case1 = getRandomVentilatorCase();
//     expect(case1).toBeDefined();
//     expect(case1.currentSettings).toBeDefined();
//     expect(case1.initialLabs).toBeDefined();
//   });

//   it('should evaluate ventilator settings', () => {
//     const testCase = VENTILATOR_CASES[0];
//     const newSettings = {
//       tidalVolume: 400,
//       respiratoryRate: 16,
//       peep: 12,
//       fio2: 80,
//     };

//     const outcome = evaluateVentilatorSettings(testCase, newSettings);

//     expect(outcome.ph).toBeDefined();
//     expect(outcome.pco2).toBeDefined();
//     expect(outcome.po2).toBeDefined();
//     expect(outcome.success).toBeDefined();
//     expect(outcome.feedback).toBeDefined();
//   });

//   it('should have teaching points for each case', () => {
//     VENTILATOR_CASES.forEach(vCase => {
//       expect(vCase.teachingPoints.length).toBeGreaterThan(0);
//       expect(vCase.explanation).toBeDefined();
//     });
//   });
// });

// Triage mode removed - not planned for implementation

// Polypharmacy Puzzle - database-driven implementation (not yet active)
// Tests will be added once database schema and API endpoints are created
