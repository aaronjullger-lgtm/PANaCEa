import { describe, expect, it } from 'vitest';
import {
  getModeReadiness,
  isModeDiscoverable,
  PRODUCTION_DEFERRED_MODE_IDS,
} from './modeReadiness';

describe('modeReadiness', () => {
  it('allows only real mounted production-ready modes to be discoverable', () => {
    expect(isModeDiscoverable('core_adaptive')).toBe(true);
    expect(isModeDiscoverable('system_drill')).toBe(true);
    expect(isModeDiscoverable('condition_drill')).toBe(true);

    for (const modeId of PRODUCTION_DEFERRED_MODE_IDS) {
      expect(isModeDiscoverable(modeId), `${modeId} should fail closed`).toBe(false);
    }
  });

  it('explains deferred modes through readiness reasons', () => {
    const readiness = getModeReadiness('pharmacology');

    expect(readiness.discoverable).toBe(false);
    expect(readiness.state).toBe('deferred');
    expect(readiness.mountedComponent).toBe('productionDeferred');
    expect(readiness.reasons.join(' ')).toContain('productionDeferred');
  });
});
