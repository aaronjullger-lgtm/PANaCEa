// lib/services/semanticValidationService.ts
// Semantic validation for short-answer drills with caching and AI fallback

interface SemanticValidationResult {
  isEquivalent: boolean;
  viaModel: boolean; // true when AI judge was used
}

class SemanticValidationService {
  private cache = new Map<string, boolean>();

  private fillerWords = ['acute', 'chronic', 'mild', 'severe', 'disease', 'syndrome'];

  private normalize(text: string): string {
    if (!text) return '';
    const lower = text.toLowerCase();
    const withoutPunct = lower.replace(/[.,/#!$%^&*;:{}=_`~()-]/g, ' ');
    const removedFillers = this.fillerWords.reduce((acc, word) => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      return acc.replace(regex, ' ');
    }, withoutPunct);
    return removedFillers
      .replace(/\b(the|a|an|of|and)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getCacheKey(a: string, b: string): string {
    return `${this.normalize(a)}::${this.normalize(b)}`;
  }

  async validate(userInput: string, correctAnswer: string): Promise<SemanticValidationResult> {
    const normalizedUser = this.normalize(userInput);
    const normalizedCorrect = this.normalize(correctAnswer);

    // Fast path
    if (normalizedUser && normalizedUser === normalizedCorrect) {
      return { isEquivalent: true, viaModel: false };
    }

    const cacheKey = this.getCacheKey(userInput, correctAnswer);
    if (this.cache.has(cacheKey)) {
      return { isEquivalent: this.cache.get(cacheKey) ?? false, viaModel: true };
    }

    // Slow path: AI judge via Gemini proxy
    const prompt = `Are the following two medical terms clinically equivalent in the context of a short-answer quiz?\nTerm A: ${userInput}\nTerm B: ${correctAnswer}\nReply ONLY with 'YES' or 'NO'.`;

    try {
      const response = await fetch('/geminiProxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelName: 'gemini-1.5-flash',
          prompt,
          temperature: 0,
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini proxy error: ${response.status}`);
      }

      const data: any = await response.json();
      const raw = typeof data === 'string' ? data : data.text;
      const verdict = (raw || '').toString().trim().toUpperCase();
      const isYes = verdict === 'YES';
      this.cache.set(cacheKey, isYes);
      return { isEquivalent: isYes, viaModel: true };
    } catch (error) {
      console.error('Semantic validation failed:', error);
      return { isEquivalent: false, viaModel: true };
    }
  }
}

export const semanticValidationService = new SemanticValidationService();
