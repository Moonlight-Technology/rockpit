# Lead ↔ Quotation Relationship Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-promote a lead to `WON` when its latest quotation revision is approved, gate new quotations on `LOST` leads behind an explicit revive flow, and separate quotation status transitions from revision creation via a dedicated `PATCH` endpoint.

**Architecture:** Add three nullable timestamp columns (`sentAt`, `approvedAt`, `rejectedAt`) to `CompanyQuotation`. Introduce a pure `applyStatusTransition` helper for timestamp + transition logic (TDD). Extend the quotation service with `updateQuotationStatusForUser`, which runs inside a Prisma transaction and synchronously updates the lead column/stage when status becomes `APPROVED`. Existing `POST` create/revision endpoints gain a `reviveLead` flag and return a `LEAD_LOST_REQUIRES_REVIVE` error when the lead is `LOST`. UI moves status updates out of `QuotationEditor` into a dedicated `QuotationStatusControl` with an explicit "Update status" button and a confirmation modal for `APPROVED`.

**Tech Stack:** Next.js 16 App Router, React 19 client components, TypeScript, Prisma 6 with PostgreSQL, Zod, Tailwind/shadcn UI primitives, Node 22 `node --test --experimental-strip-types`, ESLint.

**Spec reference:** `docs/superpowers/specs/2026-05-19-lead-quotation-relationship-design.md`

---

## File Structure

**Created:**
- `prisma/migrations/20260519090000_quotation_status_timestamps/migration.sql` — additive timestamp columns + backfill
- `src/lib/validators/company-quotation.test.ts` — validator tests (does not exist yet)
- `src/components/company/quotation-status-control.tsx` — status dropdown + Update button + confirm modal
- `src/components/company/quotation-revive-lead-dialog.tsx` — revive confirmation modal

**Modified:**
- `prisma/schema.prisma:255-275` — add `sentAt`, `approvedAt`, `rejectedAt` to `CompanyQuotation`
- `src/lib/validators/company-quotation.ts` — add `updateQuotationStatusSchema`, add `reviveLead` to `createQuotationSchema`
- `src/lib/company-lead-service.ts` — export `findStageColumn` helper used by sync logic
- `src/lib/company-quotation-service.ts` — add `applyStatusTransition`, `updateQuotationStatusForUser`, lead-sync helper, `LEAD_LOST_REQUIRES_REVIVE` guard
- `src/lib/company-quotation-service.test.ts` — add tests for `applyStatusTransition`
- `src/app/api/companies/[companyId]/quotations/route.ts` — surface `LEAD_LOST_REQUIRES_REVIVE`, propagate warnings
- `src/app/api/companies/[companyId]/quotations/[quotationId]/route.ts` — add `PATCH` handler, surface revive error + warnings
- `src/components/company/quotation-editor.tsx` — remove inline status dropdown, accept `disableStatusField` prop
- `src/components/company/quotation-editor-sheet.tsx` — accept `reviveLead` prop, surface `LEAD_LOST_REQUIRES_REVIVE` to caller
- `src/app/company/[companyId]/quotations/[quotationId]/page.tsx` — wire `QuotationStatusControl`, mark non-latest revisions read-only
- `src/app/company/[companyId]/quotations/page.tsx` — add lead stage badge on card, gate "Create quotation" with revive dialog

---

### Task 1: DB Migration — Add Status Timestamps

**Files:**
- Create: `prisma/migrations/20260519090000_quotation_status_timestamps/migration.sql`
- Modify: `prisma/schema.prisma:255-275`

- [ ] **Step 1: Update Prisma schema**

Edit `prisma/schema.prisma`. Inside `model CompanyQuotation`, after the existing `issuedAt` line (around line 263), add three new nullable timestamp fields. The relevant block becomes:

```prisma
model CompanyQuotation {
  id              String                 @id @default(cuid())
  companyId       String
  leadId          String
  quotationNumber String
  revisionNumber  Int
  status          CompanyQuotationStatus @default(DRAFT)
  subtotal        Int
  total           Int
  issuedAt        DateTime?
  sentAt          DateTime?
  approvedAt      DateTime?
  rejectedAt      DateTime?
  createdByUserId String
  // ... rest unchanged
}
```

- [ ] **Step 2: Create migration SQL**

Create the file `prisma/migrations/20260519090000_quotation_status_timestamps/migration.sql` with these contents:

```sql
-- AlterTable
ALTER TABLE "public"."CompanyQuotation"
ADD COLUMN "sentAt" TIMESTAMP(3),
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "rejectedAt" TIMESTAMP(3);

-- Backfill existing rows: copy issuedAt into the timestamp matching current status
UPDATE "public"."CompanyQuotation"
SET "sentAt" = "issuedAt"
WHERE "status" = 'SENT' AND "issuedAt" IS NOT NULL;

UPDATE "public"."CompanyQuotation"
SET "approvedAt" = "issuedAt"
WHERE "status" = 'APPROVED' AND "issuedAt" IS NOT NULL;

UPDATE "public"."CompanyQuotation"
SET "rejectedAt" = "issuedAt"
WHERE "status" = 'REJECTED' AND "issuedAt" IS NOT NULL;
```

- [ ] **Step 3: Apply migration and regenerate client**

Run: `npx prisma migrate dev --name quotation_status_timestamps`

Expected: Migration applied; "Already in sync" or new files generated. `@prisma/client` updated.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`

Expected: No errors (new fields are optional, existing code keeps compiling).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260519090000_quotation_status_timestamps
git commit -m "feat(db): add sentAt/approvedAt/rejectedAt to CompanyQuotation"
```

---

### Task 2: Extend Validators

**Files:**
- Modify: `src/lib/validators/company-quotation.ts`
- Create: `src/lib/validators/company-quotation.test.ts`

- [ ] **Step 1: Write failing validator tests**

