import assert from "node:assert/strict";
import test from "node:test";
import { calculateAccountBalances, filterMoneyTransactions } from "./money-calculations";

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

test("filterMoneyTransactions filters by type group and account", () => {
  const transactions = [
    { id: "income", type: "INCOME", accountId: "cash" },
    { id: "expense", type: "EXPENSE", accountId: "bank" },
    { id: "lend", type: "LEND", accountId: "cash" },
    { id: "payment", type: "RECEIVABLE_PAYMENT", accountId: "bank" },
    { id: "transfer", type: "TRANSFER", fromAccountId: "cash", toAccountId: "bank" },
  ] as const;

  assert.deepEqual(
    filterMoneyTransactions(transactions, { type: "income", accountId: "bank" }).map((item) => item.id),
    ["payment"]
  );
  assert.deepEqual(
    filterMoneyTransactions(transactions, { type: "expense", accountId: "cash" }).map((item) => item.id),
    ["lend"]
  );
  assert.deepEqual(
    filterMoneyTransactions(transactions, { type: "all", accountId: "bank" }).map((item) => item.id),
    ["expense", "payment", "transfer"]
  );
});
