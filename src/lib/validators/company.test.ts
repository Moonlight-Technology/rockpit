import assert from "node:assert/strict";
import test from "node:test";
import { createCompanySchema } from "./company.ts";

test("createCompanySchema defaults business type to JASA and normalizes prefix", () => {
  const parsed = createCompanySchema.parse({
    name: "Mamat Metal Works",
    quotationPrefix: "mamat/qt",
  });

  assert.equal(parsed.businessType, "JASA");
  assert.equal(parsed.quotationPrefix, "MAMATQT");
});