Create `src/lib/validators/company-quotation.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  createQuotationSchema,
  updateQuotationStatusSchema,
} from "./company-quotation.ts";

test("createQuotationSchema defaults reviveLead to false", () => {
  const parsed = createQuotationSchema.parse({
    leadId: "lead_1",
    lines: [{ description: "Design", quantity: 1, unitPrice: 1000 }],
  });
  assert.equal(parsed.reviveLead, false);
});

test("createQuotationSchema accepts reviveLead=true", () => {
  const parsed = createQuotationSchema.parse({
    leadId: "lead_1",
    lines: [{ description: "Design", quantity: 1, unitPrice: 1000 }],
    reviveLead: true,
  });
  assert.equal(parsed.reviveLead, true);
});

test("updateQuotationStatusSchema accepts each enum value", () => {
  for (const status of ["DRAFT", "SENT", "APPROVED", "REJECTED"] as const) {
    const parsed = updateQuotationStatusSchema.parse({ status });
    assert.equal(parsed.status, status);
  }
});

test("updateQuotationStatusSchema rejects extra keys like lines", () => {
  assert.throws(() =>
    updateQuotationStatusSchema.parse({
      status: "DRAFT",
      lines: [{ description: "x", quantity: 1, unitPrice: 1 }],
    })
  );
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `node --test --experimental-strip-types src/lib/validators/company-quotation.test.ts`

Expected: FAIL (imports of `updateQuotationStatusSchema` are unresolved; `reviveLead` parsing fails).

- [ ] **Step 3: Update validator file**

Replace the contents of `src/lib/validators/company-quotation.ts` with:

```ts
import { z } from "zod";

export const quotationStatusSchema = z.enum(["DRAFT", "SENT", "APPROVED", "REJECTED"]);

export const quotationLineSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().int().min(0),
});

export const createQuotationSchema = z.object({
  leadId: z.string().trim().min(1),
  lines: z.array(quotationLineSchema).min(1),
  status: quotationStatusSchema.default("DRAFT"),
  reviveLead: z.boolean().default(false),
});

export const updateQuotationStatusSchema = z
  .object({
    status: quotationStatusSchema,
  })
  .strict();

export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type QuotationLineInput = z.infer<typeof quotationLineSchema>;
export type UpdateQuotationStatusInput = z.infer<typeof updateQuotationStatusSchema>;
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `node --test --experimental-strip-types src/lib/validators/company-quotation.test.ts`

