/**
 * Text Utility Functions
 * 
 * Provides text formatting utilities for the application.
 */

/**
 * Capitalize the first letter of a string.
 * If the string starts with a lowercase letter, it will be capitalized.
 * Numbers and special characters at the beginning are preserved.
 * 
 * @param text - The string to capitalize
 * @returns The string with the first letter capitalized
 */
export function capitalizeFirstLetter(text: string): string {
  if (!text || typeof text !== 'string') return text;
  
  // Trim and find first actual character
  const trimmed = text.trim();
  if (trimmed.length === 0) return text;
  
  // Capitalize first character and append the rest
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Capitalize the first letter of each option in an array.
 * Useful for answer choices in quizzes.
 * 
 * @param options - Array of option strings
 * @returns Array with each option's first letter capitalized
 */
export function capitalizeOptions(options: string[]): string[] {
  return options.map(capitalizeFirstLetter);
}
