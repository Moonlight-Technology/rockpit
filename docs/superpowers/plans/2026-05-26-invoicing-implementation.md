# Invoicing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build company-mode invoicing so approved quotations can spawn one or more invoices with capped totals, standalone invoice pages, and manual status management.

**Architecture:** Add a dedicated invoice domain beside quotations, centered on new Prisma `CompanyInvoice` and `CompanyInvoiceLine` models plus a focused `company-invoice-service`. Reuse existing company ownership and route patterns, keep invoice amounts as immutable snapshots, and expose invoice creation from approved quotation detail plus a dedicated invoices workspace.

**Tech Stack:** Next.js 16 App Router, React 19 client/server components, TypeScript, Prisma/PostgreSQL, Zod, Node `node --test --experimental-strip-types`, ESLint, Tailwind/shadcn UI, lucide-react.

---

## File Map

- Create: `prisma/migrations/20260526093000_company_invoicing/migration.sql`
- Modify: `prisma/schema.prisma`
- Create: `src/lib/validators/company-invoice.ts`
- Create: `src/lib/company-invoice-service.ts`
- Create: `src/lib/company-invoice-service.test.ts`
- Create: `src/app/api/companies/[companyId]/invoices/route.ts`
- Create: `src/app/api/companies/[companyId]/invoices/[invoiceId]/route.ts`
- Create: `src/components/company/invoice-editor.tsx`
- Create: `src/components/company/invoice-status-control.tsx`
- Create: `src/app/company/[companyId]/invoices/page.tsx`
- Create: `src/app/company/[companyId]/invoices/[invoiceId]/page.tsx`
- Modify: `src/app/company/[companyId]/quotations/[quotationId]/page.tsx`
- Modify: `src/components/company/company-shell.tsx`

### Task 1: Schema, validator, and pure invoice rules

**Files:**
- Create: `prisma/migrations/20260526093000_company_invoicing/migration.sql`
- Modify: `prisma/schema.prisma`
- Create: `src/lib/validators/company-invoice.ts`
- Create: `src/lib/company-invoice-service.test.ts`
- Test: `src/lib/company-invoice-service.test.ts`

- [ ] **Step 1: Write the failing validator and helper tests**

Append these tests to `src/lib/company-invoice-service.test.ts` first so the new API surface is pinned before implementation:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  applyInvoiceStatusTransition,
  calculateInvoiceTotals,
  formatInvoiceNumber,
  nextInvoiceSequence,
} from "./company-invoice-service.ts";
import { createInvoiceSchema, updateInvoiceStatusSchema } from "./validators/company-invoice.ts";

test("formatInvoiceNumber builds a company-prefixed sequence number", () => {
  assert.equal(
    formatInvoiceNumber({
      prefix: "ITEK",
      issuedAt: new Date("2026-05-26T00:00:00.000Z"),
      sequence: 7,
    }),
    "ITEK/INV/2026/05/007"
  );
});

test("nextInvoiceSequence increments within the same month", () => {
  assert.equal(
    nextInvoiceSequence({
      prefix: "ITEK",
      issuedAt: new Date("2026-05-26T00:00:00.000Z"),
      existingInvoiceNumbers: ["ITEK/INV/2026/05/001", "ITEK/INV/2026/05/009"],
    }),
    10
  );
});

test("calculateInvoiceTotals sums line items", () => {
  assert.deepEqual(
    calculateInvoiceTotals({
      lines: [
        { description: "DP", quantity: 1, unitPrice: 2_000_000 },
        { description: "Setup", quantity: 2, unitPrice: 500_000 },
      ],
    }),
    { subtotal: 3_000_000, total: 3_000_000 }
  );
});

test("applyInvoiceStatusTransition sets issuedAt when moving draft to sent", () => {
  const now = new Date("2026-05-26T10:00:00.000Z");
  assert.deepEqual(
    applyInvoiceStatusTransition({
      currentStatus: "DRAFT",
      nextStatus: "SENT",
      timestamps: { issuedAt: null, paidAt: null, cancelledAt: null },
      now,
    }),
    {
      changed: true,
      updates: { status: "SENT", issuedAt: now },
    }
  );
});

