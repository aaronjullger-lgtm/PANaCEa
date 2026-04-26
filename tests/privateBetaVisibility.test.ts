import { describe, expect, it } from 'vitest';
import {
  filterPrivateBetaModes,
  isPrivateBetaModeVisible,
  isPrivateBetaRouteVisible,
} from '../lib/modes/privateBetaVisibility';
import { MODE_REGISTRY } from '../config/training-modes';

describe('private beta visibility', () => {
  it('keeps core study-loop modes visible', () => {
    expect(isPrivateBetaModeVisible('core_adaptive')).toBe(true);
    expect(isPrivateBetaModeVisible('system_drill')).toBe(true);
    expect(isPrivateBetaModeVisible('pharmacology')).toBe(true);
  });

  it('hides risky or non-launch modes from beta discovery', () => {
    expect(isPrivateBetaModeVisible('patient_encounter')).toBe(false);
    expect(isPrivateBetaModeVisible('commuter_mode')).toBe(false);
    expect(isPrivateBetaModeVisible('icd_coding_drill')).toBe(false);
    expect(isPrivateBetaModeVisible('ddx_compare')).toBe(false);
  });

  it('filters the mode registry down to beta-visible production modes', () => {
    const visibleIds = filterPrivateBetaModes(MODE_REGISTRY).map((mode) => mode.id);

    expect(visibleIds).toContain('core_adaptive');
    expect(visibleIds).toContain('rapid_recall');
    expect(visibleIds).not.toContain('patient_encounter');
    expect(visibleIds).not.toContain('icd_coding_drill');
  });

  it('gates non-launch workspace routes without changing the study loop', () => {
    expect(isPrivateBetaRouteVisible('/study')).toBe(true);
    expect(isPrivateBetaRouteVisible('/practice')).toBe(true);
    expect(isPrivateBetaRouteVisible('/live-collaboration')).toBe(false);
    expect(isPrivateBetaRouteVisible('/explorer/')).toBe(false);
  });
});
