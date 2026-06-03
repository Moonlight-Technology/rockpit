# Quotation Approval Estimated Value Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make approved quotations update `lead.estimatedValue` to the approved revision total across create, revision, and status-patch approval flows.

**Architecture:** Centralize lead approval side-effects in `src/lib/company-quotation-service.ts` so value sync and stage sync are handled consistently from all approval entry points. Keep reads unchanged because overview, leads, and projects already consume `lead.estimatedValue`; only write-side logic and service tests need changes.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma, Node test runner

---

## File Map

- Modify: `src/lib/company-quotation-service.ts`
  Responsibility: centralize approval side-effects and update `lead.estimatedValue` when a quotation becomes approved.
- Modify: `src/lib/company-quotation-service.test.ts`
  Responsibility: prove the approval helper updates value, preserves warning behavior, and does not revert on demotion.
- Optional verify only: `src/lib/company-overview.ts`
  Responsibility: confirm no code change is needed because reads already use `lead.estimatedValue`.

## Task 1: Add Failing Approval Sync Tests

**Files:**
- Modify: `src/lib/company-quotation-service.test.ts`
- Test: `src/lib/company-quotation-service.test.ts`

- [ ] **Step 1: Write the failing tests**

Extend `src/lib/company-quotation-service.test.ts` with focused tests for a new helper export:

```ts
import { syncLeadForApprovedQuotation } from "./company-quotation-service.ts";

test("syncLeadForApprovedQuotation always updates estimatedValue to approved total", async () => {
  const calls: Array<{ where: unknown; data: unknown }> = [];
  const tx = {
    companyLead: {
      update: async (args: { where: unknown; data: unknown }) => {
        calls.push(args);
        return null;
      },
    },
  } as const;

  const warnings = await syncLeadForApprovedQuotation({
    tx: tx as never,
    leadId: "lead-1",
    total: 4_250_000,
    now: new Date("2026-05-25T10:00:00.000Z"),
    leadStage: "WON",
    boardColumns: [{ id: "won", title: "Won" }],
  });

  assert.deepEqual(warnings, []);
  assert.deepEqual(calls, [
    {
      where: { id: "lead-1" },
      data: { estimatedValue: 4_250_000 },
    },
  ]);
});

test("syncLeadForApprovedQuotation updates estimatedValue even when won column is missing", async () => {
  const calls: Array<{ where: unknown; data: unknown }> = [];
  const tx = {
    companyLead: {
      update: async (args: { where: unknown; data: unknown }) => {
        calls.push(args);
        return null;
      },
    },
  } as const;

  const warnings = await syncLeadForApprovedQuotation({
    tx: tx as never,
    leadId: "lead-1",
    total: 6_000_000,
    now: new Date("2026-05-25T10:00:00.000Z"),
    leadStage: "NEGOTIATION",
    boardColumns: [{ id: "proposal", title: "Proposal" }],
  });

  assert.deepEqual(warnings, [
    {
      code: "WON_COLUMN_MISSING",
      message:
        "Quotation approved, but the 'Won' column was not found in this board. Move the lead manually.",
    },
  ]);
  assert.deepEqual(calls, [
    {
      where: { id: "lead-1" },
      data: { estimatedValue: 6_000_000 },
    },
  ]);
});

test("syncLeadForApprovedQuotation updates estimatedValue and moves non-won leads to won", async () => {
  const calls: Array<{ where: unknown; data: unknown }> = [];
  const tx = {
    companyLead: {
      update: async (args: { where: unknown; data: unknown }) => {
        calls.push(args);
        return null;
      },
    },
  } as const;

  const now = new Date("2026-05-25T10:00:00.000Z");
  const warnings = await syncLeadForApprovedQuotation({
    tx: tx as never,
    leadId: "lead-1",
    total: 8_500_000,
    now,
    leadStage: "NEGOTIATION",
    boardColumns: [{ id: "won-col", title: "Won" }],
  });

  assert.deepEqual(warnings, []);
  assert.deepEqual(calls, [
    {
      where: { id: "lead-1" },
      data: { estimatedValue: 8_500_000 },
    },
    {
      where: { id: "lead-1" },
      data: {
        column: { connect: { id: "won-col" } },
        stage: "WON",
        wonAt: now,
      },
    },
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types src/lib/company-quotation-service.test.ts`

Expected: FAIL because `syncLeadForApprovedQuotation` is not exported yet.

- [ ] **Step 3: Write minimal helper implementation**

In `src/lib/company-quotation-service.ts`, add an exported helper near the existing status/approval utilities:

```ts
export async function syncLeadForApprovedQuotation(input: {
  tx: Pick<Prisma.TransactionClient, "companyLead">;
  leadId: string;
  total: number;
  now: Date;
  leadStage: CompanyLeadStage;
  boardColumns: Array<{ id: string; title: string }>;
}) {
  await input.tx.companyLead.update({
    where: { id: input.leadId },
    data: { estimatedValue: input.total },
  });

  if (input.leadStage === CompanyLeadStage.WON) {
    return [] as QuotationWarning[];
  }

  const wonColumn = findStageColumn(input.boardColumns, CompanyLeadStage.WON);
  if (!wonColumn) {
    return [
      {
        code: "WON_COLUMN_MISSING",
        message:
          "Quotation approved, but the 'Won' column was not found in this board. Move the lead manually.",
      },
    ] satisfies QuotationWarning[];
  }

  await input.tx.companyLead.update({
    where: { id: input.leadId },
    data: {
      column: { connect: { id: wonColumn.id } },
      stage: CompanyLeadStage.WON,
      wonAt: input.now,
    },
  });

  return [] as QuotationWarning[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types src/lib/company-quotation-service.test.ts`

