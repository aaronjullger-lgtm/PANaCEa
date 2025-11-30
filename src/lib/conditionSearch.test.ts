import { describe, it, expect } from "vitest";

import { searchConditions } from "./conditionSearch.ts";

describe("conditionSearch", () => {
  it("fuzzy search matches minor typos", () => {
    const results = searchConditions("fibrilation");
    const top = results[0];
    expect(top).toBeDefined();
    expect(top.condition).toBe("Atrial Fibrillation");
  });

  it("returns empty array on blank query", () => {
    expect(searchConditions("   ")).toEqual([]);
  });
});
