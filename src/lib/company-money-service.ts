import type {
  CompanyMoneyAccount,
  CompanyMoneyCategory,
  CompanyMoneyReceivable,
  CompanyMoneyReceivablePayment,
  CompanyMoneyTransaction,
  CompanyMoneyWishlistItem,
  MoneyAccountType,
  MoneyCategoryKind,
  MoneyTransactionType,
  MoneyWishlistPriority,
  MoneyWishlistStatus,
} from "@prisma/client";
import { prisma } from "./prisma.ts";
import { allocateBudgetAmount, calculateAccountBalances } from "./money-calculations.ts";
import type {
  CreateMoneyTransactionInput,
  CreateReceivablePaymentInput,
  UpdateMoneyTransactionInput,
  UpsertMoneyBudgetInput,
} from "./validators/money.ts";

type CompanyMoneyError = "FORBIDDEN" | "NOT_FOUND" | "INVALID_STATE";

type OwnerContext = {
  userId: string;
  companyId: string;
};

type CompanyMoneyDeps = {
  prisma: {
    company: {
      findFirst: (args: unknown) => Promise<{ id: string; ownerId: string } | null>;
    };
    $transaction: <T>(input: Promise<T>[] | ((tx: CompanyMoneyTx) => Promise<T>)) => Promise<T>;
    companyMoneyAccount: {
      findMany: (args: unknown) => Promise<CompanyMoneyAccount[]>;
      count: (args: unknown) => Promise<number>;
      create: (args: unknown) => Promise<CompanyMoneyAccount>;
    };
    companyMoneyCategory: {
      count: (args: unknown) => Promise<number>;
      createMany: (args: unknown) => Promise<unknown>;
      findMany: (args: unknown) => Promise<CompanyMoneyCategory[]>;
      create: (args: unknown) => Promise<CompanyMoneyCategory>;
      findFirst: (args: unknown) => Promise<{ id: string } | null>;
      update: (args: unknown) => Promise<CompanyMoneyCategory>;
    };
    companyMoneyTransaction: {
      findMany: (args: unknown) => Promise<CompanyMoneyTransaction[]>;
      create: (args: unknown) => Promise<CompanyMoneyTransaction>;
      findFirst: (args: unknown) => Promise<{ id: string; type: MoneyTransactionType } | null>;
      update: (args: unknown) => Promise<CompanyMoneyTransaction>;
      delete: (args: unknown) => Promise<unknown>;
    };
    companyMoneyBudgetPlan: {
      findUnique: (args: unknown) => Promise<CompanyBudgetPlanRecord | null>;
      findFirst: (args: unknown) => Promise<{ totalAmount: number } | null>;
      create: (args: unknown) => Promise<CompanyBudgetPlanRecord>;
    };
    companyMoneyBudgetBucket: {
      deleteMany: (args: unknown) => Promise<unknown>;
      create: (args: unknown) => Promise<unknown>;
    };
    companyMoneyWishlistItem: {
      findMany: (args: unknown) => Promise<CompanyMoneyWishlistItem[]>;
      create: (args: unknown) => Promise<CompanyMoneyWishlistItem>;
      findFirst: (args: unknown) => Promise<{ id: string } | null>;
      update: (args: unknown) => Promise<CompanyMoneyWishlistItem>;
    };
    companyMoneyReceivable: {
      findMany: (args: unknown) => Promise<CompanyReceivableRecord[]>;
      findFirst: (args: unknown) => Promise<CompanyMoneyReceivable | null>;
      create: (args: unknown) => Promise<CompanyMoneyReceivable>;
      update: (args: unknown) => Promise<CompanyMoneyReceivable>;
    };
    companyMoneyReceivablePayment: {
      create: (args: unknown) => Promise<CompanyMoneyReceivablePayment>;
    };
  };
};

type CompanyMoneyTx = CompanyMoneyDeps["prisma"] & {
  companyMoneyBudgetPlan: {
    upsert: (args: unknown) => Promise<{ id: string }>;
    findUniqueOrThrow: (args: unknown) => Promise<CompanyBudgetPlanRecord>;
  };
};

type CompanyBudgetPlanRecord = {
  id: string;
  companyId: string;
  month: Date;
  totalAmount: number;
  buckets: Array<{
    id: string;
    label: string;
    percentage: number;
    position: number;
    categories: Array<{
      categoryId: string;
      category: { id: string; name: string };
    }>;
  }>;
};

type CompanyReceivableRecord = CompanyMoneyReceivable & {
  payments: Array<{
    id: string;
    amount: number;
    paidAt: Date;
  }>;
};

