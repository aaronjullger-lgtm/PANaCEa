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
    // Find the custom plugin function (may not be index 0 if other plugins like tailwindcss-animate are prepended)
    const plugins = (tailwindConfig as { plugins: Array<unknown> }).plugins;
    const customPlugin = plugins.find((p): p is (api: unknown) => void => typeof p === 'function');

    expect(customPlugin).toBeDefined();
    customPlugin!({ addUtilities });

    expect(addUtilities).toHaveBeenCalledWith(
      expect.objectContaining({
        '.exam-mode': expect.any(Object),
        '.eor-accent': expect.any(Object),
      })
    );
  });
});