Expected: PASS (all four tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/validators/company-quotation.ts src/lib/validators/company-quotation.test.ts
git commit -m "feat(validators): add updateQuotationStatusSchema and reviveLead flag"
```

---

### Task 3: Pure Helper — `applyStatusTransition`

**Files:**
- Modify: `src/lib/company-quotation-service.ts`
- Modify: `src/lib/company-quotation-service.test.ts`

- [ ] **Step 1: Write failing helper tests**

Append to `src/lib/company-quotation-service.test.ts`:

```ts
import { applyStatusTransition } from "./company-quotation-service.ts";

test("applyStatusTransition no-op when status equals current", () => {
  const now = new Date("2026-05-19T10:00:00.000Z");
  const result = applyStatusTransition({
    currentStatus: "DRAFT",
    nextStatus: "DRAFT",
    timestamps: { sentAt: null, approvedAt: null, rejectedAt: null, issuedAt: null },
    now,
  });
  assert.equal(result.changed, false);
  assert.deepEqual(result.updates, {});
});

test("applyStatusTransition DRAFT -> SENT sets sentAt and issuedAt", () => {
  const now = new Date("2026-05-19T10:00:00.000Z");
  const result = applyStatusTransition({
    currentStatus: "DRAFT",
    nextStatus: "SENT",
    timestamps: { sentAt: null, approvedAt: null, rejectedAt: null, issuedAt: null },
    now,
  });
  assert.equal(result.changed, true);
  assert.equal(result.updates.status, "SENT");
  assert.deepEqual(result.updates.sentAt, now);
  assert.deepEqual(result.updates.issuedAt, now);
});

test("applyStatusTransition preserves existing first-transition timestamps", () => {
  const earlier = new Date("2026-05-10T00:00:00.000Z");
  const now = new Date("2026-05-19T10:00:00.000Z");
  const result = applyStatusTransition({
    currentStatus: "SENT",
    nextStatus: "SENT",
    timestamps: { sentAt: earlier, approvedAt: null, rejectedAt: null, issuedAt: earlier },
    now,
  });
  assert.equal(result.changed, false);
});

test("applyStatusTransition SENT -> APPROVED sets approvedAt but keeps sentAt", () => {
  const earlier = new Date("2026-05-10T00:00:00.000Z");
  const now = new Date("2026-05-19T10:00:00.000Z");
  const result = applyStatusTransition({
    currentStatus: "SENT",
    nextStatus: "APPROVED",
    timestamps: { sentAt: earlier, approvedAt: null, rejectedAt: null, issuedAt: earlier },
    now,
  });
  assert.equal(result.changed, true);
  assert.deepEqual(result.updates.approvedAt, now);
  // sentAt is NOT in updates because it stays as-is
  assert.equal("sentAt" in result.updates, false);
});

test("applyStatusTransition APPROVED -> DRAFT changes status but no new timestamps", () => {
  const earlier = new Date("2026-05-10T00:00:00.000Z");
  const now = new Date("2026-05-19T10:00:00.000Z");
  const result = applyStatusTransition({
    currentStatus: "APPROVED",
    nextStatus: "DRAFT",
    timestamps: { sentAt: earlier, approvedAt: earlier, rejectedAt: null, issuedAt: earlier },
    now,
  });
  assert.equal(result.changed, true);
  assert.equal(result.updates.status, "DRAFT");
  assert.equal("approvedAt" in result.updates, false);
  assert.equal("sentAt" in result.updates, false);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `node --test --experimental-strip-types src/lib/company-quotation-service.test.ts`

Expected: FAIL (`applyStatusTransition` is not exported).

- [ ] **Step 3: Add helper to service**

Append to `src/lib/company-quotation-service.ts` (anywhere above `listQuotationsForUser`):

```ts
type QuotationStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED";

export type StatusTransitionResult = {
  changed: boolean;
  updates: {
    status?: QuotationStatus;
    sentAt?: Date;
    approvedAt?: Date;
    rejectedAt?: Date;
    issuedAt?: Date;
  };
};

export function applyStatusTransition(input: {
  currentStatus: QuotationStatus;
  nextStatus: QuotationStatus;
  timestamps: {
    sentAt: Date | null;
    approvedAt: Date | null;
    rejectedAt: Date | null;
    issuedAt: Date | null;
  };
  now: Date;
}): StatusTransitionResult {
  if (input.currentStatus === input.nextStatus) {
    return { changed: false, updates: {} };
  }

  const updates: StatusTransitionResult["updates"] = {
    status: input.nextStatus,
  };

  if (input.nextStatus === "SENT" && !input.timestamps.sentAt) {
    updates.sentAt = input.now;
  }
  if (input.nextStatus === "APPROVED" && !input.timestamps.approvedAt) {
    updates.approvedAt = input.now;
  }
  if (input.nextStatus === "REJECTED" && !input.timestamps.rejectedAt) {
    updates.rejectedAt = input.now;
  }

  // Maintain legacy issuedAt: set on first non-DRAFT transition only.
  if (
    input.nextStatus !== "DRAFT" &&
    !input.timestamps.issuedAt
  ) {
    updates.issuedAt = input.now;
  }

  return { changed: true, updates };
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `node --test --experimental-strip-types src/lib/company-quotation-service.test.ts`

Expected: PASS (all existing + new tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/company-quotation-service.ts src/lib/company-quotation-service.test.ts
git commit -m "feat(quotation): add pure applyStatusTransition helper with tests"
```

---

### Task 4: Export Stage Column Lookup From Lead Service

**Files:**
- Modify: `src/lib/company-lead-service.ts:64-81`

- [ ] **Step 1: Add and export new helper**

In `src/lib/company-lead-service.ts`, change the section around the existing `getStageFromColumnTitle` (lines 64-81) to also export a `findStageColumn` helper. The result should be:

```ts
function getStageFromColumnTitle(title: string) {
  switch (title.trim().toLowerCase()) {
    case "new":
      return CompanyLeadStage.NEW;
    case "qualified":
      return CompanyLeadStage.QUALIFIED;
    case "proposal":
      return CompanyLeadStage.PROPOSAL;
    case "negotiation":
      return CompanyLeadStage.NEGOTIATION;
    case "won":
      return CompanyLeadStage.WON;
    case "lost":
      return CompanyLeadStage.LOST;
    default:
      return CompanyLeadStage.NEW;
  }
}

export function findStageColumn(
  columns: Array<{ id: string; title: string }>,
  stage: CompanyLeadStage
): { id: string; title: string } | null {
  return (
    columns.find((column) => getStageFromColumnTitle(column.title) === stage) ?? null
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/company-lead-service.ts
git commit -m "feat(lead): export findStageColumn for cross-service stage lookups"
```

---

### Task 5: Service — `updateQuotationStatusForUser` With Lead-Sync

**Files:**
- Modify: `src/lib/company-quotation-service.ts`

- [ ] **Step 1: Add helper imports and types**

Near the top of `src/lib/company-quotation-service.ts`, add to existing imports:

```ts
import { CompanyLeadStage } from "@prisma/client";
import { findStageColumn } from "./company-lead-service.ts";
import { updateQuotationStatusSchema } from "./validators/company-quotation.ts";
```

(If `CompanyLeadStage` is already imported elsewhere in the file, fold it into the existing line.)

- [ ] **Step 2: Add the warning + result types**

Above the new function (place it before `getQuotationDetailForUser`, around line 506):

```ts
export type QuotationWarning = { code: "WON_COLUMN_MISSING"; message: string };

export type UpdateQuotationStatusResult =
  | {
      data: QuotationDetailRecord;
      warnings: QuotationWarning[];
    }
  | { error: "FORBIDDEN" | "NOT_FOUND" | "NOT_LATEST_REVISION" };
```

- [ ] **Step 3: Implement the function**

Add immediately after the types above:

```ts
export async function updateQuotationStatusForUser(input: {
  userId: string;
  companyId: string;
  quotationId: string;
  payload: unknown;
}): Promise<UpdateQuotationStatusResult> {
  const parsed = updateQuotationStatusSchema.parse(input.payload);
  const context = await getOwnerCompanyContext(input.userId, input.companyId);
  if ("error" in context) {
    return { error: context.error };
  }

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.companyQuotation.findFirst({
      where: { id: input.quotationId, companyId: context.company.id },
      select: {
        id: true,
        leadId: true,
        quotationNumber: true,
        revisionNumber: true,
        status: true,
        sentAt: true,
        approvedAt: true,
        rejectedAt: true,
        issuedAt: true,
      },
    });
    if (!existing) {
      return { error: "NOT_FOUND" as const };
    }

    const latest = await tx.companyQuotation.findFirst({
      where: {
        companyId: context.company.id,
        leadId: existing.leadId,
        quotationNumber: existing.quotationNumber,
      },
      orderBy: { revisionNumber: "desc" },
      select: { id: true },
    });
    if (latest?.id !== existing.id) {
      return { error: "NOT_LATEST_REVISION" as const };
    }

    const transition = applyStatusTransition({
      currentStatus: existing.status,
      nextStatus: parsed.status,
      timestamps: {
        sentAt: existing.sentAt,
        approvedAt: existing.approvedAt,
        rejectedAt: existing.rejectedAt,
        issuedAt: existing.issuedAt,
      },
      now,
    });

    const warnings: QuotationWarning[] = [];

    if (!transition.changed) {
      const current = await tx.companyQuotation.findFirst({
        where: { id: existing.id },
        include: quotationDetailInclude,
      });
      return { data: current!, warnings };
    }

    const updated = await tx.companyQuotation.update({
      where: { id: existing.id },
      data: transition.updates,
      include: quotationDetailInclude,
    });

    if (parsed.status === "APPROVED") {
      const lead = await tx.companyLead.findFirst({
        where: { id: existing.leadId, companyId: context.company.id },
        select: {
          id: true,
          stage: true,
          leadBoardId: true,
          leadBoard: {
            select: {
              columns: { select: { id: true, title: true } },
            },
          },
        },
      });

      if (lead && lead.stage !== CompanyLeadStage.WON) {
        const wonColumn = findStageColumn(lead.leadBoard.columns, CompanyLeadStage.WON);
        if (wonColumn) {
          await tx.companyLead.update({
            where: { id: lead.id },
            data: {
              column: { connect: { id: wonColumn.id } },
              stage: CompanyLeadStage.WON,
              wonAt: now,
            },
          });
        } else {
          warnings.push({
            code: "WON_COLUMN_MISSING",
            message:
              "Quotation approved, but the 'Won' column was not found in this board. Move the lead manually.",
          });
        }
      }
    }

    return { data: updated, warnings };
  });
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/company-quotation-service.ts
git commit -m "feat(quotation): add updateQuotationStatusForUser with lead-sync"
```

---

### Task 6: Service — LOST Guard & `reviveLead` On Create

**Files:**
- Modify: `src/lib/company-quotation-service.ts`

- [ ] **Step 1: Define result type aliases**

The existing service inlines its return types. Introduce explicit aliases so the new error variants and warnings array are easy to add. Place these immediately above `createQuotationForUser` in `src/lib/company-quotation-service.ts`:

```ts
type CreateQuotationResult =
  | { data: QuotationDetailRecord; warnings: QuotationWarning[] }
  | { error: "FORBIDDEN" | "NOT_FOUND" | "LEAD_LOST_REQUIRES_REVIVE" | "NEGOTIATION_COLUMN_NOT_FOUND" };

type CreateQuotationRevisionResult =
  | { data: QuotationDetailRecord; warnings: QuotationWarning[] }
  | {
      error:
        | "FORBIDDEN"
        | "NOT_FOUND"
        | "LEAD_MISMATCH"
        | "LEAD_LOST_REQUIRES_REVIVE"
        | "NEGOTIATION_COLUMN_NOT_FOUND";
    };
```

Update both `createQuotationForUser` and `createQuotationRevisionForUser` signatures to declare `: Promise<CreateQuotationResult>` and `: Promise<CreateQuotationRevisionResult>` respectively.

- [ ] **Step 2: Extend `createQuotationForUser` with the LOST guard**

Inside the `prisma.$transaction` callback of `createQuotationForUser` (around line 332 onward), update the lead lookup `select` to also fetch stage and board columns, then add the guard before generating the quotation number. The block becomes:

```ts
const lead = await tx.companyLead.findFirst({
  where: {
    id: parsed.leadId,
    companyId: context.company.id,
  },
  select: {
    id: true,
    stage: true,
    columnId: true,
    leadBoardId: true,
    leadBoard: {
      select: {
        columns: { select: { id: true, title: true } },
      },
    },
    quotations: {
      orderBy: { revisionNumber: "desc" },
      select: { revisionNumber: true, quotationNumber: true },
    },
  },
});

if (!lead) {
  return { error: "NOT_FOUND" as const };
}

if (lead.stage === CompanyLeadStage.LOST) {
  if (!parsed.reviveLead) {
    return { error: "LEAD_LOST_REQUIRES_REVIVE" as const };
  }
  const negotiationColumn = findStageColumn(
    lead.leadBoard.columns,
    CompanyLeadStage.NEGOTIATION
  );
  if (!negotiationColumn) {
    return { error: "NEGOTIATION_COLUMN_NOT_FOUND" as const };
  }
  await tx.companyLead.update({
    where: { id: lead.id },
    data: {
      column: { connect: { id: negotiationColumn.id } },
      stage: CompanyLeadStage.NEGOTIATION,
    },
  });
}
```

- [ ] **Step 3: Wrap the existing return path to attach warnings array**

At the bottom of the same transaction, change the existing `return { data: quotation };` to:

```ts
return { data: quotation, warnings: [] as QuotationWarning[] };
```

If the initial create includes `status === "APPROVED"`, the trigger needs to run here too. Add this block immediately before the `return`:

```ts
const warnings: QuotationWarning[] = [];

if (status === "APPROVED" && lead.stage !== CompanyLeadStage.WON) {
  const wonColumn = findStageColumn(lead.leadBoard.columns, CompanyLeadStage.WON);
  if (wonColumn) {
    await tx.companyLead.update({
      where: { id: lead.id },
      data: {
        column: { connect: { id: wonColumn.id } },
        stage: CompanyLeadStage.WON,
        wonAt: issuedAt,
      },
    });
  } else {
    warnings.push({
      code: "WON_COLUMN_MISSING",
      message:
        "Quotation approved, but the 'Won' column was not found in this board. Move the lead manually.",
    });
  }
}

return { data: quotation, warnings };
```

- [ ] **Step 4: Mirror the same logic in `createQuotationRevisionForUser`**

Inside `createQuotationRevisionForUser` (around line 418), the existing source-quotation lookup only selects basic fields. Extend it to also fetch the lead's stage and board columns. After the existing `sourceQuotation` query, fetch the lead with the same selection as Task 6 Step 2 and apply the same LOST guard + post-create `WON` sync. Place the guard immediately after the `if (sourceQuotation.leadId !== parsed.leadId)` check:

```ts
const lead = await tx.companyLead.findFirst({
  where: { id: sourceQuotation.leadId, companyId: context.company.id },
  select: {
    id: true,
    stage: true,
    columnId: true,
    leadBoardId: true,
    leadBoard: {
      select: { columns: { select: { id: true, title: true } } },
    },
  },
});

if (!lead) {
  return { error: "NOT_FOUND" as const };
}

if (lead.stage === CompanyLeadStage.LOST) {
  if (!parsed.reviveLead) {
    return { error: "LEAD_LOST_REQUIRES_REVIVE" as const };
  }
  const negotiationColumn = findStageColumn(
    lead.leadBoard.columns,
    CompanyLeadStage.NEGOTIATION
  );
  if (!negotiationColumn) {
    return { error: "NEGOTIATION_COLUMN_NOT_FOUND" as const };
  }
  await tx.companyLead.update({
    where: { id: lead.id },
    data: {
      column: { connect: { id: negotiationColumn.id } },
      stage: CompanyLeadStage.NEGOTIATION,
    },
  });
}
```

Then immediately before the final `return { data: quotation }`, replace that return with the explicit warnings-aware block:

```ts
const warnings: QuotationWarning[] = [];

if (status === "APPROVED" && lead.stage !== CompanyLeadStage.WON) {
  const wonColumn = findStageColumn(lead.leadBoard.columns, CompanyLeadStage.WON);
  if (wonColumn) {
    await tx.companyLead.update({
      where: { id: lead.id },
      data: {
        column: { connect: { id: wonColumn.id } },
        stage: CompanyLeadStage.WON,
        wonAt: issuedAt,
      },
    });
  } else {
    warnings.push({
      code: "WON_COLUMN_MISSING",
      message:
        "Quotation approved, but the 'Won' column was not found in this board. Move the lead manually.",
    });
  }
}

return { data: quotation, warnings };
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/company-quotation-service.ts
git commit -m "feat(quotation): add LOST lead guard and reviveLead on create/revision"
```

---

### Task 7: API Route — `PATCH /quotations/[quotationId]`

**Files:**
- Modify: `src/app/api/companies/[companyId]/quotations/[quotationId]/route.ts`

- [ ] **Step 1: Add PATCH handler**

Append to `src/app/api/companies/[companyId]/quotations/[quotationId]/route.ts` (after the existing `POST` export):

```ts
import { updateQuotationStatusForUser } from "@/lib/company-quotation-service";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ companyId: string; quotationId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { companyId, quotationId } = await params;

  try {
    const payload = await req.json().catch(() => null);
    if (payload === null) {
      return validationError("Invalid JSON payload.");
    }

    const result = await updateQuotationStatusForUser({
      userId,
      companyId,
      quotationId,
      payload,
    });

    if ("error" in result) {
      if (result.error === "FORBIDDEN") {
        return forbidden("Only company owner can update quotation status.");
      }
      if (result.error === "NOT_LATEST_REVISION") {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "NOT_LATEST_REVISION",
              message:
                "Only the latest revision can have its status updated. Open the latest revision and try again.",
            },
          },
          { status: 409 }
        );
      }
      return notFound("Quotation not found.");
    }

    return NextResponse.json({
      ok: true,
      data: result.data,
      warnings: result.warnings,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return validationError(error.issues[0]?.message ?? "Invalid status payload.");
    }
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } },
      { status: 500 }
    );
  }
}
```

If `updateQuotationStatusForUser` is already imported in the top-level `import { ... }` block, fold the new symbol into that statement instead of adding a separate import.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Manual smoke test (live server)**

Start dev server if not already running. From a terminal logged in as the company owner (via browser session cookie), confirm:
1. `PATCH /api/companies/<id>/quotations/<latestId>` body `{"status":"SENT"}` → `200 { ok: true, data: ..., warnings: [] }` and `sentAt` populated.
2. Same call again → `200` with unchanged data (idempotent).
3. `PATCH` on an older revision → `409 NOT_LATEST_REVISION`.
4. `PATCH` body `{"status":"APPROVED"}` → `200`; verify lead moved to the "Won" column (or `warnings` contains `WON_COLUMN_MISSING` if no such column exists).

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/companies/[companyId]/quotations/[quotationId]/route.ts"
git commit -m "feat(api): add PATCH endpoint for quotation status updates"
```

---

### Task 8: API Routes — Surface LOST & Revive Errors

**Files:**
- Modify: `src/app/api/companies/[companyId]/quotations/route.ts`
- Modify: `src/app/api/companies/[companyId]/quotations/[quotationId]/route.ts`

- [ ] **Step 1: Update the first-create POST route**

In `src/app/api/companies/[companyId]/quotations/route.ts`, replace the existing `if ("error" in result)` block in `POST` with logic that handles the new error codes and returns warnings on success:

```ts
if ("error" in result) {
  if (result.error === "FORBIDDEN") {
    return forbidden("Only company owner can create quotations.");
  }
  if (result.error === "LEAD_LOST_REQUIRES_REVIVE") {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "LEAD_LOST_REQUIRES_REVIVE",
          message:
            "Lead is currently marked Lost. Confirm to revive it before creating a quotation.",
        },
      },
      { status: 409 }
    );
  }
  if (result.error === "NEGOTIATION_COLUMN_NOT_FOUND") {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "NEGOTIATION_COLUMN_NOT_FOUND",
          message:
            "Cannot revive the lead because there is no 'Negotiation' column on the board.",
        },
      },
      { status: 400 }
    );
  }
  return notFound("Lead or company not found.");
}

