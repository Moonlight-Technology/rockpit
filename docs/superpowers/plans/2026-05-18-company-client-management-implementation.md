# Company Client Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add owner-managed Company Client CRUD and require new leads to select an existing company client.

**Architecture:** Add `CompanyClient` as company-scoped master data, expose it through owner-only service and API boundaries, then update the Company Mode UI so the Client page manages records and the Lead form selects from those records. Existing leads keep `prospectName` compatibility while new leads persist `clientId` and copy `client.name` into `prospectName`.

**Tech Stack:** Next.js 16 App Router, React 19 client/server components, TypeScript, Prisma with PostgreSQL, Zod, Tailwind/shadcn UI, lucide-react, Node 22 `node --test --experimental-strip-types`, ESLint.

---

## Context And Constraints

- Read `AGENTS.md` and relevant Next.js 16 docs before route/layout/client-boundary edits. The already-read docs were:
  - `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- The worktree already has unrelated or pre-existing dirty files in Company Mode and layout. Do not revert them. Read the current file before editing any dirty file.
- Use `apply_patch` for manual edits.
- Follow TDD: write a failing test, run it and confirm the expected failure, then implement the minimum code.
- Preserve collaborator access: collaborators keep Leads access only; Client management is owner-only.

## File Map

- Modify `prisma/schema.prisma`: add `CompanyClient`, `Company.clients`, `CompanyLead.clientId`, and relations.
- Create `prisma/migrations/20260518090000_company_clients/migration.sql`: SQL for the new table and nullable lead relation.
- Create `src/lib/validators/company-client.ts`: Zod create/update schemas.
- Create `src/lib/validators/company-client.test.ts`: validator tests.
- Create `src/lib/company-client-service.ts`: owner-only list/create/update/delete behavior.
- Create `src/lib/company-client-service.test.ts`: service unit tests using dependency injection.
- Modify `src/lib/validators/company-lead.ts`: require `clientId` for create lead payload.
- Modify `src/lib/company-lead-service.ts`: validate selected client and copy client name into `prospectName`.
- Create `src/lib/company-lead-service.test.ts`: lead creation unit tests for client validation.
- Create `src/app/api/companies/[companyId]/clients/route.ts`: list/create route handlers.
- Create `src/app/api/companies/[companyId]/clients/[clientId]/route.ts`: update/delete route handlers.
- Create `src/app/company/[companyId]/clients/page.tsx`: owner-only Client page.
- Create `src/components/company/client-table.tsx`: interactive client CRUD table and forms.
- Modify `src/components/company/company-shell.tsx`: add Client sidebar item for owners.
- Modify `src/app/company/[companyId]/leads/page.tsx`: load clients and pass them into the lead board.
- Modify `src/components/company/lead-board.tsx`: replace free-text prospect input with client selector.

## Task 1: Add Client Schema And Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260518090000_company_clients/migration.sql`

- [ ] **Step 1: Update Prisma schema**

Add the `clients` relation to `Company`:

```prisma
clients         CompanyClient[]
```

Add `clientId`, `client`, and an index to `CompanyLead`:

```prisma
clientId                String?
client                  CompanyClient?     @relation(fields: [clientId], references: [id], onDelete: Restrict)

@@index([companyId, clientId])
```

Add this model after `Company`:

```prisma
model CompanyClient {
  id          String        @id @default(cuid())
  companyId   String
  name        String
  email       String        @default("")
  phone       String        @default("")
  companyName String        @default("")
  address     String        @default("")
  notes       String        @default("")
  company     Company       @relation(fields: [companyId], references: [id], onDelete: Cascade)
  leads       CompanyLead[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@index([companyId, name])
}
```

- [ ] **Step 2: Add SQL migration**

Create `prisma/migrations/20260518090000_company_clients/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "public"."CompanyClient" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "companyName" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyClient_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "public"."CompanyLead"
ADD COLUMN "clientId" TEXT;

-- CreateIndex
CREATE INDEX "CompanyClient_companyId_name_idx" ON "public"."CompanyClient"("companyId", "name");

-- CreateIndex
CREATE INDEX "CompanyLead_companyId_clientId_idx" ON "public"."CompanyLead"("companyId", "clientId");

-- AddForeignKey
ALTER TABLE "public"."CompanyClient"
ADD CONSTRAINT "CompanyClient_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyLead"
ADD CONSTRAINT "CompanyLead_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "public"."CompanyClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 3: Verify Prisma schema formatting**

Run: `npx prisma format`

Expected: command exits `0` and formats `prisma/schema.prisma`.

- [ ] **Step 4: Commit schema work**

```bash
git add prisma/schema.prisma prisma/migrations/20260518090000_company_clients/migration.sql
git commit -m "feat: add company client schema"
```

## Task 2: Add Client Validators

**Files:**
- Create: `src/lib/validators/company-client.test.ts`
- Create: `src/lib/validators/company-client.ts`

- [ ] **Step 1: Write failing validator tests**

Create `src/lib/validators/company-client.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { createClientSchema, updateClientSchema } from "./company-client.ts";

