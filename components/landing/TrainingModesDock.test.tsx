import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TrainingModesDock } from './TrainingModesDock';

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
});

describe('training mode navigation', () => {
  it('keeps one tab stop and changes selection with vertical arrow keys', () => {
    render(<TrainingModesDock />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.filter((tab) => tab.tabIndex === 0)).toHaveLength(1);
    fireEvent.keyDown(tabs[0]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(tabs[1]!.id);
    expect(tabs.filter((tab) => tab.tabIndex === 0)).toHaveLength(1);
  });

  it('supports Home, End, and wrapping without selecting on pointer hover', () => {
    render(<TrainingModesDock />);
    const tabs = screen.getAllByRole('tab');
    fireEvent.mouseEnter(tabs[2]!);
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tabs[0]!, { key: 'End' });
    expect(document.activeElement).toBe(tabs.at(-1));
    fireEvent.keyDown(tabs.at(-1)!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(tabs[0]);
    fireEvent.keyDown(tabs[0]!, { key: 'End' });
    fireEvent.keyDown(tabs.at(-1)!, { key: 'Home' });
    expect(document.activeElement).toBe(tabs[0]);
  });

  it('uses horizontal arrows on mobile and leaves vertical scrolling keys alone', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    );
    render(<TrainingModesDock />);
    const tabs = screen.getAllByRole('tab');
    expect(screen.getByRole('tablist').getAttribute('aria-orientation')).toBe('horizontal');
    fireEvent.keyDown(tabs[0]!, { key: 'ArrowDown' });
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tabs[0]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tabs[1]);
    fireEvent.click(tabs[3]!);
    expect(tabs[3]!.getAttribute('aria-selected')).toBe('true');
  });
});