const defaultDeps: CompanyMoneyDeps = {
  prisma: prisma as unknown as CompanyMoneyDeps["prisma"],
};

const defaultCategories: Array<{ name: string; kind: MoneyCategoryKind }> = [
  { name: "Makan", kind: "EXPENSE" },
  { name: "Transportasi", kind: "EXPENSE" },
  { name: "Tagihan", kind: "EXPENSE" },
  { name: "Belanja", kind: "EXPENSE" },
  { name: "Kesehatan", kind: "EXPENSE" },
  { name: "Hiburan", kind: "EXPENSE" },
  { name: "Gaji", kind: "INCOME" },
  { name: "Bonus", kind: "INCOME" },
  { name: "Hadiah", kind: "BOTH" },
  { name: "Piutang", kind: "EXPENSE" },
];

const defaultBudgetBuckets = [
  { label: "Needs", percentage: 50, position: 0 },
  { label: "Wants", percentage: 30, position: 1 },
  { label: "Saving & Financial Goal", percentage: 20, position: 2 },
];

function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(year, monthNumber - 1, 1);
  const end = new Date(year, monthNumber, 1);
  return { start, end };
}

function normalizeBudgetMonth(month: string) {
  return monthRange(month).start;
}

function toMonthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

async function getOwnerCompany(
  input: OwnerContext,
  deps: CompanyMoneyDeps
): Promise<{ id: string; ownerId: string } | { error: CompanyMoneyError }> {
  const company = await deps.prisma.company.findFirst({
    where: { id: input.companyId },
    select: { id: true, ownerId: true },
  });

  if (!company) return { error: "NOT_FOUND" };
  if (company.ownerId !== input.userId) return { error: "FORBIDDEN" };

  return company;
}

function mapTransaction(transaction: CompanyMoneyTransaction & {
  category?: { id: string; name: string } | null;
  account?: { id: string; name: string } | null;
  fromAccount?: { id: string; name: string } | null;
  toAccount?: { id: string; name: string } | null;
  receivable?: { id: string; personName: string } | null;
}) {
  return {
    id: transaction.id,
    type: transaction.type,
    amount: transaction.amount,
    description: transaction.description,
    occurredAt: transaction.occurredAt,
    category: transaction.category ?? null,
    account: transaction.account ?? null,
    fromAccount: transaction.fromAccount ?? null,
    toAccount: transaction.toAccount ?? null,
    receivable: transaction.receivable ?? null,
  };
}

async function companyAccountBalances(companyId: string, deps: CompanyMoneyDeps) {
  const transactions = await deps.prisma.companyMoneyTransaction.findMany({
    where: { companyId },
    select: {
      type: true,
      amount: true,
      accountId: true,
      fromAccountId: true,
      toAccountId: true,
    },
  });

  return calculateAccountBalances(transactions);
}

async function companyAccountBalancesExcludingTransaction(
  companyId: string,
  transactionId: string,
  deps: CompanyMoneyDeps
) {
  const transactions = await deps.prisma.companyMoneyTransaction.findMany({
    where: { companyId, id: { not: transactionId } },
    select: {
      type: true,
      amount: true,
      accountId: true,
      fromAccountId: true,
      toAccountId: true,
    },
  });

  return calculateAccountBalances(transactions);
}

function hasNegativeBalance(balances: Record<string, number>) {
  return Object.values(balances).some((balance) => balance < 0);
}

function applyTransactionToBalances(
  balances: Record<string, number>,
  payload: UpdateMoneyTransactionInput
) {
  const next = { ...balances };
  const add = (accountId: string | null | undefined, amount: number) => {
    if (!accountId) return;
    next[accountId] = (next[accountId] ?? 0) + amount;
  };

  if (payload.type === "INCOME") add(payload.accountId, payload.amount);
  if (payload.type === "EXPENSE") add(payload.accountId, -payload.amount);
  if (payload.type === "TRANSFER") {
    add(payload.fromAccountId, -payload.amount);
    add(payload.toAccountId, payload.amount);
  }

  return next;
}

async function requireAccounts(companyId: string, accountIds: string[], deps: CompanyMoneyDeps) {
  const uniqueIds = Array.from(new Set(accountIds));
  const count = await deps.prisma.companyMoneyAccount.count({
    where: { companyId, id: { in: uniqueIds } },
  });
  return count === uniqueIds.length;
}

async function requireCategories(companyId: string, categoryIds: string[], deps: CompanyMoneyDeps) {
  const uniqueIds = Array.from(new Set(categoryIds));
  if (uniqueIds.length === 0) return true;

  const count = await deps.prisma.companyMoneyCategory.count({
    where: { companyId, id: { in: uniqueIds }, isActive: true },
  });
  return count === uniqueIds.length;
}

