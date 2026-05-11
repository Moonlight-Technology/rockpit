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

export type MoneyTransactionFilterEntry = {
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "LEND" | "RECEIVABLE_PAYMENT";
  accountId?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
};

export type MoneyTransactionTypeFilter = "all" | "income" | "expense";

export function filterMoneyTransactions<T extends MoneyTransactionFilterEntry>(
  transactions: readonly T[],
  filters: { type: MoneyTransactionTypeFilter; accountId: string }
) {
  return transactions.filter((transaction) => {
    const typeMatches =
      filters.type === "all" ||
      (filters.type === "income" &&
        (transaction.type === "INCOME" || transaction.type === "RECEIVABLE_PAYMENT")) ||
      (filters.type === "expense" && (transaction.type === "EXPENSE" || transaction.type === "LEND"));

    if (!typeMatches) return false;
    if (filters.accountId === "all") return true;

    return (
      transaction.accountId === filters.accountId ||
      transaction.fromAccountId === filters.accountId ||
      transaction.toAccountId === filters.accountId
    );
  });
}
