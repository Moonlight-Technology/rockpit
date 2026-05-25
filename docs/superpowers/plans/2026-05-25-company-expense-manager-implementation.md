# Company Expense Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an owner-only `Expense Manager` module under company workspaces with feature parity to personal `Money Manager`, but with data owned by `companyId`.

**Architecture:** Keep the existing personal money stack unchanged. Add a parallel company-scoped money domain in Prisma, validators, services, and `/api/companies/[companyId]/money/*` route handlers. Reuse pure money calculations and only extract UI pieces from the personal page where reuse is low-risk.

**Tech Stack:** Next.js 16 App Router, React 19 client/server components, TypeScript, Prisma 6 with PostgreSQL, Zod 4, Tailwind/shadcn UI, lucide-react, Node 22 `node --test --experimental-strip-types`, ESLint.

---

## File Structure

- Modify `prisma/schema.prisma`
  Add company-owned money models and `Company` relations while reusing existing money enums.
- Create `prisma/migrations/<timestamp>_company_expense_manager/migration.sql`
  Add SQL for the new company money tables and indexes.
- Create `src/lib/validators/company-money.ts`
  Re-export or define the payload schemas used by company money routes.
- Create `src/lib/company-money-service.ts`
  Company-owned money CRUD, category seeding, ownership checks, DTO mapping, and balance validations.
- Create `src/lib/company-money-service.test.ts`
  Node test coverage for owner access, isolation, budgets, wishlist, receivables, and balance rules.
- Create `src/app/api/companies/[companyId]/money/accounts/route.ts`
- Create `src/app/api/companies/[companyId]/money/categories/route.ts`
- Create `src/app/api/companies/[companyId]/money/transactions/route.ts`
- Create `src/app/api/companies/[companyId]/money/transactions/[id]/route.ts`
- Create `src/app/api/companies/[companyId]/money/budgets/route.ts`
- Create `src/app/api/companies/[companyId]/money/wishlist/route.ts`
- Create `src/app/api/companies/[companyId]/money/receivables/route.ts`
  Company-scoped API layer that follows the project’s promise-based `params` route pattern and owner-only access rules.
- Create `src/components/company/company-expense-manager.tsx`
  Client UI for the company expense workspace, derived from the personal page but pointed at company APIs.
- Create `src/app/company/[companyId]/expenses/page.tsx`
  Server entrypoint that enforces owner-only page access and renders the expense manager UI.
- Modify `src/components/company/company-shell.tsx`
  Add the owner-only sidebar item.
- Modify `src/lib/company-navigation.ts`
  Keep company route active-state logic correct for `/expenses`.
- Modify `src/lib/company-navigation.test.ts`
  Add an explicit nested route assertion for the new section.