return NextResponse.json(
  { ok: true, data: result.data, warnings: result.warnings },
  { status: 201 }
);
```

- [ ] **Step 2: Update the revision POST route**

In `src/app/api/companies/[companyId]/quotations/[quotationId]/route.ts`, replace the existing `POST` error block with:

```ts
if ("error" in result) {
  if (result.error === "FORBIDDEN") {
    return forbidden("Only company owner can create quotation revisions.");
  }
  if (result.error === "LEAD_MISMATCH") {
    return validationError("Revision lead does not match the original quotation.");
  }
  if (result.error === "LEAD_LOST_REQUIRES_REVIVE") {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "LEAD_LOST_REQUIRES_REVIVE",
          message:
            "Lead is currently marked Lost. Confirm to revive it before creating a revision.",
        },
      },
      { status: 409 }
    );
  }
  if (result.error === "NEGOTIATION_COLUMN_NOT_FOUND") {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "NEGOTIATION_COLUMN_NOT_FOUND",
          message:
            "Cannot revive the lead because there is no 'Negotiation' column on the board.",
        },
      },
      { status: 400 }
    );
  }
  return notFound("Quotation not found.");
}

return NextResponse.json(
  { ok: true, data: result.data, warnings: result.warnings },
  { status: 201 }
);
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Manual smoke test**

