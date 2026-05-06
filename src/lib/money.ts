import {
  MoneyAccountType,
  MoneyCategoryKind,
  MoneyReceivableStatus,
  MoneyTransactionType,
  MoneyWishlistPriority,
  MoneyWishlistStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { allocateBudgetAmount, calculateAccountBalances } from "@/lib/money-calculations";
import type {
  CreateMoneyTransactionInput,
  CreateReceivablePaymentInput,
  UpsertMoneyBudgetInput,
} from "@/lib/validators/money";

const defaultCategories = [
  { name: "Makan", kind: MoneyCategoryKind.EXPENSE },
  { name: "Transportasi", kind: MoneyCategoryKind.EXPENSE },
  { name: "Tagihan", kind: MoneyCategoryKind.EXPENSE },
  { name: "Belanja", kind: MoneyCategoryKind.EXPENSE },
  { name: "Kesehatan", kind: MoneyCategoryKind.EXPENSE },
  { name: "Hiburan", kind: MoneyCategoryKind.EXPENSE },
  { name: "Gaji", kind: MoneyCategoryKind.INCOME },
  { name: "Bonus", kind: MoneyCategoryKind.INCOME },
  { name: "Hadiah", kind: MoneyCategoryKind.BOTH },
  { name: "Piutang", kind: MoneyCategoryKind.EXPENSE },
];

const defaultBudgetBuckets = [
  { label: "Needs", percentage: 50, position: 0 },
  { label: "Wants", percentage: 30, position: 1 },
  { label: "Saving & Financial Goal", percentage: 20, position: 2 },
];

const transactionInclude = {
  category: { select: { id: true, name: true } },
  account: { select: { id: true, name: true } },
  fromAccount: { select: { id: true, name: true } },
  toAccount: { select: { id: true, name: true } },
  receivable: { select: { id: true, personName: true } },
} satisfies Prisma.MoneyTransactionInclude;

const budgetInclude = {
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
} satisfies Prisma.MoneyBudgetPlanInclude;

export function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(year, monthNumber - 1, 1);
  const end = new Date(year, monthNumber, 1);
  return { start, end };
}

export function normalizeBudgetMonth(month: string) {
  return monthRange(month).start;
}

function toMonthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function mapTransaction(transaction: Prisma.MoneyTransactionGetPayload<{ include: typeof transactionInclude }>) {
  return {
    id: transaction.id,
    type: transaction.type,
    amount: transaction.amount,
    description: transaction.description,
    occurredAt: transaction.occurredAt,
    category: transaction.category,
    account: transaction.account,
    fromAccount: transaction.fromAccount,
    toAccount: transaction.toAccount,
    receivable: transaction.receivable,
  };
}

