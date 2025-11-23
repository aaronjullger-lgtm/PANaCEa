import type { List, ListItem, Paragraph, Root } from "mdast";
import { toMarkdown } from "mdast-util-to-markdown";
import { toString } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import preprocessMarkdown from "./preprocessMarkdown";

const processor = unified().use(remarkParse).use(remarkGfm);

const toParagraph = (value: string): Paragraph => ({
  type: "paragraph",
  children: [{ type: "text", value }],
});

const parseListItem = (value: string): ListItem => {
  const normalizedValue = preprocessMarkdown(value ?? "");
  const parsed = processor.parse(`- ${normalizedValue}`) as Root;
  const processed = processor.runSync(parsed) as Root;
  const listNode = processed.children.find(
    (child): child is List => child.type === "list"
  );

  if (listNode?.children?.length) {
    const [firstItem] = listNode.children;

    if (firstItem) {
      firstItem.spread = false;
      return firstItem;
    }
  }

  const textValue = toString(processed).trim() || normalizedValue;

  return {
    type: "listItem",
    spread: false,
    children: [toParagraph(textValue)],
  };
};

const buildListFromArray = (items: string[]): Root => ({
  type: "root",
  children: [
    {
      type: "list",
      ordered: false,
      spread: false,
      children: items.map((item) => parseListItem(item)),
    },
  ],
});

const normalizeHyphens = (text: string): string =>
  text
    .replace(/-\s{0,1}–/g, "- ")
    .replace(/(?<!\n)-\s+/g, "\n- ")
    .replace(/\n\s*-\s{2,}/g, "\n  - ")
    .replace(/\n\s{4,}-\s+/g, "\n    - ");

const normalizeTree = (input: string | string[]): Root => {
  if (Array.isArray(input)) {
    return buildListFromArray(input);
  }

  // Normalize incorrectly formatted hyphens into valid list markdown before parsing
  const hyphenNormalized = normalizeHyphens(input ?? "");
  const preprocessed = preprocessMarkdown(hyphenNormalized);
  const parsed = processor.parse(preprocessed) as Root;
  return processor.runSync(parsed) as Root;
};

export const normalizeMarkdown = (input: string | string[]): string => {
  const tree = normalizeTree(input);
  return toMarkdown(tree).trim();
};

export const normalizeMarkdownTree = (input: string | string[]): Root => {
  return normalizeTree(input);
};

export default normalizeMarkdown;
