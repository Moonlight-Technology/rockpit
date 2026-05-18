import assert from "node:assert/strict";
import test from "node:test";
import { isCompanyNavItemActive } from "./company-navigation.ts";

test("isCompanyNavItemActive keeps overview exact-only", () => {
  assert.equal(
    isCompanyNavItemActive({
      pathname: "/company/company-1/clients",
      href: "/company/company-1",
      overviewHref: "/company/company-1",
    }),
    false
  );
});

test("isCompanyNavItemActive allows nested non-overview routes", () => {
  assert.equal(
    isCompanyNavItemActive({
      pathname: "/company/company-1/quotations/quotation-1",
      href: "/company/company-1/quotations",
      overviewHref: "/company/company-1",
    }),
    true
  );
});