test("applyInvoiceStatusTransition rejects invalid transitions", () => {
  assert.throws(() =>
    applyInvoiceStatusTransition({
      currentStatus: "PAID",
      nextStatus: "DRAFT",
      timestamps: { issuedAt: new Date(), paidAt: new Date(), cancelledAt: null },
      now: new Date("2026-05-26T10:00:00.000Z"),
    })
  );
});

test("createInvoiceSchema requires quotationId and at least one line", () => {
  const parsed = createInvoiceSchema.parse({
    quotationId: "quotation-1",
    lines: [{ description: "DP", quantity: 1, unitPrice: 500_000 }],
  });

  assert.equal(parsed.quotationId, "quotation-1");
  assert.equal(parsed.lines.length, 1);
});

test("updateInvoiceStatusSchema accepts invoice workflow statuses only", () => {
  assert.equal(updateInvoiceStatusSchema.parse({ status: "PAID" }).status, "PAID");
});
```

- [ ] **Step 2: Run the focused test file to verify it fails**

Run:

```bash
node --test --experimental-strip-types src/lib/company-invoice-service.test.ts
```

Expected: FAIL with module-not-found or missing export errors for `company-invoice-service.ts` and `company-invoice.ts`.

- [ ] **Step 3: Add Prisma schema and validator definitions**

Update `prisma/schema.prisma` with the new enum and relations, and create `src/lib/validators/company-invoice.ts` with the exact shape below:

```prisma
enum CompanyInvoiceStatus {
  DRAFT
  SENT
  PAID
  CANCELLED
}

model CompanyInvoice {
  id              String               @id @default(cuid())
  companyId       String
  quotationId     String
  leadId          String
  createdByUserId String
  invoiceNumber   String
  status          CompanyInvoiceStatus @default(DRAFT)
  subtotal        Int
  total           Int
  notes           String               @default("")
  issuedAt        DateTime?
  paidAt          DateTime?
  cancelledAt     DateTime?
  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt
  company         Company              @relation(fields: [companyId], references: [id], onDelete: Cascade)
  quotation       CompanyQuotation     @relation(fields: [quotationId], references: [id], onDelete: Cascade)
  lead            CompanyLead          @relation(fields: [leadId], references: [id], onDelete: Cascade)
  createdBy       User                 @relation(fields: [createdByUserId], references: [id], onDelete: Cascade)
  lines           CompanyInvoiceLine[]

  @@index([companyId, createdAt])
  @@index([quotationId, status])
  @@unique([companyId, invoiceNumber])
}

model CompanyInvoiceLine {
  id          String         @id @default(cuid())
  invoiceId   String
  description String
  quantity    Int
  unitPrice   Int
  position    Int
  invoice     CompanyInvoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@index([invoiceId, position])
}
```

```ts
import { z } from "zod";

export const invoiceStatusSchema = z.enum(["DRAFT", "SENT", "PAID", "CANCELLED"]);

export const invoiceLineSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().int().min(0),
});

export const createInvoiceSchema = z.object({
  quotationId: z.string().trim().min(1),
  lines: z.array(invoiceLineSchema).min(1),
  notes: z.string().trim().max(2_000).default(""),
});

export const updateInvoiceStatusSchema = z.object({
  status: invoiceStatusSchema,
}).strict();

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type InvoiceLineInput = z.infer<typeof invoiceLineSchema>;
export type UpdateInvoiceStatusInput = z.infer<typeof updateInvoiceStatusSchema>;
```

Create `prisma/migrations/20260526093000_company_invoicing/migration.sql` with additive SQL:

```sql
CREATE TYPE "CompanyInvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'CANCELLED');

CREATE TABLE "CompanyInvoice" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "quotationId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "status" "CompanyInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "subtotal" INTEGER NOT NULL,
  "total" INTEGER NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "issuedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyInvoiceLine" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" INTEGER NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "CompanyInvoiceLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyInvoice_companyId_invoiceNumber_key"
  ON "CompanyInvoice"("companyId", "invoiceNumber");
CREATE INDEX "CompanyInvoice_companyId_createdAt_idx"
  ON "CompanyInvoice"("companyId", "createdAt");
