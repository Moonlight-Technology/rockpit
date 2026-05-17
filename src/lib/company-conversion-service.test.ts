import assert from "node:assert/strict";
import test from "node:test";
import { canConvertLeadToProject } from "./company-conversion-service.ts";

test("canConvertLeadToProject allows won leads that have not been converted", () => {
  assert.equal(
    canConvertLeadToProject({ stage: "WON", convertedProjectBoardId: null }),
    true
  );
});

test("canConvertLeadToProject rejects duplicate conversions", () => {
  assert.equal(
    canConvertLeadToProject({ stage: "WON", convertedProjectBoardId: "board-1" }),
    false
  );
});
