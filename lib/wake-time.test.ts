import { describe, it, expect } from 'vitest';
import {
  parseTimeToMinutes,
  formatMinutesToTime,
  determineChronotype,
  calculateCognitiveWindows,
  getCognitiveState,
  getDailyStudySchedule,
  getOptimalExamTime,
  createDefaultPreferences,
  updatePreferences,
  serializePreferences,
  type Chronotype,
} from './wake-time';

// ─── parseTimeToMinutes ───────────────────────────────────────────────────────

describe('parseTimeToMinutes', () => {
  it('"00:00" → 0', () => {
    expect(parseTimeToMinutes('00:00')).toBe(0);
  });

  it('"01:00" → 60', () => {
    expect(parseTimeToMinutes('01:00')).toBe(60);
  });

  it('"07:30" → 450', () => {
    expect(parseTimeToMinutes('07:30')).toBe(450);
  });

  it('"23:59" → 1439', () => {
    expect(parseTimeToMinutes('23:59')).toBe(1439);
  });

  it('"08:15" → 495', () => {
    expect(parseTimeToMinutes('08:15')).toBe(495);
  });

  it('treats non-numeric parts as 0', () => {
    // Edge: invalid string falls back to NaN || 0 = 0
    expect(parseTimeToMinutes(':00')).toBe(0);
  });
});

// ─── formatMinutesToTime ──────────────────────────────────────────────────────

describe('formatMinutesToTime', () => {
  it('0 → "00:00"', () => {
    expect(formatMinutesToTime(0)).toBe('00:00');
  });

  it('450 → "07:30"', () => {
    expect(formatMinutesToTime(450)).toBe('07:30');
  });

  it('1439 → "23:59"', () => {
    expect(formatMinutesToTime(1439)).toBe('23:59');
  });

  it('wraps around: 1440 → "00:00"', () => {
    expect(formatMinutesToTime(1440)).toBe('00:00');
  });

  it('wraps around: 1500 → "01:00"', () => {
    expect(formatMinutesToTime(1500)).toBe('01:00');
  });

  it('negative wraps correctly: -60 → "23:00"', () => {
    expect(formatMinutesToTime(-60)).toBe('23:00');
  });

  it('is inverse of parseTimeToMinutes', () => {
    for (const t of ['00:00', '06:00', '07:30', '12:15', '23:45']) {
      expect(formatMinutesToTime(parseTimeToMinutes(t))).toBe(t);
    }
  });
});

// ─── determineChronotype ──────────────────────────────────────────────────────

describe('determineChronotype', () => {
  it('"05:00" (300 min) → early_bird', () => {
    expect(determineChronotype('05:00')).toBe('early_bird');
  });

  it('"06:00" (360 min) → early_bird (< 390)', () => {
    expect(determineChronotype('06:00')).toBe('early_bird');
  });

  it('"06:30" (390 min) → moderate_early (boundary, not < 390)', () => {
    expect(determineChronotype('06:30')).toBe('moderate_early');
  });

  it('"07:00" (420 min) → moderate_early', () => {
    expect(determineChronotype('07:00')).toBe('moderate_early');
  });

  it('"07:30" (450 min) → intermediate (boundary)', () => {
    expect(determineChronotype('07:30')).toBe('intermediate');
  });

  it('"08:00" (480 min) → intermediate', () => {
    expect(determineChronotype('08:00')).toBe('intermediate');
  });

  it('"08:30" (510 min) → moderate_late (boundary)', () => {
    expect(determineChronotype('08:30')).toBe('moderate_late');
  });

  it('"09:00" (540 min) → moderate_late', () => {
    expect(determineChronotype('09:00')).toBe('moderate_late');
  });

  it('"10:00" (600 min) → night_owl (boundary)', () => {
    expect(determineChronotype('10:00')).toBe('night_owl');
  });

  it('"11:00" → night_owl', () => {
    expect(determineChronotype('11:00')).toBe('night_owl');
  });
});

// ─── calculateCognitiveWindows ────────────────────────────────────────────────