CREATE INDEX "CompanyInvoice_quotationId_status_idx"
  ON "CompanyInvoice"("quotationId", "status");
CREATE INDEX "CompanyInvoiceLine_invoiceId_position_idx"
  ON "CompanyInvoiceLine"("invoiceId", "position");

ALTER TABLE "CompanyInvoice"
  ADD CONSTRAINT "CompanyInvoice_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyInvoice"
  ADD CONSTRAINT "CompanyInvoice_quotationId_fkey"
  FOREIGN KEY ("quotationId") REFERENCES "CompanyQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyInvoice"
  ADD CONSTRAINT "CompanyInvoice_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "CompanyLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyInvoice"
  ADD CONSTRAINT "CompanyInvoice_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyInvoiceLine"
  ADD CONSTRAINT "CompanyInvoiceLine_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "CompanyInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Implement the minimal pure helper module**

Create `src/lib/company-invoice-service.ts` with the pure exports needed by the tests before adding database work:

```ts
import { format } from "date-fns";

type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "CANCELLED";

export function formatInvoiceNumber(input: {
  prefix: string;
  issuedAt: Date;
  sequence: number;
}) {
  return `${input.prefix}/INV/${format(input.issuedAt, "yyyy/MM")}/${String(input.sequence).padStart(3, "0")}`;
}

function invoiceMonthKey(date: Date) {
  return format(date, "yyyy/MM");
}

export function nextInvoiceSequence(input: {
  prefix: string;
  issuedAt: Date;
  existingInvoiceNumbers: string[];
}) {
  const monthKey = invoiceMonthKey(input.issuedAt);
  let maxSequence = 0;

  for (const invoiceNumber of input.existingInvoiceNumbers) {
    const match = invoiceNumber.match(/^(.+)\/INV\/(\d{4}\/\d{2})\/(\d+)$/);
    if (!match) continue;
    const [, prefix, currentMonthKey, sequence] = match;
    if (prefix !== input.prefix || currentMonthKey !== monthKey) continue;
    maxSequence = Math.max(maxSequence, Number(sequence));
  }

  return maxSequence + 1;
}

export function calculateInvoiceTotals(input: {
  lines: Array<{ description: string; quantity: number; unitPrice: number }>;
}) {
  const subtotal = input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  return { subtotal, total: subtotal };
}

export function applyInvoiceStatusTransition(input: {
  currentStatus: InvoiceStatus;
  nextStatus: InvoiceStatus;
  timestamps: { issuedAt: Date | null; paidAt: Date | null; cancelledAt: Date | null };
  now: Date;
}) {
  const allowedTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
    DRAFT: ["SENT", "CANCELLED"],
    SENT: ["PAID", "CANCELLED"],
    PAID: [],
    CANCELLED: [],
  };

  if (input.currentStatus === input.nextStatus) {
    return { changed: false, updates: {} };
  }
  if (!allowedTransitions[input.currentStatus].includes(input.nextStatus)) {
    throw new Error("INVALID_STATUS_TRANSITION");
  }

  const updates: {
    status: InvoiceStatus;
    issuedAt?: Date;
    paidAt?: Date;
    cancelledAt?: Date;
  } = { status: input.nextStatus };

  if (input.nextStatus === "SENT" && !input.timestamps.issuedAt) updates.issuedAt = input.now;
  if (input.nextStatus === "PAID" && !input.timestamps.paidAt) updates.paidAt = input.now;
  if (input.nextStatus === "CANCELLED" && !input.timestamps.cancelledAt) {
    updates.cancelledAt = input.now;
  }

  return { changed: true, updates };
}
```

- [ ] **Step 5: Run tests and schema generation checks**

Run:

```bash
node --test --experimental-strip-types src/lib/company-invoice-service.test.ts
npx prisma validate
```

