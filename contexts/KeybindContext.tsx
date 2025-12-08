/**
 * KeybindContext - Global keybind management system
 * 
 * Provides a centralized way to register and manage keyboard shortcuts
 * throughout the application. Prevents ghost triggers by checking for
 * focused input elements.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

export type KeybindAction = 
  | 'submit'
  | 'next'
  | 'previous'
  | 'toggle_theme'
  | 'open_settings'
  | 'open_shortcuts'
  | 'flag_question'
  | 'bookmark_question'
  | 'show_hint'
  | 'show_explanation'
  | 'quit_mode';

export interface KeybindConfig {
  action: KeybindAction;
  key: string;
  description: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

export interface KeybindContextValue {
  keybinds: Map<KeybindAction, KeybindConfig>;
  registerKeybind: (config: KeybindConfig) => void;
  unregisterKeybind: (action: KeybindAction) => void;
  updateKeybind: (action: KeybindAction, newKey: string) => void;
  getKeybind: (action: KeybindAction) => KeybindConfig | undefined;
  isKeybindActive: boolean;
  setKeybindActive: (active: boolean) => void;
}

const KeybindContext = createContext<KeybindContextValue | undefined>(undefined);

const DEFAULT_KEYBINDS: KeybindConfig[] = [
  { action: 'submit', key: 'Enter', description: 'Submit answer' },
  { action: 'next', key: 'ArrowRight', description: 'Next question' },
  { action: 'previous', key: 'ArrowLeft', description: 'Previous question' },
  { action: 'toggle_theme', key: 't', description: 'Toggle theme', ctrlKey: true },
  { action: 'open_settings', key: ',', description: 'Open settings', ctrlKey: true },
  { action: 'open_shortcuts', key: '/', description: 'Show keyboard shortcuts', ctrlKey: true },
  { action: 'flag_question', key: 'f', description: 'Flag question' },
  { action: 'bookmark_question', key: 'b', description: 'Bookmark question' },
  { action: 'show_hint', key: 'h', description: 'Show hint' },
  { action: 'show_explanation', key: 'e', description: 'Show explanation' },
  { action: 'quit_mode', key: 'Escape', description: 'Exit current mode' },
];

interface KeybindProviderProps {
  children: ReactNode;
}

export function KeybindProvider({ children }: KeybindProviderProps) {
  const [keybinds, setKeybinds] = useState<Map<KeybindAction, KeybindConfig>>(() => {
    // Load from localStorage
    const stored = localStorage.getItem('panacea_keybinds');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as KeybindConfig[];
        return new Map(parsed.map(config => [config.action, config]));
      } catch {
        // Fall back to defaults
      }
    }
    return new Map(DEFAULT_KEYBINDS.map(config => [config.action, config]));
  });

  const [isKeybindActive, setKeybindActive] = useState(true);

  // Save to localStorage whenever keybinds change
  useEffect(() => {
    const keybindsArray = Array.from(keybinds.values());
    localStorage.setItem('panacea_keybinds', JSON.stringify(keybindsArray));
  }, [keybinds]);

  const registerKeybind = useCallback((config: KeybindConfig) => {
    setKeybinds(prev => {
      const next = new Map(prev);
      next.set(config.action, config);
      return next;
    });
  }, []);

  const unregisterKeybind = useCallback((action: KeybindAction) => {
    setKeybinds(prev => {
      const next = new Map(prev);
      next.delete(action);
      return next;
    });
  }, []);

  const updateKeybind = useCallback((action: KeybindAction, newKey: string) => {
    setKeybinds(prev => {
      const next = new Map(prev);
      const existing = next.get(action);
      if (existing) {
        next.set(action, { ...existing, key: newKey });
      }
      return next;
    });
  }, []);

  const getKeybind = useCallback((action: KeybindAction) => {
    return keybinds.get(action);
  }, [keybinds]);

  const value: KeybindContextValue = {
    keybinds,
    registerKeybind,
    unregisterKeybind,
    updateKeybind,
    getKeybind,
    isKeybindActive,
    setKeybindActive,
  };

  return (
    <KeybindContext.Provider value={value}>
      {children}
    </KeybindContext.Provider>
  );
}

/**
 * Custom hook to use keybinds in components
 */
export function useKeybind(
  action: KeybindAction,
  handler: (event: KeyboardEvent) => void,
  options?: {
    enabled?: boolean;
    preventDefault?: boolean;
  }
) {
  const context = useContext(KeybindContext);
  
  if (!context) {
    throw new Error('useKeybind must be used within a KeybindProvider');
  }

  const { keybinds, isKeybindActive } = context;
  const enabled = options?.enabled !== false;
  const preventDefault = options?.preventDefault !== false;

  useEffect(() => {
    if (!enabled || !isKeybindActive) {
      return;
    }

    const config = keybinds.get(action);
    if (!config) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if user is typing in an input field
      const target = event.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || 
                     target.tagName === 'TEXTAREA' || 
                     target.isContentEditable;

      // Skip if typing in input (unless it's Escape key which should always work)
      if (isInput && config.key !== 'Escape') {
        return;
      }

      // Check if the key matches
      const keyMatches = event.key === config.key;
      const ctrlMatches = config.ctrlKey ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
      const shiftMatches = config.shiftKey ? event.shiftKey : !event.shiftKey;
      const altMatches = config.altKey ? event.altKey : !event.altKey;

      if (keyMatches && ctrlMatches && shiftMatches && altMatches) {
        if (preventDefault) {
          event.preventDefault();
        }
        handler(event);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [action, handler, enabled, isKeybindActive, keybinds, preventDefault]);

  return context;
}

/**
 * Hook to access the keybind context directly
 */
export function useKeybindContext() {
  const context = useContext(KeybindContext);
  if (!context) {
    throw new Error('useKeybindContext must be used within a KeybindProvider');
  }
  return context;
}

/**
 * Helper function to format a keybind for display
 */
export function formatKeybind(config: KeybindConfig): string {
  const parts: string[] = [];
  
  if (config.ctrlKey) {
    parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
  }
  if (config.shiftKey) {
    parts.push('⇧');
  }
  if (config.altKey) {
    parts.push(navigator.platform.includes('Mac') ? '⌥' : 'Alt');
  }
  
  // Format the key
  let key = config.key;
  if (key === 'ArrowLeft') key = '←';
  else if (key === 'ArrowRight') key = '→';
  else if (key === 'ArrowUp') key = '↑';
  else if (key === 'ArrowDown') key = '↓';
  else if (key === 'Escape') key = 'Esc';
  else if (key === 'Enter') key = '↵';
  else if (key === ' ') key = 'Space';
  else key = key.toUpperCase();
  
  parts.push(key);
  
  return parts.join(' + ');
}
