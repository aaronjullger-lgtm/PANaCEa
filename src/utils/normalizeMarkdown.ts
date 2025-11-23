import type { Content, List, ListItem, Parent, Root } from "mdast";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

const isStrongLeadingItem = (item: ListItem): boolean => {
  const firstChild = item.children[0];

  if (!firstChild) {
    return false;
  }

  if (firstChild.type === "paragraph") {
    const firstInline = firstChild.children.find((child) =>
      child.type !== "text" ? true : (child.value?.trim() ?? "") !== ""
    );

    return firstInline?.type === "strong";
  }

  return firstChild.type === "strong";
};

const ensureNestedList = (parent: ListItem, sourceList: List): List => {
  let nestedList = parent.children.find(
    (child): child is List => child.type === "list"
  );

  if (!nestedList) {
    nestedList = {
      type: "list",
      ordered: sourceList.ordered,
      spread: false,
      children: [],
    };
    parent.children.push(nestedList);
  }

  return nestedList;
};

const normalizeList = (list: List) => {
  const normalizedItems: ListItem[] = [];
  let currentParent: ListItem | null = null;

  for (const item of list.children) {
    if (isStrongLeadingItem(item)) {
      normalizedItems.push(item);
      currentParent = item;
      continue;
    }

    if (currentParent) {
      const nested = ensureNestedList(currentParent, list);
      nested.children.push(item);
      continue;
    }

    normalizedItems.push(item);
  }

  list.children = normalizedItems;

  for (const item of list.children) {
    for (const child of item.children) {
      if (child.type === "list") {
        normalizeList(child);
      } else if (isParentNode(child)) {
        normalizeLists(child);
      }
    }
  }
};

const isParentNode = (node: Content): node is Parent => {
  return typeof (node as Parent).children !== "undefined";
};

const normalizeLists = (tree: Parent | Root) => {
  for (const child of tree.children) {
    if (child.type === "list") {
      normalizeList(child);
    } else if (isParentNode(child)) {
      normalizeLists(child);
    }
  }
};

export const normalizeMarkdownTree = (text: string): Root => {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(text) as Root;

  normalizeLists(tree);

  return tree;
};

export const prepareMarkdown = (text: string): string => {
  const tree = normalizeMarkdownTree(text);
  const processor = unified()
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true });

  const transformed = processor.runSync(tree);
  return processor.stringify(transformed) as string;
};

export const normalizeMarkdown = (text: string): string => prepareMarkdown(text);

export default normalizeMarkdown;
