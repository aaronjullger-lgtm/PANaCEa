import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SkipToContent } from './SkipToContent';

describe('SkipToContent', () => {
  it('renders a link with default label', () => {
    render(
      <>
        <SkipToContent />
        <main id="main-content">Content</main>
      </>
    );
    expect(screen.getByText('Skip to main content')).toBeTruthy();
  });

  it('renders a link with custom label', () => {
    render(
      <>
        <SkipToContent label="Jump to dashboard" targetId="dashboard" />
        <div id="dashboard">Dashboard</div>
      </>
    );
    expect(screen.getByText('Jump to dashboard')).toBeTruthy();
  });

  it('has correct href attribute', () => {
    render(
      <>
        <SkipToContent targetId="app-main" />
        <div id="app-main" />
      </>
    );
    const link = screen.getByText('Skip to main content');
    expect(link.getAttribute('href')).toBe('#app-main');
  });

  it('is visually hidden by default (sr-only)', () => {
    render(
      <>
        <SkipToContent />
        <main id="main-content" />
      </>
    );
    const link = screen.getByText('Skip to main content');
    expect(link.className).toContain('sr-only');
  });

  it('moves focus to target on click', () => {
    render(
      <>
        <SkipToContent targetId="test-main" />
        <main id="test-main" tabIndex={-1}>Main content</main>
      </>
    );

    const link = screen.getByText('Skip to main content');
    fireEvent.click(link);

    const main = document.getElementById('test-main');
    expect(document.activeElement).toBe(main);
  });
});
