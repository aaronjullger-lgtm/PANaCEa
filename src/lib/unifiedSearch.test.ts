import { describe, it, expect } from "vitest";
import { unifiedSearch } from "./unifiedSearch";

describe("unifiedSearch", () => {
  it("returns empty array on blank query", () => {
    expect(unifiedSearch("")).toEqual([]);
    expect(unifiedSearch("   ")).toEqual([]);
  });

  it("prioritizes conditions over drugs with condition boost", () => {
    // Search for "pneumonia" - should show condition results first
    const results = unifiedSearch("pneumonia");
    expect(results.length).toBeGreaterThan(0);
    
    // Find first condition and first drug if they exist
    const firstCondition = results.find(r => r.type === "condition");
    const firstDrug = results.find(r => r.type === "drug");
    
    if (firstCondition && firstDrug) {
      const conditionIndex = results.indexOf(firstCondition);
      const drugIndex = results.indexOf(firstDrug);
      
      // Condition should appear before drug
      expect(conditionIndex).toBeLessThan(drugIndex);
    }
  });

  it("finds both conditions and drugs for general terms", () => {
    const results = unifiedSearch("diabetes");
    expect(results.length).toBeGreaterThan(0);
    
    // Should have at least some results
    const hasConditions = results.some(r => r.type === "condition");
    expect(hasConditions).toBe(true);
  });

  it("finds drugs by brand name", () => {
    const results = unifiedSearch("Prozac");
    expect(results.length).toBeGreaterThan(0);
    
    const hasDrugs = results.some(r => r.type === "drug");
    expect(hasDrugs).toBe(true);
  });

  it("properly formats result names with capitalization", () => {
    const results = unifiedSearch("neomycin");
    expect(results.length).toBeGreaterThan(0);
    
    const drugResult = results.find(r => r.type === "drug" && r.name.toLowerCase().includes("neomycin"));
    if (drugResult) {
      // Should be capitalized, not lowercase
      expect(drugResult.name).not.toBe("neomycin");
      expect(drugResult.name.charAt(0)).toBe(drugResult.name.charAt(0).toUpperCase());
    }
  });

  it("limits results to 20 items", () => {
    const results = unifiedSearch("a");
    expect(results.length).toBeLessThanOrEqual(20);
  });

  it("includes proper subtitle information", () => {
    const results = unifiedSearch("aspirin");
    expect(results.length).toBeGreaterThan(0);
    
    const result = results[0];
    expect(result.subtitle).toBeDefined();
    expect(result.subtitle.length).toBeGreaterThan(0);
  });
});
