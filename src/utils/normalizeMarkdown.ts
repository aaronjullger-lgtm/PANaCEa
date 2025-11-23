import type { Content, List, ListItem, Parent, Paragraph, Root } from "mdast";
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

const applyColonBolding = (paragraph: Paragraph) => {
  const firstChild = paragraph.children[0];

  if (!firstChild || firstChild.type === "strong") {
    return;
  }

  if (firstChild.type === "text") {
    const value = firstChild.value ?? "";
    const colonIndex = value.indexOf(":");

    if (colonIndex === -1) {
      return;
    }

    const leading = value.slice(0, colonIndex).trim();

    if (!leading) {
      return;
    }

    const afterColon = value.slice(colonIndex + 1);
    const rest = afterColon.replace(/^\s+/, " ");

    const newChildren: Paragraph["children"] = [
      {
        type: "strong",
        children: [{ type: "text", value: `${leading}:` }],
      },
    ];

    if (rest.length > 0) {
      newChildren.push({ type: "text", value: rest });
    }

    newChildren.push(...paragraph.children.slice(1));
    paragraph.children = newChildren;
  }
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
      if (child.type === "paragraph") {
        applyColonBolding(child);
      } else if (child.type === "list") {
        normalizeList(child);
      } else if (isParentNode(child)) {
        traverseTree(child);
      }
    }
  }
};

const traverseTree = (tree: Parent | Root) => {
  for (const child of tree.children) {
    if (child.type === "paragraph") {
      applyColonBolding(child);
    }

    if (child.type === "list") {
      normalizeList(child as List);
      continue;
    }

    if (isParentNode(child)) {
      traverseTree(child);
    }
  }
};

export const normalizeMarkdown: Plugin<[], Root> = function () {
  return (tree) => {
    traverseTree(tree);
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
