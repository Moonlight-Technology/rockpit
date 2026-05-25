import assert from "node:assert/strict";
import test from "node:test";
import { listCompanyMoneyCategoriesWithDependencies } from "./company-money-service.ts";

function createDeps(overrides: Record<string, unknown> = {}) {
  const calls: Array<{ method: string; args: unknown }> = [];
  const prisma = {
    company: {
      findFirst: async (args: unknown) => {
        calls.push({ method: "company.findFirst", args });
        return { id: "company-1", ownerId: "user-1" };
      },
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
          },
        ];
      },
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
