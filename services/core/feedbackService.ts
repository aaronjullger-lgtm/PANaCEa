/**
 * Unified Feedback Service
 *
 * Provides sensory feedback (haptic + audio) for enhanced user engagement.
 * Consolidates hapticService.ts and adds audio feedback support.
 *
 * Usage:
 *   import { feedback } from '@/services/core';
 *   feedback.correct(); // Triggers haptic + optional sound
 */

import { triggerHapticFeedback, type HapticFeedbackType } from '@/lib/hapticFeedback';

export type FeedbackEvent =
  | 'correct'
  | 'incorrect'
  | 'streak'
  | 'milestone'
  | 'selection'
  | 'warning'
  | 'celebration';

interface FeedbackConfig {
  hapticEnabled: boolean;
  soundEnabled: boolean;
  soundVolume: number; // 0-1
}

const STORAGE_KEY = 'panceai_feedback_config';

// Load config from localStorage
function loadConfig(): FeedbackConfig {
  if (typeof window === 'undefined') {
    return { hapticEnabled: true, soundEnabled: false, soundVolume: 0.5 };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...getDefaultConfig(), ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors
  }

  return getDefaultConfig();
}

function getDefaultConfig(): FeedbackConfig {
  return {
    hapticEnabled: true,
    soundEnabled: false, // Off by default - opt-in for sounds
    soundVolume: 0.5,
  };
}

// Map feedback events to haptic patterns
const HAPTIC_MAP: Record<FeedbackEvent, HapticFeedbackType> = {
  correct: 'success',
  incorrect: 'error',
  streak: 'success',
  milestone: 'success',
  selection: 'selection',
  warning: 'warning',
  celebration: 'success',
};

// Audio context for web audio API (lazy loaded)
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!audioContext) {
    try {
      audioContext = new (
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      )();
    } catch {
      console.warn('Web Audio API not supported');
      return null;
    }
  }

  return audioContext;
}

// Generate simple tones for feedback (no external audio files needed)
function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume: number = 0.3
) {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Resume audio context if suspended (required after user interaction)
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

  // Envelope for smoother sound
  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration);
}

// Sound patterns for different events
const SOUND_PATTERNS: Record<FeedbackEvent, () => void> = {
  correct: () => {
    // Rising major chord (C-E-G)
    playTone(523.25, 0.1, 'sine', 0.2); // C5
    setTimeout(() => playTone(659.25, 0.1, 'sine', 0.2), 50); // E5
    setTimeout(() => playTone(783.99, 0.15, 'sine', 0.25), 100); // G5
  },
  incorrect: () => {
    // Descending minor second
    playTone(330, 0.15, 'triangle', 0.2); // E4
    setTimeout(() => playTone(311, 0.2, 'triangle', 0.15), 100); // Eb4
  },
  streak: () => {
    // Ascending arpeggio
    playTone(523.25, 0.08, 'sine', 0.15);
    setTimeout(() => playTone(659.25, 0.08, 'sine', 0.15), 60);
    setTimeout(() => playTone(783.99, 0.08, 'sine', 0.15), 120);
    setTimeout(() => playTone(1046.5, 0.15, 'sine', 0.2), 180);
  },
  milestone: () => {
    // Triumphant fanfare
    playTone(523.25, 0.1, 'sine', 0.2);
    setTimeout(() => playTone(659.25, 0.1, 'sine', 0.2), 80);
    setTimeout(() => playTone(783.99, 0.1, 'sine', 0.2), 160);
    setTimeout(() => playTone(1046.5, 0.3, 'sine', 0.3), 240);
  },
  selection: () => {
    playTone(880, 0.05, 'sine', 0.1); // Subtle click
  },
  warning: () => {
    playTone(440, 0.1, 'triangle', 0.15);
    setTimeout(() => playTone(440, 0.1, 'triangle', 0.15), 150);
  },
  celebration: () => {
    // Celebratory cascade
    const notes = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.1, 'sine', 0.15), i * 50);
    });
  },
};

// Singleton feedback service
class FeedbackService {
  private config: FeedbackConfig;

  constructor() {
    this.config = loadConfig();
  }

  /** Update feedback configuration */
  setConfig(updates: Partial<FeedbackConfig>) {
    this.config = { ...this.config, ...updates };
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    }
  }

  /** Get current configuration */
  getConfig(): FeedbackConfig {
    return { ...this.config };
  }

  /** Trigger feedback for an event */
  trigger(event: FeedbackEvent) {
    // Haptic feedback
    if (this.config.hapticEnabled) {
      const hapticType = HAPTIC_MAP[event];
      triggerHapticFeedback(hapticType);
    }

    // Sound feedback
    if (this.config.soundEnabled) {
      const soundFn = SOUND_PATTERNS[event];
      if (soundFn) {
        soundFn();
      }
    }
  }

  // Convenience methods
  correct() {
    this.trigger('correct');
  }
  incorrect() {
    this.trigger('incorrect');
  }
  streak() {
    this.trigger('streak');
  }
  milestone() {
    this.trigger('milestone');
  }
  selection() {
    this.trigger('selection');
  }
  warning() {
    this.trigger('warning');
  }
  celebration() {
    this.trigger('celebration');
  }
}

// Export singleton instance
export const feedback = new FeedbackService();

// Export types and config helpers
export type { FeedbackConfig };
export { loadConfig, getDefaultConfig };
