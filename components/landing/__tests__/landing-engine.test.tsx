import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClinicalLearningEngine } from '../ClinicalLearningEngine';
import { StudyPrescription } from '../StudyPrescription';
import { DASHBOARD_STUDY_PRESCRIPTION, ENGINE_STAGES } from '../content';

// jsdom lacks these browser APIs the signature visual touches; stub them so the
// components mount the same way they would in a (capability-gated) browser.
beforeAll(() => {
  class IO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('IntersectionObserver', IO);
  vi.stubGlobal('ResizeObserver', RO);
  if (!window.matchMedia) {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  }
  // canvas 2d context is unused logic-wise in jsdom; returning null is handled.
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
});

describe('ClinicalLearningEngine', () => {
  it('renders an accessible legend describing the adaptive loop', () => {
    render(<ClinicalLearningEngine />);
    // The legend (not the decorative canvas) carries the meaning.
    const firstStage = ENGINE_STAGES[0]!;
    expect(screen.getByText(firstStage.label)).toBeTruthy();
    expect(screen.getByText(firstStage.caption)).toBeTruthy();
  });
});

describe('StudyPrescription', () => {
  it('renders one dominant prescribed action with a start affordance', () => {
    render(<StudyPrescription onStart={() => {}} />);
    expect(screen.getByText(DASHBOARD_STUDY_PRESCRIPTION.title)).toBeTruthy();
    expect(screen.getByRole('button', { name: /start this block/i })).toBeTruthy();
    expect(screen.getByText(/why the engine chose this/i)).toBeTruthy();
  });
});
