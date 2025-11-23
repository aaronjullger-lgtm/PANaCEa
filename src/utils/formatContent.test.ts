import assert from "node:assert/strict";
import test from "node:test";

import { formatContent } from "./formatContent";

test("converts leading hyphens to markdown bullets", () => {
  const input = "Overview: - first point";
  assert.equal(formatContent(input), "Overview:\n- first point");
});

test("does not break hyphenated names", () => {
  const input = "Use anti-inflammatory ibuprofen-like meds";
  assert.equal(formatContent(input), input);
});

test("indents bold label bullets", () => {
  const input = "- **Important** detail";
  assert.equal(formatContent(input), "\n  - **Important** detail".trimStart());
});
