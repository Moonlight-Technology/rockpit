import assert from "node:assert/strict";
import test from "node:test";
import {
  formatQuotationNumber,
  isRetryableQuotationConflict,
  nextRevisionNumber,
  retryOnQuotationConflict,
} from "./company-quotation-service.ts";

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

test("isRetryableQuotationConflict matches quotation unique collisions", () => {
  assert.equal(
    isRetryableQuotationConflict({
      code: "P2002",
      meta: { target: ["companyId", "quotationNumber", "revisionNumber"] },
    }),
    true
  );
  assert.equal(
    isRetryableQuotationConflict({
      code: "P2002",
      meta: { target: ["leadId", "revisionNumber"] },
    }),
    true
  );
  assert.equal(
    isRetryableQuotationConflict({
      code: "P2002",
      meta: { target: ["email"] },
    }),
    false
  );
});

test("retryOnQuotationConflict retries bounded unique collisions and then succeeds", async () => {
  let attempts = 0;

  const result = await retryOnQuotationConflict(async () => {
    attempts += 1;

    if (attempts < 3) {
      throw {
        code: "P2002",
        meta: { target: ["leadId", "revisionNumber"] },
      };
    }

    return "ok";
  });

  assert.equal(result, "ok");
  assert.equal(attempts, 3);
});

test("retryOnQuotationConflict throws a controlled conflict after exhausting retries", async () => {
  await assert.rejects(
    () =>
      retryOnQuotationConflict(async () => {
        throw {
          code: "P2002",
          meta: { target: ["companyId", "quotationNumber", "revisionNumber"] },
        };
      }),
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "QUOTATION_CONFLICT"
  );
});
