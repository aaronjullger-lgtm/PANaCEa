/**
 * Re-export useTheme from ThemeContext so theme is shared across app and landing page.
 * All callers must be rendered inside ThemeProvider (see index.tsx).
 */
export { useTheme } from '../contexts/ThemeContext';
export type { Theme } from '../contexts/ThemeContext';
