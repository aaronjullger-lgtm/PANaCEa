import { describe, expect, it } from 'vitest';
import {
  PRIVATE_BETA_CANDIDATE_MODE_IDS,
  filterPrivateBetaModes,
  isPrivateBetaModeVisible,
  isPrivateBetaRouteVisible,
} from '../lib/modes/privateBetaVisibility';
import { isModeDiscoverable } from '../lib/modes/modeReadiness';
import { MODE_REGISTRY } from '../config/training-modes';

describe('private beta visibility', () => {
  it('keeps core study-loop modes visible', () => {
    expect(isPrivateBetaModeVisible('core_adaptive')).toBe(true);
    expect(isPrivateBetaModeVisible('system_drill')).toBe(true);
    expect(isPrivateBetaModeVisible('condition_drill')).toBe(true);
    expect(isPrivateBetaModeVisible('pharmacology')).toBe(false);
  });

  it('hides risky or non-launch modes from beta discovery', () => {
    expect(isPrivateBetaModeVisible('patient_encounter')).toBe(false);
    expect(isPrivateBetaModeVisible('commuter_mode')).toBe(false);
    expect(isPrivateBetaModeVisible('icd_coding_drill')).toBe(false);
    expect(isPrivateBetaModeVisible('ddx_compare')).toBe(false);
    expect(isPrivateBetaModeVisible('unknown_mode')).toBe(false);
  });

  it('filters the mode registry down to beta-visible production modes', () => {
    const visibleIds = filterPrivateBetaModes(MODE_REGISTRY).map((mode) => mode.id);

    expect(visibleIds).toContain('core_adaptive');
    expect(visibleIds).toContain('system_drill');
    expect(visibleIds).toContain('condition_drill');
    expect(visibleIds).not.toContain('rapid_recall');
    expect(visibleIds).not.toContain('patient_encounter');
    expect(visibleIds).not.toContain('icd_coding_drill');
  });

  it('treats candidate mode ids as candidates, not automatic visibility', () => {
    expect(PRIVATE_BETA_CANDIDATE_MODE_IDS.has('pharmacology')).toBe(true);
    expect(isModeDiscoverable('pharmacology')).toBe(false);
    expect(isPrivateBetaModeVisible('pharmacology')).toBe(false);
  });

  it('gates non-launch workspace routes without changing the study loop', () => {
    expect(isPrivateBetaRouteVisible('/study')).toBe(true);
    expect(isPrivateBetaRouteVisible('/practice')).toBe(true);
    expect(isPrivateBetaRouteVisible('/daily-challenges')).toBe(false);
    expect(isPrivateBetaRouteVisible('/live-collaboration')).toBe(false);
    expect(isPrivateBetaRouteVisible('/explorer/')).toBe(false);
  });
});
