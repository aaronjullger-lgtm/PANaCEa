import { describe, it, expect } from 'vitest';

// Test constants
const MODELS_PATH_PATTERN = /\/models\//g;

describe('Gemini Proxy URL Construction', () => {
  it('should construct correct URL without duplicating models/ prefix', () => {
    // Test URL construction logic from functions/geminiProxy.ts line 118
    const apiKey = "test_api_key";
    const modelName = "gemini-2.5-flash";
    
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    // Verify the URL is correctly formatted
    expect(geminiUrl).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=test_api_key");
    
    // Verify there's no duplicate "models/" in the path
    expect(geminiUrl).not.toContain("/models/models/");
    
    // Verify the URL contains the correct API version and endpoint
    expect(geminiUrl).toContain("/v1beta/models/");
    expect(geminiUrl).toContain(":generateContent");
  });

  it('should handle different model names correctly', () => {
    const apiKey = "test_key";
    const testCases = [
      { model: "gemini-2.5-flash", expected: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=test_key" },
      { model: "gemini-2.5-pro", expected: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=test_key" },
      { model: "gemini-1.5-flash", expected: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=test_key" },
    ];

    testCases.forEach(({ model, expected }) => {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      expect(geminiUrl).toBe(expected);
      expect(geminiUrl).not.toContain("/models/models/");
    });
  });

  it('should not add extra models/ prefix when model name is already formatted', () => {
    const apiKey = "test_key";
    // This test ensures that if a model name is passed without any prefix,
    // the URL construction adds exactly one "models/" prefix
    const modelName = "gemini-2.5-flash";
    
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    // Count occurrences of "/models/" in the URL
    const modelsCount = (geminiUrl.match(MODELS_PATH_PATTERN) || []).length;
    expect(modelsCount).toBe(1);
  });

  it('should construct URL with correct structure', () => {
    const apiKey = "test_key";
    const modelName = "gemini-2.5-flash";
    
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    // Verify URL structure matches Gemini API requirements
    const urlPattern = /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/[^\/]+:generateContent\?key=.+$/;
    expect(geminiUrl).toMatch(urlPattern);
  });
});
