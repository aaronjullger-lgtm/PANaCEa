import { describe, it, expect } from "vitest";
import { parseArrayToBullets } from "./markdownParser";

describe("parseArrayToBullets", () => {
  it("should not have stray * prefixes in parsed output", () => {
    const testData = [
      "**Structural Heart Disease:**",
      "*   Ischemic Heart Disease",
      "*   Hypertensive Heart Disease",
      "**Post-Cardiac Surgery:** Especially after procedures.",
    ];

    const result = parseArrayToBullets(testData);

    // Check that no stray asterisks appear in any bullet text
    function checkForStrayAsterisks(nodes: any[]): boolean {
      for (const node of nodes) {
        const text = node.parts.map((p: any) => p.value).join("");
        if (/^\*\s+/.test(text)) {
          return false;
        }
        if (node.children.length > 0 && !checkForStrayAsterisks(node.children)) {
          return false;
        }
      }
      return true;
    }

    expect(checkForStrayAsterisks(result)).toBe(true);
  });

  it("should handle entries without * prefixes normally", () => {
    const testData = [
      "First item",
      "Second item",
      "Third item",
    ];

    const result = parseArrayToBullets(testData);

    // Should have top-level bullets
    expect(result.length).toBeGreaterThan(0);
    
    // Check no stray asterisks
    for (const bullet of result) {
      const text = bullet.parts.map((p: any) => p.value).join("");
      expect(text.startsWith("*")).toBe(false);
    }
  });

  it("should create nesting for * prefixed sub-items", () => {
    const testData = [
      "**Header:**",
      "*   Sub item 1",
      "*   Sub item 2",
    ];

    const result = parseArrayToBullets(testData);

    // The header should have children (the sub-items)
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].children.length).toBeGreaterThan(0);
    
    // Sub-items should not have stray asterisks
    for (const child of result[0].children) {
      const text = child.parts.map((p: any) => p.value).join("");
      expect(text.startsWith("*")).toBe(false);
    }
  });
});
