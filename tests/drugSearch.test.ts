// tests/drugSearch.test.ts
// Tests for drug search functionality

import { describe, test, expect } from "vitest";
import {
  searchDrugs,
  findDrugByName,
  getDrugClassOptions,
  getDrugCount,
} from "../src/lib/drugSearch";

describe("Drug Search", () => {
  test("returns empty array on blank query", async () => {
    expect(await searchDrugs("")).toEqual([]);
    expect(await searchDrugs("   ")).toEqual([]);
  });

  test("finds drugs by exact name", async () => {
    const results = await searchDrugs("acetaminophen");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].drugName.toLowerCase()).toContain("acetaminophen");
  });

  test("finds drugs by partial name", async () => {
    const results = await searchDrugs("metop");
    expect(results.length).toBeGreaterThan(0);
    // Should find metoprolol
    const hasMetoprolol = results.some(r => 
      r.drugName.toLowerCase().includes("metop")
    );
    expect(hasMetoprolol).toBe(true);
  });

  test("finds drugs by class name", async () => {
    const results = await searchDrugs("SSRI");
    expect(results.length).toBeGreaterThan(0);
    // Should find SSRI drugs
    const hasSSRI = results.some(r => 
      r.drugClass.toLowerCase().includes("ssri") || 
      r.subclass.toLowerCase().includes("ssri")
    );
    expect(hasSSRI).toBe(true);
  });

  test("finds drug by name using findDrugByName", async () => {
    const drug = await findDrugByName("acetaminophen");
    expect(drug).toBeDefined();
    expect(drug?.term.toLowerCase()).toBe("acetaminophen");
  });

  test("returns undefined for non-existent drug", async () => {
    const drug = await findDrugByName("nonexistentdrugxyz123");
    expect(drug).toBeUndefined();
  });

  test("getDrugClassOptions returns array of class names", async () => {
    const classes = await getDrugClassOptions();
    expect(Array.isArray(classes)).toBe(true);
    expect(classes.length).toBeGreaterThan(0);
  });

  test("getDrugCount returns positive number", async () => {
    const count = await getDrugCount();
    expect(count).toBeGreaterThan(0);
  });

  test("search results have required properties", async () => {
    const results = await searchDrugs("aspirin");
    expect(results.length).toBeGreaterThan(0);
    
    const result = results[0];
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("drugName");
    expect(result).toHaveProperty("drugClass");
    expect(result).toHaveProperty("score");
  });

  test("limits results to maximum of 30", async () => {
    // Search for a very common term that should match many drugs
    const results = await searchDrugs("a");
    expect(results.length).toBeLessThanOrEqual(30);
  });

  test("sorts results by score descending", async () => {
    const results = await searchDrugs("metformin");
    if (results.length >= 2) {
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    }
  });
});
