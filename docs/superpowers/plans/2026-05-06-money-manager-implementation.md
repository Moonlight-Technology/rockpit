# Money Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first Money Manager MVP with multi-account IDR transactions, monthly 20/30/50 budget planning, wishlist reminders, balance-affecting piutang, and dashboard navigation.

**Architecture:** Add a focused Money Manager backend domain under Prisma, validators, services, and `/api/money/*` route handlers. Add a single mobile-first `/money-manager` client page that talks to those APIs and refetches affected data after writes. Keep task/board/planner code unchanged except for dashboard navigation.

**Tech Stack:** Next.js 16 App Router, React 19 client components, Prisma 6/PostgreSQL, Zod, Tailwind/shadcn UI components, lucide-react icons, Node 22 `node --test --experimental-strip-types` for pure helper tests.

---

## Context And Constraints

- Read these local Next.js docs before code changes:
  - `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
  - `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md`
- Route handlers live in `src/app/api/**/route.ts` and should return the existing `{ ok, data }` / `{ ok: false, error }` shape.
- Use `getSessionUserId`, `unauthorized`, and `validationError` from `src/lib/api.ts`.
- Use `apply_patch` for manual edits.
- Do not refactor unrelated board, task, planner, or auth code.
- Keep amounts as integer Rupiah values in the database.
- Accounts start at zero. Balance is derived from transactions.
- The first UI implementation should refetch after successful writes instead of optimistic updates.

## File Map

Backend agent owns:

- Modify `prisma/schema.prisma`: add money enums/models and relations from `User`.
- Create `prisma/migrations/<timestamp>_money_manager/migration.sql`: schema migration.
- Create `src/lib/validators/money.ts`: Zod schemas for API payloads.
- Create `src/lib/money.ts`: money service functions and DTO mapping.
- Create `src/lib/money-calculations.ts`: pure balance, budget, and receivable helpers.
- Create `src/lib/money-calculations.test.ts`: Node test coverage for helpers.
- Create `src/app/api/money/accounts/route.ts`
- Create `src/app/api/money/categories/route.ts`
- Create `src/app/api/money/transactions/route.ts`
- Create `src/app/api/money/budgets/route.ts`
- Create `src/app/api/money/wishlist/route.ts`
- Create `src/app/api/money/receivables/route.ts`

Frontend agent owns:

- Create `src/app/money-manager/page.tsx`: mobile-first Money Manager UI.
- Modify `src/app/page.tsx`: add Money Manager navigation in desktop header and mobile menu.

Shared contract:

- Backend returns JSON serializable records with ISO date strings where needed.
- Frontend sends `Content-Type: application/json` and uses API endpoints exactly as listed above.

## API Contract

### `GET /api/money/accounts`

Response:

```ts
{
  ok: true,
  data: Array<{
    id: string;
    name: string;
    type: "CASH" | "BANK" | "EWALLET" | "OTHER";
    balance: number;
    createdAt: string;
    updatedAt: string;
  }>;
}
```

### `POST /api/money/accounts`

Request:

```ts
{
  name: string;
  type: "CASH" | "BANK" | "EWALLET" | "OTHER";
}
```

### `GET /api/money/categories`

Seeds Indonesian defaults for the current user if missing.

Response:

```ts
{
  ok: true,
  data: Array<{
    id: string;
    name: string;
    kind: "INCOME" | "EXPENSE" | "BOTH";
    isDefault: boolean;
    isActive: boolean;
  }>;
}
```

### `POST /api/money/categories`

Request:

```ts
{
  name: string;
  kind: "INCOME" | "EXPENSE" | "BOTH";
}
```

### `GET /api/money/transactions?month=YYYY-MM`

Response:

```ts
{
  ok: true,
  data: Array<{
    id: string;
    type: "INCOME" | "EXPENSE" | "TRANSFER" | "LEND" | "RECEIVABLE_PAYMENT";
    amount: number;
    description: string | null;
    occurredAt: string;
    category: { id: string; name: string } | null;
    account: { id: string; name: string } | null;
    fromAccount: { id: string; name: string } | null;
    toAccount: { id: string; name: string } | null;
    receivable: { id: string; personName: string } | null;
  }>;
}
```

### `POST /api/money/transactions`

Income:

```ts
{
  type: "INCOME";
  amount: number;
  accountId: string;
  categoryId?: string | null;
  description?: string | null;
  occurredAt: string;
}
```

Expense:

```ts
{
  type: "EXPENSE";
  amount: number;
  accountId: string;
  categoryId: string;
  description?: string | null;
  occurredAt: string;
}
```

Transfer:

```ts
{
  type: "TRANSFER";
  amount: number;
  fromAccountId: string;
  toAccountId: string;
  description?: string | null;
  occurredAt: string;
}
```

Lend:

```ts
{
  type: "LEND";
  amount: number;
  accountId: string;
  personName: string;
  dueDate?: string | null;
  description?: string | null;
  occurredAt: string;
}
```

Receivable payment:

```ts
{
  type: "RECEIVABLE_PAYMENT";
  amount: number;
  accountId: string;
  receivableId: string;
  description?: string | null;
  occurredAt: string;
}
```

### `GET /api/money/budgets?month=YYYY-MM`

Gets or creates a budget for the month. When creating a new month, copy the previous budget amount if one exists; otherwise use `0`. Default buckets are `Needs` 50, `Wants` 30, `Saving & Financial Goal` 20.

Response:

```ts
{
  ok: true,
  data: {
    id: string;
    month: string;
    totalAmount: number;
    buckets: Array<{
      id: string;
      label: string;
      percentage: number;
      allocatedAmount: number;
      usedAmount: number;
      remainingAmount: number;
      categories: Array<{ id: string; name: string }>;
    }>;
  };
}
```

### `POST /api/money/budgets`

Request:

```ts
{
  month: string;
  totalAmount: number;
  buckets: Array<{
    id?: string;
    label: string;
    percentage: number;
    categoryIds: string[];
  }>;
}
```

### `GET /api/money/wishlist`

Response:

```ts
{
  ok: true,
  data: Array<{
    id: string;
    name: string;
    estimatedPrice: number;
    priority: "LOW" | "MEDIUM" | "HIGH";
    status: "PLANNED" | "BOUGHT" | "SKIPPED";
    notes: string | null;
  }>;
}
```

### `POST /api/money/wishlist`

Request:

```ts
{
  name: string;
  estimatedPrice: number;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status?: "PLANNED" | "BOUGHT" | "SKIPPED";
  notes?: string | null;
}
```

### `GET /api/money/receivables`

Response:

```ts
{
  ok: true,
  data: Array<{
    id: string;
    personName: string;
    originalAmount: number;
    remainingAmount: number;
    status: "ACTIVE" | "PAID";
    dueDate: string | null;
    notes: string | null;
    payments: Array<{
      id: string;
      amount: number;
      paidAt: string;
    }>;
  }>;
}
```

### `POST /api/money/receivables`

Record repayment only. Lend creation goes through `POST /api/money/transactions` with `type: "LEND"`.

Request:

```ts
{
  receivableId: string;
  amount: number;
  accountId: string;
  paidAt: string;
  notes?: string | null;
}
```

---

## Task 1: Backend Data Model, Helpers, Validators, And APIs

**Owner:** BE agent

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260506000100_money_manager/migration.sql`
- Create: `src/lib/money-calculations.ts`
- Create: `src/lib/money-calculations.test.ts`
- Create: `src/lib/validators/money.ts`
- Create: `src/lib/money.ts`
- Create: `src/app/api/money/accounts/route.ts`
- Create: `src/app/api/money/categories/route.ts`
- Create: `src/app/api/money/transactions/route.ts`
- Create: `src/app/api/money/budgets/route.ts`
- Create: `src/app/api/money/wishlist/route.ts`
- Create: `src/app/api/money/receivables/route.ts`

