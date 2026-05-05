import { describe, it, expect } from 'vitest';
import {
  ROUTE_REGISTRY,
  isKnownPath,
  getViewForPath,
} from '../config/routeRegistry';
import { TRAINING_MODES, MODES_WITH_DEDICATED_ROUTES } from '../config/training-modes';
import { ROUTES } from '../config/routes';
import { filterPrivateBetaModes } from '../lib/modes/privateBetaVisibility';
import { getModeReadiness } from '../lib/modes/modeReadiness';

// ---------------------------------------------------------------------------
// 1. isKnownPath — strict matching (no false positives)
// ---------------------------------------------------------------------------

describe('isKnownPath — strict matching', () => {
  it('accepts exact registered paths', () => {
    expect(isKnownPath('/study')).toBe(true);
    expect(isKnownPath('/practice')).toBe(true);
    expect(isKnownPath('/progress')).toBe(true);
    expect(isKnownPath('/admin')).toBe(true);
    expect(isKnownPath('/daily-challenges')).toBe(true);
    expect(isKnownPath('/')).toBe(true);
  });

  it('accepts /study/knowledge, /study/utilities, /study/path', () => {
    expect(isKnownPath('/study/knowledge')).toBe(true);
    expect(isKnownPath('/study/utilities')).toBe(true);
    expect(isKnownPath('/study/path')).toBe(true);
  });

  it('accepts admin sub-routes', () => {
    expect(isKnownPath('/admin/curation')).toBe(true);
    expect(isKnownPath('/admin/refinery')).toBe(true);
    expect(isKnownPath('/admin/taxonomies')).toBe(true);
    expect(isKnownPath('/admin/system-mappings')).toBe(true);
    expect(isKnownPath('/admin/question-generator')).toBe(true);
  });

  it('accepts tool routes (clinical-eye, visualizer, etc.)', () => {
    expect(isKnownPath('/clinical-eye')).toBe(true);
    expect(isKnownPath('/visualizer')).toBe(true);
    expect(isKnownPath('/lecture-converter')).toBe(true);
    expect(isKnownPath('/technique-check')).toBe(true);
  });

  it('accepts dynamic /session/<id> routes', () => {
    expect(isKnownPath('/session/abc123')).toBe(true);
    expect(isKnownPath('/session/42')).toBe(true);
  });

  it('rejects multi-segment /session/<a>/<b>', () => {
    expect(isKnownPath('/session/abc/extra')).toBe(false);
  });

  it('rejects /session/ with no id', () => {
    expect(isKnownPath('/session/')).toBe(false);
  });

  it('rejects /studyxyz (prefix false positive)', () => {
    expect(isKnownPath('/studyxyz')).toBe(false);
  });

  it('rejects /admin/nonexistent', () => {
    expect(isKnownPath('/admin/nonexistent')).toBe(false);
  });

  it('rejects /study/nonexistent', () => {
    expect(isKnownPath('/study/nonexistent')).toBe(false);
  });

  it('rejects completely unknown paths', () => {
    expect(isKnownPath('/foobar')).toBe(false);
    expect(isKnownPath('/random/path')).toBe(false);
  });

  it('normalizes trailing slashes', () => {
    expect(isKnownPath('/study/')).toBe(true);
    expect(isKnownPath('/practice/')).toBe(true);
  });

  it('accepts legacy redirect paths that are in the registry', () => {
    expect(isKnownPath('/study/reference')).toBe(true);
    expect(isKnownPath('/study/toolkit')).toBe(true);
    expect(isKnownPath('/study/main-session')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. All training mode routes are valid known paths
// ---------------------------------------------------------------------------

describe('Training mode routes', () => {
  it('every TRAINING_MODE entry has a unique route', () => {
    const routes = TRAINING_MODES.map((m) => m.route);
    const unique = new Set(routes);
    expect(unique.size).toBe(routes.length);
  });

  it('every TRAINING_MODE route is a known path', () => {
    for (const mode of TRAINING_MODES) {
      expect(
        isKnownPath(mode.route),
        `mode ${mode.id} route ${mode.route} should be known`
      ).toBe(true);
    }
  });

  it('all routes start with /', () => {
    for (const mode of TRAINING_MODES) {
      expect(
        mode.route.startsWith('/'),
        `mode ${mode.id} route should start with /`
      ).toBe(true);
    }
  });

  it('private-beta visible mode CTAs resolve only to known, real-mounted routes', () => {
    for (const mode of filterPrivateBetaModes(TRAINING_MODES)) {
      const readiness = getModeReadiness(mode.id);
      expect(isKnownPath(mode.route), `mode ${mode.id} route ${mode.route} should be known`).toBe(true);
      expect(readiness.mountedComponent, `mode ${mode.id} should not point at productionDeferred`).toBe('real');
    }
  });

  it('cram_mode has a route in TRAINING_MODES', () => {
    const cram = TRAINING_MODES.find((m) => m.id === 'cram_mode');
    expect(cram).toBeDefined();
    expect(cram!.route).toBe('/modes/cram-mode');
  });

  it('medical_wordle has a route in TRAINING_MODES', () => {
    const wordle = TRAINING_MODES.find((m) => m.id === 'medical_wordle');
    expect(wordle).toBeDefined();
    expect(wordle!.route).toBe('/modes/medical-wordle');
  });

  it('core_adaptive route matches ROUTES constant', () => {
    const core = TRAINING_MODES.find((m) => m.id === 'core_adaptive');
    expect(core).toBeDefined();
    expect(core!.route).toBe(ROUTES.CORE_ADAPTIVE);
  });
});

// ---------------------------------------------------------------------------
// 3. Registry completeness
// ---------------------------------------------------------------------------

describe('Route registry completeness', () => {
  it('ROUTE_REGISTRY has entries for all TRAINING_MODES', () => {
    const registryPaths = new Set(ROUTE_REGISTRY.map((r) => r.path));
    for (const mode of TRAINING_MODES) {
      expect(
        registryPaths.has(mode.route),
        `registry missing route for mode ${mode.id}: ${mode.route}`
      ).toBe(true);
    }
  });

  it('every route in the registry that has a view resolves via getViewForPath', () => {
    for (const entry of ROUTE_REGISTRY) {
      if (entry.view && !entry.path.includes(':')) {
        const resolved = getViewForPath(entry.path);
        expect(
          resolved,
          `getViewForPath(${entry.path}) should return ${entry.view}`
        ).toBe(entry.view);
      }
    }
  });

  it('MODES_WITH_DEDICATED_ROUTES includes cram_mode', () => {
    expect(MODES_WITH_DEDICATED_ROUTES).toContain('cram_mode');
  });

  it('MODES_WITH_DEDICATED_ROUTES includes medical_wordle', () => {
    expect(MODES_WITH_DEDICATED_ROUTES).toContain('medical_wordle');
  });
});

// ---------------------------------------------------------------------------
// 4. Deprecated constants are gone
// ---------------------------------------------------------------------------

describe('Deprecated route constants cleanup', () => {
  it('ROUTES object does not have STUDY_REFERENCE', () => {
    expect('STUDY_REFERENCE' in ROUTES).toBe(false);
  });

  it('ROUTES object does not have STUDY_TOOLKIT', () => {
    expect('STUDY_TOOLKIT' in ROUTES).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. getViewForPath — correct view resolution
// ---------------------------------------------------------------------------

describe('getViewForPath', () => {
  it('returns null for React Router-only routes (no view)', () => {
    expect(getViewForPath('/practice')).toBeNull();
    expect(getViewForPath('/progress')).toBeNull();
    expect(getViewForPath('/daily-challenges')).toBeNull();
    expect(getViewForPath('/clinical-eye')).toBeNull();
    expect(getViewForPath('/visualizer')).toBeNull();
  });

  it('returns correct views for view-state routes', () => {
    expect(getViewForPath('/study')).toBe('command_center');
    expect(getViewForPath('/study/knowledge')).toBeNull(); // migrated to React Router
    expect(getViewForPath('/study/utilities')).toBeNull(); // migrated to React Router
    expect(getViewForPath('/study/path')).toBeNull(); // migrated to React Router
    expect(getViewForPath('/gap-analysis')).toBeNull(); // migrated to React Router
    expect(getViewForPath('/menu')).toBe('menu');
  });

  it('returns session_runner for dynamic session routes', () => {
    expect(getViewForPath('/session/abc123')).toBe('session_runner');
    expect(getViewForPath('/session/xyz')).toBe('session_runner');
  });

  it('returns null for unknown paths', () => {
    expect(getViewForPath('/unknown')).toBeNull();
    expect(getViewForPath('/admin/nonexistent')).toBeNull();
  });

  it('resolves training mode routes to their mode id as view', () => {
    expect(getViewForPath('/modes/ecg-drill')).toBe('ecg_drill');
    expect(getViewForPath('/modes/derm-drill')).toBe('derm_drill');
    expect(getViewForPath('/modes/cram-mode')).toBe('cram_mode');
    expect(getViewForPath('/modes/medical-wordle')).toBe('medical_wordle');
    expect(getViewForPath('/core-adaptive')).toBe('core_adaptive');
  });
});