async function mapBudgetPlan(plan: CompanyBudgetPlanRecord, deps: CompanyMoneyDeps) {
  const { start, end } = monthRange(toMonthValue(plan.month));
  const categoryIds = plan.buckets.flatMap((bucket) =>
    bucket.categories.map((bucketCategory) => bucketCategory.categoryId)
  );

  const expenses = categoryIds.length
    ? await deps.prisma.companyMoneyTransaction.findMany({
        where: {
          companyId: plan.companyId,
          type: "EXPENSE",
          categoryId: { in: categoryIds },
          occurredAt: { gte: start, lt: end },
        },
        select: { amount: true, categoryId: true },
      })
    : [];

  return {
    id: plan.id,
    month: toMonthValue(plan.month),
    totalAmount: plan.totalAmount,
    buckets: plan.buckets.map((bucket) => {
      const bucketCategoryIds = new Set(
        bucket.categories.map((bucketCategory) => bucketCategory.categoryId)
      );
      const usedAmount = expenses.reduce(
        (sum, expense) =>
          sum +
          (expense.categoryId && bucketCategoryIds.has(expense.categoryId)
            ? expense.amount
            : 0),
        0
      );
      const allocatedAmount = allocateBudgetAmount(plan.totalAmount, bucket.percentage);

      return {
        id: bucket.id,
        label: bucket.label,
        percentage: bucket.percentage,
        allocatedAmount,
        usedAmount,
        remainingAmount: allocatedAmount - usedAmount,
        categories: bucket.categories.map((bucketCategory) => bucketCategory.category),
      };
    }),
  };
}

export async function ensureDefaultCompanyMoneyCategoriesWithDependencies(
  input: OwnerContext,
  deps: CompanyMoneyDeps
) {
  const company = await getOwnerCompany(input, deps);
  if ("error" in company) return company;

  const existingCount = await deps.prisma.companyMoneyCategory.count({
    where: { companyId: company.id },
  });

  if (existingCount === 0) {
    await deps.prisma.companyMoneyCategory.createMany({
      data: defaultCategories.map((category) => ({
        companyId: company.id,
        ...category,
        isDefault: true,
      })),
    });
  }

  return { data: { companyId: company.id } };
}

export async function listCompanyMoneyCategoriesWithDependencies(
  input: OwnerContext,
  deps: CompanyMoneyDeps
) {
  const seeded = await ensureDefaultCompanyMoneyCategoriesWithDependencies(input, deps);
  if ("error" in seeded) return seeded;

  const categories = await deps.prisma.companyMoneyCategory.findMany({
    where: { companyId: input.companyId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      kind: true,
      isDefault: true,
      isActive: true,
    },
  });

  return { data: categories };
}

export async function listCompanyMoneyAccountsWithDependencies(
  input: OwnerContext,
  deps: CompanyMoneyDeps
) {
  const company = await getOwnerCompany(input, deps);
  if ("error" in company) return company;

  const [accounts, balances] = await Promise.all([
    deps.prisma.companyMoneyAccount.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "asc" },
    }),
    companyAccountBalances(company.id, deps),
  ]);

  return {
    data: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      type: account.type,
      balance: balances[account.id] ?? 0,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    })),
  };
}

export async function createCompanyMoneyAccount(
  input: OwnerContext & { name: string; type: MoneyAccountType }
) {
  const company = await getOwnerCompany(input, defaultDeps);
  if ("error" in company) return company;

  const account = await defaultDeps.prisma.companyMoneyAccount.create({
    data: {
      companyId: company.id,
      name: input.name,
      type: input.type,
    },
  });

  return { data: account };
}

export async function listCompanyMoneyAccounts(input: OwnerContext) {
  return listCompanyMoneyAccountsWithDependencies(input, defaultDeps);
}

export async function listCompanyMoneyCategories(input: OwnerContext) {
  return listCompanyMoneyCategoriesWithDependencies(input, defaultDeps);
}

export async function createCompanyMoneyCategory(input: OwnerContext & { name: string; kind: MoneyCategoryKind }) {
  const company = await getOwnerCompany(input, defaultDeps);
  if ("error" in company) return company;

  const category = await defaultDeps.prisma.companyMoneyCategory.create({
    data: {
      companyId: company.id,
      name: input.name,
      kind: input.kind,
    },
    select: {
      id: true,
      name: true,
      kind: true,
      isDefault: true,
      isActive: true,
    },
  });

  return { data: category };
}