- [ ] **Step 1: Add a failing helper test for balance calculation**

Create `src/lib/money-calculations.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { calculateAccountBalances } from "./money-calculations.ts";

test("calculateAccountBalances applies income expense transfer lend and receivable payments", () => {
  const balances = calculateAccountBalances([
    { type: "INCOME", amount: 1_000_000, accountId: "cash" },
    { type: "EXPENSE", amount: 125_000, accountId: "cash" },
    { type: "TRANSFER", amount: 200_000, fromAccountId: "cash", toAccountId: "bank" },
    { type: "LEND", amount: 100_000, accountId: "cash" },
    { type: "RECEIVABLE_PAYMENT", amount: 40_000, accountId: "bank" },
  ]);

  assert.equal(balances.cash, 575_000);
  assert.equal(balances.bank, 240_000);
});
```

- [ ] **Step 2: Run the helper test and confirm RED**

Run:

```bash
node --test --experimental-strip-types src/lib/money-calculations.test.ts
```

Expected: FAIL because `src/lib/money-calculations.ts` does not exist.

- [ ] **Step 3: Implement money calculation helpers**

Create `src/lib/money-calculations.ts`:

```ts
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
```

- [ ] **Step 4: Run the helper test and confirm GREEN**

Run:

```bash
node --test --experimental-strip-types src/lib/money-calculations.test.ts
```