Expected: PASS for new helper tests and existing quotation service tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/company-quotation-service.ts src/lib/company-quotation-service.test.ts
git commit -m "test: cover approved quotation lead value sync"
```

## Task 2: Route Create-Quotation Approval Through the Helper

**Files:**
- Modify: `src/lib/company-quotation-service.ts`
- Test: `src/lib/company-quotation-service.test.ts`

- [ ] **Step 1: Add a focused regression test for no-revert behavior**

Add this pure behavior test to `src/lib/company-quotation-service.test.ts`:

```ts
test("applyStatusTransition APPROVED -> DRAFT remains a status-only change", () => {
  const earlier = new Date("2026-05-10T00:00:00.000Z");
  const now = new Date("2026-05-25T10:00:00.000Z");
  const result = applyStatusTransition({
    currentStatus: "APPROVED",
    nextStatus: "DRAFT",
    timestamps: { sentAt: earlier, approvedAt: earlier, rejectedAt: null, issuedAt: earlier },
    now,
  });

  assert.equal(result.changed, true);
  assert.equal(result.updates.status, "DRAFT");
  assert.equal("estimatedValue" in (result.updates as Record<string, unknown>), false);
});
```

- [ ] **Step 2: Run test to verify current behavior stays green**

Run: `node --test --experimental-strip-types src/lib/company-quotation-service.test.ts`

Expected: PASS. This protects the “no automatic revert” rule.

- [ ] **Step 3: Replace duplicated create approval logic**

In the `createQuotationForUser` approval branch, replace the inline `won` transition block:

```ts
      const warnings =
        status === "APPROVED"
          ? await syncLeadForApprovedQuotation({
              tx,
              leadId: lead.id,
              total: quotation.total,
              now: issuedAt,
              leadStage: lead.stage,
              boardColumns: lead.leadBoard.columns,
            })
          : [];

      return { data: quotation, warnings };
```

Delete the old duplicated `findStageColumn` / `companyLead.update` / warning block in that function.

- [ ] **Step 4: Run tests to verify it passes**

Run: `node --test --experimental-strip-types src/lib/company-quotation-service.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/company-quotation-service.ts src/lib/company-quotation-service.test.ts
git commit -m "refactor: reuse approval value sync in quotation create flow"
```

## Task 3: Route Revision-Create and PATCH Approval Through the Helper

**Files:**
- Modify: `src/lib/company-quotation-service.ts`
- Test: `src/lib/company-quotation-service.test.ts`

- [ ] **Step 1: Update revision-create approval path**

In `createQuotationRevisionForUser`, replace the inline approved branch with:

```ts
      const warnings =
        status === "APPROVED"
          ? await syncLeadForApprovedQuotation({
              tx,
              leadId: lead.id,
              total: quotation.total,
              now: issuedAt,
              leadStage: lead.stage,
              boardColumns: lead.leadBoard.columns,
            })
          : [];

      return { data: quotation, warnings };
```

- [ ] **Step 2: Update PATCH approval path**

In `updateQuotationStatusForUser`, replace the inline approved branch with:

```ts
    let warnings: QuotationWarning[] = [];

    if (parsed.status === "APPROVED") {
      warnings = await syncLeadForApprovedQuotation({
        tx,
        leadId: quotation.lead.id,
        total: quotation.total,
        now,
        leadStage: quotation.lead.stage,
        boardColumns: quotation.lead.leadBoard.columns,
      });
    }
```

Keep all non-approved transitions unchanged.

- [ ] **Step 3: Run tests to verify it passes**

Run: `node --test --experimental-strip-types src/lib/company-quotation-service.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/company-quotation-service.ts src/lib/company-quotation-service.test.ts
git commit -m "feat: sync lead value on approved quotation flows"
```

## Task 4: Final Verification

**Files:**
- Verify only: `src/lib/company-quotation-service.ts`
- Verify only: `src/lib/company-overview.ts`

- [ ] **Step 1: Run focused automated verification**

Run:

```bash
node --test --experimental-strip-types src/lib/company-quotation-service.test.ts
node --test --experimental-strip-types src/lib/validators/company-quotation.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run project typecheck**

Run: `npx tsc --noEmit`

Expected: either PASS or the same known unrelated baseline failure currently coming from `src/lib/company-money-service.test.ts` importing a missing `./company-money-service.ts`. No new quotation-related type errors should remain.

- [ ] **Step 3: Run manual QA in the app**

Verify these cases in company mode:

1. Create a quotation directly as `APPROVED`; confirm the lead moves to `WON` when possible and the lead value matches quotation total.
2. Create a revision directly as `APPROVED`; confirm lead value updates to the revised total.
3. Approve the latest draft via status control; confirm lead value updates to that revision total.
4. Change an approved quotation back to `DRAFT`; confirm status changes but lead value does not automatically revert.
5. Simulate missing `Won` column and approve a quotation; confirm warning appears and lead value still updates.

- [ ] **Step 4: Commit final verification state if needed**

If Task 4 required code edits, commit them; otherwise no commit is needed here.

## Self-Review

- Spec coverage:
  - approval via create, revision, and PATCH: Tasks 2 and 3
  - separate value sync from stage sync: Task 1 helper design
  - no revert on demotion: Task 2 regression test and unchanged non-approved paths
  - existing reads continue to work: Task 4 verification
- Placeholder scan: all steps include explicit files, code, commands, and expected outcomes.
- Type consistency: plan uses `syncLeadForApprovedQuotation`, `lead.estimatedValue`, `quotation.total`, and `QuotationWarning` consistently across all tasks.
