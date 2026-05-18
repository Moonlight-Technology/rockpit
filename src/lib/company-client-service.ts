import type { CompanyClient } from "@prisma/client";
import { prisma } from "./prisma.ts";
import { createClientSchema, updateClientSchema } from "./validators/company-client.ts";

type ClientWorkflowError = "FORBIDDEN" | "NOT_FOUND" | "CLIENT_IN_USE";

type ClientDeps = {
  prisma: {
    company: {
      findFirst: (args: unknown) => Promise<{ id: string; ownerId: string } | null>;
    };
    companyClient: {
      findMany: (args: unknown) => Promise<CompanyClient[]>;
      findFirst: (args: unknown) => Promise<{ id: string } | null>;
      create: (args: unknown) => Promise<CompanyClient>;
      update: (args: unknown) => Promise<CompanyClient>;
      delete: (args: unknown) => Promise<unknown>;
    };
    companyLead: {
      count: (args: unknown) => Promise<number>;
    };
  };
};

type ClientInput = {
  userId: string;
  companyId: string;
};

const defaultDeps: ClientDeps = { prisma: prisma as unknown as ClientDeps["prisma"] };

async function getOwnerCompany(
  input: ClientInput,
  deps: ClientDeps
): Promise<{ id: string; ownerId: string } | { error: ClientWorkflowError }> {
  const company = await deps.prisma.company.findFirst({
    where: { id: input.companyId },
    select: { id: true, ownerId: true },
  });

  if (!company) {
    return { error: "NOT_FOUND" };
  }
  if (company.ownerId !== input.userId) {
    return { error: "FORBIDDEN" };
  }

  return company;
}

export async function listClientsWithDependencies(input: ClientInput, deps: ClientDeps) {
  const company = await getOwnerCompany(input, deps);
  if ("error" in company) {
    return company;
  }

  const clients = await deps.prisma.companyClient.findMany({
    where: { companyId: company.id },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
  });

  return { data: clients };
}

export async function createClientWithDependencies(
  input: ClientInput & { payload: unknown },
  deps: ClientDeps
) {
  const parsed = createClientSchema.parse(input.payload);
  const company = await getOwnerCompany(input, deps);
  if ("error" in company) {
    return company;
  }

  const client = await deps.prisma.companyClient.create({
    data: {
      companyId: company.id,
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone,
      companyName: parsed.companyName,
      address: parsed.address,
      notes: parsed.notes,
    },
  });

  return { data: client };
}

export async function updateClientWithDependencies(
  input: ClientInput & { clientId: string; payload: unknown },
  deps: ClientDeps
) {
  const parsed = updateClientSchema.parse(input.payload);
  const company = await getOwnerCompany(input, deps);
  if ("error" in company) {
    return company;
  }

  const existing = await deps.prisma.companyClient.findFirst({
    where: { id: input.clientId, companyId: company.id },
    select: { id: true },
  });
  if (!existing) {
    return { error: "NOT_FOUND" as const };
  }

  const client = await deps.prisma.companyClient.update({
    where: { id: input.clientId },
    data: parsed,
  });

  return { data: client };
}

export async function deleteClientWithDependencies(
  input: ClientInput & { clientId: string },
  deps: ClientDeps
) {
  const company = await getOwnerCompany(input, deps);
  if ("error" in company) {
    return company;
  }

  const existing = await deps.prisma.companyClient.findFirst({
    where: { id: input.clientId, companyId: company.id },
    select: { id: true },
  });
  if (!existing) {
    return { error: "NOT_FOUND" as const };
  }

  const leadCount = await deps.prisma.companyLead.count({
    where: { companyId: company.id, clientId: input.clientId },
  });
  if (leadCount > 0) {
    return { error: "CLIENT_IN_USE" as const };
  }

  await deps.prisma.companyClient.delete({ where: { id: input.clientId } });

  return { data: { id: input.clientId } };
}

export function listClientsForUser(input: ClientInput) {
  return listClientsWithDependencies(input, defaultDeps);
}

export function createClientForUser(input: ClientInput & { payload: unknown }) {
  return createClientWithDependencies(input, defaultDeps);
}

export function updateClientForUser(input: ClientInput & { clientId: string; payload: unknown }) {
  return updateClientWithDependencies(input, defaultDeps);
}

export function deleteClientForUser(input: ClientInput & { clientId: string }) {
  return deleteClientWithDependencies(input, defaultDeps);
}