Expected: PASS.

- [ ] **Step 5: Add Prisma enums, models, and user relations**

Modify `prisma/schema.prisma` by adding these enums after existing enums:

```prisma
enum MoneyAccountType {
  CASH
  BANK
  EWALLET
  OTHER
}

enum MoneyCategoryKind {
  INCOME
  EXPENSE
  BOTH
}

enum MoneyTransactionType {
  INCOME
  EXPENSE
  TRANSFER
  LEND
  RECEIVABLE_PAYMENT
}

enum MoneyWishlistPriority {
  LOW
  MEDIUM
  HIGH
}

enum MoneyWishlistStatus {
  PLANNED
  BOUGHT
  SKIPPED
}

enum MoneyReceivableStatus {
  ACTIVE
  PAID
}
```

Add these relations to `model User`:

```prisma
  moneyAccounts      MoneyAccount[]
  moneyCategories    MoneyCategory[]
  moneyTransactions  MoneyTransaction[]
  moneyBudgetPlans   MoneyBudgetPlan[]
  moneyWishlistItems MoneyWishlistItem[]
  moneyReceivables   MoneyReceivable[]
```

Add these models after `TaskAssignment`:

```prisma
model MoneyAccount {
  id        String           @id @default(cuid())
  userId    String
  name      String
  type      MoneyAccountType @default(OTHER)
  user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions MoneyTransaction[] @relation("MoneyTransactionAccount")
  outgoingTransfers MoneyTransaction[] @relation("MoneyTransactionFromAccount")
  incomingTransfers MoneyTransaction[] @relation("MoneyTransactionToAccount")
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  @@index([userId, type])
}

model MoneyCategory {
  id        String            @id @default(cuid())
  userId    String
  name      String
  kind      MoneyCategoryKind @default(BOTH)
  isDefault Boolean           @default(false)
  isActive  Boolean           @default(true)
  user      User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions MoneyTransaction[]
  budgetBuckets MoneyBudgetBucketCategory[]
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt

  @@unique([userId, name])
  @@index([userId, isActive])
}

model MoneyTransaction {
  id             String               @id @default(cuid())
  userId         String
  type           MoneyTransactionType
  amount         Int
  categoryId     String?
  accountId      String?
  fromAccountId  String?
  toAccountId    String?
  receivableId   String?
  description    String?
  occurredAt     DateTime
  user           User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  category       MoneyCategory?       @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  account        MoneyAccount?        @relation("MoneyTransactionAccount", fields: [accountId], references: [id], onDelete: SetNull)
  fromAccount    MoneyAccount?        @relation("MoneyTransactionFromAccount", fields: [fromAccountId], references: [id], onDelete: SetNull)
  toAccount      MoneyAccount?        @relation("MoneyTransactionToAccount", fields: [toAccountId], references: [id], onDelete: SetNull)
  receivable     MoneyReceivable?     @relation(fields: [receivableId], references: [id], onDelete: SetNull)
  receivablePayment MoneyReceivablePayment?
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  @@index([userId, occurredAt])
  @@index([accountId])
  @@index([fromAccountId])
  @@index([toAccountId])
  @@index([receivableId])
}

model MoneyBudgetPlan {
  id          String              @id @default(cuid())
  userId      String
  month       DateTime
  totalAmount Int                 @default(0)
  user        User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  buckets     MoneyBudgetBucket[]
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt

  @@unique([userId, month])
}

model MoneyBudgetBucket {
  id           String                      @id @default(cuid())
  budgetPlanId String
  label        String
  percentage   Int
  position     Int                         @default(0)
  budgetPlan   MoneyBudgetPlan             @relation(fields: [budgetPlanId], references: [id], onDelete: Cascade)
  categories   MoneyBudgetBucketCategory[]
  createdAt    DateTime                    @default(now())
  updatedAt    DateTime                    @updatedAt

  @@index([budgetPlanId, position])
}

model MoneyBudgetBucketCategory {
  id         String            @id @default(cuid())
  bucketId   String
  categoryId String
  bucket     MoneyBudgetBucket @relation(fields: [bucketId], references: [id], onDelete: Cascade)
  category   MoneyCategory     @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  createdAt  DateTime          @default(now())
  updatedAt  DateTime          @updatedAt

  @@unique([bucketId, categoryId])
}

model MoneyWishlistItem {
  id             String                @id @default(cuid())
  userId         String
  name           String
  estimatedPrice Int                   @default(0)
  priority       MoneyWishlistPriority @default(MEDIUM)
  status         MoneyWishlistStatus   @default(PLANNED)
  notes          String?
  user           User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt      DateTime              @default(now())
  updatedAt      DateTime              @updatedAt

  @@index([userId, status])
}

model MoneyReceivable {
  id              String                  @id @default(cuid())
  userId          String
  personName      String
  originalAmount  Int
  remainingAmount Int
  status          MoneyReceivableStatus   @default(ACTIVE)
  dueDate         DateTime?
  notes           String?
  user            User                    @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions    MoneyTransaction[]
  payments        MoneyReceivablePayment[]
  createdAt       DateTime                @default(now())
  updatedAt       DateTime                @updatedAt

  @@index([userId, status])
}

model MoneyReceivablePayment {
  id           String           @id @default(cuid())
  receivableId String
  transactionId String          @unique
  amount       Int
  paidAt       DateTime
  receivable   MoneyReceivable  @relation(fields: [receivableId], references: [id], onDelete: Cascade)
  transaction  MoneyTransaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  @@index([receivableId, paidAt])
}
```