Expected: PASS for the new test file and `The schema at prisma/schema.prisma is valid`.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260526093000_company_invoicing/migration.sql src/lib/validators/company-invoice.ts src/lib/company-invoice-service.ts src/lib/company-invoice-service.test.ts
git commit -m "feat: add invoice schema and core helpers"
```

### Task 2: Invoice service and API routes

**Files:**
- Modify: `src/lib/company-invoice-service.ts`
- Modify: `src/lib/company-invoice-service.test.ts`
- Create: `src/app/api/companies/[companyId]/invoices/route.ts`
- Create: `src/app/api/companies/[companyId]/invoices/[invoiceId]/route.ts`

- [ ] **Step 1: Write the failing service tests for domain behavior**

Extend `src/lib/company-invoice-service.test.ts` with dependency-injected tests modelled after the money service tests:

```ts
import {
  createInvoiceForUserWithDependencies,
  getInvoiceDetailForUserWithDependencies,
  listInvoicesForUserWithDependencies,
  updateInvoiceStatusForUserWithDependencies,
} from "./company-invoice-service.ts";

test("createInvoiceForUserWithDependencies rejects quotations that are not approved", async () => {
  const deps = createInvoiceDeps({
    companyQuotation: {
      findFirst: async () => ({ id: "quotation-1", status: "SENT", total: 5_000_000 }),
    },
  });

  const result = await createInvoiceForUserWithDependencies(
    {
      userId: "user-1",
      companyId: "company-1",
      payload: {
        quotationId: "quotation-1",
        lines: [{ description: "DP", quantity: 1, unitPrice: 1_000_000 }],
      },
    },
    deps
  );

  assert.deepEqual(result, { error: "QUOTATION_NOT_APPROVED" });
});

test("createInvoiceForUserWithDependencies rejects totals above quotation ceiling", async () => {
  const deps = createInvoiceDeps({
    companyQuotation: {
      findFirst: async () => ({
        id: "quotation-1",
        companyId: "company-1",
        leadId: "lead-1",
        status: "APPROVED",
        total: 5_000_000,
        company: { quotationPrefix: "ITEK" },
      }),
    },
    companyInvoice: {
      aggregate: async () => ({ _sum: { total: 4_000_000 } }),
      findMany: async () => [],
      create: async () => unexpectedCall(),
      findFirst: async () => null,
      update: async () => unexpectedCall(),
    },
  });

  const result = await createInvoiceForUserWithDependencies(
    {
      userId: "user-1",
      companyId: "company-1",
      payload: {
        quotationId: "quotation-1",
        lines: [{ description: "Remaining", quantity: 1, unitPrice: 2_000_000 }],
      },
    },
    deps
  );

  assert.deepEqual(result, { error: "INVOICE_TOTAL_EXCEEDS_QUOTATION" });
});

test("updateInvoiceStatusForUserWithDependencies marks sent invoices as paid", async () => {
  const result = await updateInvoiceStatusForUserWithDependencies(
    {
      userId: "user-1",
      companyId: "company-1",
      invoiceId: "invoice-1",
      payload: { status: "PAID" },
    },
    createInvoiceDeps({
      companyInvoice: {
        findFirst: async () => ({
          id: "invoice-1",
          status: "SENT",
          issuedAt: new Date("2026-05-26T08:00:00.000Z"),
          paidAt: null,
          cancelledAt: null,
        }),
        update: async (args: { data: Record<string, unknown> }) => args.data,
      },
    })
  );

  assert.equal("data" in result, true);
});
```

- [ ] **Step 2: Run the service test file to verify the new cases fail**

Run:

```bash
node --test --experimental-strip-types src/lib/company-invoice-service.test.ts
```

Expected: FAIL with missing exports for the dependency-based invoice service functions.

- [ ] **Step 3: Implement the invoice service with company-owner checks and ceiling enforcement**

Expand `src/lib/company-invoice-service.ts` around these core signatures:

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.ts";
import {
  createInvoiceSchema,
  updateInvoiceStatusSchema,
} from "./validators/company-invoice.ts";

export async function listInvoicesForUser(userId: string, companyId: string) {
  return listInvoicesForUserWithDependencies(userId, companyId, { prisma });
}

export async function createInvoiceForUser(input: {
  userId: string;
  companyId: string;
  payload: unknown;
}) {
  return createInvoiceForUserWithDependencies(input, { prisma });
}

export async function getInvoiceDetailForUser(input: {
  userId: string;
  companyId: string;
  invoiceId: string;
}) {
  return getInvoiceDetailForUserWithDependencies(input, { prisma });
}

export async function updateInvoiceStatusForUser(input: {
  userId: string;
  companyId: string;
  invoiceId: string;
  payload: unknown;
}) {
  return updateInvoiceStatusForUserWithDependencies(input, { prisma });
}
```

