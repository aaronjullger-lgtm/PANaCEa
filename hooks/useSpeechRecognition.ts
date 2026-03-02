/**
 * useSpeechRecognition Hook
 *
 * A standalone hook for speech-to-text functionality using the Web Speech API.
 * Use this in components that need voice input without the full CommuterContext.
 *
 * Features:
 * - Start/stop listening
 * - Real-time transcript updates
 * - Confidence scores
 * - Error handling
 * - Language selection
 *
 * Usage:
 *   const { startListening, stopListening, transcript, isListening, isSupported } = useSpeechRecognition();
 *   startListening();
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface SpeechRecognitionOptions {
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
  grammars?: SpeechGrammarList;
  onResult?: (transcript: string, isFinal: boolean, confidence: number) => void;
  onError?: (error: SpeechRecognitionErrorEvent) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export interface UseSpeechRecognitionReturn {
  startListening: (options?: SpeechRecognitionOptions) => void;
  stopListening: () => void;
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
  resetTranscript: () => void;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const optionsRef = useRef<SpeechRecognitionOptions>({});

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsSupported(false);
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    // Default options
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    // Event handlers
    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      optionsRef.current.onStart?.();
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        const alternative = result[0];
        if (!alternative) continue;
        const text = alternative.transcript;
        const isFinal = result.isFinal;
        const confidence = alternative.confidence;

        if (isFinal) {
          finalTranscript += text + ' ';
        } else {
          interimTranscript += text + ' ';
        }

        optionsRef.current.onResult?.(text, isFinal, confidence);
      }

      if (finalTranscript) {
        setTranscript((prev) => (prev + finalTranscript).trim());
        setInterimTranscript('');
      }
      if (interimTranscript) {
        setInterimTranscript(interimTranscript.trim());
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setError(`${event.error}: ${event.message}`);
      setIsListening(false);
      optionsRef.current.onError?.(event);
    };

    recognition.onend = () => {
      setIsListening(false);
      optionsRef.current.onEnd?.();
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startListening = useCallback((options: SpeechRecognitionOptions = {}) => {
    if (!recognitionRef.current || !isSupported) {
      console.warn('Speech recognition not supported');
      return;
    }

    optionsRef.current = options;

    // Apply options
    const recognition = recognitionRef.current;
    if (options.continuous !== undefined) recognition.continuous = options.continuous;
    if (options.interimResults !== undefined) recognition.interimResults = options.interimResults;
    if (options.lang) recognition.lang = options.lang;
    if (options.grammars) recognition.grammars = options.grammars;

    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setError('Failed to start');
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    startListening,
    stopListening,
    transcript,
    interimTranscript,
    isListening,
    isSupported,
    error,
    resetTranscript,
  };
}