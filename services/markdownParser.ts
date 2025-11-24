export interface BulletNode {
  text: string;
  children: BulletNode[];
}

export interface ParsedSection {
  id: string;
  title: string;
  accent?: "danger" | "default";
  bullets: BulletNode[];
}

const KEYWORD_LABELS = [
  "General",
  "Volume Overload",
  "Volume Depletion",
  "Specific Clues to Etiology",
  "Hyperkalemia",
  "Indications (Mnemonic: AEIOU)",
  "A",
  "E",
  "I",
  "O",
  "U",
  "Gold Standard",
  "Screening",
  "Race",
  "Risk Factors",
];

const keywordPatterns = KEYWORD_LABELS.map(
  (label) => new RegExp(`^${label.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\b:?`, "i")
);

const clinicalTerms = [
  /\b(Aspirin|Metoprolol|Labetalol|Carvedilol|Hydralazine|Nitroglycerin|Furosemide|Lasix|Insulin|Dextrose|Calcium gluconate|Albuterol|Heparin|Warfarin|Apixaban|Rivaroxaban|Patiromer|Kayexalate)\b/gi,
  /\b(Cr|BUN|K\+|Na\+|BNP|pH|ABG|HCO3|PaO2|PaCO2|TSH|T4|T3|B12|Folate|ANA|RF|ESR|CRP|ALT|AST|ALP|GGT|LDH)\b/gi,
  /\b(ACE|ARB|ACEi|ARBs|DO NOT|Emergent|Urgent)\b/gi,
];

const mnemonicLetters = new Set(["A", "E", "I", "O", "U"]);

interface RawBullet {
  text: string;
  indentLevel: number;
  isHeader: boolean;
  keywordMatch?: string;
}

function boldSpecialTokens(text: string): string {
  let result = text;

  result = result.replace(/\*\*([^*]+)\*\*:/g, "**$1:**");

  result = result.replace(/\*([A-Za-z0-9+/()'\-\s]{2,})\*/g, (_match, term: string) => {
    const cleaned = term.trim();
    return cleaned.length > 1 ? `**${cleaned}**` : cleaned;
  });

  clinicalTerms.forEach((pattern) => {
    result = result.replace(pattern, "**$1**");
  });

  result = result.replace(/(^|\s)([A-Z][A-Za-z0-9 /+()'\-]{2,40}?):/g, (_match, prefix: string, label: string) => {
    if (/^\*\*/.test(label)) return `${prefix}${label}:`;
    return `${prefix}**${label}:**`;
  });

  return result;
}

function emphasizeKeyword(text: string, keyword?: string): string {
  if (!keyword) return boldSpecialTokens(text);
  const escaped = keyword.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const pattern = new RegExp(`^${escaped}:?\s*(.*)$`, "i");
  const match = text.match(pattern);
  if (!match) return boldSpecialTokens(text);

  const [, trailing] = match;
  const dash = trailing ? " — " : "";
  return `**${keyword}**${dash}${boldSpecialTokens(trailing)}`.trim();
}

function normalizeDenseParagraphs(text: string): string {
  const paragraphs = text.split(/\n{2,}/);
  const expanded = paragraphs.flatMap((para) => {
    const starCount = (para.match(/\*/g) || []).length;
    if (starCount > 4) {
      return para
        .split(/\s*\*\s+/)
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => `- ${part}`);
    }
    return [para];
  });

  return expanded.join("\n");
}

function preprocess(text: string): string {
  let formatted = text.replace(/\r\n/g, "\n");

  formatted = normalizeDenseParagraphs(formatted);
  formatted = formatted.replace(/([.!?])\s+-\s+/g, "$1\n- ");
  formatted = formatted.replace(/\s--\s+/g, "\n- ");
  formatted = formatted.replace(/(^|\n)\*\s+/g, "$1- ");
  formatted = formatted.replace(/(^|\n)\s*-\s*\*\s+/g, "$1  - ");

  return formatted;
}

function extractLines(text: string): RawBullet[] {
  const normalized = preprocess(text);
  const lines = normalized.split(/\n+/).map((line) => line.trimEnd());

  const rawBullets: RawBullet[] = [];

  lines.forEach((line) => {
    if (!line) return;

    const indentMatch = line.match(/^\s*/);
    const indentLevel = Math.min(Math.floor((indentMatch?.[0].length ?? 0) / 2), 2);

    const cleaned = line.replace(/^[-*]\s*/, "").trim();
    if (!cleaned) return;

    const keywordMatch = KEYWORD_LABELS.find((label, index) =>
      keywordPatterns[index].test(cleaned)
    );

    const isHeader = Boolean(keywordMatch && /:\s*/.test(cleaned));

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
  let headerParent: BulletNode | null = null;

  rawBullets.forEach((raw) => {
    while (stack.length > raw.indentLevel) {
      stack.pop();
    }

    const parentFromIndent = stack[stack.length - 1];
    let parent: BulletNode | undefined;

    if (parentFromIndent) {
      parent = parentFromIndent;
    } else if (
      headerParent &&
      (!raw.isHeader || mnemonicLetters.has((raw.keywordMatch || "").toUpperCase()))
    ) {
      parent = headerParent;
    }

    const node: BulletNode = {
      text: emphasizeKeyword(raw.text, raw.keywordMatch),
      children: [],
    };

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }

    if (raw.isHeader) {
      headerParent = node;
    }

    stack.push(node);
  });

  return roots;
}

export function parseMarkdownToBullets(text: string | undefined | null): BulletNode[] {
  if (!text) return [];

  const rawBullets = extractLines(text);
  if (rawBullets.length === 0) return [];

  return buildHierarchy(rawBullets);
}

export function parseArrayToBullets(values: string[] | undefined | null): BulletNode[] {
  if (!values) return [];

  const text = values
    .filter(Boolean)
    .map((entry) => `- ${entry.trim()}`)
    .join("\n");

  return parseMarkdownToBullets(text);
}

export function buildParsedSections(
  sections: {
    key: string;
    title: string;
    type: "markdown" | "list";
    value?: string;
    items?: string[];
    accent?: "danger" | "default";
  }[]
): ParsedSection[] {
  return sections.map((section) => ({
    id: section.key,
    title: section.title,
    accent: section.accent,
    bullets:
      section.type === "markdown"
        ? parseMarkdownToBullets(section.value)
        : parseArrayToBullets(section.items),
  }));
}