test("createClientSchema trims client fields and defaults optional strings", () => {
  const parsed = createClientSchema.parse({
    name: "  Jane Doe  ",
    email: " jane@example.com ",
    phone: " 08123456789 ",
    companyName: " PT Jane ",
    address: " Jakarta ",
    notes: " Preferred contact: email ",
  });

  assert.deepEqual(parsed, {
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "08123456789",
    companyName: "PT Jane",
    address: "Jakarta",
    notes: "Preferred contact: email",
  });
});

test("createClientSchema accepts name-only clients", () => {
  const parsed = createClientSchema.parse({ name: "Acme" });

  assert.deepEqual(parsed, {
    name: "Acme",
    email: "",
    phone: "",
    companyName: "",
    address: "",
    notes: "",
  });
});

test("updateClientSchema requires at least one field", () => {
  assert.throws(() => updateClientSchema.parse({}), /At least one field is required/);
});
```

- [ ] **Step 2: Run validator tests and verify RED**

Run: `node --test --experimental-strip-types src/lib/validators/company-client.test.ts`

Expected: FAIL with module-not-found or missing export for `company-client.ts`.

- [ ] **Step 3: Implement validators**

Create `src/lib/validators/company-client.ts`:

```ts
import { z } from "zod";

const optionalClientText = z.string().trim().max(500).default("");

export const createClientSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160).or(z.literal("")).default(""),
  phone: z.string().trim().max(40).default(""),
  companyName: z.string().trim().max(160).default(""),
  address: z.string().trim().max(500).default(""),
  notes: optionalClientText,
});

export const updateClientSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().email().max(160).or(z.literal("")).optional(),
    phone: z.string().trim().max(40).optional(),
    companyName: z.string().trim().max(160).optional(),
    address: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one field is required.",
  });
```

- [ ] **Step 4: Run validator tests and verify GREEN**

Run: `node --test --experimental-strip-types src/lib/validators/company-client.test.ts`

Expected: PASS for all three tests.

- [ ] **Step 5: Commit validators**

```bash
git add src/lib/validators/company-client.ts src/lib/validators/company-client.test.ts
git commit -m "test: cover company client validation"
```

## Task 3: Add Client Service

**Files:**
- Create: `src/lib/company-client-service.test.ts`
- Create: `src/lib/company-client-service.ts`

- [ ] **Step 1: Write failing service tests**

Create `src/lib/company-client-service.test.ts`:

```ts
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
        return [{ id: "client-1", companyId: "company-1", name: "Acme" }];
      },
      findFirst: async (args: unknown) => {
        calls.push({ method: "companyClient.findFirst", args });
        return { id: "client-1", companyId: "company-1", name: "Acme" };
      },
      create: async (args: unknown) => {
        calls.push({ method: "companyClient.create", args });
        return { id: "client-1", ...(args as { data: object }).data };
      },
      update: async (args: unknown) => {
        calls.push({ method: "companyClient.update", args });
        return { id: "client-1", ...(args as { data: object }).data };
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
    data: [{ id: "client-1", companyId: "company-1", name: "Acme" }],
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
```

- [ ] **Step 2: Run service tests and verify RED**

Run: `node --test --experimental-strip-types src/lib/company-client-service.test.ts`

Expected: FAIL with module-not-found or missing export for `company-client-service.ts`.

- [ ] **Step 3: Implement service**

Create `src/lib/company-client-service.ts`:

```ts
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClientSchema, updateClientSchema } from "@/lib/validators/company-client";

type ClientWorkflowError = "FORBIDDEN" | "NOT_FOUND" | "CLIENT_IN_USE";

type ClientDeps = {
  prisma: Pick<PrismaClient, "company" | "companyClient" | "companyLead">;
};

type ClientInput = {
  userId: string;
  companyId: string;
};

