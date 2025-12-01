// Utility to parse JSON that may be wrapped in markdown code blocks or have other formatting
export function parseDirtyJson<T = any>(text: string): T {
  // Remove markdown code blocks
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  
  // Trim whitespace
  cleaned = cleaned.trim();
  
  // Find the first [ or { and last ] or }
  const firstBracket = Math.min(
    cleaned.indexOf('[') === -1 ? Infinity : cleaned.indexOf('['),
    cleaned.indexOf('{') === -1 ? Infinity : cleaned.indexOf('{')
  );
  
  const lastSquareBracket = cleaned.lastIndexOf(']');
  const lastCurlyBracket = cleaned.lastIndexOf('}');
  const lastBracket = Math.max(lastSquareBracket, lastCurlyBracket);
  
  if (firstBracket !== Infinity && lastBracket !== -1) {
    cleaned = cleaned.substring(firstBracket, lastBracket + 1);
  }
  
  // Parse the JSON
  return JSON.parse(cleaned);
}
