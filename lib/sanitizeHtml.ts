/**
 * Sanitize HTML for safe use with dangerouslySetInnerHTML (rationale, pearls, tables).
 * Allows only safe tags and safe attributes to prevent XSS while preserving formatting.
 */

const ALLOWED_TAGS = new Set([
  'a',
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
  'sub',
  'sup',
  'code',
  'pre',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
]);

/** Safe attributes per tag - only these are preserved */
const SAFE_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
  span: new Set(['class']),
  div: new Set(['class']),
  p: new Set(['class']),
  table: new Set(['class']),
  ol: new Set(['type', 'start']),
};

/**
 * Sanitize a single HTML tag, preserving safe attributes.
 * Strips event handlers (on*) and dangerous attribute values (javascript:).
 * Drops disallowed tags entirely.
 */
function sanitizeTag(tagMatch: string): string {
  const openClose = tagMatch.match(/^(<\/?)(\w+)/);
  if (!openClose) return '';
  const bracket = openClose[1];
  const name = openClose[2];
  if (name === undefined) return '';
  const tagName = name.toLowerCase();
  if (!ALLOWED_TAGS.has(tagName)) return '';
  if (bracket === '</') return `</${tagName}>`;

  // Extract and filter attributes
  const allowedAttrs = SAFE_ATTRIBUTES[tagName];
  if (!allowedAttrs) return `<${tagName}>`;

  const attrs: string[] = [];
  const attrRegex = /\s+([a-z][a-z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/gi;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(tagMatch)) !== null) {
    const attrName = match[1]?.toLowerCase();
    const attrValue = match[2] ?? match[3] ?? match[4] ?? '';
    if (!attrName) continue;

    // Skip event handlers and dangerous values
    if (attrName.startsWith('on')) continue;
    if (/^\s*javascript\s*:/i.test(attrValue)) continue;

    if (allowedAttrs.has(attrName)) {
      // For href, only allow http(s), mailto, and relative URLs
      if (attrName === 'href') {
        if (/^(?:https?:|mailto:|\/|#)/i.test(attrValue.trim())) {
          attrs.push(`${attrName}="${attrValue}"`);
        }
      } else {
        attrs.push(`${attrName}="${attrValue}"`);
      }
    }
  }

  return attrs.length > 0 ? `<${tagName} ${attrs.join(' ')}>` : `<${tagName}>`;
}

/**
 * Sanitize HTML string for display in rationale/explanation panels.
 * Removes script/style/iframe; allows only safe tags with safe attributes.
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