const defaultDeps: ClientDeps = { prisma };

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
```

- [ ] **Step 4: Run service tests and verify GREEN**

Run: `node --test --experimental-strip-types src/lib/company-client-service.test.ts`

Expected: PASS for all service tests.

- [ ] **Step 5: Commit client service**

```bash
git add src/lib/company-client-service.ts src/lib/company-client-service.test.ts
git commit -m "feat: add company client service"
```

## Task 4: Add Client API Routes

**Files:**
- Create: `src/app/api/companies/[companyId]/clients/route.ts`
- Create: `src/app/api/companies/[companyId]/clients/[clientId]/route.ts`

- [ ] **Step 1: Implement collection route**

Create `src/app/api/companies/[companyId]/clients/route.ts`:

```ts
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createClientForUser, listClientsForUser } from "@/lib/company-client-service";
import { forbidden, getSessionUserId, notFound, unauthorized, validationError } from "@/lib/api";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { companyId } = await params;
  const result = await listClientsForUser({ userId, companyId });
  if ("error" in result) {
    if (result.error === "FORBIDDEN") {
      return forbidden("Only company owner can manage clients.");
    }
    return notFound("Company not found.");
  }

  return NextResponse.json({ ok: true, data: result.data });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { companyId } = await params;

  try {
    const payload = await req.json().catch(() => null);
    if (payload === null) {
      return validationError("Invalid JSON payload.");
    }

    const result = await createClientForUser({ userId, companyId, payload });
    if ("error" in result) {
      if (result.error === "FORBIDDEN") {
        return forbidden("Only company owner can manage clients.");
      }
      return notFound("Company not found.");
    }

    return NextResponse.json({ ok: true, data: result.data }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return validationError(error.issues[0]?.message ?? "Invalid client payload.");
    }

    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Implement item route**

Create `src/app/api/companies/[companyId]/clients/[clientId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { deleteClientForUser, updateClientForUser } from "@/lib/company-client-service";
import { forbidden, getSessionUserId, notFound, unauthorized, validationError } from "@/lib/api";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ companyId: string; clientId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { companyId, clientId } = await params;

  try {
    const payload = await req.json().catch(() => null);
    if (payload === null) {
      return validationError("Invalid JSON payload.");
    }

    const result = await updateClientForUser({ userId, companyId, clientId, payload });
    if ("error" in result) {
      if (result.error === "FORBIDDEN") {
        return forbidden("Only company owner can manage clients.");
      }
      return notFound("Client not found.");
    }

    return NextResponse.json({ ok: true, data: result.data });
  } catch (error) {
    if (error instanceof ZodError) {
      return validationError(error.issues[0]?.message ?? "Invalid client payload.");
    }

    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ companyId: string; clientId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { companyId, clientId } = await params;
  const result = await deleteClientForUser({ userId, companyId, clientId });
  if ("error" in result) {
    if (result.error === "FORBIDDEN") {
      return forbidden("Only company owner can manage clients.");
    }
    if (result.error === "CLIENT_IN_USE") {
      return validationError("Client is already used by a lead.");
    }
    return notFound("Client not found.");
  }

  return NextResponse.json({ ok: true, data: result.data });
}
```

- [ ] **Step 3: Verify TypeScript for API routes**

Run: `npx tsc --noEmit`

Expected: no type errors from the new route handler signatures.

- [ ] **Step 4: Commit API routes**

```bash
git add src/app/api/companies/[companyId]/clients/route.ts src/app/api/companies/[companyId]/clients/[clientId]/route.ts
git commit -m "feat: add company client api"
```

## Task 5: Add Client Page And Sidebar Navigation

**Files:**
- Create: `src/components/company/client-table.tsx`
- Create: `src/app/company/[companyId]/clients/page.tsx`
- Modify: `src/components/company/company-shell.tsx`

- [ ] **Step 1: Implement Client table component**

Create `src/components/company/client-table.tsx` with a client component that accepts `companyId` and `clients`, renders a create form, table rows, inline edit mode, and delete buttons. Use these exported types and function signature:

```ts
"use client";

export type CompanyClientRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  address: string;
  notes: string;
  updatedAt: string | Date;
};

type ClientTableProps = {
  companyId: string;
  clients: CompanyClientRow[];
};

export function ClientTable({ companyId, clients }: ClientTableProps) {
  // Use fetch(`/api/companies/${companyId}/clients`) for POST.
  // Use fetch(`/api/companies/${companyId}/clients/${clientId}`) for PATCH and DELETE.
  // On success, clear form state and call router.refresh().
}
```

The component must use existing UI primitives from:

```ts
import { useRouter } from "next/navigation";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
```

The create payload shape must be:

```ts
{
  name: form.name,
  email: form.email,
  phone: form.phone,
  companyName: form.companyName,
  address: form.address,
  notes: form.notes
}
```

- [ ] **Step 2: Implement server page**

Create `src/app/company/[companyId]/clients/page.tsx`:

```ts
import { notFound, redirect } from "next/navigation";
import { ClientTable } from "@/components/company/client-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUserId } from "@/lib/api";
import { listClientsForUser } from "@/lib/company-client-service";

export default async function CompanyClientsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  const { companyId } = await params;
  const result = await listClientsForUser({ userId, companyId });
  if ("error" in result) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card text-card-foreground">
        <CardHeader>
          <Badge variant="outline" className="w-fit border-border bg-muted text-muted-foreground">
            Client master data
          </Badge>
          <CardTitle className="text-3xl text-card-foreground">Client</CardTitle>
          <CardDescription className="max-w-2xl text-muted-foreground">
            Manage company clients once, then select them when creating leads.
          </CardDescription>
        </CardHeader>
      </Card>

      <ClientTable companyId={companyId} clients={result.data} />
    </div>
  );
}
```

- [ ] **Step 3: Add Client sidebar item**

In `src/components/company/company-shell.tsx`, import `UsersRound` from `lucide-react`, add:

```ts
const clientsHref = `/company/${company.id}/clients`;
```

Then put this owner-only item before Leads:

```ts
...(canManageSettings
  ? [{ href: clientsHref, label: "Client", icon: UsersRound }]
  : []),
```

- [ ] **Step 4: Verify UI typecheck**

Run: `npx tsc --noEmit`

Expected: no type errors from `ClientTable`, the page, or sidebar imports.

- [ ] **Step 5: Commit Client UI**

```bash
git add src/components/company/client-table.tsx src/app/company/[companyId]/clients/page.tsx src/components/company/company-shell.tsx
git commit -m "feat: add company client page"
```

## Task 6: Require Client Selection When Creating Leads

**Files:**
- Modify: `src/lib/validators/company-lead.ts`
- Create: `src/lib/company-lead-service.test.ts`
- Modify: `src/lib/company-lead-service.ts`
- Modify: `src/app/company/[companyId]/leads/page.tsx`
- Modify: `src/components/company/lead-board.tsx`

- [ ] **Step 1: Write failing lead service tests**

Create `src/lib/company-lead-service.test.ts`:

```ts
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
```

- [ ] **Step 2: Run lead tests and verify RED**

Run: `node --test --experimental-strip-types src/lib/company-lead-service.test.ts`

Expected: FAIL because `createLeadWithDependencies` is not exported or create lead still requires `prospectName`.

- [ ] **Step 3: Update lead validator**

Change `createLeadSchema` in `src/lib/validators/company-lead.ts` to:

```ts
export const createLeadSchema = z.object({
  title: z.string().trim().min(2).max(120),
  clientId: z.string().trim().min(1),
  estimatedValue: z.coerce.number().int().min(0),
  notes: z.string().trim().max(2000).default(""),
  columnId: z.string().trim().min(1),
});
```

Keep `updateLeadSchema.prospectName` unchanged for backward-compatible edits if existing code still sends it.

- [ ] **Step 4: Update lead service with dependency-injected create**

In `src/lib/company-lead-service.ts`, add `companyClient` to the dependency type and export:

```ts
export async function createLeadWithDependencies(
  input: {
    userId: string;
    companyId: string;
    payload: unknown;
  },
  deps: {
    prisma: Pick<typeof prisma, "companyLeadBoard" | "companyClient" | "companyLead">;
  } = { prisma }
) {
  const parsed = createLeadSchema.parse(input.payload);
  const context = await getPrimaryLeadBoardContextWithDependencies(
    input.userId,
    input.companyId,
    deps
  );
  if ("error" in context) {
    return context;
  }

  if (!context.isOwner) {
    return { error: "FORBIDDEN" as const };
  }

  const column = context.columns.find((item) => item.id === parsed.columnId);
  if (!column) {
    return { error: "INVALID_COLUMN" as const };
  }

  const client = await deps.prisma.companyClient.findFirst({
    where: { id: parsed.clientId, companyId: context.companyId },
    select: { id: true, name: true },
  });
  if (!client) {
    return { error: "INVALID_CLIENT" as const };
  }

  const lead = await deps.prisma.companyLead.create({
    data: {
      companyId: context.companyId,
      leadBoardId: context.boardId,
      columnId: column.id,
      ownerUserId: input.userId,
      title: parsed.title,
      clientId: client.id,
      prospectName: client.name,
      estimatedValue: parsed.estimatedValue,
      notes: parsed.notes,
      stage: getStageFromColumnTitle(column.title),
    },
  });

  return { data: lead };
}
```

To support tests, extract the existing private `getPrimaryLeadBoardContext` body into `getPrimaryLeadBoardContextWithDependencies(userId, companyId, deps)` and have `getPrimaryLeadBoardContext` call it with `{ prisma }`.

Make `createLeadForUser` call `createLeadWithDependencies(input, { prisma })`.

- [ ] **Step 5: Update lead API invalid-client response**

In `src/app/api/companies/[companyId]/leads/route.ts`, add this branch:

```ts
if (result.error === "INVALID_CLIENT") {
  return validationError("Selected client is invalid.");
}
```

- [ ] **Step 6: Run lead tests and verify GREEN**

Run: `node --test --experimental-strip-types src/lib/company-lead-service.test.ts`

Expected: PASS for both client-backed lead tests.

- [ ] **Step 7: Load clients on Leads page**

In `src/app/company/[companyId]/leads/page.tsx`, import `listClientsForUser` and fetch clients only for owners:

```ts
import { listClientsForUser } from "@/lib/company-client-service";
```

After `isOwner` is known:

```ts
const clientsResult = isOwner
  ? await listClientsForUser({ userId, companyId })
  : { data: [] };
const clients = "data" in clientsResult ? clientsResult.data : [];
```

Pass `clients={clients}` into `LeadBoard`.

- [ ] **Step 8: Replace prospect input with Client selector**

In `src/components/company/lead-board.tsx`, update props:

```ts
clients: Array<{
  id: string;
  name: string;
  companyName: string;
  email: string;
}>;
```

Change `initialLeadForm.prospectName` to `clientId`, initialize it from `clients[0]?.id ?? ""`, and send `clientId` in the POST body.

Replace the Prospect `<Input>` with:

```tsx
<label className="grid gap-1 text-sm">
  <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Client</span>
  <select
    value={leadForm.clientId}
    onChange={(event) =>
      setLeadForm((current) => ({ ...current, clientId: event.target.value }))
    }
    className="h-8 rounded-lg border border-border bg-background px-3 text-foreground outline-none"
    disabled={clients.length === 0}
  >
    {clients.map((client) => (
      <option key={client.id} value={client.id}>
        {client.companyName ? `${client.name} - ${client.companyName}` : client.name}
      </option>
    ))}
  </select>
</label>
```

Change form validity to require `leadForm.clientId.length > 0`. If `clients.length === 0`, show a small text state:

```tsx
<p className="text-sm text-muted-foreground">
  Create a client first before adding a lead.
</p>
```

- [ ] **Step 9: Verify lead integration**

Run:

```bash
node --test --experimental-strip-types src/lib/company-lead-service.test.ts
npx tsc --noEmit
```

Expected: lead service tests pass and TypeScript has no errors.

- [ ] **Step 10: Commit lead integration**

```bash
git add src/lib/validators/company-lead.ts src/lib/company-lead-service.ts src/lib/company-lead-service.test.ts src/app/api/companies/[companyId]/leads/route.ts src/app/company/[companyId]/leads/page.tsx src/components/company/lead-board.tsx
git commit -m "feat: require clients for company leads"
```

## Task 7: Final Verification

**Files:**
- Read-only verification across changed files.

- [ ] **Step 1: Run all focused tests**

Run:

```bash
node --test --experimental-strip-types src/lib/validators/company-client.test.ts src/lib/company-client-service.test.ts src/lib/company-lead-service.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 2: Run existing company tests**

Run:

```bash
node --test --experimental-strip-types src/lib/company-conversion-service.test.ts src/lib/company-overview.test.ts src/lib/company-quotation-service.test.ts src/lib/validators/company.test.ts
```

Expected: existing company tests pass.

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: ESLint exits `0`.

- [ ] **Step 4: Run production build**

Run: `npm run build`

Expected: Next.js build exits `0`.

- [ ] **Step 5: Inspect git status**

Run: `git status --short`

Expected: only intentional committed changes remain, plus any unrelated dirty files that existed before this plan.

## Self-Review Notes

- Spec coverage: schema, owner-only Client CRUD, sidebar item, Client table, lead creation via `clientId`, delete rejection for used clients, and focused tests are covered.
- Existing lead compatibility is covered by keeping `prospectName` and using nullable `clientId`.
- Collaborator restriction is covered by owner-only service access and owner-only sidebar/page behavior.
- No automatic backfill, import/export, or collaborator client management is included.
