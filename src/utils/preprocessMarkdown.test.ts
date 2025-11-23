import assert from "assert";
import { preprocessMarkdown } from "./preprocessMarkdown";

describe("preprocessMarkdown", () => {
  it("normalizes en/em dashes to hyphens", () => {
    assert.equal(preprocessMarkdown("– dash — test"), "- dash - test");
  });

  it("ensures bullets are followed by a space", () => {
    assert.equal(preprocessMarkdown("-item\n-next"), "- item\n- next");
  });

  it("collapses multiple spaces", () => {
    assert.equal(preprocessMarkdown("too   many   spaces"), "too many spaces");
  });
});
