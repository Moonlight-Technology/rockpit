import assert from "node:assert/strict";
import test from "node:test";
import { createLeadWithDependencies } from "./company-lead-service.ts";

function createDeps(overrides: Record<string, unknown> = {}) {
  const prisma = {
    companyLeadBoard: {
      findMany: async () => [
        {
          id: "board-1",
          companyId: "company-1",
          company: { ownerId: "user-1" },
          members: [],
          columns: [{ id: "column-1", title: "New", position: 0 }],
        },
      ],
    },
    companyClient: {
      findFirst: async () => ({ id: "client-1", companyId: "company-1", name: "Acme" }),
    },
    companyLead: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "lead-1", ...data }),
    },
    ...overrides,
  };

  return { prisma };
}

test("createLeadWithDependencies creates a lead from a company client", async () => {
  const result = await createLeadWithDependencies(
    {
      userId: "user-1",
      companyId: "company-1",
      payload: {
        title: "Website redesign",
        clientId: "client-1",
        estimatedValue: 5000000,
        notes: "Initial scope",
        columnId: "column-1",
      },
    },
    createDeps()
  );

  assert.equal("data" in result, true);
  if ("data" in result) {
    assert.equal(result.data.clientId, "client-1");
    assert.equal(result.data.prospectName, "Acme");
  }
});

test("createLeadWithDependencies rejects a client outside the company", async () => {
  const result = await createLeadWithDependencies(
    {
      userId: "user-1",
      companyId: "company-1",
      payload: {
        title: "Website redesign",
        clientId: "client-2",
        estimatedValue: 5000000,
        columnId: "column-1",
      },
    },
    createDeps({
      companyClient: {
        findFirst: async () => null,
      },
    })
  );

  assert.deepEqual(result, { error: "INVALID_CLIENT" });
});
