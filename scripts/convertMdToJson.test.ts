import assert from "node:assert/strict";
import test from "node:test";

import { SECTION_BREAK_TOKEN } from "../src/lib/markdown.ts";
import { cleanMultilineString } from "./convertMdToJson.ts";

test("preserves newlines while cleaning", () => {
  const input = "Line one with **bold**\nSecond line follows\n\nThird line";
  const result = cleanMultilineString(input);
  const parts = result.split("\n");

  assert.equal(parts[0], "Line one with **bold**");
  assert.equal(parts[1], "Second line follows");
  assert.equal(parts[2], "");
  assert.equal(parts[3], "Third line");
});

test("converts separator markers into tokens", () => {
  const input = "Paragraph one***";
  const result = cleanMultilineString(input);
  assert.ok(result.includes(SECTION_BREAK_TOKEN));
  assert.ok(result.includes("Paragraph one"));
});