async function userAccountBalances(userId: string) {
  const transactions = await prisma.moneyTransaction.findMany({
    where: { userId },
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

async function requireAccounts(userId: string, accountIds: string[]) {
  const uniqueIds = Array.from(new Set(accountIds));
  const count = await prisma.moneyAccount.count({
    where: { userId, id: { in: uniqueIds } },
  });
  return count === uniqueIds.length;
}

async function requireCategories(userId: string, categoryIds: string[]) {
  const uniqueIds = Array.from(new Set(categoryIds));
  if (uniqueIds.length === 0) return true;

  const count = await prisma.moneyCategory.count({
    where: { userId, id: { in: uniqueIds }, isActive: true },
  });
  return count === uniqueIds.length;
}

async function mapBudgetPlan(
  plan: Prisma.MoneyBudgetPlanGetPayload<{ include: typeof budgetInclude }>
) {
  const { start, end } = monthRange(toMonthValue(plan.month));
  const categoryIds = plan.buckets.flatMap((bucket) =>
    bucket.categories.map((bucketCategory) => bucketCategory.categoryId)
  );
  const expenses = categoryIds.length
    ? await prisma.moneyTransaction.findMany({
        where: {
          userId: plan.userId,
          type: MoneyTransactionType.EXPENSE,
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
        (sum, expense) => sum + (expense.categoryId && bucketCategoryIds.has(expense.categoryId) ? expense.amount : 0),
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

async function createReceivablePaymentTransaction(
  userId: string,
  payload: CreateReceivablePaymentInput | Extract<CreateMoneyTransactionInput, { type: "RECEIVABLE_PAYMENT" }>
) {
  const isReceivablePaymentPayload = "paidAt" in payload;
  const occurredAt = isReceivablePaymentPayload ? payload.paidAt : payload.occurredAt;
  const description = isReceivablePaymentPayload ? payload.notes : payload.description;
  const [accountExists, receivable] = await Promise.all([
    requireAccounts(userId, [payload.accountId]),
    prisma.moneyReceivable.findFirst({ where: { id: payload.receivableId, userId } }),
  ]);

  if (!accountExists || !receivable) {
    return { ok: false as const, message: "Money record not found." };
  }

  if (payload.amount > receivable.remainingAmount) {
    return { ok: false as const, message: "Payment exceeds remaining receivable." };
  }

  const transaction = await prisma.$transaction(async (tx) => {
    const createdTransaction = await tx.moneyTransaction.create({
      data: {
        userId,
        type: MoneyTransactionType.RECEIVABLE_PAYMENT,
        amount: payload.amount,
        accountId: payload.accountId,
        receivableId: payload.receivableId,
        description,
        occurredAt: new Date(occurredAt),
      },
      include: transactionInclude,
    });

    await tx.moneyReceivablePayment.create({
      data: {
        receivableId: payload.receivableId,
        transactionId: createdTransaction.id,
        amount: payload.amount,
        paidAt: new Date(occurredAt),
      },
    });

    const remainingAmount = receivable.remainingAmount - payload.amount;
    await tx.moneyReceivable.update({
      where: { id: payload.receivableId },
      data: {
        remainingAmount,
        status: remainingAmount === 0 ? MoneyReceivableStatus.PAID : MoneyReceivableStatus.ACTIVE,
      },
    });

    return createdTransaction;
  });

  return { ok: true as const, data: mapTransaction(transaction) };
}

export async function ensureDefaultMoneyCategories(userId: string): Promise<void> {
  await prisma.$transaction(
    defaultCategories.map((category) =>
      prisma.moneyCategory.upsert({
        where: { userId_name: { userId, name: category.name } },
        create: { userId, ...category, isDefault: true },
        update: {},
      })
    )
  );
}

export async function listMoneyAccounts(userId: string): Promise<
  Array<{
    id: string;
    name: string;
    type: MoneyAccountType;
    balance: number;
    createdAt: Date;
    updatedAt: Date;
  }>
> {
  const [accounts, balances] = await Promise.all([
    prisma.moneyAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
    userAccountBalances(userId),
  ]);

  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    balance: balances[account.id] ?? 0,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  }));
}

export async function createMoneyAccount(input: {
  userId: string;
  name: string;
  type: MoneyAccountType;
}) {
  return prisma.moneyAccount.create({
    data: input,
  });
}

export async function listMoneyCategories(userId: string) {
  await ensureDefaultMoneyCategories(userId);
  return prisma.moneyCategory.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      kind: true,
      isDefault: true,
      isActive: true,
    },
  });
}

export async function createMoneyCategory(input: {
  userId: string;
  name: string;
  kind: MoneyCategoryKind;
}) {
  return prisma.moneyCategory.create({
    data: input,
    select: {
      id: true,
      name: true,
      kind: true,
      isDefault: true,
      isActive: true,
    },
  });
}

export async function updateMoneyCategory(input: {
  userId: string;
  id: string;
  name: string;
  kind: MoneyCategoryKind;
}) {
  const category = await prisma.moneyCategory.findFirst({
    where: { id: input.id, userId: input.userId },
    select: { id: true },
  });
  if (!category) {
    return { ok: false as const, message: "Money record not found." };
  }

  const updated = await prisma.moneyCategory.update({
    where: { id: input.id },
    data: {
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

  return { ok: true as const, data: updated };
}

export async function listMoneyTransactions(userId: string, month: string) {
  const { start, end } = monthRange(month);
  const transactions = await prisma.moneyTransaction.findMany({
    where: { userId, occurredAt: { gte: start, lt: end } },
    include: transactionInclude,
    orderBy: { occurredAt: "desc" },
  });

  return transactions.map(mapTransaction);
}

export async function createMoneyTransaction(userId: string, payload: CreateMoneyTransactionInput) {
  if (payload.type === "INCOME") {
    const [accountExists, categoryExists] = await Promise.all([
      requireAccounts(userId, [payload.accountId]),
      payload.categoryId ? requireCategories(userId, [payload.categoryId]) : true,
    ]);

    if (!accountExists || !categoryExists) {
      return { ok: false as const, message: "Money record not found." };
    }

    const transaction = await prisma.moneyTransaction.create({
      data: {
        userId,
        type: payload.type,
        amount: payload.amount,
        accountId: payload.accountId,
        categoryId: payload.categoryId,
        description: payload.description,
        occurredAt: new Date(payload.occurredAt),
      },
      include: transactionInclude,
    });

    return { ok: true as const, data: mapTransaction(transaction) };
  }

  if (payload.type === "EXPENSE") {
    const [accountExists, categoryExists, balances] = await Promise.all([
      requireAccounts(userId, [payload.accountId]),
      requireCategories(userId, [payload.categoryId]),
      userAccountBalances(userId),
    ]);

    if (!accountExists || !categoryExists) {
      return { ok: false as const, message: "Money record not found." };
    }

    if ((balances[payload.accountId] ?? 0) < payload.amount) {
      return { ok: false as const, message: "Insufficient balance." };
    }

    const transaction = await prisma.moneyTransaction.create({
      data: {
        userId,
        type: payload.type,
        amount: payload.amount,
        accountId: payload.accountId,
        categoryId: payload.categoryId,
        description: payload.description,
        occurredAt: new Date(payload.occurredAt),
      },
      include: transactionInclude,
    });

    return { ok: true as const, data: mapTransaction(transaction) };
  }

  if (payload.type === "TRANSFER") {
    if (payload.fromAccountId === payload.toAccountId) {
      return { ok: false as const, message: "Transfer accounts must be different." };
    }

    const [accountsExist, balances] = await Promise.all([
      requireAccounts(userId, [payload.fromAccountId, payload.toAccountId]),
      userAccountBalances(userId),
    ]);

    if (!accountsExist) {
      return { ok: false as const, message: "Money record not found." };
    }

    if ((balances[payload.fromAccountId] ?? 0) < payload.amount) {
      return { ok: false as const, message: "Insufficient balance." };
    }

    const transaction = await prisma.$transaction((tx) =>
      tx.moneyTransaction.create({
        data: {
          userId,
          type: payload.type,
          amount: payload.amount,
          fromAccountId: payload.fromAccountId,
          toAccountId: payload.toAccountId,
          description: payload.description,
          occurredAt: new Date(payload.occurredAt),
        },
        include: transactionInclude,
      })
    );

    return { ok: true as const, data: mapTransaction(transaction) };
  }

  if (payload.type === "LEND") {
    const [accountExists, balances] = await Promise.all([
      requireAccounts(userId, [payload.accountId]),
      userAccountBalances(userId),
    ]);

    if (!accountExists) {
      return { ok: false as const, message: "Money record not found." };
    }

    if ((balances[payload.accountId] ?? 0) < payload.amount) {
      return { ok: false as const, message: "Insufficient balance." };
    }

    const transaction = await prisma.$transaction(async (tx) => {
      const receivable = await tx.moneyReceivable.create({
        data: {
          userId,
          personName: payload.personName,
          originalAmount: payload.amount,
          remainingAmount: payload.amount,
          dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
          notes: payload.description,
        },
      });

      return tx.moneyTransaction.create({
        data: {
          userId,
          type: payload.type,
          amount: payload.amount,
          accountId: payload.accountId,
          receivableId: receivable.id,
          description: payload.description,
          occurredAt: new Date(payload.occurredAt),
        },
        include: transactionInclude,
      });
    });

    return { ok: true as const, data: mapTransaction(transaction) };
  }

  return createReceivablePaymentTransaction(userId, payload);
}

export async function getOrCreateMoneyBudget(userId: string, month: string) {
  const budgetMonth = normalizeBudgetMonth(month);
  const existing = await prisma.moneyBudgetPlan.findUnique({
    where: { userId_month: { userId, month: budgetMonth } },
    include: budgetInclude,
  });

  if (existing) {
    return mapBudgetPlan(existing);
  }

  const previous = await prisma.moneyBudgetPlan.findFirst({
    where: { userId, month: { lt: budgetMonth } },
    orderBy: { month: "desc" },
    select: { totalAmount: true },
  });

  const created = await prisma.moneyBudgetPlan.create({
    data: {
      userId,
      month: budgetMonth,
      totalAmount: previous?.totalAmount ?? 0,
      buckets: {
        create: defaultBudgetBuckets,
      },
    },
    include: budgetInclude,
  });

  return mapBudgetPlan(created);
}

export async function upsertMoneyBudget(userId: string, payload: UpsertMoneyBudgetInput) {
  const percentageTotal = payload.buckets.reduce((sum, bucket) => sum + bucket.percentage, 0);
  if (percentageTotal !== 100) {
    return { ok: false as const, message: "Budget bucket percentages must total 100." };
  }

  const categoryIds = payload.buckets.flatMap((bucket) => bucket.categoryIds);
  const uniqueCategoryIds = new Set(categoryIds);
  if (uniqueCategoryIds.size !== categoryIds.length) {
    return { ok: false as const, message: "Each category can only be assigned to one budget bucket." };
  }

  const categoriesExist = await requireCategories(userId, categoryIds);
  if (!categoriesExist) {
    return { ok: false as const, message: "Money record not found." };
  }

  const budgetMonth = normalizeBudgetMonth(payload.month);
  const plan = await prisma.$transaction(async (tx) => {
    const upserted = await tx.moneyBudgetPlan.upsert({
      where: { userId_month: { userId, month: budgetMonth } },
      create: { userId, month: budgetMonth, totalAmount: payload.totalAmount },
      update: { totalAmount: payload.totalAmount },
    });

    await tx.moneyBudgetBucket.deleteMany({ where: { budgetPlanId: upserted.id } });

    for (const [position, bucket] of payload.buckets.entries()) {
      await tx.moneyBudgetBucket.create({
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

    return tx.moneyBudgetPlan.findUniqueOrThrow({
      where: { id: upserted.id },
      include: budgetInclude,
    });
  });

  return { ok: true as const, data: await mapBudgetPlan(plan) };
}

export async function listWishlistItems(userId: string) {
  return prisma.moneyWishlistItem.findMany({
    where: { userId },
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
}

export async function createWishlistItem(input: {
  userId: string;
  name: string;
  estimatedPrice: number;
  priority: MoneyWishlistPriority;
  status: MoneyWishlistStatus;
  notes?: string | null;
}) {
  return prisma.moneyWishlistItem.create({
    data: input,
    select: {
      id: true,
      name: true,
      estimatedPrice: true,
      priority: true,
      status: true,
      notes: true,
    },
  });
}

export async function listReceivables(userId: string) {
  return prisma.moneyReceivable.findMany({
    where: { userId },
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
}

export async function recordReceivablePayment(
  userId: string,
  payload: CreateReceivablePaymentInput
) {
  return createReceivablePaymentTransaction(userId, payload);
}
