import { describe, expect, it, vi } from 'vitest';
import tailwindConfig from '../tailwind.config';

describe('tailwind config tokens', () => {
  it('keeps brand shadow utilities configured', () => {
    const boxShadow = (tailwindConfig as { theme: { extend: { boxShadow: Record<string, string> } } })
      .theme.extend.boxShadow;

    expect(boxShadow.brand).toContain('rgba(15, 23, 42');
    expect(boxShadow['brand-lg']).toContain('rgba(15, 23, 42');
    expect(boxShadow['glow-accent']).toContain('rgba(14, 165, 233');
  });

  it('registers exam-mode and eor-accent utility classes', () => {
    const addUtilities = vi.fn();
    const firstPlugin = (tailwindConfig as { plugins: Array<(api: unknown) => void> }).plugins[0];

    expect(typeof firstPlugin).toBe('function');
    firstPlugin({ addUtilities });

    expect(addUtilities).toHaveBeenCalledWith(
      expect.objectContaining({
        '.exam-mode': expect.any(Object),
        '.eor-accent': expect.any(Object),
      })
    );
  });
});
