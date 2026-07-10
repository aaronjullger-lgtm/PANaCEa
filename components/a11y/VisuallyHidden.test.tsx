import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { VisuallyHidden } from './VisuallyHidden';

describe('VisuallyHidden', () => {
  it('renders content in an sr-only span by default', () => {
    const { container } = render(<VisuallyHidden>Trending up</VisuallyHidden>);
    const el = container.querySelector('span.sr-only');
    expect(el).toBeTruthy();
    expect(el?.textContent).toBe('Trending up');
  });

  it('can render as a block element', () => {
    const { container } = render(<VisuallyHidden as="div">hidden</VisuallyHidden>);
    const el = container.querySelector('div.sr-only');
    expect(el).toBeTruthy();
  });
});
