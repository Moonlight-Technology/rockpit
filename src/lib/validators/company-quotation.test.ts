import assert from "node:assert/strict";
import test from "node:test";
import {
  createQuotationSchema,
  updateQuotationStatusSchema,
} from "./company-quotation.ts";

test("createQuotationSchema defaults reviveLead to false", () => {
  const parsed = createQuotationSchema.parse({
    leadId: "lead_1",
    lines: [{ description: "Design", quantity: 1, unitPrice: 1000 }],
  });
  assert.equal(parsed.reviveLead, false);
});

test("createQuotationSchema accepts reviveLead=true", () => {
  const parsed = createQuotationSchema.parse({
    leadId: "lead_1",
    lines: [{ description: "Design", quantity: 1, unitPrice: 1000 }],
    reviveLead: true,
  });
  assert.equal(parsed.reviveLead, true);
});

test("updateQuotationStatusSchema accepts each enum value", () => {
  for (const status of ["DRAFT", "SENT", "APPROVED", "REJECTED"] as const) {
    const parsed = updateQuotationStatusSchema.parse({ status });
    assert.equal(parsed.status, status);
  }
});

test("updateQuotationStatusSchema rejects extra keys like lines", () => {
  assert.throws(() =>
    updateQuotationStatusSchema.parse({
      status: "DRAFT",
      lines: [{ description: "x", quantity: 1, unitPrice: 1 }],
    })
  );
});
