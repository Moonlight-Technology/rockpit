export type MoneyLedgerEntry = {
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "LEND" | "RECEIVABLE_PAYMENT";
  amount: number;
  accountId?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
};

export function calculateAccountBalances(entries: MoneyLedgerEntry[]) {
  const balances: Record<string, number> = {};

  const add = (accountId: string | null | undefined, amount: number) => {
    if (!accountId) return;
    balances[accountId] = (balances[accountId] ?? 0) + amount;
  };

  for (const entry of entries) {
    if (entry.type === "INCOME" || entry.type === "RECEIVABLE_PAYMENT") {
      add(entry.accountId, entry.amount);
    }

    if (entry.type === "EXPENSE" || entry.type === "LEND") {
      add(entry.accountId, -entry.amount);
    }

    if (entry.type === "TRANSFER") {
      add(entry.fromAccountId, -entry.amount);
      add(entry.toAccountId, entry.amount);
    }
  }

  return balances;
}

export function allocateBudgetAmount(totalAmount: number, percentage: number) {
  return Math.round((totalAmount * percentage) / 100);
}

export function remainingReceivableAmount(originalAmount: number, payments: number[]) {
  return Math.max(0, originalAmount - payments.reduce((sum, amount) => sum + amount, 0));
}
