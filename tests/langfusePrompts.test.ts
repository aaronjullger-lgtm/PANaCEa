/**
 * Tests for lib/observability/langfusePrompts.ts — versioned prompt management
 * with in-process cache, Langfuse fetch, and graceful fallback.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  compilePrompt,
  chatToText,
  getPrompt,
  invalidatePromptCache,
  listCachedPrompts,
  prefetchPrompts,
} from '../lib/observability/langfusePrompts';

// Mock Langfuse config/enabled gates so we control the fetch path.
const langfuseModule = vi.hoisted(() => ({
  isLangfuseEnabled: vi.fn(),
  getLangfuseConfig: vi.fn(),
}));

vi.mock('@/lib/agents/langfuse', () => langfuseModule);

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const BASE_CONFIG = {
  baseUrl: 'https://cloud.langfuse.com',
  publicKey: 'pk-test',
  secretKey: 'sk-test',
  enabled: true,
};

describe('compilePrompt', () => {
  it('substitutes double-brace variables', () => {
    expect(compilePrompt('Hello {{name}}', { name: 'Aaron' })).toBe('Hello Aaron');
  });

  it('substitutes single-brace variables', () => {
    expect(compilePrompt('Hello {name}', { name: 'Aaron' })).toBe('Hello Aaron');
  });

  it('supports spaces inside braces', () => {
    expect(compilePrompt('Hello {{ name }}', { name: 'Aaron' })).toBe('Hello Aaron');
  });

  it('supports numeric and boolean values', () => {
    expect(compilePrompt('x={{count}} y={{flag}}', { count: 3, flag: true })).toBe(
      'x=3 y=true'
    );
  });

  it('returns template unchanged when no variables given', () => {
    expect(compilePrompt('plain template')).toBe('plain template');
  });
});

describe('chatToText', () => {
  it('joins messages with blank lines', () => {
    expect(chatToText(['line one', 'line two'])).toBe('line one\n\nline two');
  });
});

describe('getPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    invalidatePromptCache();
  });

  afterEach(() => {
    invalidatePromptCache();
  });

  it('returns fallback when Langfuse disabled', async () => {
    langfuseModule.isLangfuseEnabled.mockReturnValue(false);

    const result = await getPrompt('missing', {
      fallbackText: 'fallback {{var}}',
      fallbackConfig: { temperature: 0.5 },
      variables: { var: 'value' },
    });

    expect(result).toEqual({
      text: 'fallback value',
      config: { temperature: 0.5 },
      version: 0,
      source: 'fallback',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws when no fallback and Langfuse disabled', async () => {
    langfuseModule.isLangfuseEnabled.mockReturnValue(false);

    await expect(getPrompt('missing')).rejects.toThrow(/not found and no fallback/);
  });

  it('fetches from Langfuse when enabled and caches result', async () => {
    langfuseModule.isLangfuseEnabled.mockReturnValue(true);
    langfuseModule.getLangfuseConfig.mockReturnValue(BASE_CONFIG);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        type: 'text',
        prompt: 'langfuse {{name}}',
        config: { temperature: 0.2, model: 'gemini-2.5-flash' },
        version: 7,
        labels: ['prod'],
      }),
    });

    const first = await getPrompt('tutor', { variables: { name: 'Aaron' } });
    expect(first).toEqual({
      text: 'langfuse Aaron',
      config: { temperature: 0.2, model: 'gemini-2.5-flash' },
      version: 7,
      source: 'langfuse',
    });

    // Second call must hit cache — no second fetch, source = cache.
    const second = await getPrompt('tutor', { variables: { name: 'Aaron' } });
    expect(second.source).toBe('cache');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('treats 404 as missing and falls back', async () => {
    langfuseModule.isLangfuseEnabled.mockReturnValue(true);
    langfuseModule.getLangfuseConfig.mockReturnValue(BASE_CONFIG);
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    const result = await getPrompt('ghost', { fallbackText: 'safe default' });
    expect(result.source).toBe('fallback');
    expect(result.text).toBe('safe default');
  });

  it('returns fallback on network error', async () => {
    langfuseModule.isLangfuseEnabled.mockReturnValue(true);
    langfuseModule.getLangfuseConfig.mockReturnValue(BASE_CONFIG);
    mockFetch.mockRejectedValue(new Error('network down'));

    const result = await getPrompt('flaky', { fallbackText: 'fallback' });
    expect(result.source).toBe('fallback');
    expect(result.text).toBe('fallback');
  });

  it('compiles chat-type prompts via chatToText', async () => {
    langfuseModule.isLangfuseEnabled.mockReturnValue(true);
    langfuseModule.getLangfuseConfig.mockReturnValue(BASE_CONFIG);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        type: 'chat',
        prompt: ['system: be concise', 'user: answer {{q}}'],
        config: {},
        version: 2,
        labels: [],
      }),
    });

    const result = await getPrompt('chatty', { variables: { q: 'hello' } });
    expect(result.text).toBe('system: be concise\n\nuser: answer hello');
  });

  it('prefetchPrompts settles even when prompts missing', async () => {
    langfuseModule.isLangfuseEnabled.mockReturnValue(false);

    await expect(prefetchPrompts(['a', 'b'])).resolves.toBeUndefined();
  });
});

describe('invalidatePromptCache', () => {
  it('clears named entry only', async () => {
    langfuseModule.isLangfuseEnabled.mockReturnValue(true);
    langfuseModule.getLangfuseConfig.mockReturnValue(BASE_CONFIG);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ type: 'text', prompt: 'p1', config: {}, version: 1, labels: [] }),
    });

    await getPrompt('keep');
    await getPrompt('drop');
    expect(listCachedPrompts()).toEqual(expect.arrayContaining(['keep:latest', 'drop:latest']));

    invalidatePromptCache('drop');
    expect(listCachedPrompts()).toEqual(['keep:latest']);

    invalidatePromptCache();
    expect(listCachedPrompts()).toEqual([]);
  });
});