- [ ] **Step 6: Create migration SQL**

Create `prisma/migrations/20260506000100_money_manager/migration.sql` matching the Prisma schema. Run this command after editing schema to generate the exact SQL if local database shadow config works:

```bash
npx prisma migrate dev --name money_manager --create-only --schema=./prisma/schema.prisma
```

If the migration command cannot reach the local database, write the SQL manually from the Prisma schema and then run:

```bash
npx prisma generate --schema=./prisma/schema.prisma
```

Expected: Prisma client generation succeeds after schema changes.

- [ ] **Step 7: Add Zod validators**

Create `src/lib/validators/money.ts` with schemas for every request in the API contract:

```ts
import { z } from "zod";

export const moneyAccountTypeSchema = z.enum(["CASH", "BANK", "EWALLET", "OTHER"]);
export const moneyCategoryKindSchema = z.enum(["INCOME", "EXPENSE", "BOTH"]);
export const moneyTransactionTypeSchema = z.enum([
  "INCOME",
  "EXPENSE",
  "TRANSFER",
  "LEND",
  "RECEIVABLE_PAYMENT",
]);
export const moneyWishlistPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const moneyWishlistStatusSchema = z.enum(["PLANNED", "BOUGHT", "SKIPPED"]);

const amountSchema = z.number().int().positive();
const isoDateSchema = z.string().datetime();

export const createMoneyAccountSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: moneyAccountTypeSchema,
});

export const createMoneyCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: moneyCategoryKindSchema,
});

const baseTransactionSchema = z.object({
  type: moneyTransactionTypeSchema,
  amount: amountSchema,
  description: z.string().trim().max(500).optional().nullable(),
  occurredAt: isoDateSchema,
});

export const createMoneyTransactionSchema = z.discriminatedUnion("type", [
  baseTransactionSchema.extend({
    type: z.literal("INCOME"),
    accountId: z.string().cuid(),
    categoryId: z.string().cuid().optional().nullable(),
  }),
  baseTransactionSchema.extend({
    type: z.literal("EXPENSE"),
    accountId: z.string().cuid(),
    categoryId: z.string().cuid(),
  }),
  baseTransactionSchema.extend({
    type: z.literal("TRANSFER"),
    fromAccountId: z.string().cuid(),
    toAccountId: z.string().cuid(),
  }),
  baseTransactionSchema.extend({
    type: z.literal("LEND"),
    accountId: z.string().cuid(),
    personName: z.string().trim().min(1).max(120),
    dueDate: isoDateSchema.optional().nullable(),
  }),
  baseTransactionSchema.extend({
    type: z.literal("RECEIVABLE_PAYMENT"),
    accountId: z.string().cuid(),
    receivableId: z.string().cuid(),
  }),
]);

export const upsertMoneyBudgetSchema = z.object({
  month: z.string().regex(/^\\d{4}-\\d{2}$/),
  totalAmount: z.number().int().min(0),
  buckets: z
    .array(
      z.object({
        id: z.string().cuid().optional(),
        label: z.string().trim().min(1).max(80),
        percentage: z.number().int().min(0).max(100),
        categoryIds: z.array(z.string().cuid()).default([]),
      })
    )
    .min(1)
    .max(8),
});

export const createWishlistItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  estimatedPrice: z.number().int().min(0),
  priority: moneyWishlistPrioritySchema,
  status: moneyWishlistStatusSchema.default("PLANNED"),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const createReceivablePaymentSchema = z.object({
  receivableId: z.string().cuid(),
  amount: amountSchema,
  accountId: z.string().cuid(),
  paidAt: isoDateSchema,
  notes: z.string().trim().max(500).optional().nullable(),
});
```

