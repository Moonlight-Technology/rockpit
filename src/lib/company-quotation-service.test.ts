import assert from "node:assert/strict";
import test from "node:test";
import { formatQuotationNumber, nextRevisionNumber } from "./company-quotation-service.ts";

test("formatQuotationNumber builds a company-prefixed sequence number", () => {
  assert.equal(
    formatQuotationNumber({
      prefix: "MAMAT",
      issuedAt: new Date("2026-05-17T00:00:00.000Z"),
      sequence: 7,
    }),
    "MAMAT/QT/2026/05/007"
  );
});

test("nextRevisionNumber increments from the latest revision", () => {
  assert.equal(nextRevisionNumber([]), 1);
  assert.equal(nextRevisionNumber([{ revisionNumber: 1 }, { revisionNumber: 2 }]), 3);
});
