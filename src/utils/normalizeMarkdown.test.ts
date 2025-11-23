import assert from "assert";
import type { List } from "mdast";
import { normalizeMarkdown, normalizeMarkdownTree } from "./normalizeMarkdown";
import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";

describe("normalizeMarkdown", () => {
  it("nests subsequent items under bold parents", () => {
    const tree = normalizeMarkdownTree(
      "- **Important** detail\n- follow up\n- another\n- **Next** item\n- child"
    );
    const list = tree.children[0] as List;

    assert.equal(list.children.length, 2);

    const firstParent = list.children[0];
    const nestedFirst = firstParent.children.find(
      (child) => child.type === "list"
    ) as List;

    assert.ok(nestedFirst);
    assert.equal(nestedFirst.children.length, 2);

    const secondParent = list.children[1];
    const nestedSecond = secondParent.children.find(
      (child) => child.type === "list"
    ) as List;

    assert.ok(nestedSecond);
    assert.equal(nestedSecond.children.length, 1);
  });

  it("keeps standalone bullets when no bold headers are present", () => {
    const tree = normalizeMarkdownTree("- first point\n- second point");
    const list = tree.children[0] as List;

    assert.equal(list.children.length, 2);
    assert.ok(list.children.every((item) => item.type === "listItem"));
  });

  it("integrates as a remark plugin without removing text content", () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(normalizeMarkdown);

    const processed = processor.processSync(
      "- **Bold** parent\n- child text continues"
    );

    assert.ok(processed.value.toString().includes("child text"));
  });

  it("auto-bolds colon-prefixed paragraphs", () => {
    const tree = normalizeMarkdownTree("Leading phrase: details follow");
    const paragraph = tree.children[0];

    assert.equal(paragraph.type, "paragraph");
    const [firstChild] = (paragraph as any).children;

    assert.equal(firstChild.type, "strong");
    assert.equal(firstChild.children[0].value, "Leading phrase:");
  });
});
