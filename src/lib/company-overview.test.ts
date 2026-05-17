import assert from "node:assert/strict";
import test from "node:test";
import { buildCompanyOverviewMetrics } from "./company-overview.ts";

test("buildCompanyOverviewMetrics summarizes open pipeline drafts wins and active projects", () => {
  const metrics = buildCompanyOverviewMetrics({
    leads: [
      { stage: "NEW", estimatedValue: 5_000_000, wonAt: null },
      { stage: "WON", estimatedValue: 7_000_000, wonAt: new Date("2026-05-10T00:00:00.000Z") },
    ],
    quotations: [{ status: "DRAFT", total: 3_500_000 }],
    activeProjectCount: 2,
    now: new Date("2026-05-17T00:00:00.000Z"),
  });

  assert.deepEqual(metrics, {
    openPipelineValue: 5_000_000,
    quotationDraftValue: 3_500_000,
    wonValueThisMonth: 7_000_000,
    activeProjectCount: 2,
  });
});
