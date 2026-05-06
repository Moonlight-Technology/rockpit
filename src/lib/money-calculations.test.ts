import assert from "node:assert/strict";
import test from "node:test";
import { calculateAccountBalances } from "./money-calculations.ts";

test("calculateAccountBalances applies income expense transfer lend and receivable payments", () => {
  const balances = calculateAccountBalances([
    { type: "INCOME", amount: 1_000_000, accountId: "cash" },
    { type: "EXPENSE", amount: 125_000, accountId: "cash" },
    { type: "TRANSFER", amount: 200_000, fromAccountId: "cash", toAccountId: "bank" },
    { type: "LEND", amount: 100_000, accountId: "cash" },
    { type: "RECEIVABLE_PAYMENT", amount: 40_000, accountId: "bank" },
  ]);

  assert.equal(balances.cash, 575_000);
  assert.equal(balances.bank, 240_000);
});