describe('calculateCognitiveWindows', () => {
  it('peakStart is 2 hours after wake time', () => {
    const w = calculateCognitiveWindows('06:00');
    // 6:00 + 2h = 08:00
    expect(w.peakStart).toBe('08:00');
  });

  it('peakEnd is 4 hours after wake time', () => {
    const w = calculateCognitiveWindows('06:00');
    expect(w.peakEnd).toBe('10:00');
  });

  it('troughStart is 6 hours after wake time', () => {
    const w = calculateCognitiveWindows('06:00');
    expect(w.troughStart).toBe('12:00');
  });

  it('troughEnd is 8 hours after wake time', () => {
    const w = calculateCognitiveWindows('06:00');
    expect(w.troughEnd).toBe('14:00');
  });

  it('eveningStart is 10 hours after wake time', () => {
    const w = calculateCognitiveWindows('06:00');
    expect(w.eveningStart).toBe('16:00');
  });

  it('eveningEnd is 12 hours after wake time', () => {
    const w = calculateCognitiveWindows('06:00');
    expect(w.eveningEnd).toBe('18:00');
  });

  it('lateNightStart is 14 hours after wake time', () => {
    const w = calculateCognitiveWindows('06:00');
    expect(w.lateNightStart).toBe('20:00');
  });

  it('times wrap correctly for late wake: "10:00"', () => {
    const w = calculateCognitiveWindows('10:00');
    // peakStart = 10:00 + 2h = 12:00
    expect(w.peakStart).toBe('12:00');
    // eveningEnd = 10:00 + 12h = 22:00
    expect(w.eveningEnd).toBe('22:00');
    // lateNightStart = 10:00 + 14h = 00:00
    expect(w.lateNightStart).toBe('00:00');
  });
});

// ─── getCognitiveState ────────────────────────────────────────────────────────