Implement these rules inside the dependency-based functions:

```ts
const ACTIVE_INVOICE_STATUSES = ["DRAFT", "SENT", "PAID"] as const;

const ownerCompanySelect = {
  id: true,
  ownerId: true,
  quotationPrefix: true,
  name: true,
  slug: true,
  description: true,
} satisfies Prisma.CompanySelect;

const invoiceDetailInclude = {
  quotation: {
    select: {
      id: true,
      quotationNumber: true,
      revisionNumber: true,
      total: true,
      status: true,
    },
  },
  lead: {
    select: {
      id: true,
      title: true,
      prospectName: true,
      estimatedValue: true,
    },
  },
  createdBy: {
    select: { id: true, name: true, email: true },
  },
  lines: {
    orderBy: { position: "asc" },
  },
} satisfies Prisma.CompanyInvoiceInclude;
```

Creation should:

```ts
const payload = createInvoiceSchema.parse(input.payload);
const company = await deps.prisma.company.findFirst({ where: { id: input.companyId }, select: ownerCompanySelect });
if (!company) return { error: "NOT_FOUND" };
if (company.ownerId !== input.userId) return { error: "FORBIDDEN" };

const quotation = await deps.prisma.companyQuotation.findFirst({
  where: { id: payload.quotationId, companyId: input.companyId },
  select: {
    id: true,
    companyId: true,
    leadId: true,
    total: true,
    status: true,
  },
});

if (!quotation) return { error: "NOT_FOUND" };
if (quotation.status !== "APPROVED") return { error: "QUOTATION_NOT_APPROVED" };

const { subtotal, total } = calculateInvoiceTotals({ lines: payload.lines });
const activeTotals = await deps.prisma.companyInvoice.aggregate({
  where: {
    quotationId: quotation.id,
    status: { in: [...ACTIVE_INVOICE_STATUSES] },
  },
  _sum: { total: true },
});

const usedTotal = activeTotals._sum.total ?? 0;
if (usedTotal + total > quotation.total) {
  return { error: "INVOICE_TOTAL_EXCEEDS_QUOTATION" };
}
```

Persist the invoice and lines in one transaction and return the created record with `invoiceDetailInclude`. Status updates should use `applyInvoiceStatusTransition` and convert thrown `INVALID_STATUS_TRANSITION` into `{ error: "INVALID_STATUS_TRANSITION" }`.

- [ ] **Step 4: Add Next.js routes using existing `api.ts` response helpers**

Create `src/app/api/companies/[companyId]/invoices/route.ts`:

```ts
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { forbidden, getSessionUserId, notFound, unauthorized, validationError } from "@/lib/api";
import { createInvoiceForUser, listInvoicesForUser } from "@/lib/company-invoice-service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { companyId } = await params;
  const result = await listInvoicesForUser(userId, companyId);
  if ("error" in result) {
    if (result.error === "FORBIDDEN") return forbidden("Only the company owner can view invoices.");
    return notFound("Company not found.");
  }

  return NextResponse.json({ ok: true, data: result });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { companyId } = await params;

  try {
    const payload = await req.json().catch(() => null);
    if (payload === null) return validationError("Invalid JSON payload.");

    const result = await createInvoiceForUser({ userId, companyId, payload });
    if ("error" in result) {
      if (result.error === "FORBIDDEN") return forbidden("Only company owner can create invoices.");
      if (result.error === "QUOTATION_NOT_APPROVED") {
        return NextResponse.json({ ok: false, error: { code: "QUOTATION_NOT_APPROVED", message: "Invoice can only be created from an approved quotation." } }, { status: 409 });
      }
      if (result.error === "INVOICE_TOTAL_EXCEEDS_QUOTATION") {
        return NextResponse.json({ ok: false, error: { code: "INVOICE_TOTAL_EXCEEDS_QUOTATION", message: "Invoice total exceeds the remaining approved quotation amount." } }, { status: 409 });
      }
      return notFound("Quotation or company not found.");
    }

    return NextResponse.json({ ok: true, data: result.data }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return validationError(error.issues[0]?.message ?? "Invalid invoice payload.");
    }
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } }, { status: 500 });
  }
}
```

