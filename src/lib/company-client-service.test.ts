import assert from "node:assert/strict";
import test from "node:test";
import {
  createClientWithDependencies,
  deleteClientWithDependencies,
  listClientsWithDependencies,
  updateClientWithDependencies,
} from "./company-client-service.ts";

function createDeps(overrides: Record<string, unknown> = {}) {
  const calls: Array<{ method: string; args: unknown }> = [];
  const client = {
    id: "client-1",
    companyId: "company-1",
    name: "Acme",
    email: "",
    phone: "",
    companyName: "",
    address: "",
    notes: "",
    createdAt: new Date("2026-05-18T00:00:00.000Z"),
    updatedAt: new Date("2026-05-18T00:00:00.000Z"),
  };
  const prisma = {
    company: {
      findFirst: async (args: unknown) => {
        calls.push({ method: "company.findFirst", args });
        return { id: "company-1", ownerId: "user-1" };
      },
    },
    companyClient: {
      findMany: async (args: unknown) => {
        calls.push({ method: "companyClient.findMany", args });
        return [client];
      },
      findFirst: async (args: unknown) => {
        calls.push({ method: "companyClient.findFirst", args });
        return client;
      },
      create: async (args: unknown) => {
        calls.push({ method: "companyClient.create", args });
        return { ...client, ...(args as { data: object }).data };
      },
      update: async (args: unknown) => {
        calls.push({ method: "companyClient.update", args });
        return { ...client, ...(args as { data: object }).data };
      },
      delete: async (args: unknown) => {
        calls.push({ method: "companyClient.delete", args });
        return { id: "client-1" };
      },
    },
    companyLead: {
      count: async (args: unknown) => {
        calls.push({ method: "companyLead.count", args });
        return 0;
      },
    },
    ...overrides,
  };

  return { prisma, calls };
}

test("listClientsWithDependencies returns company clients for owners", async () => {
  const deps = createDeps();
  const result = await listClientsWithDependencies(
    { userId: "user-1", companyId: "company-1" },
    deps
  );

  assert.deepEqual(result, {
    data: [
      {
        id: "client-1",
        companyId: "company-1",
        name: "Acme",
        email: "",
        phone: "",
        companyName: "",
        address: "",
        notes: "",
        createdAt: new Date("2026-05-18T00:00:00.000Z"),
        updatedAt: new Date("2026-05-18T00:00:00.000Z"),
      },
    ],
  });
});

test("createClientWithDependencies creates trimmed client data for owners", async () => {
  const deps = createDeps();
  const result = await createClientWithDependencies(
    {
      userId: "user-1",
      companyId: "company-1",
      payload: { name: " Acme ", email: " sales@acme.test " },
    },
    deps
  );

  assert.equal("data" in result, true);
  assert.deepEqual(deps.calls.at(-1), {
    method: "companyClient.create",
    args: {
      data: {
        companyId: "company-1",
        name: "Acme",
        email: "sales@acme.test",
        phone: "",
        companyName: "",
        address: "",
        notes: "",
      },
    },
  });
});

test("updateClientWithDependencies rejects clients outside the company", async () => {
  const deps = createDeps({
    companyClient: {
      findFirst: async () => null,
    },
  });

  const result = await updateClientWithDependencies(
    {
      userId: "user-1",
      companyId: "company-1",
      clientId: "client-2",
      payload: { name: "New Name" },
    },
    deps
  );

  assert.deepEqual(result, { error: "NOT_FOUND" });
});

test("deleteClientWithDependencies rejects used clients", async () => {
  const deps = createDeps({
    companyLead: {
      count: async () => 1,
    },
  });

  const result = await deleteClientWithDependencies(
    { userId: "user-1", companyId: "company-1", clientId: "client-1" },
    deps
  );

  assert.deepEqual(result, { error: "CLIENT_IN_USE" });
});