describe('getCognitiveState', () => {
  /**
   * Build a Date at the given hours+minutes since the wake time.
   * wakeTime = "07:00" (420 min), offset adds to get current time.
   */
  function makeTimeAtOffset(wakeTime: string, offsetHours: number): Date {
    const wakeMin = parseTimeToMinutes(wakeTime);
    const currentMin = wakeMin + offsetHours * 60;
    const d = new Date(2025, 0, 1); // arbitrary date
    d.setHours(Math.floor(((currentMin % 1440) + 1440) % 1440 / 60));
    d.setMinutes(currentMin % 60);
    return d;
  }

  const WAKE = '07:00'; // 420 min

  it('before wake time → rest state', () => {
    const beforeWake = new Date(2025, 0, 1, 6, 0); // 06:00 < 07:00
    const result = getCognitiveState(WAKE, beforeWake);
    expect(result.cognitiveState).toBe('rest');
    expect(result.isOptimal).toBe(false);
  });

  it('0.5h after wake → good (still waking up)', () => {
    const result = getCognitiveState(WAKE, makeTimeAtOffset(WAKE, 0.5));
    expect(result.cognitiveState).toBe('good');
    expect(result.isOptimal).toBe(false);
  });

  it('2h after wake → peak', () => {
    const result = getCognitiveState(WAKE, makeTimeAtOffset(WAKE, 2));
    expect(result.cognitiveState).toBe('peak');
    expect(result.isOptimal).toBe(true);
  });

  it('3h after wake → peak', () => {
    const result = getCognitiveState(WAKE, makeTimeAtOffset(WAKE, 3));
    expect(result.cognitiveState).toBe('peak');
  });

  it('5h after wake → good', () => {
    const result = getCognitiveState(WAKE, makeTimeAtOffset(WAKE, 5));
    expect(result.cognitiveState).toBe('good');
    expect(result.isOptimal).toBe(true);
  });

  it('7h after wake → trough', () => {
    const result = getCognitiveState(WAKE, makeTimeAtOffset(WAKE, 7));
    expect(result.cognitiveState).toBe('trough');
    expect(result.isOptimal).toBe(false);
  });

  it('9h after wake → good (transitioning)', () => {
    const result = getCognitiveState(WAKE, makeTimeAtOffset(WAKE, 9));
    expect(result.cognitiveState).toBe('good');
    expect(result.isOptimal).toBe(false);
  });

  it('11h after wake → recovery', () => {
    const result = getCognitiveState(WAKE, makeTimeAtOffset(WAKE, 11));
    expect(result.cognitiveState).toBe('recovery');
    expect(result.isOptimal).toBe(true);
  });

  it('13h after wake → good (declining evening)', () => {
    const result = getCognitiveState(WAKE, makeTimeAtOffset(WAKE, 13));
    expect(result.cognitiveState).toBe('good');
    expect(result.isOptimal).toBe(false);
  });

  it('15h after wake → late_night', () => {
    const result = getCognitiveState(WAKE, makeTimeAtOffset(WAKE, 15));
    expect(result.cognitiveState).toBe('late_night');
    expect(result.isOptimal).toBe(false);
  });

  it('all states have stabilityModifier and confidence', () => {
    for (const offset of [0, 0.5, 2, 5, 7, 9, 11, 13, 15]) {
      const result = getCognitiveState(WAKE, makeTimeAtOffset(WAKE, offset));
      expect(result.stabilityModifier).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });
});

// ─── getDailyStudySchedule ────────────────────────────────────────────────────

describe('getDailyStudySchedule', () => {
  it('returns exactly 5 schedule blocks', () => {
    expect(getDailyStudySchedule('07:00')).toHaveLength(5);
  });

  it('each block has required fields', () => {
    for (const block of getDailyStudySchedule('07:00')) {
      expect(block).toHaveProperty('timeRange');
      expect(block).toHaveProperty('state');
      expect(block).toHaveProperty('recommendation');
      expect(block).toHaveProperty('priority');
    }
  });

  it('priority values are high/medium/low only', () => {
    for (const block of getDailyStudySchedule('07:00')) {
      expect(['high', 'medium', 'low']).toContain(block.priority);
    }
  });

  it('peak cognition block has high priority', () => {
    const schedule = getDailyStudySchedule('07:00');
    const peak = schedule.find(b => b.state === 'Peak Cognition');
    expect(peak).toBeDefined();
    expect(peak!.priority).toBe('high');
  });
});

// ─── getOptimalExamTime ───────────────────────────────────────────────────────

describe('getOptimalExamTime', () => {
  const cases: [Chronotype, string][] = [
    ['early_bird', '08:00-10:00'],
    ['moderate_early', '09:00-11:00'],
    ['intermediate', '10:00-12:00'],
    ['moderate_late', '11:00-13:00'],
    ['night_owl', '12:00-14:00'],
  ];

  for (const [chronotype, expected] of cases) {
    it(`${chronotype} → "${expected}"`, () => {
      expect(getOptimalExamTime(chronotype)).toBe(expected);
    });
  }

  it('later chronotypes have later optimal exam times', () => {
    const t = (s: string) => parseTimeToMinutes(s.split('-')[0]!);
    expect(t(getOptimalExamTime('night_owl'))).toBeGreaterThan(t(getOptimalExamTime('early_bird')));
  });
});

// ─── createDefaultPreferences ─────────────────────────────────────────────────

describe('createDefaultPreferences', () => {
  it('weekdayWakeTime is "07:30"', () => {
    expect(createDefaultPreferences().weekdayWakeTime).toBe('07:30');
  });

  it('weekendWakeTime is "08:30"', () => {
    expect(createDefaultPreferences().weekendWakeTime).toBe('08:30');
  });

  it('chronotype is intermediate', () => {
    expect(createDefaultPreferences().chronotype).toBe('intermediate');
  });

  it('irregularSchedule is false', () => {
    expect(createDefaultPreferences().irregularSchedule).toBe(false);
  });

  it('updatedAt is a valid ISO timestamp', () => {
    expect(() => new Date(createDefaultPreferences().updatedAt)).not.toThrow();
  });
});

// ─── updatePreferences ────────────────────────────────────────────────────────

describe('updatePreferences', () => {
  it('merges partial updates', () => {
    const base = createDefaultPreferences();
    const updated = updatePreferences(base, { irregularSchedule: true });
    expect(updated.irregularSchedule).toBe(true);
    expect(updated.weekdayWakeTime).toBe(base.weekdayWakeTime);
  });

  it('recalculates chronotype when weekdayWakeTime changes', () => {
    const base = createDefaultPreferences(); // intermediate (07:30)
    const updated = updatePreferences(base, { weekdayWakeTime: '05:30' });
    expect(updated.chronotype).toBe('early_bird');
  });

  it('updates updatedAt timestamp', () => {
    const base = createDefaultPreferences();
    const before = new Date(base.updatedAt).getTime();
    const updated = updatePreferences(base, {});
    const after = new Date(updated.updatedAt).getTime();
    expect(after).toBeGreaterThanOrEqual(before);
  });
});

// ─── serializePreferences ─────────────────────────────────────────────────────

describe('serializePreferences', () => {
  it('serializes all fields', () => {
    const prefs = createDefaultPreferences();
    const serialized = serializePreferences(prefs);
    expect(serialized).toHaveProperty('weekdayWake', prefs.weekdayWakeTime);
    expect(serialized).toHaveProperty('weekendWake', prefs.weekendWakeTime);
    expect(serialized).toHaveProperty('irregular', prefs.irregularSchedule);
    expect(serialized).toHaveProperty('chronotype', prefs.chronotype);
    expect(serialized).toHaveProperty('updated');
  });

  it('studyStart is included (undefined if not set)', () => {
    const serialized = serializePreferences(createDefaultPreferences());
    expect('studyStart' in serialized).toBe(true);
  });
});
