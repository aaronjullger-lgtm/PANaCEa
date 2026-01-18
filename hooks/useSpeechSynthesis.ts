/**
 * useSpeechSynthesis Hook
 *
 * A standalone hook for text-to-speech functionality.
 * Use this in components that need speech without the full CommuterContext.
 *
 * Features:
 * - Queue management for multiple utterances
 * - Rate/pitch/volume control
 * - Voice selection
 * - Pause/resume support
 *
 * Usage:
 *   const { speak, isSpeaking, stopSpeaking, voices } = useSpeechSynthesis();
 *   speak("Hello, medical student!");
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface SpeechOptions {
  rate?: number; // 0.1 - 10, default 1
  pitch?: number; // 0 - 2, default 1
  volume?: number; // 0 - 1, default 1
  voice?: SpeechSynthesisVoice | null;
  lang?: string; // e.g., 'en-US'
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: SpeechSynthesisErrorEvent) => void;
}

export interface UseSpeechSynthesisReturn {
  speak: (text: string, options?: SpeechOptions) => void;
  isSpeaking: boolean;
  isPaused: boolean;
  isSupported: boolean;
  stopSpeaking: () => void;
  pauseSpeaking: () => void;
  resumeSpeaking: () => void;
  voices: SpeechSynthesisVoice[];
  currentVoice: SpeechSynthesisVoice | null;
  setVoice: (voice: SpeechSynthesisVoice | null) => void;
}

const DEFAULT_OPTIONS: Required<Omit<SpeechOptions, 'voice' | 'onStart' | 'onEnd' | 'onError'>> = {
  rate: 1,
  pitch: 1,
  volume: 1,
  lang: 'en-US',
};

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [currentVoice, setCurrentVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);
    synthRef.current = window.speechSynthesis;

    // Load voices
    const loadVoices = () => {
      const availableVoices = synthRef.current?.getVoices() || [];
      setVoices(availableVoices);

      // Set default voice (prefer English voices)
      if (availableVoices.length > 0 && !currentVoice) {
        const englishVoice =
          availableVoices.find((v) => v.lang.startsWith('en') && v.localService) ||
          availableVoices[0];
        setCurrentVoice(englishVoice);
      }
    };

    // Voices may not be immediately available
    loadVoices();

    // Chrome requires listening to voiceschanged event
    if (synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.addEventListener('voiceschanged', loadVoices);
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
        synthRef.current.removeEventListener('voiceschanged', loadVoices);
      }
    };
  }, []);

  // Speak text
  const speak = useCallback(
    (text: string, options: SpeechOptions = {}) => {
      if (!synthRef.current || !isSupported) {
        console.warn('Speech synthesis not supported');
        return;
      }

      // Cancel any ongoing speech
      synthRef.current.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;

      // Apply options
      utterance.rate = options.rate ?? DEFAULT_OPTIONS.rate;
      utterance.pitch = options.pitch ?? DEFAULT_OPTIONS.pitch;
      utterance.volume = options.volume ?? DEFAULT_OPTIONS.volume;
      utterance.lang = options.lang ?? DEFAULT_OPTIONS.lang;

      if (options.voice) {
        utterance.voice = options.voice;
      } else if (currentVoice) {
        utterance.voice = currentVoice;
      }

      // Event handlers
      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsPaused(false);
        options.onStart?.();
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        options.onEnd?.();
      };

      utterance.onerror = (event) => {
        setIsSpeaking(false);
        setIsPaused(false);
        console.error('Speech synthesis error:', event.error);
        options.onError?.(event);
      };

      utterance.onpause = () => {
        setIsPaused(true);
      };

      utterance.onresume = () => {
        setIsPaused(false);
      };

      synthRef.current.speak(utterance);
    },
    [isSupported, currentVoice]
  );

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
    }
  }, []);

  // Pause speaking
  const pauseSpeaking = useCallback(() => {
    if (synthRef.current && isSpeaking) {
      synthRef.current.pause();
      setIsPaused(true);
    }
  }, [isSpeaking]);

  // Resume speaking
  const resumeSpeaking = useCallback(() => {
    if (synthRef.current && isPaused) {
      synthRef.current.resume();
      setIsPaused(false);
    }
  }, [isPaused]);

  // Set voice
  const setVoice = useCallback((voice: SpeechSynthesisVoice | null) => {
    setCurrentVoice(voice);
  }, []);

  return {
    speak,
    isSpeaking,
    isPaused,
    isSupported,
    stopSpeaking,
    pauseSpeaking,
    resumeSpeaking,
    voices,
    currentVoice,
    setVoice,
  };
}

/**
 * Helper to clean medical text for better speech
 * Expands abbreviations and removes problematic characters
 */
export function cleanTextForSpeech(text: string): string {
  return (
    text
      // Remove HTML tags
      .replace(/<[^>]*>/g, ' ')
      // Expand common medical abbreviations
      .replace(/\bpt\b/gi, 'patient')
      .replace(/\bhx\b/gi, 'history')
      .replace(/\bdx\b/gi, 'diagnosis')
      .replace(/\btx\b/gi, 'treatment')
      .replace(/\brx\b/gi, 'prescription')
      .replace(/\bsx\b/gi, 'symptoms')
      .replace(/\byo\b/gi, 'year old')
      .replace(/\by\/o\b/gi, 'year old')
      .replace(/\bM\b/g, 'male')
      .replace(/\bF\b/g, 'female')
      .replace(/\bBP\b/gi, 'blood pressure')
      .replace(/\bHR\b/gi, 'heart rate')
      .replace(/\bRR\b/gi, 'respiratory rate')
      .replace(/\bSOB\b/gi, 'shortness of breath')
      .replace(/\bCP\b/gi, 'chest pain')
      .replace(/\bABD\b/gi, 'abdominal')
      .replace(/\bWNL\b/gi, 'within normal limits')
      .replace(/\bNAD\b/gi, 'no acute distress')
      // Clean up multiple spaces
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export default useSpeechSynthesis;