export async function updateCompanyMoneyCategory(
  input: OwnerContext & { id: string; name: string; kind: MoneyCategoryKind }
) {
  const company = await getOwnerCompany(input, defaultDeps);
  if ("error" in company) return company;

  const existing = await defaultDeps.prisma.companyMoneyCategory.findFirst({
    where: { id: input.id, companyId: company.id },
    select: { id: true },
  });
  if (!existing) return { error: "NOT_FOUND" as const };

  const updated = await defaultDeps.prisma.companyMoneyCategory.update({
    where: { id: input.id },
    data: { name: input.name, kind: input.kind },
    select: {
      id: true,
      name: true,
      kind: true,
      isDefault: true,
      isActive: true,
    },
  });

  return { data: updated };
}

async function createReceivablePaymentTransactionWithDependencies(
  input: OwnerContext & {
    payload:
      | CreateReceivablePaymentInput
      | Extract<CreateMoneyTransactionInput, { type: "RECEIVABLE_PAYMENT" }>;
  },
  deps: CompanyMoneyDeps
) {
  const company = await getOwnerCompany(input, deps);
  if ("error" in company) return company;

  const isReceivablePaymentPayload = "paidAt" in input.payload;
  const occurredAt = isReceivablePaymentPayload
    ? (input.payload as CreateReceivablePaymentInput).paidAt
    : (input.payload as Extract<CreateMoneyTransactionInput, { type: "RECEIVABLE_PAYMENT" }>).occurredAt;
  const description = isReceivablePaymentPayload
    ? (input.payload as CreateReceivablePaymentInput).notes
    : (input.payload as Extract<CreateMoneyTransactionInput, { type: "RECEIVABLE_PAYMENT" }>).description;

  const [accountExists, receivable] = await Promise.all([
    requireAccounts(company.id, [input.payload.accountId], deps),
    deps.prisma.companyMoneyReceivable.findFirst({
      where: { id: input.payload.receivableId, companyId: company.id },
    }),
  ]);

  if (!accountExists || !receivable) {
    return { error: "NOT_FOUND" as const, message: "Money record not found." };
  }

  if (input.payload.amount > receivable.remainingAmount) {
    return {
      error: "INVALID_STATE" as const,
      message: "Payment exceeds remaining receivable.",
    };
  }

  const transaction = await deps.prisma.$transaction(async (tx) => {
    const createdTransaction = await tx.companyMoneyTransaction.create({
      data: {
        companyId: company.id,
        type: "RECEIVABLE_PAYMENT",
        amount: input.payload.amount,
        accountId: input.payload.accountId,
        receivableId: input.payload.receivableId,
        description,
        occurredAt: new Date(occurredAt),
      },
      include: {
        category: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } },
        fromAccount: { select: { id: true, name: true } },
        toAccount: { select: { id: true, name: true } },
        receivable: { select: { id: true, personName: true } },
      },
    });

    await tx.companyMoneyReceivablePayment.create({
      data: {
        receivableId: input.payload.receivableId,
        transactionId: createdTransaction.id,
        amount: input.payload.amount,
        paidAt: new Date(occurredAt),
      },
    });

    const remainingAmount = receivable.remainingAmount - input.payload.amount;
    await tx.companyMoneyReceivable.update({
      where: { id: input.payload.receivableId },
      data: {
        remainingAmount,
        status: remainingAmount === 0 ? "PAID" : "ACTIVE",
      },
    });

    return createdTransaction;
  });

  return { data: mapTransaction(transaction as never) };
}

