import type { Content, List, ListItem, Parent, Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { Plugin, unified } from "unified";

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

const isParentNode = (node: Content): node is Parent => {
  return typeof (node as Parent).children !== "undefined";
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

const normalizeLists = (tree: Parent | Root) => {
  for (const child of tree.children) {
    if (child.type === "list") {
      normalizeList(child as List);
    } else if (isParentNode(child)) {
      normalizeLists(child);
    }
  }
};

export const normalizeMarkdown: Plugin<[], Root> = function () {
  return (tree) => {
    normalizeLists(tree);
  };
};

export const normalizeMarkdownTree = (text: string): Root => {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(normalizeMarkdown);

  const tree = processor.parse(text) as Root;
  return processor.runSync(tree) as Root;
};

export default normalizeMarkdown;
