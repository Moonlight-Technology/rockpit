import assert from "node:assert/strict";
import test from "node:test";

const { buildCompanyOverviewMetrics } = await import(
  new URL("./company-overview.ts", import.meta.url).href
);

test("buildCompanyOverviewMetrics summarizes open pipeline drafts wins and active projects", () => {
  const metrics = buildCompanyOverviewMetrics({
    leads: [
      { stage: "NEW", estimatedValue: 5_000_000, wonAt: null },
      { stage: "WON", estimatedValue: 7_000_000, wonAt: new Date("2026-05-10T00:00:00.000Z") },
    ],
    quotations: [
      {
        leadId: "lead-1",
        status: "DRAFT",
        total: 3_500_000,
        revisionNumber: 1,
        createdAt: new Date("2026-05-10T00:00:00.000Z"),
      },
    ],
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

test("buildCompanyOverviewMetrics only counts the latest draft revision per lead", () => {
  const metrics = buildCompanyOverviewMetrics({
    leads: [{ stage: "PROPOSAL", estimatedValue: 8_000_000, wonAt: null }],
    quotations: [
      {
        leadId: "lead-1",
        status: "DRAFT",
        total: 2_000_000,
        revisionNumber: 1,
        createdAt: new Date("2026-05-10T00:00:00.000Z"),
      },
      {
        leadId: "lead-1",
        status: "DRAFT",
        total: 3_000_000,
        revisionNumber: 2,
        createdAt: new Date("2026-05-11T00:00:00.000Z"),
      },
      {
        leadId: "lead-2",
        status: "SENT",
        total: 4_000_000,
        revisionNumber: 2,
        createdAt: new Date("2026-05-12T00:00:00.000Z"),
      },
      {
        leadId: "lead-2",
        status: "DRAFT",
        total: 1_000_000,
        revisionNumber: 1,
        createdAt: new Date("2026-05-09T00:00:00.000Z"),
      },
    ],
    activeProjectCount: 0,
    now: new Date("2026-05-17T00:00:00.000Z"),
  });

  assert.equal(metrics.quotationDraftValue, 3_000_000);
});
