/**
 * Safety helpers for retrieved memory context.
 *
 * Retrieved source text is untrusted. These helpers neutralize source-level
 * instructions before the text is inserted into model prompts while preserving
 * ordinary clinical content and citation metadata.
 */

export interface SanitizedMemoryText {
  text: string;
  flags: string[];
  mutated: boolean;
  originalLength: number;
}

interface InjectionPattern {
  flag: string;
  pattern: RegExp;
}

const ZERO_WIDTH_CHARS = /[\u200B-\u200D\uFEFF]/g;

const PROMPT_INJECTION_PATTERNS: InjectionPattern[] = [
  {
    flag: 'ignore_previous_instructions',
    pattern: /\bignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions\b/gi,
  },
  {
    flag: 'reveal_system_prompt',
    pattern:
      /\b(?:reveal|print|show|display|output)\s+(?:the\s+)?(?:system|developer)\s+prompt\b/gi,
  },
  {
    flag: 'role_override',
    pattern: /\byou\s+are\s+(?:now|no\s+longer)\s+[^.\n]{0,160}/gi,
  },
  {
    flag: 'citation_suppression',
    pattern: /\b(?:do\s+not|don't)\s+(?:cite|mention|attribute)\s+(?:the\s+)?source\b/gi,
  },
  {
    flag: 'secret_or_data_exfiltration',
    pattern:
      /\b(?:exfiltrate|leak|send|dump)\s+(?:the\s+)?(?:secrets?|api\s+keys?|tokens?|user\s+data|cache)\b/gi,
  },
  {
    flag: 'tool_or_cache_instruction',
    pattern:
      /\b(?:delete|modify|overwrite)\s+(?:the\s+)?(?:cache|memory|retrieval\s+index|vector\s+store|database)\b/gi,
  },
];

function replacementFor(flag: string): string {
  return `[removed unsafe source instruction: ${flag}]`;
}

function replaceUnsafeControlChars(value: string): string {
  let sanitized = '';

  for (const char of value) {
    const code = char.charCodeAt(0);
    sanitized +=
      code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127
        ? ' '
        : char;
  }

  return sanitized;
}

export function sanitizeRetrievedContextText(input: string): SanitizedMemoryText {
  const originalText = typeof input === 'string' ? input : '';
  const originalLength = originalText.length;
  let text = replaceUnsafeControlChars(String(input ?? '').replace(ZERO_WIDTH_CHARS, '')).trim();

  const flags = new Set<string>();

  for (const { flag, pattern } of PROMPT_INJECTION_PATTERNS) {
    pattern.lastIndex = 0;
    if (!pattern.test(text)) continue;

    pattern.lastIndex = 0;
    text = text.replace(pattern, () => {
      flags.add(flag);
      return replacementFor(flag);
    });
  }

  return {
    text,
    flags: [...flags].sort(),
    mutated: flags.size > 0 || text !== originalText,
    originalLength,
  };
}

export function formatMemorySafetyFlags(flags: string[]): string {
  if (flags.length === 0) return '';
  return `[Safety: removed unsafe source instruction patterns: ${flags.join(', ')}]`;
}
