/**
 * ShortcutContext - Customizable Keyboard Shortcut System
 * 
 * Provides a centralized system for managing keyboard shortcuts across the app.
 * Features:
 * - Customizable key bindings
 * - Persistent storage in localStorage
 * - Global shortcut hook with auto-cleanup
 * - Input field detection (ignores shortcuts when typing)
 * - Easy to extend with new actions
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type ShortcutAction = 
  | 'FLIP_CARD'
  | 'MARK_CORRECT'
  | 'MARK_WRONG'
  | 'NEXT_QUESTION'
  | 'PREV_QUESTION'
  | 'PLAY_AUDIO';

export type ShortcutMap = Record<ShortcutAction, string>;

// ============================================================================
// DEFAULT SHORTCUTS
// ============================================================================

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  FLIP_CARD: ' ',          // Space
  MARK_CORRECT: '1',       // Number 1
  MARK_WRONG: '2',         // Number 2
  NEXT_QUESTION: 'ArrowRight',
  PREV_QUESTION: 'ArrowLeft',
  PLAY_AUDIO: 'p',
};

// ============================================================================
// CONTEXT
// ============================================================================

interface ShortcutContextValue {
  shortcuts: ShortcutMap;
  updateShortcut: (action: ShortcutAction, newKey: string) => void;
  resetShortcuts: () => void;
  getKeyForAction: (action: ShortcutAction) => string;
  getActionForKey: (key: string) => ShortcutAction | null;
}

const ShortcutContext = createContext<ShortcutContextValue | undefined>(undefined);

const STORAGE_KEY = 'panacea_shortcuts';

// ============================================================================
// PROVIDER
// ============================================================================

export const ShortcutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [shortcuts, setShortcuts] = useState<ShortcutMap>(DEFAULT_SHORTCUTS);

  // Load shortcuts from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsedShortcuts = JSON.parse(saved) as Partial<ShortcutMap>;
        
        // Merge with defaults to handle new actions added in future updates
        const mergedShortcuts = { ...DEFAULT_SHORTCUTS };
        
        // Override with saved values
        for (const action in parsedShortcuts) {
          if (action in DEFAULT_SHORTCUTS) {
            mergedShortcuts[action as ShortcutAction] = parsedShortcuts[action as ShortcutAction]!;
          }
        }
        
        setShortcuts(mergedShortcuts);
        console.log('[ShortcutContext] Loaded custom shortcuts from localStorage');
      }
    } catch (error) {
      console.error('[ShortcutContext] Failed to load shortcuts from localStorage:', error);
      setShortcuts(DEFAULT_SHORTCUTS);
    }
  }, []);

  // Update a single shortcut
  const updateShortcut = useCallback((action: ShortcutAction, newKey: string) => {
    setShortcuts(prev => {
      const updated = { ...prev, [action]: newKey };
      
      // Save to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        console.log(`[ShortcutContext] Updated ${action} to '${newKey}'`);
      } catch (error) {
        console.error('[ShortcutContext] Failed to save shortcuts to localStorage:', error);
      }
      
      return updated;
    });
  }, []);

  // Reset all shortcuts to defaults
  const resetShortcuts = useCallback(() => {
    setShortcuts(DEFAULT_SHORTCUTS);
    
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('[ShortcutContext] Reset shortcuts to defaults');
    } catch (error) {
      console.error('[ShortcutContext] Failed to reset shortcuts:', error);
    }
  }, []);

  // Get key for a specific action
  const getKeyForAction = useCallback((action: ShortcutAction): string => {
    return shortcuts[action];
  }, [shortcuts]);

  // Get action for a specific key (reverse lookup)
  const getActionForKey = useCallback((key: string): ShortcutAction | null => {
    const entry = Object.entries(shortcuts).find(([_, value]) => value === key);
    return entry ? (entry[0] as ShortcutAction) : null;
  }, [shortcuts]);

  const value: ShortcutContextValue = {
    shortcuts,
    updateShortcut,
    resetShortcuts,
    getKeyForAction,
    getActionForKey,
  };

  return (
    <ShortcutContext.Provider value={value}>
      {children}
    </ShortcutContext.Provider>
  );
};

// ============================================================================
// CUSTOM HOOK - useShortcut
// ============================================================================

/**
 * Hook for registering a keyboard shortcut
 * 
 * @param action - The shortcut action to listen for
 * @param callback - Function to call when the shortcut is triggered
 * @param options - Optional configuration
 * 
 * @example
 * useShortcut('FLIP_CARD', () => {
 *   console.log('Space pressed!');
 *   flipCard();
 * });
 */
export function useShortcut(
  action: ShortcutAction,
  callback: () => void,
  options?: {
    enabled?: boolean;  // Whether the shortcut is currently active (default: true)
    preventDefault?: boolean;  // Whether to prevent default browser behavior (default: true)
  }
): void {
  const context = useContext(ShortcutContext);
  
  if (!context) {
    throw new Error('useShortcut must be used within a ShortcutProvider');
  }

  const { shortcuts } = context;
  const { enabled = true, preventDefault = true } = options || {};

  useEffect(() => {
    // Don't attach listener if disabled
    if (!enabled) return;

    const key = shortcuts[action];
    if (!key) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = event.target as HTMLElement;
      const isInputField = 
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (isInputField) return;

      // Check if the pressed key matches the shortcut
      if (event.key === key) {
        if (preventDefault) {
          event.preventDefault();
        }
        
        callback();
      }
    };

    // Add global keydown listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [action, callback, shortcuts, enabled, preventDefault]);
}

// ============================================================================
// CONTEXT HOOK
// ============================================================================

/**
 * Hook to access the shortcut context
 * 
 * @example
 * const { shortcuts, updateShortcut, resetShortcuts } = useShortcutContext();
 */
export function useShortcutContext(): ShortcutContextValue {
  const context = useContext(ShortcutContext);
  
  if (!context) {
    throw new Error('useShortcutContext must be used within a ShortcutProvider');
  }
  
  return context;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format a key for display (e.g., 'ArrowRight' -> 'Arrow Right', ' ' -> 'Space')
 */
export function formatKeyForDisplay(key: string): string {
  const keyMap: Record<string, string> = {
    ' ': 'Space',
    'ArrowUp': 'Arrow Up',
    'ArrowDown': 'Arrow Down',
    'ArrowLeft': 'Arrow Left',
    'ArrowRight': 'Arrow Right',
    'Enter': 'Enter',
    'Escape': 'Escape',
    'Tab': 'Tab',
    'Backspace': 'Backspace',
    'Delete': 'Delete',
  };

  return keyMap[key] || key.toUpperCase();
}

/**
 * Check if a key is already assigned to another action
 */
export function isKeyConflict(
  shortcuts: ShortcutMap,
  key: string,
  excludeAction?: ShortcutAction
): ShortcutAction | null {
  const entries = Object.entries(shortcuts) as [ShortcutAction, string][];
  
  for (const [action, assignedKey] of entries) {
    if (assignedKey === key && action !== excludeAction) {
      return action;
    }
  }
  
  return null;
}

/**
 * Get a human-readable action name
 */
export function getActionDisplayName(action: ShortcutAction): string {
  const displayNames: Record<ShortcutAction, string> = {
    FLIP_CARD: 'Flip Card',
    MARK_CORRECT: 'Mark Correct',
    MARK_WRONG: 'Mark Wrong',
    NEXT_QUESTION: 'Next Question',
    PREV_QUESTION: 'Previous Question',
    PLAY_AUDIO: 'Play Audio',
  };

  return displayNames[action];
}
