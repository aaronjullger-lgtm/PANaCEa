/**
 * CommuterContext - Global Accessibility Mode
 *
 * Provides a voice-first interaction layer for hands-free study.
 * When enabled, activates speech recognition and synthesis across
 * compatible components (Main Session, Patient Encounter).
 *
 * Features:
 * - Speech-to-text for answering questions
 * - Text-to-speech for reading questions aloud
 * - High-contrast, large touch target UI mode
 * - Auto-advance with voice commands
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { toast } from '@/lib/toast';
import { StorageKeys } from '@/lib/storage/storageRegistry';

// Web Speech API types are defined in types/speech.d.ts

export interface CommuterSettings {
  voiceEnabled: boolean;
  autoReadQuestions: boolean;
  autoAdvance: boolean;
  speechRate: number; // 0.5 - 2.0
  highContrastMode: boolean;
  largeTouchTargets: boolean;
}

const DEFAULT_SETTINGS: CommuterSettings = {
  voiceEnabled: true,
  autoReadQuestions: true,
  autoAdvance: false,
  speechRate: 1.0,
  highContrastMode: true,
  largeTouchTargets: true,
};

interface CommuterContextType {
  isCommuterMode: boolean;
  settings: CommuterSettings;
  toggleCommuterMode: () => void;
  enableCommuterMode: () => void;
  disableCommuterMode: () => void;
  updateSettings: (updates: Partial<CommuterSettings>) => void;
  // Speech synthesis helpers
  speak: (text: string, priority?: boolean) => void;
  stopSpeaking: () => void;
  isSpeaking: boolean;
  // Speech recognition helpers
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  transcript: string;
  resetTranscript: () => void;
}

const CommuterContext = createContext<CommuterContextType | undefined>(undefined);

export function CommuterProvider({ children }: { children: ReactNode }) {
  const [isCommuterMode, setIsCommuterMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(StorageKeys.COMMUTER_MODE);
    return stored === 'true';
  });

  const [settings, setSettings] = useState<CommuterSettings>(() => {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    const stored = localStorage.getItem(StorageKeys.COMMUTER_SETTINGS);
    if (stored) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  // Speech synthesis state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSynthesis, setSpeechSynthesis] = useState<SpeechSynthesis | null>(null);

  // Speech recognition state
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  // Initialize speech APIs
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Speech Synthesis
    if ('speechSynthesis' in window) {
      setSpeechSynthesis(window.speechSynthesis);
    }

    // Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';

      recognitionInstance.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          // Guard: result[0] may be undefined in TypeScript strict mode
          const firstAlternative = result?.[0];
          if (!firstAlternative) continue;

          if (result.isFinal) {
            finalTranscript += firstAlternative.transcript;
          } else {
            interimTranscript += firstAlternative.transcript;
          }
        }

        setTranscript(finalTranscript || interimTranscript);
      };

      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionInstance.onend = () => {
        setIsListening(false);
      };

      setRecognition(recognitionInstance);
    }
  }, []);

  // Persist commuter mode state
  useEffect(() => {
    localStorage.setItem(StorageKeys.COMMUTER_MODE, String(isCommuterMode));

    // Apply high-contrast mode to document
    if (isCommuterMode && settings.highContrastMode) {
      document.documentElement.classList.add('commuter-mode');
    } else {
      document.documentElement.classList.remove('commuter-mode');
    }
  }, [isCommuterMode, settings.highContrastMode]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem(StorageKeys.COMMUTER_SETTINGS, JSON.stringify(settings));
  }, [settings]);

  const toggleCommuterMode = useCallback(() => {
    setIsCommuterMode((prev) => !prev);
    toast.success('Changes saved');
  }, []);

  const enableCommuterMode = useCallback(() => {
    setIsCommuterMode(true);
  }, []);

  const disableCommuterMode = useCallback(() => {
    setIsCommuterMode(false);
    stopSpeaking();
    stopListening();
  }, []);

  const updateSettings = useCallback((updates: Partial<CommuterSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
    toast.success('Changes saved');
  }, []);

  // Speech synthesis
  const speak = useCallback(
    (text: string, priority = false) => {
      if (!speechSynthesis || !isCommuterMode || !settings.voiceEnabled) return;

      if (priority) {
        speechSynthesis.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = settings.speechRate;
      utterance.pitch = 1;
      utterance.volume = 1;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      speechSynthesis.speak(utterance);
    },
    [speechSynthesis, isCommuterMode, settings.voiceEnabled, settings.speechRate]
  );

  const stopSpeaking = useCallback(() => {
    if (speechSynthesis) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [speechSynthesis]);

  // Speech recognition
  const startListening = useCallback(() => {
    if (!recognition || !isCommuterMode || !settings.voiceEnabled) return;

    try {
      recognition.start();
      setIsListening(true);
      setTranscript('');
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
    }
  }, [recognition, isCommuterMode, settings.voiceEnabled]);

  const stopListening = useCallback(() => {
    if (recognition) {
      recognition.stop();
      setIsListening(false);
    }
  }, [recognition]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  const value: CommuterContextType = {
    isCommuterMode,
    settings,
    toggleCommuterMode,
    enableCommuterMode,
    disableCommuterMode,
    updateSettings,
    speak,
    stopSpeaking,
    isSpeaking,
    isListening,
    startListening,
    stopListening,
    transcript,
    resetTranscript,
  };

  return <CommuterContext.Provider value={value}>{children}</CommuterContext.Provider>;
}

export function useCommuter(): CommuterContextType {
  const context = useContext(CommuterContext);
  if (context === undefined) {
    throw new Error('useCommuter must be used within a CommuterProvider');
  }
  return context;
}

export type { CommuterContextType };
