import assert from "node:assert/strict";
import test from "node:test";

import { SECTION_BREAK_TOKEN, renderMarkdownHtml } from "./markdown.ts";

test("renders paragraphs with preserved line breaks", () => {
  const input = "First line\nSecond line\n\nNext paragraph";
  const html = renderMarkdownHtml(input);
  assert.ok(html.includes("<p>First line<br />Second line</p>"));
  assert.ok(html.includes("<p>Next paragraph</p>"));
});

test("renders lists and section breaks", () => {
  const input = `Intro\n${SECTION_BREAK_TOKEN}\n- bullet one\n- bullet two`;
  const html = renderMarkdownHtml(input);
  assert.ok(html.includes("<hr"));
  assert.ok(html.includes("<ul>"));
  assert.ok(html.includes("<li>bullet one</li>"));
});