export async function createCompanyMoneyTransactionWithDependencies(
  input: OwnerContext & { payload: CreateMoneyTransactionInput },
  deps: CompanyMoneyDeps
) {
  const company = await getOwnerCompany(input, deps);
  if ("error" in company) return company;

  if (input.payload.type === "INCOME") {
    const [accountExists, categoryExists] = await Promise.all([
      requireAccounts(company.id, [input.payload.accountId], deps),
      input.payload.categoryId
        ? requireCategories(company.id, [input.payload.categoryId], deps)
        : true,
    ]);

    if (!accountExists || !categoryExists) {
      return { error: "NOT_FOUND" as const, message: "Money record not found." };
    }

    const transaction = await deps.prisma.companyMoneyTransaction.create({
      data: {
        companyId: company.id,
        type: input.payload.type,
        amount: input.payload.amount,
        accountId: input.payload.accountId,
        categoryId: input.payload.categoryId,
        description: input.payload.description,
        occurredAt: new Date(input.payload.occurredAt),
      },
      include: {
        category: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } },
        fromAccount: { select: { id: true, name: true } },
        toAccount: { select: { id: true, name: true } },
        receivable: { select: { id: true, personName: true } },
      },
    });

    return { data: mapTransaction(transaction as never) };
  }

  if (input.payload.type === "EXPENSE") {
    const [accountExists, categoryExists, balances] = await Promise.all([
      requireAccounts(company.id, [input.payload.accountId], deps),
      requireCategories(company.id, [input.payload.categoryId], deps),
      companyAccountBalances(company.id, deps),
    ]);

    if (!accountExists || !categoryExists) {
      return { error: "NOT_FOUND" as const, message: "Money record not found." };
    }

    if ((balances[input.payload.accountId] ?? 0) < input.payload.amount) {
      return {
        error: "INVALID_STATE" as const,
        message: "Transaction would make account balance negative.",
      };
    }

    const transaction = await deps.prisma.companyMoneyTransaction.create({
      data: {
        companyId: company.id,
        type: input.payload.type,
        amount: input.payload.amount,
        accountId: input.payload.accountId,
        categoryId: input.payload.categoryId,
        description: input.payload.description,
        occurredAt: new Date(input.payload.occurredAt),
      },
      include: {
        category: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } },
        fromAccount: { select: { id: true, name: true } },
        toAccount: { select: { id: true, name: true } },
        receivable: { select: { id: true, personName: true } },
      },
    });

    return { data: mapTransaction(transaction as never) };
  }

  if (input.payload.type === "TRANSFER") {
    if (input.payload.fromAccountId === input.payload.toAccountId) {
      return {
        error: "INVALID_STATE" as const,
        message: "Transfer accounts must be different.",
      };
    }

    const [accountsExist, balances] = await Promise.all([
      requireAccounts(company.id, [input.payload.fromAccountId, input.payload.toAccountId], deps),
      companyAccountBalances(company.id, deps),
    ]);

    if (!accountsExist) {
      return { error: "NOT_FOUND" as const, message: "Money record not found." };
    }

    if ((balances[input.payload.fromAccountId] ?? 0) < input.payload.amount) {
      return {
        error: "INVALID_STATE" as const,
        message: "Transaction would make account balance negative.",
      };
    }

    const transaction = await deps.prisma.companyMoneyTransaction.create({
      data: {
        companyId: company.id,
        type: input.payload.type,
        amount: input.payload.amount,
        fromAccountId: input.payload.fromAccountId,
        toAccountId: input.payload.toAccountId,
        description: input.payload.description,
        occurredAt: new Date(input.payload.occurredAt),
      },
      include: {
        category: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } },
        fromAccount: { select: { id: true, name: true } },
        toAccount: { select: { id: true, name: true } },
        receivable: { select: { id: true, personName: true } },
      },
    });

    return { data: mapTransaction(transaction as never) };
  }

  if (input.payload.type === "LEND") {
    const lendPayload = input.payload as Extract<CreateMoneyTransactionInput, { type: "LEND" }>;
    const [accountExists, balances] = await Promise.all([
      requireAccounts(company.id, [lendPayload.accountId], deps),
      companyAccountBalances(company.id, deps),
    ]);

    if (!accountExists) {
      return { error: "NOT_FOUND" as const, message: "Money record not found." };
    }

    if ((balances[lendPayload.accountId] ?? 0) < lendPayload.amount) {
      return {
        error: "INVALID_STATE" as const,
        message: "Transaction would make account balance negative.",
      };
    }

    const transaction = await deps.prisma.$transaction(async (tx) => {
      const receivable = await tx.companyMoneyReceivable.create({
        data: {
          companyId: company.id,
          personName: lendPayload.personName,
          originalAmount: lendPayload.amount,
          remainingAmount: lendPayload.amount,
          dueDate: lendPayload.dueDate ? new Date(lendPayload.dueDate) : null,
          notes: lendPayload.description,
        },
      });

      return tx.companyMoneyTransaction.create({
        data: {
          companyId: company.id,
          type: lendPayload.type,
          amount: lendPayload.amount,
          accountId: lendPayload.accountId,
          receivableId: receivable.id,
          description: lendPayload.description,
          occurredAt: new Date(lendPayload.occurredAt),
        },
        include: {
          category: { select: { id: true, name: true } },
          account: { select: { id: true, name: true } },
          fromAccount: { select: { id: true, name: true } },
          toAccount: { select: { id: true, name: true } },
          receivable: { select: { id: true, personName: true } },
        },
      });
    });

    return { data: mapTransaction(transaction as never) };
  }

  const receivablePaymentInput = input as OwnerContext & {
    payload: Extract<CreateMoneyTransactionInput, { type: "RECEIVABLE_PAYMENT" }>;
  };
  return createReceivablePaymentTransactionWithDependencies(receivablePaymentInput, deps);
}

