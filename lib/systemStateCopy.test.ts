import { describe, expect, it } from 'vitest';
import {
  formatSystemToastMessage,
  getCalmSystemCopy,
  getClinicalLoadingMessage,
  looksLikeRawError,
} from './systemStateCopy';

describe('systemStateCopy', () => {
  it('normalizes raw recommendation failures into calm recovery copy', () => {
    const copy = getCalmSystemCopy('Failed to load recommendations: HTTP 500');

    expect(copy.title).toBe('Recommendations unavailable.');
    expect(copy.description).toBe('Your progress is safe. Retry or start a default mixed block.');
  });

  it('normalizes sync failures without exposing raw phrasing', () => {
    const message = formatSystemToastMessage('Sync failed: TypeError stack trace');

    expect(message).toContain('Sync paused.');
    expect(message).toContain("We'll sync automatically");
    expect(message).not.toMatch(/TypeError|stack trace|failed/i);
  });

  it('cycles intelligent loading messages deterministically', () => {
    expect(getClinicalLoadingMessage(0)).toBe('Building your next move...');
    expect(getClinicalLoadingMessage(1)).toBe('Checking review timing...');
    expect(getClinicalLoadingMessage(2)).toBe('Prioritizing missed patterns...');
    expect(getClinicalLoadingMessage(3)).toBe('Balancing blueprint coverage...');
    expect(getClinicalLoadingMessage(4)).toBe('Building your next move...');
  });

  it('detects raw error phrasing that should not be shown directly', () => {
    expect(looksLikeRawError('Failed to fetch daily load')).toBe(true);
    expect(looksLikeRawError('Recommendations unavailable.')).toBe(false);
  });
});
