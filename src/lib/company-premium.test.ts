import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPANY_MODE_UNLOCK_CODE,
  isValidCompanyUnlockCode,
  normalizeQuotationPrefix,
} from "./company-premium.ts";

test("isValidCompanyUnlockCode accepts the exact configured unlock code", () => {
  assert.equal(COMPANY_MODE_UNLOCK_CODE, "MAMAT-METAL");
  assert.equal(isValidCompanyUnlockCode("MAMAT-METAL"), true);
});

test("isValidCompanyUnlockCode trims whitespace and rejects wrong values", () => {
  assert.equal(isValidCompanyUnlockCode("  MAMAT-METAL  "), true);
  assert.equal(isValidCompanyUnlockCode("mamat-metal"), false);
  assert.equal(isValidCompanyUnlockCode("MAMAT"), false);
});

test("normalizeQuotationPrefix uppercases and strips unsupported characters", () => {
  assert.equal(normalizeQuotationPrefix("mamat"), "MAMAT");
  assert.equal(normalizeQuotationPrefix(" mamat/qt "), "MAMATQT");
  assert.equal(normalizeQuotationPrefix("ab-12"), "AB12");
});