export async function createCompanyMoneyTransaction(
  input: OwnerContext & { payload: CreateMoneyTransactionInput }
) {
  return createCompanyMoneyTransactionWithDependencies(input, defaultDeps);
}

export async function listCompanyMoneyTransactions(input: OwnerContext & { month: string }) {
  const company = await getOwnerCompany(input, defaultDeps);
  if ("error" in company) return company;

  const { start, end } = monthRange(input.month);
  const transactions = await defaultDeps.prisma.companyMoneyTransaction.findMany({
    where: { companyId: company.id, occurredAt: { gte: start, lt: end } },
    include: {
      category: { select: { id: true, name: true } },
      account: { select: { id: true, name: true } },
      fromAccount: { select: { id: true, name: true } },
      toAccount: { select: { id: true, name: true } },
      receivable: { select: { id: true, personName: true } },
    },
    orderBy: { occurredAt: "desc" },
  });

  return { data: transactions.map((transaction) => mapTransaction(transaction as never)) };
}

export async function updateCompanyMoneyTransactionWithDependencies(
  input: OwnerContext & { transactionId: string; payload: UpdateMoneyTransactionInput },
  deps: CompanyMoneyDeps
) {
  const company = await getOwnerCompany(input, deps);
  if ("error" in company) return company;

  const existing = await deps.prisma.companyMoneyTransaction.findFirst({
    where: { id: input.transactionId, companyId: company.id },
    select: { id: true, type: true },
  });
  if (!existing) return { error: "NOT_FOUND" as const };

  if (existing.type === "LEND" || existing.type === "RECEIVABLE_PAYMENT") {
    return {
      error: "INVALID_STATE" as const,
      message: "Piutang transactions are read-only here.",
    };
  }
  if (existing.type !== input.payload.type) {
    return {
      error: "INVALID_STATE" as const,
      message: "Transaction type cannot be changed.",
    };
  }

  if (input.payload.type === "INCOME") {
    const [accountExists, categoryExists] = await Promise.all([
      requireAccounts(company.id, [input.payload.accountId], deps),
      input.payload.categoryId
        ? requireCategories(company.id, [input.payload.categoryId], deps)
        : true,
    ]);
    if (!accountExists || !categoryExists) {
      return { error: "NOT_FOUND" as const, message: "Money record not found." };
    }

    const transaction = await deps.prisma.companyMoneyTransaction.update({
      where: { id: input.transactionId },
      data: {
        amount: input.payload.amount,
        accountId: input.payload.accountId,
        categoryId: input.payload.categoryId,
        fromAccountId: null,
        toAccountId: null,
        description: input.payload.description,
        occurredAt: new Date(input.payload.occurredAt),
      },
      include: {
        category: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } },
        fromAccount: { select: { id: true, name: true } },
        toAccount: { select: { id: true, name: true } },
        receivable: { select: { id: true, personName: true } },
      },
    });
    return { data: mapTransaction(transaction as never) };
  }

  if (input.payload.type === "EXPENSE") {
    const [accountExists, categoryExists, balances] = await Promise.all([
      requireAccounts(company.id, [input.payload.accountId], deps),
      requireCategories(company.id, [input.payload.categoryId], deps),
      companyAccountBalancesExcludingTransaction(company.id, input.transactionId, deps),
    ]);
    if (!accountExists || !categoryExists) {
      return { error: "NOT_FOUND" as const, message: "Money record not found." };
    }
    if (hasNegativeBalance(applyTransactionToBalances(balances, input.payload))) {
      return {
        error: "INVALID_STATE" as const,
        message: "Transaction would make account balance negative.",
      };
    }

    const transaction = await deps.prisma.companyMoneyTransaction.update({
      where: { id: input.transactionId },
      data: {
        amount: input.payload.amount,
        accountId: input.payload.accountId,
        categoryId: input.payload.categoryId,
        fromAccountId: null,
        toAccountId: null,
        description: input.payload.description,
        occurredAt: new Date(input.payload.occurredAt),
      },
      include: {
        category: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } },
        fromAccount: { select: { id: true, name: true } },
        toAccount: { select: { id: true, name: true } },
        receivable: { select: { id: true, personName: true } },
      },
    });
    return { data: mapTransaction(transaction as never) };
  }

  if (input.payload.fromAccountId === input.payload.toAccountId) {
    return {
      error: "INVALID_STATE" as const,
      message: "Transfer accounts must be different.",
    };
  }

  const [accountsExist, balances] = await Promise.all([
    requireAccounts(company.id, [input.payload.fromAccountId, input.payload.toAccountId], deps),
    companyAccountBalancesExcludingTransaction(company.id, input.transactionId, deps),
  ]);

  if (!accountsExist) {
    return { error: "NOT_FOUND" as const, message: "Money record not found." };
  }
  if (hasNegativeBalance(applyTransactionToBalances(balances, input.payload))) {
    return {
      error: "INVALID_STATE" as const,
      message: "Transaction would make account balance negative.",
    };
  }

  const transaction = await deps.prisma.companyMoneyTransaction.update({
    where: { id: input.transactionId },
    data: {
      amount: input.payload.amount,
      accountId: null,
      categoryId: null,
      fromAccountId: input.payload.fromAccountId,
      toAccountId: input.payload.toAccountId,
      description: input.payload.description,
      occurredAt: new Date(input.payload.occurredAt),
    },
    include: {
      category: { select: { id: true, name: true } },
      account: { select: { id: true, name: true } },
      fromAccount: { select: { id: true, name: true } },
      toAccount: { select: { id: true, name: true } },
      receivable: { select: { id: true, personName: true } },
    },
  });
  return { data: mapTransaction(transaction as never) };
}