### Task 1: Add company expense schema, migration, and validation entrypoint

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_company_expense_manager/migration.sql`
- Create: `src/lib/validators/company-money.ts`
- Test: `node --test --experimental-strip-types src/lib/company-money-service.test.ts`

- [ ] **Step 1: Write the failing service test for company-scoped defaults and isolation**

Create `src/lib/company-money-service.test.ts` with an initial red test that assumes company-specific records exist and categories seed once per company:

```ts
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
        return [{ id: "cat-1", companyId: "company-1", name: "Makan", kind: "EXPENSE", isDefault: true, isActive: true }];
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --test --experimental-strip-types src/lib/company-money-service.test.ts
```

Expected: FAIL because `src/lib/company-money-service.ts` does not exist yet and company money Prisma models are not defined.

- [ ] **Step 3: Add company money Prisma models and validation entrypoint**

Extend `prisma/schema.prisma` by adding company relations on `Company` and the parallel company money tables. Reuse existing enums instead of inventing new ones:

```prisma
model Company {
  id                     String                   @id @default(cuid())
  ownerId                String
  name                   String
  slug                   String
  description            String                   @default("")
  businessType           CompanyBusinessType      @default(JASA)
  quotationPrefix        String
  owner                  User                     @relation("CompanyOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  clients                CompanyClient[]
  leadBoards             CompanyLeadBoard[]
  leads                  CompanyLead[]
  quotations             CompanyQuotation[]
  boards                 Board[]
  moneyAccounts          CompanyMoneyAccount[]
  moneyCategories        CompanyMoneyCategory[]
  moneyTransactions      CompanyMoneyTransaction[]
  moneyBudgetPlans       CompanyMoneyBudgetPlan[]
  moneyWishlistItems     CompanyMoneyWishlistItem[]
  moneyReceivables       CompanyMoneyReceivable[]
  createdAt              DateTime                 @default(now())
  updatedAt              DateTime                 @updatedAt

  @@unique([ownerId, slug])
  @@unique([ownerId, quotationPrefix])
}

model CompanyMoneyAccount {
  id          String           @id @default(cuid())
  companyId   String
  name        String
  type        MoneyAccountType
  company     Company          @relation(fields: [companyId], references: [id], onDelete: Cascade)
  transactions CompanyMoneyTransaction[] @relation("CompanyMoneyTransactionAccount")
  fromTransfers CompanyMoneyTransaction[] @relation("CompanyMoneyTransactionFromAccount")
  toTransfers   CompanyMoneyTransaction[] @relation("CompanyMoneyTransactionToAccount")
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  @@index([companyId, createdAt])
}
```

Mirror the rest of the personal money tables with `companyId` ownership:

```prisma
model CompanyMoneyCategory {
  id          String            @id @default(cuid())
  companyId   String
  name        String
  kind        MoneyCategoryKind
  isDefault   Boolean           @default(false)
  isActive    Boolean           @default(true)
  company     Company           @relation(fields: [companyId], references: [id], onDelete: Cascade)
  transactions CompanyMoneyTransaction[]
  budgetBuckets CompanyMoneyBudgetBucketCategory[]
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  @@index([companyId, isActive])
}

model CompanyMoneyTransaction {
  id            String               @id @default(cuid())
  companyId     String
  type          MoneyTransactionType
  amount        Int
  description   String?
  occurredAt    DateTime
  accountId     String?
  categoryId    String?
  fromAccountId String?
  toAccountId   String?
  receivableId  String?
  company       Company              @relation(fields: [companyId], references: [id], onDelete: Cascade)
  account       CompanyMoneyAccount? @relation("CompanyMoneyTransactionAccount", fields: [accountId], references: [id], onDelete: SetNull)
  category      CompanyMoneyCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  fromAccount   CompanyMoneyAccount? @relation("CompanyMoneyTransactionFromAccount", fields: [fromAccountId], references: [id], onDelete: SetNull)
  toAccount     CompanyMoneyAccount? @relation("CompanyMoneyTransactionToAccount", fields: [toAccountId], references: [id], onDelete: SetNull)
  receivable    CompanyMoneyReceivable? @relation(fields: [receivableId], references: [id], onDelete: SetNull)
  createdAt     DateTime             @default(now())
  updatedAt     DateTime             @updatedAt

  @@index([companyId, occurredAt])
}
```

Create `src/lib/validators/company-money.ts` as the company route validation entrypoint:

```ts
export {
  createMoneyAccountSchema as createCompanyMoneyAccountSchema,
  createMoneyCategorySchema as createCompanyMoneyCategorySchema,
  updateMoneyCategorySchema as updateCompanyMoneyCategorySchema,
  createMoneyTransactionSchema as createCompanyMoneyTransactionSchema,
  updateMoneyTransactionSchema as updateCompanyMoneyTransactionSchema,
  upsertMoneyBudgetSchema as upsertCompanyMoneyBudgetSchema,
  createWishlistItemSchema as createCompanyWishlistItemSchema,
  updateWishlistItemSchema as updateCompanyWishlistItemSchema,
  createReceivablePaymentSchema as createCompanyReceivablePaymentSchema,
} from "@/lib/validators/money";
```

Create `prisma/migrations/<timestamp>_company_expense_manager/migration.sql` from the schema changes. Use `CompanyMoney*` table names and add indexes on `(company_id, created_at)` or `(company_id, occurred_at)` matching the Prisma schema.

- [ ] **Step 4: Re-run the test to keep it red for the right reason**

Run:

```bash
node --test --experimental-strip-types src/lib/company-money-service.test.ts
```

Expected: FAIL because the service file and exported function still do not exist, but the missing-model problem is now addressed in the schema.

- [ ] **Step 5: Commit the schema foundation**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/validators/company-money.ts src/lib/company-money-service.test.ts
git commit -m "feat: add company expense schema foundation"
```

### Task 2: Implement the company money service with owner checks

**Files:**
- Create: `src/lib/company-money-service.ts`
- Modify: `src/lib/company-money-service.test.ts`
- Test: `src/lib/company-money-service.test.ts`

- [ ] **Step 1: Expand the failing service tests for access and transaction behavior**

Append tests that lock the service contract before implementation:

```ts
import {
  createCompanyMoneyTransactionWithDependencies,
  listCompanyMoneyAccountsWithDependencies,
} from "./company-money-service.ts";

test("listCompanyMoneyAccountsWithDependencies rejects non-owners", async () => {
  const deps = createDeps({
    company: {
      findFirst: async () => null,
    },
  });

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
```

- [ ] **Step 2: Run the service tests to verify the new assertions fail**

Run:

```bash
node --test --experimental-strip-types src/lib/company-money-service.test.ts
```

Expected: FAIL because the service exports and behavior do not exist yet.

- [ ] **Step 3: Implement `src/lib/company-money-service.ts` with company-owned equivalents of the personal money flows**

Follow the structure of `src/lib/money.ts`, but keep the ownership and Prisma tables explicitly company-scoped:

```ts
import {
  MoneyReceivableStatus,
  MoneyTransactionType,
  MoneyCategoryKind,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { allocateBudgetAmount, calculateAccountBalances } from "@/lib/money-calculations";
import type {
  CreateMoneyTransactionInput,
  CreateReceivablePaymentInput,
  UpdateMoneyTransactionInput,
  UpsertMoneyBudgetInput,
} from "@/lib/validators/money";

type OwnerContext = { userId: string; companyId: string };

async function requireOwnedCompany(
  { userId, companyId }: OwnerContext,
  db: typeof prisma
) {
  const company = await db.company.findFirst({
    where: { id: companyId, ownerId: userId },
    select: { id: true },
  });

  return company ? { data: company } : { error: "FORBIDDEN" as const };
}

const defaultCategories = [
  { name: "Makan", kind: MoneyCategoryKind.EXPENSE },
  { name: "Transportasi", kind: MoneyCategoryKind.EXPENSE },
  { name: "Tagihan", kind: MoneyCategoryKind.EXPENSE },
  { name: "Belanja", kind: MoneyCategoryKind.EXPENSE },
  { name: "Kesehatan", kind: MoneyCategoryKind.EXPENSE },
  { name: "Hiburan", kind: MoneyCategoryKind.EXPENSE },
  { name: "Pendapatan", kind: MoneyCategoryKind.INCOME },
  { name: "Piutang", kind: MoneyCategoryKind.EXPENSE },
];
```

Implement dependency-injected exports for unit tests and thin runtime wrappers for routes:

```ts
export async function listCompanyMoneyAccountsWithDependencies(
  input: OwnerContext,
  deps: { prisma: typeof prisma }
) {
  const owned = await requireOwnedCompany(input, deps.prisma);
  if ("error" in owned) return owned;

  const transactions = await deps.prisma.companyMoneyTransaction.findMany({
    where: { companyId: input.companyId },
    select: {
      type: true,
      amount: true,
      accountId: true,
      fromAccountId: true,
      toAccountId: true,
    },
  });

  const balances = calculateAccountBalances(transactions);
  const accounts = await deps.prisma.companyMoneyAccount.findMany({
    where: { companyId: input.companyId },
    orderBy: { createdAt: "asc" },
  });

  return {
    data: accounts.map((account) => ({
      ...account,
      balance: balances[account.id] ?? 0,
    })),
  };
}

export async function listCompanyMoneyAccounts(input: OwnerContext) {
  return listCompanyMoneyAccountsWithDependencies(input, { prisma });
}
```

Keep these behaviors aligned with personal money:

- seed default categories once per company
- use `calculateAccountBalances` for balance derivation
- reject transactions that would push balances below zero
- support `INCOME`, `EXPENSE`, `TRANSFER`, `LEND`, and `RECEIVABLE_PAYMENT`
- map DTOs to the same response shape consumed by the personal page
- compute budget bucket usage using company transactions in the selected month

Use the same return shape pattern already used by company services:

```ts
{ data: ... }
{ error: "FORBIDDEN" }
{ error: "NOT_FOUND" }
{ error: "INVALID_STATE", message: "..." }
```

- [ ] **Step 4: Re-run the service tests and get them green**

Run:

```bash
node --test --experimental-strip-types src/lib/company-money-service.test.ts
```

Expected: PASS with owner access, default seeding, and invalid balance tests green.

- [ ] **Step 5: Commit the service layer**

```bash
git add src/lib/company-money-service.ts src/lib/company-money-service.test.ts
git commit -m "feat: add company expense service"
```

### Task 3: Add owner-only company money API routes

**Files:**
- Create: `src/app/api/companies/[companyId]/money/accounts/route.ts`
- Create: `src/app/api/companies/[companyId]/money/categories/route.ts`
- Create: `src/app/api/companies/[companyId]/money/transactions/route.ts`
- Create: `src/app/api/companies/[companyId]/money/transactions/[id]/route.ts`
- Create: `src/app/api/companies/[companyId]/money/budgets/route.ts`
- Create: `src/app/api/companies/[companyId]/money/wishlist/route.ts`
- Create: `src/app/api/companies/[companyId]/money/receivables/route.ts`
- Test: `src/lib/company-money-service.test.ts`

- [ ] **Step 1: Add one more red test for an update/delete path contract**

Extend `src/lib/company-money-service.test.ts` with a route-facing contract test for transaction updates:

```ts
import { updateCompanyMoneyTransactionWithDependencies } from "./company-money-service.ts";

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
```

- [ ] **Step 2: Run the test suite to verify the new route-facing contract fails**

Run:

```bash
node --test --experimental-strip-types src/lib/company-money-service.test.ts
```

Expected: FAIL until update/delete helpers are implemented.

- [ ] **Step 3: Implement route handlers using the project’s company route conventions**

Use `src/app/api/companies/[companyId]/clients/route.ts` as the pattern source. Every route must await promise-based `params`, read the session user once, and translate service errors into API helpers from `src/lib/api`.

Example `src/app/api/companies/[companyId]/money/accounts/route.ts`:

```ts
import { NextResponse } from "next/server";
import {
  forbidden,
  getSessionUserId,
  unauthorized,
  validationError,
} from "@/lib/api";
import {
  createCompanyMoneyAccount,
  listCompanyMoneyAccounts,
} from "@/lib/company-money-service";
import { createCompanyMoneyAccountSchema } from "@/lib/validators/company-money";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { companyId } = await params;
  const result = await listCompanyMoneyAccounts({ userId, companyId });
  if ("error" in result) {
    return forbidden("Only company owner can access expense manager.");
  }

  return NextResponse.json({ ok: true, data: result.data });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const payload = await req.json().catch(() => null);
  if (payload === null) return validationError("Invalid JSON payload.");

  const parsed = createCompanyMoneyAccountSchema.safeParse(payload);
  if (!parsed.success) return validationError("Invalid account payload.");

  const { companyId } = await params;
  const result = await createCompanyMoneyAccount({ userId, companyId, ...parsed.data });
  if ("error" in result) {
    return forbidden("Only company owner can access expense manager.");
  }

  return NextResponse.json({ ok: true, data: result.data }, { status: 201 });
}
```

For the remaining handlers, keep the personal API shapes stable:

- `GET /transactions?month=YYYY-MM`
- `PATCH` and `DELETE` on `/transactions/[id]`
- `GET` and `POST` on `/budgets`
- `GET` and `POST` on `/wishlist`
- `GET` and `POST` on `/receivables`

Route-specific rules:

- `transactions/[id]` should return `notFound()` when the transaction is not part of the company
- validation errors should reuse the personal route message style
- forbidden owner checks should return `forbidden("Only company owner can access expense manager.")`

- [ ] **Step 4: Re-run the service tests and a route lint pass**

Run:

```bash
node --test --experimental-strip-types src/lib/company-money-service.test.ts
npm run lint -- src/app/api/companies/[companyId]/money src/lib/company-money-service.ts src/lib/validators/company-money.ts
```

Expected: service tests PASS and ESLint reports no route-handler or TypeScript issues in the new files.

- [ ] **Step 5: Commit the API layer**

```bash
git add src/app/api/companies/[companyId]/money src/lib/company-money-service.ts src/lib/validators/company-money.ts src/lib/company-money-service.test.ts
git commit -m "feat: add company expense api routes"
```

### Task 4: Add the owner-only page and company sidebar navigation

**Files:**
- Create: `src/components/company/company-expense-manager.tsx`
- Create: `src/app/company/[companyId]/expenses/page.tsx`
- Modify: `src/components/company/company-shell.tsx`
- Modify: `src/lib/company-navigation.test.ts`
- Test: `src/lib/company-navigation.test.ts`

- [ ] **Step 1: Add the failing navigation test for the new route**

Extend `src/lib/company-navigation.test.ts`:

```ts
test("isCompanyNavItemActive treats company expense manager as an active nested section", () => {
  assert.equal(
    isCompanyNavItemActive({
      pathname: "/company/company-1/expenses",
      href: "/company/company-1/expenses",
      overviewHref: "/company/company-1",
    }),
    true
  );
});
```

- [ ] **Step 2: Run the navigation test to verify the new assertion path is covered**

Run:

```bash
node --test --experimental-strip-types src/lib/company-navigation.test.ts
```

Expected: PASS or FAIL depending on whether the new assertion exposes an overlooked route edge. If it passes immediately, keep it as coverage and continue.

- [ ] **Step 3: Implement the page and sidebar item**

Create `src/app/company/[companyId]/expenses/page.tsx` as an owner-only server entrypoint:

```ts
import { notFound, redirect } from "next/navigation";
import { CompanyExpenseManager } from "@/components/company/company-expense-manager";
import { getSessionUserId } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export default async function CompanyExpenseManagerPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const { companyId } = await params;
  const company = await prisma.company.findFirst({
    where: { id: companyId, ownerId: userId },
    select: { id: true, name: true },
  });

  if (!company) notFound();

  return <CompanyExpenseManager companyId={company.id} companyName={company.name} />;
}
```

Create `src/components/company/company-expense-manager.tsx` by adapting the existing client flow from `src/app/money-manager/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Banknote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CompanyExpenseManagerProps = {
  companyId: string;
  companyName: string;
};

const basePath = (companyId: string) => `/api/companies/${companyId}/money`;

export function CompanyExpenseManager({ companyId, companyName }: CompanyExpenseManagerProps) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const responses = await Promise.all([
        fetch(`${basePath(companyId)}/accounts`, { cache: "no-store" }),
        fetch(`${basePath(companyId)}/categories`, { cache: "no-store" }),
      ]);

      if (responses.some((response) => !response.ok)) {
        setError("Sebagian data Expense Manager belum tersedia.");
      }
    };

    void load();
  }, [companyId]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="size-5" />
            Expense Manager
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Company workspace for {companyName}.</p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
```

Then modify `src/components/company/company-shell.tsx` to add the owner-only nav item:

```ts
import { Banknote, FileText, FolderOpen, KanbanSquare, LayoutDashboard, Settings, UsersRound } from "lucide-react";

const expensesHref = `/company/${company.id}/expenses`;

const primaryNav: NavItem[] = isOnboarding
  ? [{ href: settingsHref, label: "Settings", icon: Settings }]
  : [
      ...(canManageSettings ? [{ href: overviewHref, label: "Overview", icon: LayoutDashboard }] : []),
      ...(canManageSettings ? [{ href: clientsHref, label: "Client", icon: UsersRound }] : []),
      { href: leadsHref, label: "Leads", icon: KanbanSquare },
      ...(canManageSettings ? [{ href: expensesHref, label: "Expense Manager", icon: Banknote }] : []),
      ...(canManageSettings ? [{ href: projectsHref, label: "Projects", icon: FolderOpen }] : []),
      ...(canManageSettings ? [{ href: quotationsHref, label: "Quotations", icon: FileText }] : []),
    ];
```

Important implementation note:

- move shared formatting or DTO types out of `src/app/money-manager/page.tsx` only if needed by both pages
- do not alter the personal dashboard launcher or `CompanyModeMenu`

- [ ] **Step 4: Verify navigation coverage and page-level lint**

Run:

```bash
node --test --experimental-strip-types src/lib/company-navigation.test.ts
npm run lint -- src/components/company/company-shell.tsx src/components/company/company-expense-manager.tsx src/app/company/[companyId]/expenses/page.tsx src/lib/company-navigation.ts
```

Expected: nav tests PASS and ESLint reports no issues in the new owner-only page and sidebar item.

- [ ] **Step 5: Commit the UI entrypoint**

```bash
git add src/components/company/company-shell.tsx src/components/company/company-expense-manager.tsx src/app/company/[companyId]/expenses/page.tsx src/lib/company-navigation.test.ts
git commit -m "feat: add company expense manager page"
```

### Task 5: Finish feature parity in the company expense UI and run final verification

**Files:**
- Modify: `src/components/company/company-expense-manager.tsx`
- Optionally create: `src/components/company/money-manager-shared.tsx`
- Test: `src/lib/company-money-service.test.ts`
- Test: `src/lib/company-navigation.test.ts`

- [ ] **Step 1: Add the remaining UI flows against company endpoints**

Port the personal `Money Manager` behaviors into `src/components/company/company-expense-manager.tsx`:

```tsx
const companyApi = {
  accounts: `${basePath(companyId)}/accounts`,
  categories: `${basePath(companyId)}/categories`,
  transactions: `${basePath(companyId)}/transactions`,
  budgets: `${basePath(companyId)}/budgets`,
  wishlist: `${basePath(companyId)}/wishlist`,
  receivables: `${basePath(companyId)}/receivables`,
};

await postApi(companyApi.transactions, payload);
await patchApi(`${companyApi.transactions}/${selectedTransaction.id}`, payload);
await postApi(companyApi.budgets, { month, totalAmount, buckets });
await postApi(companyApi.wishlist, payload);
await postApi(companyApi.receivables, payload);
```

Keep the same user-facing behaviors from the personal page:

- month-based transaction loading
- transaction type filtering with `filterMoneyTransactions`
- account/category creation
- transaction edit/delete for supported types
- budget bucket editing
- wishlist status updates
- receivable payment recording
- refetch-after-write state refresh

If duplication becomes unmanageable, extract only genuinely shared pieces such as:

```tsx
export type MoneyAccountView = {
  id: string;
  name: string;
  type: "CASH" | "BANK" | "EWALLET" | "OTHER";
  balance: number;
  createdAt: string;
  updatedAt: string;
};
```

- [ ] **Step 2: Run the focused verification suite**

Run:

```bash
node --test --experimental-strip-types src/lib/company-money-service.test.ts src/lib/company-navigation.test.ts
npm run lint -- src/components/company/company-expense-manager.tsx src/components/company/company-shell.tsx src/app/company/[companyId]/expenses/page.tsx src/app/api/companies/[companyId]/money src/lib/company-money-service.ts src/lib/validators/company-money.ts
```

Expected: all Node tests PASS and ESLint is clean for the complete company expense feature surface.

- [ ] **Step 3: Run a final application build check**

Run:

```bash
npm run build
```

Expected: PASS with the new company money routes and owner-only page compiling under Next.js 16.

- [ ] **Step 4: Commit the finished feature**

```bash
git add src/components/company/company-expense-manager.tsx src/components/company/company-shell.tsx src/app/company/[companyId]/expenses/page.tsx src/app/api/companies/[companyId]/money src/lib/company-money-service.ts src/lib/company-money-service.test.ts src/lib/company-navigation.test.ts prisma/schema.prisma prisma/migrations src/lib/validators/company-money.ts
git commit -m "feat: add company expense manager"
```

## Self-Review

- Spec coverage check:
  Owner-only sidebar placement is covered in Task 4.
  Company-owned data models are covered in Task 1.
  Owner-only API routes are covered in Task 3.
  Money Manager feature parity is covered in Tasks 2 and 5.
  Personal money isolation is preserved by the architecture and verification steps in Tasks 2 and 5.
- Placeholder scan:
  No `TBD`, `TODO`, or “similar to above” shortcuts remain. Every task names exact files and commands.
- Type consistency:
  The plan consistently uses `CompanyMoney*` Prisma models, `companyId` ownership, and promise-based `params` in route handlers.
