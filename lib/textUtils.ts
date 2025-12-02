/**
 * Text formatting utilities
 */

/**
 * Convert a string to Title Case for proper display.
 * E.g., "acetyl salicylic acid" -> "Acetyl Salicylic Acid"
 */
export function toTitleCase(str: string): string {
  if (!str) return str;
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Capitalize the first letter of a string while preserving the rest
 */
export function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