export async function updateCompanyMoneyTransaction(
  input: OwnerContext & { transactionId: string; payload: UpdateMoneyTransactionInput }
) {
  return updateCompanyMoneyTransactionWithDependencies(input, defaultDeps);
}

export async function deleteCompanyMoneyTransaction(
  input: OwnerContext & { transactionId: string }
) {
  const company = await getOwnerCompany(input, defaultDeps);
  if ("error" in company) return company;

  const existing = await defaultDeps.prisma.companyMoneyTransaction.findFirst({
    where: { id: input.transactionId, companyId: company.id },
    select: { id: true, type: true },
  });
  if (!existing) return { error: "NOT_FOUND" as const };
  if (existing.type === "LEND" || existing.type === "RECEIVABLE_PAYMENT") {
    return {
      error: "INVALID_STATE" as const,
      message: "Piutang transactions are read-only here.",
    };
  }

  const balances = await companyAccountBalancesExcludingTransaction(
    company.id,
    input.transactionId,
    defaultDeps
  );
  if (hasNegativeBalance(balances)) {
    return {
      error: "INVALID_STATE" as const,
      message: "Deleting this transaction would make an account balance negative.",
    };
  }

  await defaultDeps.prisma.companyMoneyTransaction.delete({ where: { id: input.transactionId } });
  return { data: { id: input.transactionId } };
}

