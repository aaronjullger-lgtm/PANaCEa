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
    // <a> tags are preserved but javascript: hrefs are stripped
    expect(out.toLowerCase()).toContain('<a>');
    expect(out).toContain('link</a>');
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

  // SEC-004 adversarial coverage
  it('drops data:, vbscript:, and other non-allowlisted href protocols', () => {
    for (const proto of ['data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)', 'file:///etc/passwd']) {
      const out = sanitizeForRationale(`<a href="${proto}">x</a>`).toLowerCase();
      expect(out).toContain('<a>'); // tag kept, dangerous href dropped
      expect(out).not.toContain('href=');
      expect(out).not.toContain('vbscript:');
      expect(out).not.toContain('data:text/html');
    }
  });

  it('removes mixed-case and spaced script tags', () => {
    const out = sanitizeForRationale('<ScRiPt>alert(1)</ScRiPt><p>ok</p>').toLowerCase();
    expect(out).not.toContain('alert(1)');
    expect(out).not.toContain('<script');
    expect(out).toContain('ok');
  });

  it('enforces rel=noopener noreferrer on target=_blank links', () => {
    const out = sanitizeForRationale('<a href="https://example.com" target="_blank">x</a>');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it('strips disallowed svg/img with event handlers entirely', () => {
    const out = sanitizeForRationale('<svg onload="alert(1)"></svg><img src=x onerror=alert(1)>').toLowerCase();
    expect(out).not.toContain('<svg');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('onload');
    expect(out).not.toContain('onerror');
  });

  it('preserves legitimate medical formatting (sub/sup, lists, headings)', () => {
    const input = '<h3>Dx</h3><p>Na<sub>+</sub> and O<sup>2</sup></p><ul><li>step</li></ul>';
    const out = sanitizeForRationale(input);
    expect(out).toContain('<sub>');
    expect(out).toContain('<sup>');
    expect(out).toContain('<li>');
    expect(out).toContain('<h3>');
  });
});
