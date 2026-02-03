/**
 * Sanitize HTML for safe use with dangerouslySetInnerHTML (rationale, pearls, tables).
 * Allows only safe tags and strips script/event handlers to prevent XSS.
 */

const ALLOWED_TAGS = new Set([
  'b',
  'i',
  'u',
  'strong',
  'em',
  'br',
  'p',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'span',
  'div',
]);

/**
 * Strip dangerous attributes (on*, href, src, style with javascript:) from a tag.
 * Keeps only tag name for allowed tags; drops disallowed tags entirely.
 */
function sanitizeTag(tagMatch: string): string {
  const openClose = tagMatch.match(/^(<\/?)(\w+)/);
  if (!openClose) return '';
  const [, bracket, name] = openClose;
  const tagName = name.toLowerCase();
  if (!ALLOWED_TAGS.has(tagName)) return '';
  if (bracket === '</') return `</${tagName}>`;
  return `<${tagName}>`;
}

/**
 * Sanitize HTML string for display in rationale/explanation panels.
 * Removes script/style/iframe; allows only safe tags and strips all attributes.
 */
export function sanitizeForRationale(html: string | null | undefined): string {
  if (html == null || html === '') return '';
  let out = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');
  out = out.replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, sanitizeTag);
  return out;
}