Create `src/app/api/companies/[companyId]/invoices/[invoiceId]/route.ts` with `GET` + `PATCH` mirroring the quotation detail route, returning 409 for invalid status transitions.

- [ ] **Step 5: Run service tests and lint for the backend slice**

Run:

```bash
node --test --experimental-strip-types src/lib/company-invoice-service.test.ts
npm run lint -- src/lib/validators/company-invoice.ts src/lib/company-invoice-service.ts src/app/api/companies/[companyId]/invoices/route.ts src/app/api/companies/[companyId]/invoices/[invoiceId]/route.ts
```

Expected: PASS and zero ESLint errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/company-invoice-service.ts src/lib/company-invoice-service.test.ts src/app/api/companies/[companyId]/invoices/route.ts src/app/api/companies/[companyId]/invoices/[invoiceId]/route.ts
git commit -m "feat: add invoice service and api"
```

### Task 3: Quotation detail invoice creation flow

**Files:**
- Create: `src/components/company/invoice-editor.tsx`
- Modify: `src/app/company/[companyId]/quotations/[quotationId]/page.tsx`

- [ ] **Step 1: Add the failing UI integration expectation**

Document the UI target in code comments at the top of the new component while building from the server page contract:

```tsx
type InvoiceEditorProps = {
  quotationId: string;
  initialLines: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  quotationLabel: string;
  prospectName: string;
};
```

The first render target is:

```tsx
<InvoiceEditor
  quotationId={quotation.id}
  quotationLabel={`${quotation.quotationNumber} rev ${quotation.revisionNumber}`}
  prospectName={quotation.lead.prospectName}
  initialLines={quotation.lines.map((line) => ({
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
  }))}
/>
```

- [ ] **Step 2: Implement the invoice editor client component**

Create `src/components/company/invoice-editor.tsx` by adapting the existing quotation editor structure but removing status, discount, and revision behavior:

```tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const emptyLine = { description: "", quantity: 1, unitPrice: 0 };