1. Move a lead to the "Lost" column via the kanban UI.
2. From a tool such as `curl` or REST client, `POST /api/companies/<id>/quotations` with `{"leadId":"<lostLeadId>","lines":[{...}]}` → expect `409 LEAD_LOST_REQUIRES_REVIVE`.
3. Retry with `"reviveLead": true` → expect `201` and lead now in "Negotiation" column.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/companies/[companyId]/quotations/route.ts "src/app/api/companies/[companyId]/quotations/[quotationId]/route.ts"
git commit -m "feat(api): surface LEAD_LOST_REQUIRES_REVIVE and revive errors"
```

---

### Task 9: FE — `QuotationStatusControl` Component

**Files:**
- Create: `src/components/company/quotation-status-control.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/company/quotation-status-control.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

type QuotationStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED";

type Props = {
  quotationId: string;
  currentStatus: QuotationStatus;
  prospectName: string;
  quotationLabel: string; // e.g. "Q-001 rev 2"
  disabled?: boolean;
};

export function QuotationStatusControl({
  quotationId,
  currentStatus,
  prospectName,
  quotationLabel,
  disabled = false,
}: Props) {
  const router = useRouter();
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const [pendingStatus, setPendingStatus] = useState<QuotationStatus>(currentStatus);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [, startTransition] = useTransition();
  const isDirty = pendingStatus !== currentStatus;

  async function submit(status: QuotationStatus) {
    setIsSaving(true);
    const response = await fetch(
      `/api/companies/${companyId}/quotations/${quotationId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }
    );
    const result = await response.json().catch(() => null);
    setIsSaving(false);

    if (!response.ok || !result?.ok) {
      toast.error(result?.error?.message ?? "Unable to update status.");
      setPendingStatus(currentStatus);
      return;
    }

    if (status === "APPROVED") {
      const wonMissing = (result.warnings ?? []).some(
        (w: { code: string }) => w.code === "WON_COLUMN_MISSING"
      );
      toast.success(
        wonMissing
          ? `${quotationLabel} approved. Note: 'Won' column missing — move the lead manually.`
          : `${quotationLabel} approved. ${prospectName} moved to Won.`
      );
    } else {
      toast.success(`Status updated to ${status}.`);
    }

    startTransition(() => router.refresh());
  }

  function onClickUpdate() {
    if (!isDirty || isSaving) return;
    if (pendingStatus === "APPROVED") {
      setShowApproveConfirm(true);
      return;
    }
    submit(pendingStatus);
  }

  return (
    <div className="flex items-end gap-3">
      <label className="grid gap-1 text-sm">
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Status
        </span>
        <select
          value={pendingStatus}
          disabled={disabled || isSaving}
          onChange={(event) => setPendingStatus(event.target.value as QuotationStatus)}
          className="rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none"
        >
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </label>
      <button
        type="button"
        disabled={!isDirty || disabled || isSaving}
        onClick={onClickUpdate}
        className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? "Saving..." : "Update status"}
      </button>

      {showApproveConfirm ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowApproveConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-lg"
          >
            <h3 className="text-lg font-semibold">Approve quotation?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Approving {quotationLabel} will mark lead &quot;{prospectName}&quot; as Won and move
              it to the &quot;Won&quot; column.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowApproveConfirm(false);
                  setPendingStatus(currentStatus);
                }}
                className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowApproveConfirm(false);
                  submit("APPROVED");
                }}
                className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/company/quotation-status-control.tsx
git commit -m "feat(ui): add QuotationStatusControl with explicit save + approve modal"
```

---

### Task 10: FE — Wire Status Control On Quotation Detail Page

**Files:**
- Modify: `src/components/company/quotation-editor.tsx`
- Modify: `src/app/company/[companyId]/quotations/[quotationId]/page.tsx`

- [ ] **Step 1: Inspect existing detail page**

Run: `sed -n '1,80p' "src/app/company/[companyId]/quotations/[quotationId]/page.tsx"` so you know the current header layout, then identify where to mount `QuotationStatusControl` (next to the existing status badge in the page header).

- [ ] **Step 2: Add prop `hideStatusField` to editor and skip rendering when set**

Open `src/components/company/quotation-editor.tsx`. In `QuotationEditorProps`, add:

```ts
hideStatusField?: boolean;
```

In the function signature, default it:

```ts
hideStatusField = false,
```

Wrap the existing `<label className="grid gap-1 text-sm">...status select...</label>` block (the one containing the `<option>` tags) in:

```tsx
{!hideStatusField ? (
  /* existing status label block stays here */
) : null}
```

This way the editor still owns status when used for the **first-time create** sheet, but the detail page (which uses `QuotationStatusControl` separately) hides it.

- [ ] **Step 3: Replace inline status display on detail page**

In `src/app/company/[companyId]/quotations/[quotationId]/page.tsx`, import the new component:

```tsx
import { QuotationStatusControl } from "@/components/company/quotation-status-control";
```

`getQuotationDetailForUser` already returns the revision list as `result.revisions` sorted by `revisionNumber desc`. Compute the latest-revision flag once near the top of the page component:

```tsx
const isLatestRevision =
  result.revisions.length === 0 ||
  result.quotation.revisionNumber === result.revisions[0].revisionNumber;
```

(Use whatever variable name the page uses for the awaited service result; in the existing file it is destructured into `quotation` / `revisions`. If it currently destructures, refer to `revisions[0].revisionNumber` directly.)

Where the page currently renders the status badge in the header, replace it with:

```tsx
<QuotationStatusControl
  quotationId={quotation.id}
  currentStatus={quotation.status}
  prospectName={quotation.lead.prospectName}
  quotationLabel={`${quotation.quotationNumber} rev ${quotation.revisionNumber}`}
  disabled={!isLatestRevision}
/>
```

- [ ] **Step 4: Add read-only banner for non-latest revision**

Just below the page header, render:

```tsx
{!isLatestRevision ? (
  <div className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-3 text-sm text-amber-200">
    Viewing a historical revision. Open the latest revision to change status or create another revision.
  </div>
) : null}
```

- [ ] **Step 5: Type-check + smoke**

Run: `npx tsc --noEmit`. Open the dev server and visit a quotation detail page; verify:
- Status dropdown shows current status.
- Changing dropdown enables "Update status" button.
- Clicking with `SENT` updates immediately.
- Clicking with `APPROVED` opens confirm modal; confirming moves the lead to Won.
- Visiting an older revision URL disables the dropdown and shows the banner.

- [ ] **Step 6: Commit**

```bash
git add src/components/company/quotation-editor.tsx "src/app/company/[companyId]/quotations/[quotationId]/page.tsx"
git commit -m "feat(ui): wire QuotationStatusControl into detail page with read-only banner"
```

---

### Task 11: FE — Revive Confirmation Dialog On Sheet

**Files:**
- Create: `src/components/company/quotation-revive-lead-dialog.tsx`
- Modify: `src/components/company/quotation-editor-sheet.tsx`

- [ ] **Step 1: Create the revive dialog**

Create `src/components/company/quotation-revive-lead-dialog.tsx`:

```tsx
"use client";

type Props = {
  open: boolean;
  prospectName: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function QuotationReviveLeadDialog({
  open,
  prospectName,
  onCancel,
  onConfirm,
}: Props) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-lg"
      >
        <h3 className="text-lg font-semibold">Lead is marked Lost</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {prospectName} was previously marked as Lost. Creating a new quotation will move
          it back to the &quot;Negotiation&quot; column.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20"
          >
            Revive &amp; continue
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Teach the editor to forward `reviveLead`**

Open `src/components/company/quotation-editor.tsx`. Extend props:

```ts
reviveLead?: boolean;
```

Default it (`reviveLead = false`) and include it in the `fetch` body:

```ts
body: JSON.stringify({
  leadId,
  status,
  lines,
  reviveLead,
}),
```

- [ ] **Step 3: Update `QuotationEditorSheet` to gate on LOST status**

Replace `src/components/company/quotation-editor-sheet.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { QuotationEditor } from "@/components/company/quotation-editor";
import { QuotationReviveLeadDialog } from "@/components/company/quotation-revive-lead-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type Props = {
  leadId: string;
  prospectName: string;
  leadStage: "NEW" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST";
  triggerLabel?: string;
};

export function QuotationEditorSheet({
  leadId,
  prospectName,
  leadStage,
  triggerLabel = "Create quotation",
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reviveDialogOpen, setReviveDialogOpen] = useState(false);
  const [reviveConfirmed, setReviveConfirmed] = useState(false);

  function onTriggerClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (leadStage === "LOST" && !reviveConfirmed) {
      event.preventDefault();
      setReviveDialogOpen(true);
    }
  }

  return (
    <>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger
          render={
            <button
              type="button"
              onClick={onTriggerClick}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
            >
              <Plus className="size-4" />
              {triggerLabel}
            </button>
          }
        />
        <SheetContent
          side="right"
          className="w-full overflow-y-auto data-[side=right]:sm:max-w-3xl"
        >
          <SheetHeader>
            <SheetTitle>Create quotation for {prospectName}</SheetTitle>
            <SheetDescription>
              The first quotation starts a numbered series. Saving again later from the
              detail page creates the next revision.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <QuotationEditor
              leadId={leadId}
              title=""
              description=""
              submitLabel="Create quotation"
              reviveLead={leadStage === "LOST" && reviveConfirmed}
              bare
            />
          </div>
        </SheetContent>
      </Sheet>

      <QuotationReviveLeadDialog
        open={reviveDialogOpen}
        prospectName={prospectName}
        onCancel={() => setReviveDialogOpen(false)}
        onConfirm={() => {
          setReviveConfirmed(true);
          setReviveDialogOpen(false);
          setSheetOpen(true);
        }}
      />
    </>
  );
}
```

- [ ] **Step 4: Pass `leadStage` from the page**

In `src/app/company/[companyId]/quotations/page.tsx`, where `<QuotationEditorSheet ... />` is rendered for `leadsWithoutSeries`, add the `leadStage` prop:

```tsx
<QuotationEditorSheet
  leadId={lead.id}
  prospectName={lead.prospectName}
  leadStage={lead.stage}
/>
```

(`lead.stage` is already in the `quotationsResult.leads` payload returned by `listQuotationsForUser`.)

- [ ] **Step 5: Type-check + smoke**

Run: `npx tsc --noEmit`. Manually:
1. Drag a no-series lead to the "Lost" column on the lead kanban page.
2. Navigate to Quotations. Find the lead in the right column.
3. Click "Create quotation" → revive dialog opens.
4. Click "Cancel" → dialog closes, sheet stays closed.
5. Click "Revive & continue" → dialog closes, sheet opens; submit form succeeds, lead now in Negotiation column.

- [ ] **Step 6: Commit**

```bash
git add src/components/company/quotation-editor.tsx src/components/company/quotation-editor-sheet.tsx src/components/company/quotation-revive-lead-dialog.tsx "src/app/company/[companyId]/quotations/page.tsx"
git commit -m "feat(ui): gate quotation creation on LOST leads behind revive dialog"
```

---

### Task 12: FE — Lead Stage Badge On Quotations List

**Files:**
- Modify: `src/app/company/[companyId]/quotations/page.tsx`

- [ ] **Step 1: Inject stage badge into existing series card**

In `src/app/company/[companyId]/quotations/page.tsx`, find the existing card for each entry under `latestByLead`. Inside the row that already shows the status badge, add a sibling badge for the lead stage. Replace:

```tsx
<span className="rounded-full border border-border bg-background px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
  {quotation.status}
</span>
```

with:

```tsx
<div className="flex items-center gap-2">
  <span
    className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] ${
      quotation.lead.stage === "WON"
        ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-200"
        : quotation.lead.stage === "LOST"
        ? "border-rose-300/30 bg-rose-500/10 text-rose-200"
        : "border-border bg-muted text-muted-foreground"
    }`}
  >
    {quotation.lead.stage}
  </span>
  <span className="rounded-full border border-border bg-background px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
    {quotation.status}
  </span>
</div>
```