- [ ] **Step 8: Implement service functions**

Create `src/lib/money.ts`. It must include:

```ts
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
import { allocateBudgetAmount } from "@/lib/money-calculations";

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

export function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(year, monthNumber - 1, 1);
  const end = new Date(year, monthNumber, 1);
  return { start, end };
}

export function normalizeBudgetMonth(month: string) {
  return monthRange(month).start;
}
```

Then implement exported functions matching these signatures:

```ts
export async function ensureDefaultMoneyCategories(userId: string): Promise<void>;
export async function listMoneyAccounts(userId: string): Promise<Array<{ id: string; name: string; type: MoneyAccountType; balance: number; createdAt: Date; updatedAt: Date }>>;
export async function createMoneyAccount(input: { userId: string; name: string; type: MoneyAccountType }): Promise<unknown>;
export async function listMoneyCategories(userId: string): Promise<unknown[]>;
export async function createMoneyCategory(input: { userId: string; name: string; kind: MoneyCategoryKind }): Promise<unknown>;
export async function listMoneyTransactions(userId: string, month: string): Promise<unknown[]>;
export async function createMoneyTransaction(userId: string, payload: unknown): Promise<{ ok: true; data: unknown } | { ok: false; message: string }>;
export async function getOrCreateMoneyBudget(userId: string, month: string): Promise<unknown>;
export async function upsertMoneyBudget(userId: string, payload: unknown): Promise<{ ok: true; data: unknown } | { ok: false; message: string }>;
export async function listWishlistItems(userId: string): Promise<unknown[]>;
export async function createWishlistItem(input: { userId: string; name: string; estimatedPrice: number; priority: MoneyWishlistPriority; status: MoneyWishlistStatus; notes?: string | null }): Promise<unknown>;
export async function listReceivables(userId: string): Promise<unknown[]>;
export async function recordReceivablePayment(userId: string, payload: unknown): Promise<{ ok: true; data: unknown } | { ok: false; message: string }>;
```

