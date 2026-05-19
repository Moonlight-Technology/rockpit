import assert from "node:assert/strict";
import test from "node:test";
import {
  formatQuotationNumber,
  getIssuedAtForQuotationStatus,
  isRetryableQuotationConflict,
  nextQuotationSequence,
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

test("nextQuotationSequence increments numerically within the same month", () => {
  assert.equal(
    nextQuotationSequence({
      prefix: "MAMAT",
      issuedAt: new Date("2026-05-17T00:00:00.000Z"),
      existingQuotationNumbers: [
        "MAMAT/QT/2026/05/999",
        "MAMAT/QT/2026/05/1000",
        "MAMAT/QT/2026/04/015",
      ],
    }),
    1001
  );
});

test("nextQuotationSequence resets to 1 for a new month", () => {
  assert.equal(
    nextQuotationSequence({
      prefix: "MAMAT",
      issuedAt: new Date("2026-06-01T00:00:00.000Z"),
      existingQuotationNumbers: ["MAMAT/QT/2026/05/125", "MAMAT/QT/2026/04/999"],
    }),
    1
  );
});

test("getIssuedAtForQuotationStatus leaves drafts unissued", () => {
  const now = new Date("2026-05-17T10:11:12.000Z");

  assert.equal(getIssuedAtForQuotationStatus("DRAFT", now), null);
  assert.deepEqual(getIssuedAtForQuotationStatus("SENT", now), now);
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

import { applyStatusTransition } from "./company-quotation-service.ts";

test("applyStatusTransition no-op when status equals current", () => {
  const now = new Date("2026-05-19T10:00:00.000Z");
  const result = applyStatusTransition({
    currentStatus: "DRAFT",
    nextStatus: "DRAFT",
    timestamps: { sentAt: null, approvedAt: null, rejectedAt: null, issuedAt: null },
    now,
  });
  assert.equal(result.changed, false);
  assert.deepEqual(result.updates, {});
});

test("applyStatusTransition DRAFT -> SENT sets sentAt and issuedAt", () => {
  const now = new Date("2026-05-19T10:00:00.000Z");
  const result = applyStatusTransition({
    currentStatus: "DRAFT",
    nextStatus: "SENT",
    timestamps: { sentAt: null, approvedAt: null, rejectedAt: null, issuedAt: null },
    now,
  });
  assert.equal(result.changed, true);
  assert.equal(result.updates.status, "SENT");
  assert.deepEqual(result.updates.sentAt, now);
  assert.deepEqual(result.updates.issuedAt, now);
});

test("applyStatusTransition preserves existing first-transition timestamps", () => {
  const earlier = new Date("2026-05-10T00:00:00.000Z");
  const now = new Date("2026-05-19T10:00:00.000Z");
  const result = applyStatusTransition({
    currentStatus: "SENT",
    nextStatus: "SENT",
    timestamps: { sentAt: earlier, approvedAt: null, rejectedAt: null, issuedAt: earlier },
    now,
  });
  assert.equal(result.changed, false);
});

test("applyStatusTransition SENT -> APPROVED sets approvedAt but keeps sentAt", () => {
  const earlier = new Date("2026-05-10T00:00:00.000Z");
  const now = new Date("2026-05-19T10:00:00.000Z");
  const result = applyStatusTransition({
    currentStatus: "SENT",
    nextStatus: "APPROVED",
    timestamps: { sentAt: earlier, approvedAt: null, rejectedAt: null, issuedAt: earlier },
    now,
  });
  assert.equal(result.changed, true);
  assert.deepEqual(result.updates.approvedAt, now);
  assert.equal("sentAt" in result.updates, false);
});

test("applyStatusTransition APPROVED -> DRAFT changes status but no new timestamps", () => {
  const earlier = new Date("2026-05-10T00:00:00.000Z");
  const now = new Date("2026-05-19T10:00:00.000Z");
  const result = applyStatusTransition({
    currentStatus: "APPROVED",
    nextStatus: "DRAFT",
    timestamps: { sentAt: earlier, approvedAt: earlier, rejectedAt: null, issuedAt: earlier },
    now,
  });
  assert.equal(result.changed, true);
  assert.equal(result.updates.status, "DRAFT");
  assert.equal("approvedAt" in result.updates, false);
  assert.equal("sentAt" in result.updates, false);
});