`quotation.lead.stage` is part of the listing payload — extend `quotationListInclude` if needed in `src/lib/company-quotation-service.ts` to include the lead `stage` field. Verify by inspecting `quotationListInclude` definition; if `stage` is absent, add `stage: true` next to the other fields in the `lead.select` block.

- [ ] **Step 2: Type-check + smoke**

Run: `npx tsc --noEmit`. Reload `/company/<id>/quotations`. Verify each card shows two badges (lead stage + quotation status).

- [ ] **Step 3: Commit**

```bash
git add src/lib/company-quotation-service.ts "src/app/company/[companyId]/quotations/page.tsx"
git commit -m "feat(ui): show lead stage badge on quotation list cards"
```

---

### Task 13: End-To-End Smoke Test + Lint

**Files:**
- (verification only)

- [ ] **Step 1: Run full lint**

Run: `npm run lint`

Expected: no errors. Fix any that surface (most likely unused imports from the refactor).

- [ ] **Step 2: Run all unit tests**

Run:

```
node --test --experimental-strip-types src/lib/validators/company-quotation.test.ts src/lib/company-quotation-service.test.ts
```

Expected: PASS for both files.

- [ ] **Step 3: End-to-end manual flow**

Verify each scenario against a running dev server in order:

1. **Happy path approval**: create lead → create first quotation (DRAFT) → set status SENT (no modal, lead unchanged) → set status APPROVED (modal appears, confirm) → lead card moves to "Won" column on kanban; quotation list shows lead stage badge `WON`.
2. **Won column missing**: rename "Won" column to something else (e.g. "Closed") in the kanban admin. Try approving a different quotation → toast warns about missing column; lead stays in current column. Rename back.
3. **Revive flow**: drag a lead to "Lost". Open quotations page → click "Create quotation" → revive dialog → confirm → sheet opens → submit DRAFT → lead now in "Negotiation".
4. **Not-latest revision lock**: open a quotation with multiple revisions; visit the URL of an older revision → status dropdown is disabled, banner visible. PATCH attempts return 409.
5. **Re-quote on WON lead**: on a lead that already became Won, create a new revision (DRAFT). Lead remains WON, new revision visible.