Implementation requirements:

- Use `prisma.$transaction` for transfer, lend, and repayment.
- Use a helper to get account balances from all user transactions before creating balance-decreasing transactions.
- Return `{ ok: false, message: "Insufficient balance." }` when expense, transfer, or lend would make a balance negative.
- Return `{ ok: false, message: "Transfer accounts must be different." }` when `fromAccountId === toAccountId`.
- Return `{ ok: false, message: "Payment exceeds remaining receivable." }` when repayment is too large.
- `getOrCreateMoneyBudget` creates default buckets `Needs` 50, `Wants` 30, `Saving & Financial Goal` 20 and copies the newest previous `totalAmount` for that user when available.
- `upsertMoneyBudget` rejects bucket percentage totals that are not exactly `100`.

- [ ] **Step 9: Implement route handlers**

Each route file should follow this pattern:

```ts
import { NextResponse } from "next/server";
import { getSessionUserId, unauthorized, validationError } from "@/lib/api";
import { createMoneyAccountSchema } from "@/lib/validators/money";
import { createMoneyAccount, listMoneyAccounts } from "@/lib/money";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();
  const data = await listMoneyAccounts(userId);
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();
  const payload = await req.json();
  const parsed = createMoneyAccountSchema.safeParse(payload);
  if (!parsed.success) return validationError("Invalid account payload.");
  const data = await createMoneyAccount({ userId, ...parsed.data });
  return NextResponse.json({ ok: true, data }, { status: 201 });
}
```

Adapt imports and service calls for each endpoint in the API contract. For service results shaped as `{ ok: false, message }`, return:

```ts
return NextResponse.json(
  { ok: false, error: { code: "VALIDATION_ERROR", message: result.message } },
  { status: 422 }
);
```

- [ ] **Step 10: Verify backend**

Run:

```bash
node --test --experimental-strip-types src/lib/money-calculations.test.ts
npx prisma generate --schema=./prisma/schema.prisma
npm run lint
```

Expected: all commands pass.

- [ ] **Step 11: Commit backend work**

Run:

```bash
git add prisma/schema.prisma prisma/migrations/20260506000100_money_manager/migration.sql src/lib/money-calculations.ts src/lib/money-calculations.test.ts src/lib/validators/money.ts src/lib/money.ts src/app/api/money
git commit -m "Add Money Manager backend"
```

---

## Task 2: Frontend Money Manager Page And Dashboard Navigation

**Owner:** FE agent

**Files:**

- Create: `src/app/money-manager/page.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add Money Manager navigation to dashboard**

Modify `src/app/page.tsx`:

- Add `WalletCards` to the lucide import.
- Add a desktop button beside Planner:

```tsx
<Button
  size="sm"
  variant="outline"
  onClick={() => router.push("/money-manager")}
>
  <WalletCards data-icon="inline-start" />
  Money Manager
</Button>
```

- Add a mobile menu button beside Planner:

```tsx
<Button
  size="sm"
  variant="ghost"
  className="w-full justify-start"
  onClick={() => {
    setShowMobileMenu(false);
    router.push("/money-manager");
  }}
>
  <WalletCards data-icon="inline-start" />
  Money Manager
</Button>
```

- [ ] **Step 2: Create the client page shell**

Create `src/app/money-manager/page.tsx` starting with:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  Landmark,
  Plus,
  ReceiptText,
  Repeat,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
```

Define local API DTO types matching the API Contract. Use `number` for Rupiah amounts and ISO strings for dates.

- [ ] **Step 3: Add formatting and fetch helpers**

Inside `page.tsx`, add:

```tsx
const formatRupiah = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);

const currentMonthValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

async function readApi<T>(url: string): Promise<T | null> {
  const response = await fetch(url, { cache: "no-store" });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) return null;
  return result.data as T;
}
```

- [ ] **Step 4: Implement page state and data loading**

Add state for:

