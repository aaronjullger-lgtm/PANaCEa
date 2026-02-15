import { describe, it, expect } from 'vitest';
import { sanitizeForRationale } from '@/lib/sanitizeHtml';

describe('sanitizeForRationale', () => {
  it('removes scripts/iframes/styles and strips disallowed tags', () => {
    const input =
      '<p>Hello<script>alert(1)</script><b onclick="x()">World</b><img src=x onerror=alert(1) /><iframe src="https://evil.com"></iframe><a href="javascript:alert(1)">link</a></p>';
    const out = sanitizeForRationale(input);

    expect(out).toContain('<p>');
    expect(out).toContain('</p>');
    expect(out).toContain('<b>');
    expect(out).toContain('World');

    expect(out.toLowerCase()).not.toContain('<script');
    expect(out.toLowerCase()).not.toContain('<iframe');
    expect(out.toLowerCase()).not.toContain('<style');
    expect(out.toLowerCase()).not.toContain('<img');
    expect(out.toLowerCase()).not.toContain('<a');
    expect(out.toLowerCase()).not.toContain('onerror');
    expect(out.toLowerCase()).not.toContain('onclick');
    expect(out.toLowerCase()).not.toContain('javascript:');
  });

  it('keeps safe table tags but strips attributes', () => {
    const input = '<table border="1"><tr><td style="color:red" onclick="x()">X</td></tr></table>';
    const out = sanitizeForRationale(input);
    expect(out).toBe('<table><tr><td>X</td></tr></table>');
  });

  it('returns empty string for nullish input', () => {
    expect(sanitizeForRationale(null)).toBe('');
    expect(sanitizeForRationale(undefined)).toBe('');
    expect(sanitizeForRationale('')).toBe('');
  });
});
