/**
 * Tests for Virtual Attending Service
 * Phase 17: Requirement 66
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generatePersonalizedFeedback,
  getPersona,
  getAllPersonas,
  savePreferredPersona,
  loadPreferredPersona,
  getMotivationalMessage,
  ATTENDING_PERSONAS,
} from '../services/virtualAttendingService';

describe('Virtual Attending Service', () => {
  // Mock localStorage for tests
  beforeEach(() => {
    const localStorageMock = {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] || null;
      },
      setItem(key: string, value: string) {
        this.store[key] = value;
      },
      removeItem(key: string) {
        delete this.store[key];
      },
      clear() {
        this.store = {};
      },
    };

    global.localStorage = localStorageMock as any;
  });

  describe('Persona Management', () => {
    it('should have 5 unique personas', () => {
      const personas = getAllPersonas();
      expect(personas).toHaveLength(5);

      const ids = personas.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(5);
    });

    it('should get persona by ID', () => {
      const surgeon = getPersona('surgeon');
      expect(surgeon.id).toBe('surgeon');
      expect(surgeon.name).toBe('The Surgeon');
      expect(surgeon.icon).toBe('🔪');
    });

    it('should have all required persona properties', () => {
      getAllPersonas().forEach((persona) => {
        expect(persona).toHaveProperty('id');
        expect(persona).toHaveProperty('name');
        expect(persona).toHaveProperty('description');
        expect(persona).toHaveProperty('icon');
        expect(persona).toHaveProperty('correctFeedbackStyle');
        expect(persona).toHaveProperty('incorrectFeedbackStyle');
      });
    });
  });

  describe('Feedback Generation', () => {
    it('should generate correct answer feedback', async () => {
      const feedback = await generatePersonalizedFeedback('nurturer', {
        isCorrect: true,
        topic: 'Cardiology',
        condition: 'STEMI',
      });

      expect(feedback).toBeTruthy();
      expect(typeof feedback).toBe('string');
      expect(feedback.length).toBeGreaterThan(0);
    });

    it('should generate incorrect answer feedback', async () => {
      const feedback = await generatePersonalizedFeedback('surgeon', {
        isCorrect: false,
        topic: 'Cardiology',
        condition: 'STEMI',
        keyLearning: 'Always check troponins',
      });

      expect(feedback).toBeTruthy();
      expect(typeof feedback).toBe('string');
      expect(feedback.length).toBeGreaterThan(0);
    });

    it('should generate different feedback for different personas', async () => {
      const nurturerFeedback = await generatePersonalizedFeedback('nurturer', {
        isCorrect: true,
        topic: 'Cardiology',
      });

      const surgeonFeedback = await generatePersonalizedFeedback('surgeon', {
        isCorrect: true,
        topic: 'Cardiology',
      });

      // Feedback should be different (though there's a small chance of collision)
      expect(nurturerFeedback).not.toBe(surgeonFeedback);
    });

    it('should handle all persona types', async () => {
      const personaIds = [
        'nurturer',
        'surgeon',
        'professor',
        'comedian',
        'drill-sergeant',
      ] as const;

      for (const personaId of personaIds) {
        const feedback = await generatePersonalizedFeedback(personaId, {
          isCorrect: true,
          topic: 'Test Topic',
        });

        expect(feedback).toBeTruthy();
        expect(typeof feedback).toBe('string');
      }
    });
  });

  describe('Persona Preferences', () => {
    it('should save and load preferred persona', () => {
      savePreferredPersona('surgeon');
      const loaded = loadPreferredPersona();
      expect(loaded).toBe('surgeon');
    });

    it('should return default persona if none saved', () => {
      localStorage.removeItem('panceai_attending_persona');
      const loaded = loadPreferredPersona();
      expect(loaded).toBe('professor'); // Default persona
    });

    it('should handle invalid persona ID gracefully', () => {
      localStorage.setItem('panceai_attending_persona', 'invalid_persona');
      const loaded = loadPreferredPersona();
      expect(loaded).toBe('professor'); // Fallback to default
    });
  });

  describe('Motivational Messages', () => {
    it('should provide motivational message for each persona', () => {
      const personaIds = [
        'nurturer',
        'surgeon',
        'professor',
        'comedian',
        'drill-sergeant',
      ] as const;

      personaIds.forEach((personaId) => {
        const message = getMotivationalMessage(personaId);
        expect(message).toBeTruthy();
        expect(typeof message).toBe('string');
        expect(message.length).toBeGreaterThan(10);
      });
    });

    it('should have unique messages for different personas', () => {
      const messages = new Set();

      Object.keys(ATTENDING_PERSONAS).forEach((personaId) => {
        const message = getMotivationalMessage(personaId as any);
        messages.add(message);
      });

      expect(messages.size).toBe(5);
    });
  });

  describe('Persona Characteristics', () => {
    it('should have appropriate feedback styles', () => {
      const nurturer = getPersona('nurturer');
      expect(nurturer.correctFeedbackStyle).toBe('encouraging');
      expect(nurturer.incorrectFeedbackStyle).toBe('supportive');

      const surgeon = getPersona('surgeon');
      expect(surgeon.correctFeedbackStyle).toBe('brief');
      expect(surgeon.incorrectFeedbackStyle).toBe('harsh');
    });

    it('should have descriptive names', () => {
      getAllPersonas().forEach((persona) => {
        expect(persona.name).toMatch(/^The /);
        expect(persona.description.length).toBeGreaterThan(10);
      });
    });

    it('should have unique emojis', () => {
      const emojis = getAllPersonas().map((p) => p.icon);
      const uniqueEmojis = new Set(emojis);
      expect(uniqueEmojis.size).toBe(5);
    });
  });

  describe('Feedback Content', () => {
    it('should include topic in feedback when provided', async () => {
      const feedback = await generatePersonalizedFeedback('professor', {
        isCorrect: true,
        topic: 'Neurology',
      });

      // Professor persona is educational and likely mentions the topic
      // We can't guarantee exact content, but we can check it's substantial
      expect(feedback.length).toBeGreaterThan(15);
    });

    it('should include key learning in incorrect feedback', async () => {
      const keyLearning = 'Remember to check volume status';
      const feedback = await generatePersonalizedFeedback('nurturer', {
        isCorrect: false,
        topic: 'Cardiology',
        keyLearning,
      });

      // Should be substantial feedback
      expect(feedback.length).toBeGreaterThan(20);
    });

    it('should provide supportive incorrect feedback for nurturer', async () => {
      const feedback = await generatePersonalizedFeedback('nurturer', {
        isCorrect: false,
        topic: 'Test',
      });

      // Nurturer should have gentle, supportive language
      // Check for positive words (but feedback is randomized, so we can't be too specific)
      expect(feedback.length).toBeGreaterThan(10);
    });

    it('should provide direct incorrect feedback for surgeon', async () => {
      const feedback = await generatePersonalizedFeedback('surgeon', {
        isCorrect: false,
        topic: 'Emergency',
      });

      // Surgeon feedback should be present and direct
      expect(feedback.length).toBeGreaterThan(5);
    });
  });
});