```tsx
const [month, setMonth] = useState(currentMonthValue);
const [accounts, setAccounts] = useState<MoneyAccount[]>([]);
const [categories, setCategories] = useState<MoneyCategory[]>([]);
const [transactions, setTransactions] = useState<MoneyTransaction[]>([]);
const [budget, setBudget] = useState<MoneyBudget | null>(null);
const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
const [receivables, setReceivables] = useState<Receivable[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [fabOpen, setFabOpen] = useState(false);
const [activeForm, setActiveForm] = useState<"INCOME" | "EXPENSE" | "TRANSFER" | "LEND" | null>(null);
```

Add a `loadMoneyData` function that fetches accounts, categories, transactions, budget, wishlist, and receivables with `Promise.all`, then call it in `useEffect`.

- [ ] **Step 5: Build transaction-first layout**

Render:

- Soft gradient page wrapper matching `src/app/page.tsx`.
- Header with back button to `/`, title `Money Manager`, and month input.
- Horizontal account strip. If no accounts exist, show a card saying `Belum ada akun`.
- Tabs: `Transaksi`, `Budget`, `Wishlist`, `Piutang`, `Akun`.
- `Transaksi` tab as the default and list transactions first.
- FAB fixed to the bottom right with options `Income`, `Expense`, `Transfer`, `Piutang`.

Use compact cards and avoid nested cards.

- [ ] **Step 6: Add create forms**

Use a single modal-like fixed panel controlled by `activeForm`. It must support:

- Income: amount, account, category optional, description.
- Expense: amount, account, category required, description.
- Transfer: amount, from account, to account, description.
- Piutang: amount, source account, person name, due date optional, description.

On submit, POST to `/api/money/transactions`, close the form on success, then call `loadMoneyData()`.

If API returns an error, show the message in the panel.

- [ ] **Step 7: Add account creation**

In the `Akun` tab, add a small form:

```tsx
{
  name: string;
  type: "CASH" | "BANK" | "EWALLET" | "OTHER";
}
```

POST to `/api/money/accounts`, then refetch data.

- [ ] **Step 8: Add budget editing**

In the `Budget` tab:

- Show total amount input.
- Show bucket rows with label, percentage, progress, and selected categories.
- Allow selecting categories using checkboxes per bucket.
- POST to `/api/money/budgets` with `month`, `totalAmount`, and bucket payload.
- Prevent submit if percentages do not total 100 and show `Total persentase harus 100%.`

- [ ] **Step 9: Add wishlist creation**

In the `Wishlist` tab:

- Show list of wishlist items.
- Add form fields for name, estimated price, priority, and notes.
- POST to `/api/money/wishlist`, then refetch.
- Make it clear through layout that wishlist does not affect saldo by not placing any transaction controls in this tab.

- [ ] **Step 10: Add piutang repayment**

In the `Piutang` tab:

- Show receivables with person name, original amount, remaining amount, status, and payments.
- For active receivables, show repayment form with receiving account and amount.
- POST to `/api/money/receivables`, then refetch.

- [ ] **Step 11: Verify frontend**

Run:

```bash
npm run lint
npm run build
```

Expected: both pass.

- [ ] **Step 12: Commit frontend work**

Run:

```bash
git add src/app/money-manager/page.tsx src/app/page.tsx
git commit -m "Add Money Manager UI"
```

---

## Task 3: Integration Verification

**Owner:** Main coordinator

**Files:**

- Review all backend and frontend files touched by Tasks 1 and 2.

- [ ] **Step 1: Regenerate Prisma client**

Run:

```bash
npx prisma generate --schema=./prisma/schema.prisma
```

Expected: Prisma client generation succeeds.

- [ ] **Step 2: Run helper tests**

Run:

```bash
node --test --experimental-strip-types src/lib/money-calculations.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Manual QA**

Start the dev server:

```bash
npm run dev
```

Manual checks:

- Main dashboard desktop header has `Money Manager`.
- Main dashboard mobile menu has `Money Manager`.
- `/money-manager` loads.
- Add account.
- Add income and see balance increase.
- Add expense and see balance decrease.
- Transfer between two accounts and see both balances change.
- Create piutang and see source account decrease.
- Record piutang repayment and see receiving account increase.
- Create budget and assign categories.
- Create wishlist item and confirm it does not change balances.

