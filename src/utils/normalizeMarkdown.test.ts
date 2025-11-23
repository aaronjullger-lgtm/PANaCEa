import assert from "assert";
import type { List } from "mdast";
import { normalizeMarkdown, normalizeMarkdownTree } from "./normalizeMarkdown";

describe("normalizeMarkdown", () => {
  it("converts plain strings to markdown with normalized bullets", () => {
    const output = normalizeMarkdown("-dash\n--nested");

    assert.ok(output.includes("- dash"));
    assert.ok(output.includes("- nested"));
  });

  it("wraps string arrays as a single markdown list", () => {
    const tree = normalizeMarkdownTree(["Alpha", "Beta", "Gamma"]);
    const [list] = tree.children as List[];

    assert.equal(list.type, "list");
    assert.equal(list.children.length, 3);
  });

  it("preserves nested children written inside list items", () => {
    const markdown = normalizeMarkdown([
      "Parent item\n  - child one\n  - child two",
      "Second"
    ]);

    assert.ok(markdown.includes("- child one"));
    assert.ok(markdown.trim().startsWith("- Parent item"));
  });
});
