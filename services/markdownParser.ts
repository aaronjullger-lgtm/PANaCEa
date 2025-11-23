import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { toString } from "mdast-util-to-string";
import type { Content, List, ListItem, Parent, Root } from "mdast";

export type ParsedItem =
  | { type: "bullet"; level: number; text: string }
  | { type: "mnemonic-header"; text: string };

export interface ParsedSection {
  id?: string;
  title: string;
  items: ParsedItem[];
  accent?: "danger" | "default";
}

const mnemonicHeaderPattern = /Indications\s*\(Mnemonic:[^)]+\)/i;
const mnemonicLetterPattern = /^[AEIOU]:/i;

const labPatterns = [
  /\b(Cr|BUN|K\+|Na\+|BNP|pH|ABG|HCO3|PaO2|PaCO2)\b/gi,
];

const medicationPatterns = [
  /\b(Aspirin|Metoprolol|Labetalol|Carvedilol|Hydralazine|Nitroglycerin|Furosemide|Lasix|Insulin|Dextrose|Calcium gluconate|Albuterol|Heparin|Warfarin|Apixaban|Rivaroxaban|Patiromer|Kayexalate)\b/gi,
];

const subheaderPattern = /(^|\s)([A-Z][A-Za-z0-9 /+()'-]{2,40}?):/g;

function preprocess(text: string): string {
  let formatted = text;
  formatted = formatted.replace(/([.!?])\s+-\s+/g, "$1\n- ");
  formatted = formatted.replace(
    /(-\s*Indications\s*\(Mnemonic:[^\n]*\):\s*\n)((?:-\s*[A-Z]:[^\n]*\n?)+)/g,
    (_match, header: string, block: string) => {
      const nestedBlock = block.replace(/-\s+([A-Z]:)/g, "  - $1");
      return header + nestedBlock;
    }
  );
  formatted = formatted.replace(/:\s*\n-\s/g, ":\n - ");
  formatted = formatted.replace(/- \*\*([^:]+):\*\*/g, "\n- $1:");
  return formatted;
}

function applyContextBold(text: string): string {
  let result = text;

  labPatterns.forEach((pattern) => {
    result = result.replace(pattern, "<strong>$1</strong>");
  });

  medicationPatterns.forEach((pattern) => {
    result = result.replace(pattern, "<strong>$1</strong>");
  });

  result = result.replace(/\b([AEIOU]):/g, "<strong>$1:</strong>");

  result = result.replace(subheaderPattern, (_match, prefix, label) => {
    if (label.startsWith("<strong>")) return `${prefix}${label}:`;
    return `${prefix}<strong>${label}:</strong>`;
  });

  return result;
}

function extractText(node: Content): string {
  return applyContextBold(toString(node).trim());
}

function parseList(list: List, level: number, items: ParsedItem[]): void {
  list.children.forEach((child) => parseListItem(child as ListItem, level, items));
}

function parseListItem(listItem: ListItem, level: number, items: ParsedItem[]): void {
  const childTexts: string[] = [];
  const nestedLists: List[] = [];

  (listItem.children as Content[]).forEach((child) => {
    if (child.type === "list") {
      nestedLists.push(child as List);
    } else if (child.type === "paragraph" || child.type === "text") {
      const text = extractText(child);
      if (text) childTexts.push(text);
    } else if ((child as Parent).children) {
      childTexts.push(extractText(child));
    }
  });

  const primaryText = childTexts.join(" ").trim();

  if (primaryText) {
    if (mnemonicHeaderPattern.test(primaryText)) {
      items.push({ type: "mnemonic-header", text: primaryText });
    } else {
      const isMnemonicLetter = mnemonicLetterPattern.test(primaryText);
      items.push({
        type: "bullet",
        level: isMnemonicLetter ? Math.max(level + 1, 2) : level,
        text: primaryText,
      });
    }
  }

  nestedLists.forEach((nested) => parseList(nested, level + 1, items));
}

export function parseMarkdownToItems(text: string | undefined | null): ParsedItem[] {
  if (!text) return [];
  const normalizedText = preprocess(text);
  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkBreaks)
    .parse(normalizedText) as Root;

  const items: ParsedItem[] = [];

  tree.children.forEach((node) => {
    if (node.type === "list") {
      parseList(node as List, 0, items);
    } else if (node.type === "paragraph") {
      const textValue = extractText(node as Content);
      if (textValue) {
        items.push({ type: "bullet", level: 0, text: textValue });
      }
    }
  });

  return items;
}

export function parseArrayItems(values: string[] | undefined | null): ParsedItem[] {
  if (!values) return [];
  return values
    .filter(Boolean)
    .map((entry) => ({
      type: "bullet" as const,
      level: 0,
      text: applyContextBold(entry.trim()),
    }));
}

export function buildParsedSections(
  sections: { key: string; title: string; type: "markdown" | "list"; value?: string; items?: string[]; accent?: "danger" | "default" }[]
): ParsedSection[] {
  return sections.map((section) => ({
    id: section.key,
    title: section.title,
    accent: section.accent,
    items:
      section.type === "markdown"
        ? parseMarkdownToItems(section.value)
        : parseArrayItems(section.items),
  }));
}