export function InvoiceEditor({
  quotationId,
  initialLines,
  quotationLabel,
  prospectName,
}: InvoiceEditorProps) {
  const router = useRouter();
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lines, setLines] = useState(() => (initialLines.length ? initialLines : [emptyLine]));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isBusy = isPending || isSubmitting;

  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) return;
    setError(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/companies/${companyId}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quotationId, lines, notes }),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      setError(result?.error?.message ?? "Unable to create invoice.");
      setIsSubmitting(false);
      return;
    }

    startTransition(() => {
      router.push(`/company/${companyId}/invoices/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[28px] border border-border bg-card p-5 text-card-foreground">
      <div>
        <h2 className="text-lg font-semibold text-card-foreground">Create invoice</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Start from approved quotation {quotationLabel} for {prospectName}.
        </p>
      </div>
      {/* reuse line editing layout from quotation editor, but total equals subtotal */}
    </form>
  );
}
```

Reuse the same line editing block pattern from `src/components/company/quotation-editor.tsx`, minus discount controls. Keep `notes` as a textarea under the total summary.

- [ ] **Step 3: Gate the create-invoice UI on approved latest quotations**

Modify `src/app/company/[companyId]/quotations/[quotationId]/page.tsx` so the lower left panel becomes invoice-aware:

```tsx
import { InvoiceEditor } from "@/components/company/invoice-editor";

const canCreateInvoice = isLatestRevision && quotation.status === "APPROVED";
```

Replace the existing conditional block with:

```tsx
{isLatestRevision ? (
  <div className="space-y-4">
    <QuotationEditor ... />
    {canCreateInvoice ? (
      <InvoiceEditor
        quotationId={quotation.id}
        quotationLabel={`${quotation.quotationNumber} rev ${quotation.revisionNumber}`}
        prospectName={quotation.lead.prospectName}
        initialLines={quotation.lines.map((line) => ({
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
        }))}
      />
    ) : (
      <div className="rounded-3xl border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
        Invoice creation unlocks after the latest quotation revision is approved.
      </div>
    )}
  </div>
) : (
  <div className="rounded-3xl border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
    Open the latest revision to create another revision or invoice.
  </div>
)}
```

- [ ] **Step 4: Lint the UI files and verify the quotation page still builds**

Run:

```bash
npm run lint -- src/components/company/invoice-editor.tsx src/app/company/[companyId]/quotations/[quotationId]/page.tsx
```

Expected: zero ESLint errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/company/invoice-editor.tsx src/app/company/[companyId]/quotations/[quotationId]/page.tsx
git commit -m "feat: add invoice creation from approved quotations"
```

### Task 4: Invoice pages, status control, navigation, and final verification

**Files:**
- Create: `src/components/company/invoice-status-control.tsx`
- Create: `src/app/company/[companyId]/invoices/page.tsx`
- Create: `src/app/company/[companyId]/invoices/[invoiceId]/page.tsx`
- Modify: `src/components/company/company-shell.tsx`
- Test: `src/lib/company-invoice-service.test.ts`

- [ ] **Step 1: Implement the invoice status control client component**

Create `src/components/company/invoice-status-control.tsx` with an explicit save flow like quotation status control:

```tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "CANCELLED";

export function InvoiceStatusControl({
  invoiceId,
  currentStatus,
}: {
  invoiceId: string;
  currentStatus: InvoiceStatus;
}) {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params.companyId;
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDirty = selectedStatus !== currentStatus;

  async function handleUpdate() {
    if (!isDirty || isPending) return;

    const response = await fetch(`/api/companies/${companyId}/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: selectedStatus }),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      setError(result?.error?.message ?? "Unable to update invoice status.");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-3">
      <select
        value={selectedStatus}
        onChange={(event) => setSelectedStatus(event.target.value as InvoiceStatus)}
        className="rounded-xl border border-border bg-background px-3 py-2 text-foreground"
      >
        <option value="DRAFT">Draft</option>
        <option value="SENT">Sent</option>
        <option value="PAID">Paid</option>
        <option value="CANCELLED">Cancelled</option>
      </select>
      <button type="button" disabled={!isDirty || isPending} onClick={handleUpdate} className="rounded-full border border-border px-4 py-2 text-sm">
        {isPending ? "Updating..." : "Update status"}
      </button>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
```

- [ ] **Step 2: Build the invoice list page and add it to company navigation**

Create `src/app/company/[companyId]/invoices/page.tsx`:

```tsx
import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUserId } from "@/lib/api";
import { listInvoicesForUser } from "@/lib/company-invoice-service";

export default async function CompanyInvoicesPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const { companyId } = await params;
  const result = await listInvoicesForUser(userId, companyId);
  if ("error" in result) notFound();

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card text-card-foreground">
        <CardHeader>
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">Invoices</Badge>
          <CardTitle className="text-3xl text-card-foreground">Company invoices</CardTitle>
          <CardDescription className="text-muted-foreground">
            Track approved-quotation billing snapshots and update payment states manually.
          </CardDescription>
        </CardHeader>
      </Card>
      <div className="space-y-3">
        {result.invoices.map((invoice) => (
          <Link key={invoice.id} href={`/company/${companyId}/invoices/${invoice.id}`} className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/40 p-4 transition hover:bg-accent/50">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-card-foreground">{invoice.invoiceNumber}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {invoice.quotation.quotationNumber} · {invoice.lead.prospectName}
                </p>
              </div>
              <span className="rounded-full border border-border bg-background px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {invoice.status}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <ReceiptText className="size-4" />
              <span>Rp{invoice.total.toLocaleString("id-ID")}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

Modify `src/components/company/company-shell.tsx` to import `ReceiptText` from `lucide-react`, define `const invoicesHref = \`/company/${company.id}/invoices\`;`, and add `{ href: invoicesHref, label: "Invoices", icon: ReceiptText }` next to Quotations for owners.

- [ ] **Step 3: Build the invoice detail page**

Create `src/app/company/[companyId]/invoices/[invoiceId]/page.tsx`:

```tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { notFound, redirect } from "next/navigation";
import { InvoiceStatusControl } from "@/components/company/invoice-status-control";
import { getSessionUserId } from "@/lib/api";
import { getInvoiceDetailForUser } from "@/lib/company-invoice-service";

export default async function CompanyInvoiceDetailPage({
  params,
}: {
  params: Promise<{ companyId: string; invoiceId: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const { companyId, invoiceId } = await params;
  const result = await getInvoiceDetailForUser({ userId, companyId, invoiceId });
  if ("error" in result) notFound();

  const { invoice, company } = result;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-card p-6 text-card-foreground">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Link href={`/company/${companyId}/invoices`} className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
              <ArrowLeft className="size-4" />
              Back to invoices
            </Link>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Invoice detail</p>
              <h1 className="mt-2 text-2xl font-semibold text-card-foreground">{invoice.invoiceNumber}</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Snapshot from {invoice.quotation.quotationNumber} for {invoice.lead.prospectName}.
              </p>
            </div>
          </div>
          <InvoiceStatusControl invoiceId={invoice.id} currentStatus={invoice.status} />
        </div>
      </section>
      {/* render line table, notes, subtotal/total, and issued/paid/cancelled dates */}
    </div>
  );
}
```

Render a line-items table matching the quotation detail page style, plus summary fields:

```tsx
<p className="text-sm text-slate-600">
  Issued {invoice.issuedAt ? format(new Date(invoice.issuedAt), "PPP") : "Not sent yet"}
</p>
<p className="text-sm text-slate-600">
  Paid {invoice.paidAt ? format(new Date(invoice.paidAt), "PPP") : "Unpaid"}
</p>
```

- [ ] **Step 4: Run the final verification set**

Run:

```bash
node --test --experimental-strip-types src/lib/company-invoice-service.test.ts
npm run lint -- src/lib/validators/company-invoice.ts src/lib/company-invoice-service.ts src/app/api/companies/[companyId]/invoices/route.ts src/app/api/companies/[companyId]/invoices/[invoiceId]/route.ts src/components/company/invoice-editor.tsx src/components/company/invoice-status-control.tsx src/app/company/[companyId]/quotations/[quotationId]/page.tsx src/app/company/[companyId]/invoices/page.tsx src/app/company/[companyId]/invoices/[invoiceId]/page.tsx src/components/company/company-shell.tsx
npx prisma validate
```

Expected: all tests pass, ESLint passes, Prisma schema validates.

- [ ] **Step 5: Manual smoke-check in the app**

Run:

```bash
npm run dev
```

Then verify manually:

```text
1. Open an approved quotation detail page.
2. Confirm the Create invoice form appears only on the latest approved revision.
3. Create one invoice and verify redirect to /company/<companyId>/invoices/<invoiceId>.
4. Create more invoices until the quotation ceiling is reached; confirm the over-limit request returns a visible error.
5. Open /company/<companyId>/invoices and confirm the new invoice appears.
6. Update DRAFT -> SENT -> PAID on the detail page and confirm timestamps render.
```

- [ ] **Step 6: Commit**

```bash
git add src/components/company/invoice-status-control.tsx src/app/company/[companyId]/invoices/page.tsx src/app/company/[companyId]/invoices/[invoiceId]/page.tsx src/components/company/company-shell.tsx
git commit -m "feat: add invoice pages and navigation"
```

## Self-Review

- Spec coverage:
  - Approved quotation only: covered in Task 2 create service validation and Task 3 UI gating.
  - Many invoices per quotation: covered by schema in Task 1 and ceiling logic in Task 2.
  - Snapshot lines and totals: covered by Task 1 schema plus Task 2 create persistence.
  - Status workflow `DRAFT`, `SENT`, `PAID`, `CANCELLED`: covered by Task 1 helper rules, Task 2 patch endpoint, Task 4 status control.
  - Dedicated invoices area: covered by Task 4 navigation plus list/detail pages.
- Placeholder scan:
  - No `TODO`/`TBD` markers remain in task steps.
  - Migration path, route paths, and command lines are explicit.
- Type consistency:
  - Shared status names are `DRAFT | SENT | PAID | CANCELLED` throughout.
  - Service exports, route imports, and UI props all use `invoiceId`, `quotationId`, `invoiceNumber`, and `InvoiceStatusControl` consistently.
