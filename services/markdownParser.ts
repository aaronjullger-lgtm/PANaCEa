import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { toString } from "mdast-util-to-string";
import type { Content, List, ListItem, Root } from "mdast";

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

const clinicalTerms = [
  /\b(Aspirin|Metoprolol|Labetalol|Carvedilol|Hydralazine|Nitroglycerin|Furosemide|Lasix|Insulin|Dextrose|Calcium gluconate|Albuterol|Heparin|Warfarin|Apixaban|Rivaroxaban|Patiromer|Kayexalate)\b/gi,
  /\b(Cr|BUN|K\+|Na\+|BNP|pH|ABG|HCO3|PaO2|PaCO2|TSH|T4|T3|B12|Folate|ANA|RF|ESR|CRP|ALT|AST|ALP|GGT|LDH)\b/gi,
];

const mnemonicLetter = /^\s*[AEIOU]:/i;

function shouldBoldTerm(term: string): boolean {
  if (!term) return false;
  return /[A-Z]/.test(term) || /\d/.test(term) || term.length >= 5;
}

function boldSpecialTokens(text: string): string {
  let result = text;

  result = result.replace(/\*\*([^*]+)\*\*:/g, "**$1:**");

  result = result.replace(/\*([A-Za-z0-9+/()'\-\s]{2,})\*/g, (_match, term: string) => {
    return shouldBoldTerm(term.trim()) ? `**${term.trim()}**` : term;
  });

  clinicalTerms.forEach((pattern) => {
    result = result.replace(pattern, "**$1**");
  });

  result = result.replace(/\b([AEIOU]):/g, "**$1:**");

  result = result.replace(/(^|\s)([A-Z][A-Za-z0-9 /+()'\-]{2,40}?):/g, (_match, prefix: string, label: string) => {
    if (/^\*\*/.test(label)) return `${prefix}${label}:`;
    return `${prefix}**${label}:**`;
  });

  return result;
}

function preprocess(text: string): string {
  let formatted = text.replace(/\r\n/g, "\n");

  formatted = formatted.replace(/([.!?])\s+-\s+/g, "$1\n- ");
  formatted = formatted.replace(/\s--\s+/g, "\n- ");
  formatted = formatted.replace(/:\s*\n-\s/g, ":\n - ");
  formatted = formatted.replace(/(^|\n)-\s*\*\s+/g, "$1  - ");
  formatted = formatted.replace(/- \*\*([^:]+):\*\*/g, "- **$1:**");

  return formatted;
}

function extractText(node: Content): string {
  return boldSpecialTokens(toString(node).trim());
}

function parseList(list: List, level: number): BulletNode[] {
  return list.children.map((item) => parseListItem(item as ListItem, level)).filter(Boolean) as BulletNode[];
}

function parseListItem(listItem: ListItem, level: number): BulletNode | null {
  const texts: string[] = [];
  const childLists: List[] = [];

  listItem.children.forEach((child) => {
    if (child.type === "list") {
      childLists.push(child as List);
      return;
    }

    if ((child as Content).type) {
      const value = extractText(child as Content);
      if (value) texts.push(value);
    }
  });

  const combined = texts.join(" ").replace(/\s+/g, " ").trim();
  if (!combined) return null;

  const isMnemonic = mnemonicLetter.test(combined);
  const node: BulletNode = {
    text: boldSpecialTokens(combined),
    children: childLists.flatMap((child) => parseList(child, Math.min(level + 1, 2))),
  };

  if (isMnemonic && node.children.length === 0) {
    node.children = [];
  }

  return node;
}

function paragraphToBullets(content: Content): BulletNode[] {
  const text = boldSpecialTokens(toString(content).trim());
  if (!text) return [];

  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z(])/);
  if (sentences.length === 1) {
    return [
      {
        text,
        children: [],
      },
    ];
  }

  return sentences
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .map((sentence) => ({ text: sentence, children: [] }));
}

function nestHeaders(nodes: BulletNode[]): BulletNode[] {
  const result: BulletNode[] = [];
  let currentHeader: BulletNode | null = null;

  nodes.forEach((node) => {
    const hasHeaderCue =
      /:\s*$/.test(node.text) || /^\*\*[^*]+:\*\*/.test(node.text);
    const normalizedChildren = node.children.length
      ? nestHeaders(node.children)
      : [];

    if (hasHeaderCue) {
      const headerNode: BulletNode = {
        ...node,
        text: boldSpecialTokens(node.text),
        children: normalizedChildren,
      };
      result.push(headerNode);
      currentHeader = headerNode;
      return;
    }

    if (currentHeader) {
      currentHeader.children.push({ ...node, children: normalizedChildren });
      return;
    }

    result.push({ ...node, children: normalizedChildren });
    currentHeader = null;
  });

  return result;
}

export function parseMarkdownToBullets(text: string | undefined | null): BulletNode[] {
  if (!text) return [];
  const normalizedText = preprocess(text);
  const tree = unified().use(remarkParse).use(remarkGfm).parse(normalizedText) as Root;

  const bullets: BulletNode[] = [];

  tree.children.forEach((node) => {
    if (node.type === "list") {
      bullets.push(...parseList(node as List, 0));
    } else if (node.type === "paragraph") {
      bullets.push(...paragraphToBullets(node as Content));
    }
  });

  if (bullets.length === 0 && normalizedText.trim()) {
    return normalizedText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ text: boldSpecialTokens(line), children: [] }));
  }

  return nestHeaders(bullets);
}

export function parseArrayToBullets(values: string[] | undefined | null): BulletNode[] {
  if (!values) return [];
  const initial = values
    .filter(Boolean)
    .map((entry) => ({ text: boldSpecialTokens(entry.trim()), children: [] }));

  return nestHeaders(initial);
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
