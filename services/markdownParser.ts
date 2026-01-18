export type TextPart = { type: 'text' | 'strong' | 'em'; value: string };

export interface BulletNode {
  parts: TextPart[];
  children: BulletNode[];
}

export interface ParsedSection {
  id: string;
  title: string;
  accent?: 'danger' | 'default';
  bullets: BulletNode[];
}

const KEYWORD_LABELS = [
  'General',
  'Volume Overload',
  'Volume Depletion',
  'Specific Clues to Etiology',
  'Hyperkalemia',
  'Indications (Mnemonic: AEIOU)',
  'A',
  'E',
  'I',
  'O',
  'U',
  'Gold Standard',
  'Screening',
  'Race',
  'Risk Factors',
];

const clinicalTerms = [
  /\b(Aspirin|Metoprolol|Labetalol|Carvedilol|Hydralazine|Nitroglycerin|Furosemide|Lasix|Insulin|Dextrose|Calcium gluconate|Albuterol|Heparin|Warfarin|Apixaban|Rivaroxaban|Patiromer|Kayexalate)\b/gi,
  /\b(Cr|BUN|K\+|Na\+|BNP|pH|ABG|HCO3|PaO2|PaCO2|TSH|T4|T3|B12|Folate|ANA|RF|ESR|CRP|ALT|AST|ALP|GGT|LDH)\b/gi,
  /\b(ACE|ARB|ACEi|ARBs|DO NOT|Emergent|Urgent)\b/gi,
];

interface RawBullet {
  text: string;
  indentLevel: number;
  isHeader: boolean;
  keywordMatch?: string;
}

function stripFormatting(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .trim();
}

function preprocess(text: string): string {
  let formatted = text.replace(/\r\n/g, '\n');

  formatted = formatted.replace(/(^|\n)\*\s+/g, '$1- ');

  return formatted;
}

function applyClinicalBolding(text: string): string {
  let result = text;

  clinicalTerms.forEach((pattern) => {
    result = result.replace(pattern, '**$1**');
  });

  return result.replace(
    /^(\s*)([A-Z][A-Za-z0-9 /+()'\-]{2,40}?)(:\s+|\s+—\s+)?/,
    (_match, prefix: string, label: string, delimiter: string | undefined) => {
      return `${prefix}**${label.trim()}**${delimiter ?? ' '}`;
    }
  );
}

function emphasizeLeadingKeyword(text: string, keyword: string): string {
  const escaped = keyword.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}\b:?\s*(.*)$`, 'i');
  const match = text.match(pattern);
  if (!match) return applyClinicalBolding(text);

  const rest = match[1].trim();
  const dash = rest ? ' — ' : '';
  return `**${keyword}**${dash}${applyClinicalBolding(rest)}`.trim();
}

function formatTextParts(raw: string, keyword?: string): { parts: TextPart[]; isHeader: boolean } {
  const cleaned = stripFormatting(raw);
  const colonMatch = cleaned.match(/^([^:]+):\s*(.*)$/);
  const parts: TextPart[] = [];

  const isSecondaryLabel = colonMatch
    ? /\b(Prevalence|Type\s*\d|Stage|Classification|Category)\b/i.test(colonMatch[1])
    : false;

  if (colonMatch) {
    const label = colonMatch[1].trim();
    const rest = colonMatch[2].trim();
    parts.push({ type: isSecondaryLabel ? 'em' : 'strong', value: `${label}:` });
    if (rest) {
      parts.push(...toParts(` ${applyClinicalBolding(rest)}`));
    }
    return { parts, isHeader: true };
  }

  const emphasized = keyword
    ? emphasizeLeadingKeyword(cleaned, keyword)
    : applyClinicalBolding(cleaned);
  const textParts = toParts(emphasized);
  return { parts: textParts, isHeader: false };
}

function toParts(text: string): TextPart[] {
  const parts: TextPart[] = [];
  const boldPattern = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = boldPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'strong', value: match[1] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return parts;
}

function extractLines(text: string): RawBullet[] {
  const normalized = preprocess(text);
  const lines = normalized.split(/\n+/);

  const rawBullets: RawBullet[] = [];

  lines.forEach((line) => {
    if (!line.trim()) return;

    const indentMatch = line.match(/^(\s*)/);
    const indentLevel = Math.min(Math.floor((indentMatch?.[0].length ?? 0) / 2), 2);

    const cleaned = line.replace(/^\s*[-*]\s*/, '').trim();
    if (!cleaned) return;

    const keywordMatch = KEYWORD_LABELS.find((label) =>
      new RegExp(`^${label.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\b:?`, 'i').test(cleaned)
    );

    const isHeader = /:\s*$/.test(cleaned) || Boolean(keywordMatch);

    rawBullets.push({
      text: cleaned,
      indentLevel,
      isHeader,
      keywordMatch,
    });
  });

  return rawBullets;
}

function buildHierarchy(rawBullets: RawBullet[]): BulletNode[] {
  const roots: BulletNode[] = [];
  const stack: BulletNode[] = [];
  let headerParent: { node: BulletNode; level: number } | null = null;

  rawBullets.forEach((raw) => {
    while (stack.length > raw.indentLevel) {
      stack.pop();
    }

    const baseParent = stack[stack.length - 1];
    const headerLevel = headerParent?.level ?? null;
    const useHeaderParent = headerParent && (raw.indentLevel <= (headerLevel ?? 0) || !baseParent);

    const parent = useHeaderParent ? headerParent?.node : baseParent;

    const { parts, isHeader } = formatTextParts(raw.text, raw.keywordMatch);
    const node: BulletNode = {
      parts,
      children: [],
    };

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }

    const computedLevel = useHeaderParent
      ? Math.min((headerLevel ?? 0) + 1, 2)
      : Math.min(stack.length, 2);

    stack.push(node);

    if (isHeader) {
      headerParent = { node, level: computedLevel };
    }
  });

  return roots;
}

export function parseMarkdownToBullets(text: string | undefined | null): BulletNode[] {
  if (!text) return [];

  const rawBullets = extractLines(text);
  if (rawBullets.length === 0) return [];

  return buildHierarchy(rawBullets);
}

// Regex pattern to match sub-bullet entries that start with "* " or "*   "
const STRAY_ASTERISK_PATTERN = /^\*\s+/;

export function parseArrayToBullets(values: string[] | undefined | null): BulletNode[] {
  if (!values) return [];

  const text = values
    .filter(Boolean)
    .map((entry) => {
      const trimmed = entry.trim();
      // Detect entries that start with "* " or "*   " (sub-bullets from original markdown
      // that were stored as array elements with their markdown prefix intact).
      // Convert them to indented bullet points for proper nesting.
      if (STRAY_ASTERISK_PATTERN.test(trimmed)) {
        // Remove the leading "* " or "*   " and add proper indentation
        const cleaned = trimmed.replace(STRAY_ASTERISK_PATTERN, '').trim();
        return `  - ${cleaned}`;
      }
      return `- ${trimmed}`;
    })
    .join('\n');

  return parseMarkdownToBullets(text);
}

export function buildParsedSections(
  sections: {
    key: string;
    title: string;
    type: 'markdown' | 'list';
    value?: string;
    items?: string[];
    accent?: 'danger' | 'default';
  }[]
): ParsedSection[] {
  return sections.map((section) => ({
    id: section.key,
    title: section.title,
    accent: section.accent,
    bullets:
      section.type === 'markdown'
        ? parseMarkdownToBullets(section.value)
        : parseArrayToBullets(section.items),
  }));
}