export async function getOrCreateCompanyMoneyBudget(input: OwnerContext & { month: string }) {
  const company = await getOwnerCompany(input, defaultDeps);
  if ("error" in company) return company;

  const budgetMonth = normalizeBudgetMonth(input.month);
  const existing = await defaultDeps.prisma.companyMoneyBudgetPlan.findUnique({
    where: { companyId_month: { companyId: company.id, month: budgetMonth } },
    include: {
      buckets: {
        orderBy: { position: "asc" },
        include: {
          categories: {
            include: {
              category: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (existing) return { data: await mapBudgetPlan(existing, defaultDeps) };

  const previous = await defaultDeps.prisma.companyMoneyBudgetPlan.findFirst({
    where: { companyId: company.id, month: { lt: budgetMonth } },
    orderBy: { month: "desc" },
    select: { totalAmount: true },
  });

  const created = await defaultDeps.prisma.companyMoneyBudgetPlan.create({
    data: {
      companyId: company.id,
      month: budgetMonth,
      totalAmount: previous?.totalAmount ?? 0,
      buckets: {
        create: defaultBudgetBuckets,
      },
    },
    include: {
      buckets: {
        orderBy: { position: "asc" },
        include: {
          categories: {
            include: {
              category: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  return { data: await mapBudgetPlan(created, defaultDeps) };
}

export async function upsertCompanyMoneyBudget(
  input: OwnerContext & { payload: UpsertMoneyBudgetInput }
) {
  const company = await getOwnerCompany(input, defaultDeps);
  if ("error" in company) return company;

  const percentageTotal = input.payload.buckets.reduce(
    (sum, bucket) => sum + bucket.percentage,
    0
  );
  if (percentageTotal !== 100) {
    return {
      error: "INVALID_STATE" as const,
      message: "Budget bucket percentages must total 100.",
    };
  }

  const categoryIds = input.payload.buckets.flatMap((bucket) => bucket.categoryIds);
  const uniqueCategoryIds = new Set(categoryIds);
  if (uniqueCategoryIds.size !== categoryIds.length) {
    return {
      error: "INVALID_STATE" as const,
      message: "Each category can only be assigned to one budget bucket.",
    };
  }

  const categoriesExist = await requireCategories(company.id, categoryIds, defaultDeps);
  if (!categoriesExist) {
    return { error: "NOT_FOUND" as const, message: "Money record not found." };
  }

  const budgetMonth = normalizeBudgetMonth(input.payload.month);
  const plan = await defaultDeps.prisma.$transaction(async (tx) => {
    const upserted = await tx.companyMoneyBudgetPlan.upsert({
      where: { companyId_month: { companyId: company.id, month: budgetMonth } },
      create: { companyId: company.id, month: budgetMonth, totalAmount: input.payload.totalAmount },
      update: { totalAmount: input.payload.totalAmount },
    });

    await tx.companyMoneyBudgetBucket.deleteMany({ where: { budgetPlanId: upserted.id } });

    for (const [position, bucket] of input.payload.buckets.entries()) {
      await tx.companyMoneyBudgetBucket.create({
        data: {
          budgetPlanId: upserted.id,
          label: bucket.label,
          percentage: bucket.percentage,
          position,
          categories: {
            create: bucket.categoryIds.map((categoryId) => ({ categoryId })),
          },
        },
      });
    }

    return tx.companyMoneyBudgetPlan.findUniqueOrThrow({
      where: { id: upserted.id },
      include: {
        buckets: {
          orderBy: { position: "asc" },
          include: {
            categories: {
              include: {
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
  });

  return { data: await mapBudgetPlan(plan, defaultDeps) };
}

export async function listCompanyWishlistItems(input: OwnerContext) {
  const company = await getOwnerCompany(input, defaultDeps);
  if ("error" in company) return company;

  const items = await defaultDeps.prisma.companyMoneyWishlistItem.findMany({
    where: { companyId: company.id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      estimatedPrice: true,
      priority: true,
      status: true,
      notes: true,
    },
  });

  return { data: items };
}

export async function createCompanyWishlistItem(
  input: OwnerContext & {
    name: string;
    estimatedPrice: number;
    priority: MoneyWishlistPriority;
    status: MoneyWishlistStatus;
    notes?: string | null;
  }
) {
  const company = await getOwnerCompany(input, defaultDeps);
  if ("error" in company) return company;

  const item = await defaultDeps.prisma.companyMoneyWishlistItem.create({
    data: {
      companyId: company.id,
      name: input.name,
      estimatedPrice: input.estimatedPrice,
      priority: input.priority,
      status: input.status,
      notes: input.notes,
    },
    select: {
      id: true,
      name: true,
      estimatedPrice: true,
      priority: true,
      status: true,
      notes: true,
    },
  });

  return { data: item };
}

export async function updateCompanyWishlistItemStatus(
  input: OwnerContext & { id: string; status: MoneyWishlistStatus }
) {
  const company = await getOwnerCompany(input, defaultDeps);
  if ("error" in company) return company;

  const existing = await defaultDeps.prisma.companyMoneyWishlistItem.findFirst({
    where: { id: input.id, companyId: company.id },
    select: { id: true },
  });
  if (!existing) return { error: "NOT_FOUND" as const };

  const item = await defaultDeps.prisma.companyMoneyWishlistItem.update({
    where: { id: input.id },
    data: { status: input.status },
    select: {
      id: true,
      name: true,
      estimatedPrice: true,
      priority: true,
      status: true,
      notes: true,
    },
  });

  return { data: item };
}

export async function listCompanyReceivables(input: OwnerContext) {
  const company = await getOwnerCompany(input, defaultDeps);
  if ("error" in company) return company;

  const receivables = await defaultDeps.prisma.companyMoneyReceivable.findMany({
    where: { companyId: company.id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      personName: true,
      originalAmount: true,
      remainingAmount: true,
      status: true,
      dueDate: true,
      notes: true,
      payments: {
        orderBy: { paidAt: "desc" },
        select: {
          id: true,
          amount: true,
          paidAt: true,
        },
      },
    },
  });

  return { data: receivables };
}

export async function recordCompanyReceivablePayment(
  input: OwnerContext & { payload: CreateReceivablePaymentInput }
) {
  return createReceivablePaymentTransactionWithDependencies(input, defaultDeps);
}
