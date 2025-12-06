import { describe, it, expect } from 'vitest';
import {
  DEFAULT_OSCE_CONFIG,
  OSCE_DIFFICULTY_DESCRIPTIONS,
  CULTURAL_COMPETENCY_SCENARIOS,
  RESOURCE_LIMITED_SETTINGS,
  applyResourceLimitations,
  getAIDifficultyPrompt,
} from '../config/osce-settings';

describe('OSCE Configuration', () => {
  it('should have default OSCE configuration', () => {
    expect(DEFAULT_OSCE_CONFIG).toBeDefined();
    expect(DEFAULT_OSCE_CONFIG.enableVoiceMode).toBe(false);
    expect(DEFAULT_OSCE_CONFIG.aiDifficultyLevel).toBe('cooperative');
  });

  it('should have difficulty descriptions for all levels', () => {
    expect(OSCE_DIFFICULTY_DESCRIPTIONS.cooperative).toBeDefined();
    expect(OSCE_DIFFICULTY_DESCRIPTIONS.difficult).toBeDefined();
    expect(OSCE_DIFFICULTY_DESCRIPTIONS.very_difficult).toBeDefined();
  });

  it('should have cultural competency scenarios', () => {
    expect(CULTURAL_COMPETENCY_SCENARIOS.length).toBeGreaterThan(0);
    
    CULTURAL_COMPETENCY_SCENARIOS.forEach(scenario => {
      expect(scenario.id).toBeDefined();
      expect(scenario.title).toBeDefined();
      expect(scenario.teachingPoints.length).toBeGreaterThan(0);
    });
  });

  it('should have resource limited settings', () => {
    expect(RESOURCE_LIMITED_SETTINGS.disabledTests).toBeDefined();
    expect(RESOURCE_LIMITED_SETTINGS.availableTests).toBeDefined();
    expect(RESOURCE_LIMITED_SETTINGS.disabledTests).toContain('CT Scan');
    expect(RESOURCE_LIMITED_SETTINGS.disabledTests).toContain('MRI');
  });

  it('should apply resource limitations correctly', () => {
    const allTests = ['X-Ray', 'CT Scan', 'MRI', 'Ultrasound', 'Basic Labs'];
    const limitedTests = applyResourceLimitations(allTests);
    
    expect(limitedTests).toContain('X-Ray');
    expect(limitedTests).toContain('Ultrasound');
    expect(limitedTests).toContain('Basic Labs');
    expect(limitedTests).not.toContain('CT Scan');
    expect(limitedTests).not.toContain('MRI');
  });

  it('should generate AI difficulty prompts', () => {
    const cooperativePrompt = getAIDifficultyPrompt('cooperative');
    const difficultPrompt = getAIDifficultyPrompt('difficult');
    const veryDifficultPrompt = getAIDifficultyPrompt('very_difficult');
    
    expect(cooperativePrompt).toContain('cooperative');
    expect(difficultPrompt).toContain('vague');
    expect(veryDifficultPrompt).toContain('difficult');
  });
});

describe('Cultural Competency Scenarios', () => {
  it('should cover diverse cultural topics', () => {
    const topics = CULTURAL_COMPETENCY_SCENARIOS.map(s => s.id);
    
    expect(topics).toContain('blood_transfusion');
    expect(topics).toContain('organ_donation');
    expect(topics).toContain('end_of_life');
  });

  it('should have teaching points for each scenario', () => {
    CULTURAL_COMPETENCY_SCENARIOS.forEach(scenario => {
      expect(scenario.teachingPoints.length).toBeGreaterThanOrEqual(3);
    });
  });
});
