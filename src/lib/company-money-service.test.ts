import assert from "node:assert/strict";
import test from "node:test";
import {
  createCompanyMoneyTransactionWithDependencies,
  listCompanyMoneyAccountsWithDependencies,
  listCompanyMoneyCategoriesWithDependencies,
  updateCompanyMoneyTransactionWithDependencies,
} from "./company-money-service.ts";

type CompanyMoneyDeps = Parameters<typeof listCompanyMoneyCategoriesWithDependencies>[1];

async function unexpectedCall<T>(): Promise<T> {
  throw new Error("Unexpected mock call");
}

function createDeps(overrides: Record<string, unknown> = {}) {
  const calls: Array<{ method: string; args: unknown }> = [];
  const prisma: CompanyMoneyDeps["prisma"] = {
    company: {
      findFirst: async (args: unknown) => {
        calls.push({ method: "company.findFirst", args });
        return { id: "company-1", ownerId: "user-1" };
      },
    },
    $transaction: async () => unexpectedCall(),
    companyMoneyAccount: {
      findMany: async () => [],
      count: async () => 0,
      create: async () => unexpectedCall(),
    },
    companyMoneyCategory: {
      count: async (args: unknown) => {
        calls.push({ method: "companyMoneyCategory.count", args });
        return 0;
      },
      createMany: async (args: unknown) => {
        calls.push({ method: "companyMoneyCategory.createMany", args });
        return { count: 10 };
      },
      findMany: async (args: unknown) => {
        calls.push({ method: "companyMoneyCategory.findMany", args });
        return [
          {
            id: "cat-1",
            companyId: "company-1",
            name: "Makan",
            kind: "EXPENSE",
            isDefault: true,
            isActive: true,
            createdAt: new Date("2026-05-26T00:00:00.000Z"),
            updatedAt: new Date("2026-05-26T00:00:00.000Z"),
          },
        ];
      },
      create: async () => unexpectedCall(),
      findFirst: async () => null,
      update: async () => unexpectedCall(),
    },
    companyMoneyTransaction: {
      findMany: async () => [],
      create: async () => unexpectedCall(),
      findFirst: async () => null,
      update: async () => unexpectedCall(),
      delete: async () => unexpectedCall(),
    },
    companyMoneyBudgetPlan: {
      findUnique: async () => null,
      findFirst: async () => null,
      create: async () => unexpectedCall(),
    },
    companyMoneyBudgetBucket: {
      deleteMany: async () => unexpectedCall(),
      create: async () => unexpectedCall(),
    },
    companyMoneyWishlistItem: {
      findMany: async () => [],
      create: async () => unexpectedCall(),
      findFirst: async () => null,
      update: async () => unexpectedCall(),
    },
    companyMoneyReceivable: {
      findMany: async () => [],
      findFirst: async () => null,
      create: async () => unexpectedCall(),
      update: async () => unexpectedCall(),
    },
    companyMoneyReceivablePayment: {
      create: async () => unexpectedCall(),
    },
    ...overrides,
  };

  return { prisma, calls };
}

test("listCompanyMoneyCategoriesWithDependencies seeds defaults once per owner company", async () => {
  const deps = createDeps();
  const result = await listCompanyMoneyCategoriesWithDependencies(
    { userId: "user-1", companyId: "company-1" },
    deps
  );

  assert.equal("data" in result, true);
  assert.deepEqual(deps.calls[1], {
    method: "companyMoneyCategory.count",
    args: { where: { companyId: "company-1" } },
  });
  assert.equal(
    deps.calls.some((call) => call.method === "companyMoneyCategory.createMany"),
    true
  );
});

test("listCompanyMoneyAccountsWithDependencies rejects non-owners", async () => {
  const deps = createDeps();
  deps.prisma.company.findFirst = async (args: unknown) => {
    deps.calls.push({ method: "company.findFirst", args });
    return { id: "company-1", ownerId: "user-1" };
  };

  const result = await listCompanyMoneyAccountsWithDependencies(
    { userId: "user-2", companyId: "company-1" },
    deps
  );

  assert.deepEqual(result, { error: "FORBIDDEN" });
});

test("createCompanyMoneyTransactionWithDependencies rejects negative resulting balances", async () => {
  const deps = createDeps({
    companyMoneyAccount: {
      count: async () => 1,
      findMany: async () => [{ id: "acc-1", name: "Cash", type: "CASH" }],
    },
    companyMoneyCategory: {
      count: async () => 1,
    },
    companyMoneyTransaction: {
      findMany: async () => [],
    },
  });

  const result = await createCompanyMoneyTransactionWithDependencies(
    {
      userId: "user-1",
      companyId: "company-1",
      payload: {
        type: "EXPENSE",
        amount: 50_000,
        accountId: "acc-1",
        categoryId: "cat-1",
        occurredAt: "2026-05-25T12:00:00.000Z",
      },
    },
    deps
  );

  assert.deepEqual(result, {
    error: "INVALID_STATE",
    message: "Transaction would make account balance negative.",
  });
});

test("updateCompanyMoneyTransactionWithDependencies rejects transactions outside the company", async () => {
  const deps = createDeps({
    companyMoneyTransaction: {
      findFirst: async () => null,
    },
  });

  const result = await updateCompanyMoneyTransactionWithDependencies(
    {
      userId: "user-1",
      companyId: "company-1",
      transactionId: "txn-1",
      payload: {
        type: "INCOME",
        amount: 200_000,
        accountId: "acc-1",
        occurredAt: "2026-05-25T12:00:00.000Z",
      },
    },
    deps
  );

  assert.deepEqual(result, { error: "NOT_FOUND" });
});