- [ ] **Step 4: Final commit if any lint/test fixes were needed**

If only documentation/lint adjustments were made:

```bash
git add -A
git commit -m "chore: tidy up lint and verify smoke flow"
```

If nothing changed, skip this step.

---

## Self-Review Notes

Cross-checked plan against spec sections:

- **§4 Rules** → Tasks 5, 6 (APPROVED→WON, LOST guard, REJECTED no-op via `applyStatusTransition` matrix, PATCH no-op idempotency).
- **§4 Invariants** → Task 5 (`WON_COLUMN_MISSING` warning, `NEGOTIATION_COLUMN_NOT_FOUND` error, `NOT_LATEST_REVISION`, idempotent same-status PATCH).
- **§5 Schema** → Task 1.
- **§6.1 POST /quotations** → Task 6 + Task 8.
- **§6.2 POST /quotations/[id]** → Task 6 + Task 8.
- **§6.3 PATCH** → Tasks 5 + 7.
- **§6.4 Error shape & warnings** → Tasks 5, 7, 8.
- **§7.1 Detail page status control + read-only revision** → Task 10.
- **§7.2 List page stage badge** → Task 12.
- **§7.3 Approve modal** → Task 9.
- **§7.4 Revive modal** → Task 11.
- **§7.5 Toast messages** → Task 9.
- **§9 Edge cases** → covered across Tasks 5, 6, 7, 10, 13.
- **§10 Migration plan order** → Tasks ordered identically (DB → service → API → FE → smoke).
- **§11 Testing strategy** → TDD applied to validators (Task 2) and pure helper (Task 3); DB-touching logic verified by manual smoke per Tasks 7, 8, 10, 11, 13 since the codebase has no DB integration test layer.
