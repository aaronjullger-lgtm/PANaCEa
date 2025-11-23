import assert from "assert";
import type { List } from "mdast";
import { normalizeMarkdown } from "./normalizeMarkdown";

describe("normalizeMarkdown", () => {
  it("nests subsequent items under bold parents", () => {
    const tree = normalizeMarkdown("- **Important** detail\n- follow up\n- another\n- **Next** item\n- child");
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
    const tree = normalizeMarkdown("- first point\n- second point");
    const list = tree.children[0] as List;

    assert.equal(list.children.length, 2);
    assert.ok(list.children.every((item) => item.type === "listItem"));
  });
});
