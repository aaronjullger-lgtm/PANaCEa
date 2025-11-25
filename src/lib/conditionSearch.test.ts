import assert from "node:assert/strict";
import test from "node:test";

import { searchConditions } from "./conditionSearch.ts";

test("fuzzy search matches minor typos", () => {
  const results = searchConditions("fibrilation");
  const top = results[0];
  assert.ok(top, "Expected at least one result");
  assert.equal(top.type, "condition");
  assert.equal(top.term, "Atrial Fibrillation");
});

test("returns empty array on blank query", () => {
  assert.deepEqual(searchConditions("   "), []);
});
