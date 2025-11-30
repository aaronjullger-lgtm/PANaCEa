import { describe, it, expect } from "vitest";

import { SECTION_BREAK_TOKEN } from "../src/lib/markdown.ts";
import { cleanMultilineString } from "./convertMdToJson.ts";

describe("convertMdToJson utilities", () => {
  it("preserves newlines while cleaning", () => {
    const input = "Line one with **bold**\nSecond line follows\n\nThird line";
    const result = cleanMultilineString(input);
    const parts = result.split("\n");

    expect(parts[0]).toBe("Line one with **bold**");
    expect(parts[1]).toBe("Second line follows");
    expect(parts[2]).toBe("");
    expect(parts[3]).toBe("Third line");
  });

  it("converts separator markers into tokens", () => {
    const input = "Paragraph one***";
    const result = cleanMultilineString(input);
    expect(result).toContain(SECTION_BREAK_TOKEN);
    expect(result).toContain("Paragraph one");
  });
});
