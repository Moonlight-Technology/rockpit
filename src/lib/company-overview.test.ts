import assert from "node:assert/strict";
import test from "node:test";
import { groupLeadsByColumn } from "./company-overview.ts";

test("groupLeadsByColumn returns columns in position order with estimated value totals", () => {
  const grouped = groupLeadsByColumn(
    [
      { id: "proposal", title: "Proposal", position: 2 },
      { id: "new", title: "New", position: 0 },
    ],
    [
      { id: "lead-1", columnId: "new", estimatedValue: 5000000 },
      { id: "lead-2", columnId: "proposal", estimatedValue: 2500000 },
    ]
  );

  assert.deepEqual(grouped.map((column) => column.id), ["new", "proposal"]);
  assert.deepEqual(grouped.map((column) => column.totalEstimatedValue), [5000000, 2500000]);
});
