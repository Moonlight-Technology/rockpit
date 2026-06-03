# Quotation Discount Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add global quotation discount support in company mode with selectable fixed-amount or percentage input, persisted per revision and reflected in totals across API and UI.

**Architecture:** Extend `CompanyQuotation` with additive discount fields and compute `discountAmount` + `total` at save time in the quotation service. Reuse the existing quotation create/revision flow, adding validator coverage, UI inputs in the editor, and read-side rendering in the detail page while keeping list page behavior unchanged.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma, Zod, Node test runner

---

## File Map

- Modify: `prisma/schema.prisma`
  Responsibility: persist discount enum + fields on `CompanyQuotation`.
- Create: `prisma/migrations/<timestamp>_quotation_discount/migration.sql`
  Responsibility: additive DB migration for discount fields with safe defaults.
- Modify: `src/lib/validators/company-quotation.ts`
  Responsibility: validate `discountType` and `discountValue` on create/revision payloads.
- Modify: `src/lib/validators/company-quotation.test.ts`
  Responsibility: prove validator defaults and invalid discount combinations.
- Modify: `src/lib/company-quotation-service.ts`
  Responsibility: calculate discount totals and persist/read new fields.
- Modify: `src/lib/company-quotation-service.test.ts`
  Responsibility: prove discount calculation behavior.
- Modify: `src/components/company/quotation-editor.tsx`
  Responsibility: collect discount input and render subtotal/discount/total summary.
- Modify: `src/app/company/[companyId]/quotations/[quotationId]/page.tsx`
  Responsibility: render stored discount breakdown and prefill revision editor.
- Optional verify only: `src/app/company/[companyId]/quotations/page.tsx`
  Responsibility: confirm no code change is needed because list already uses `quotation.total`.

## Task 1: Add Failing Validator Tests

**Files:**
- Modify: `src/lib/validators/company-quotation.test.ts`
- Test: `src/lib/validators/company-quotation.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these tests near the existing quotation validator coverage:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { createQuotationSchema } from "./company-quotation.ts";

test("createQuotationSchema defaults discount to fixed zero", () => {
  const result = createQuotationSchema.parse({
    leadId: "lead-1",
    lines: [{ description: "Design", quantity: 1, unitPrice: 500_000 }],
  });

  assert.equal(result.discountType, "FIXED");
  assert.equal(result.discountValue, 0);
});

test("createQuotationSchema rejects percentage discount above one hundred", () => {
  assert.throws(() =>
    createQuotationSchema.parse({
      leadId: "lead-1",
      lines: [{ description: "Design", quantity: 1, unitPrice: 500_000 }],
      discountType: "PERCENTAGE",
      discountValue: 101,
    })
  );
});

test("createQuotationSchema rejects negative fixed discount", () => {
  assert.throws(() =>
    createQuotationSchema.parse({
      leadId: "lead-1",
      lines: [{ description: "Design", quantity: 1, unitPrice: 500_000 }],
      discountType: "FIXED",
      discountValue: -1,
    })
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types src/lib/validators/company-quotation.test.ts`

Expected: FAIL because `discountType` and `discountValue` are not defined in `createQuotationSchema`.

- [ ] **Step 3: Write minimal validator implementation**

Update `src/lib/validators/company-quotation.ts` to extend the schema:

```ts
import { z } from "zod";

export const quotationStatusSchema = z.enum(["DRAFT", "SENT", "APPROVED", "REJECTED"]);
export const quotationDiscountTypeSchema = z.enum(["FIXED", "PERCENTAGE"]);

export const quotationLineSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().int().min(0),
});

export const createQuotationSchema = z
  .object({
    leadId: z.string().trim().min(1),
    lines: z.array(quotationLineSchema).min(1),
    status: quotationStatusSchema.default("DRAFT"),
    reviveLead: z.boolean().default(false),
    discountType: quotationDiscountTypeSchema.default("FIXED"),
    discountValue: z.coerce.number().int().min(0).default(0),
  })
  .superRefine((value, ctx) => {
    if (value.discountType === "PERCENTAGE" && value.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discountValue"],
        message: "Percentage discount must be between 0 and 100.",
      });
    }
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types src/lib/validators/company-quotation.test.ts`

Expected: PASS for the new discount tests and existing validator tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validators/company-quotation.ts src/lib/validators/company-quotation.test.ts
git commit -m "test: cover quotation discount validation"
```

## Task 2: Add Failing Quotation Calculation Tests

**Files:**
- Modify: `src/lib/company-quotation-service.test.ts`
- Test: `src/lib/company-quotation-service.test.ts`

- [ ] **Step 1: Write the failing tests**

Append these tests to `src/lib/company-quotation-service.test.ts`:

```ts
import { calculateQuotationTotals } from "./company-quotation-service.ts";

test("calculateQuotationTotals applies fixed discount and keeps subtotal", () => {
  assert.deepEqual(
    calculateQuotationTotals({
      lines: [{ description: "Build", quantity: 2, unitPrice: 500_000 }],
      discountType: "FIXED",
      discountValue: 250_000,
    }),
    {
      subtotal: 1_000_000,
      discountAmount: 250_000,
      total: 750_000,
    }
  );
});

test("calculateQuotationTotals clamps fixed discount above subtotal", () => {
  assert.deepEqual(
    calculateQuotationTotals({
      lines: [{ description: "Build", quantity: 1, unitPrice: 300_000 }],
      discountType: "FIXED",
      discountValue: 500_000,
    }),
    {
      subtotal: 300_000,
      discountAmount: 300_000,
      total: 0,
    }
  );
});

test("calculateQuotationTotals converts percentage discount to rupiah", () => {
  assert.deepEqual(
    calculateQuotationTotals({
      lines: [{ description: "Build", quantity: 3, unitPrice: 400_000 }],
      discountType: "PERCENTAGE",
      discountValue: 10,
    }),
    {
      subtotal: 1_200_000,
      discountAmount: 120_000,
      total: 1_080_000,
    }
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types src/lib/company-quotation-service.test.ts`

Expected: FAIL because `calculateQuotationTotals` does not exist.

- [ ] **Step 3: Write minimal calculation implementation**

Add a focused helper to `src/lib/company-quotation-service.ts` near the quotation utility functions:

```ts
type DiscountType = "FIXED" | "PERCENTAGE";

type QuotationLineCalculationInput = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export function calculateQuotationTotals(input: {
  lines: QuotationLineCalculationInput[];
  discountType: DiscountType;
  discountValue: number;
}) {
  const subtotal = input.lines.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice,
    0
  );

  const rawDiscount =
    input.discountType === "PERCENTAGE"
      ? Math.floor((subtotal * input.discountValue) / 100)
      : input.discountValue;

  const discountAmount = Math.min(Math.max(rawDiscount, 0), subtotal);
  const total = Math.max(subtotal - discountAmount, 0);

  return { subtotal, discountAmount, total };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types src/lib/company-quotation-service.test.ts`

Expected: PASS for the new calculation tests and existing service tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/company-quotation-service.ts src/lib/company-quotation-service.test.ts
git commit -m "test: add quotation discount total calculations"
```

## Task 3: Persist Discount Fields in Prisma and Service Writes

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_quotation_discount/migration.sql`
- Modify: `src/lib/company-quotation-service.ts`
- Test: `src/lib/company-quotation-service.test.ts`

- [ ] **Step 1: Write the failing schema-aware assertions**

Add one more test in `src/lib/company-quotation-service.test.ts` to lock the helper for percentage zero and zero subtotal:

```ts
test("calculateQuotationTotals keeps zero subtotal at zero", () => {
  assert.deepEqual(
    calculateQuotationTotals({
      lines: [{ description: "Free consult", quantity: 1, unitPrice: 0 }],
      discountType: "PERCENTAGE",
      discountValue: 50,
    }),
    {
      subtotal: 0,
      discountAmount: 0,
      total: 0,
    }
  );
});
```

- [ ] **Step 2: Run test to verify current logic still passes**

Run: `node --test --experimental-strip-types src/lib/company-quotation-service.test.ts`

Expected: PASS. This step protects the helper before wiring persistence.

- [ ] **Step 3: Update Prisma schema and migration**

Modify `prisma/schema.prisma`:

```prisma
enum CompanyQuotationDiscountType {
  FIXED
  PERCENTAGE
}

model CompanyQuotation {
  id              String                       @id @default(cuid())
  companyId       String
  leadId          String
  quotationNumber String
  revisionNumber  Int
  status          CompanyQuotationStatus      @default(DRAFT)
  subtotal        Int
  discountType    CompanyQuotationDiscountType @default(FIXED)
  discountValue   Int                         @default(0)
  discountAmount  Int                         @default(0)
  total           Int
  // remaining fields unchanged
}
```

Create migration SQL with additive defaults:

```sql
CREATE TYPE "CompanyQuotationDiscountType" AS ENUM ('FIXED', 'PERCENTAGE');

ALTER TABLE "CompanyQuotation"
ADD COLUMN "discountType" "CompanyQuotationDiscountType" NOT NULL DEFAULT 'FIXED',
ADD COLUMN "discountValue" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "discountAmount" INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 4: Wire service create/revision writes**

In `src/lib/company-quotation-service.ts`, import the inferred input type if useful and replace manual subtotal/total writes with the helper:

```ts
const totals = calculateQuotationTotals({
  lines: parsed.lines,
  discountType: parsed.discountType,
  discountValue: parsed.discountValue,
});

// inside tx.companyQuotation.create data:
subtotal: totals.subtotal,
discountType: parsed.discountType,
discountValue: parsed.discountValue,
discountAmount: totals.discountAmount,
total: totals.total,
```

Apply the same write path in both:

- first quotation creation
- quotation revision creation

Also expand read includes/selects by relying on Prisma include payload so `discountType`, `discountValue`, and `discountAmount` are returned.

- [ ] **Step 5: Run tests to verify it stays green**

Run:

```bash
node --test --experimental-strip-types src/lib/company-quotation-service.test.ts
node --test --experimental-strip-types src/lib/validators/company-quotation.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/company-quotation-service.ts src/lib/company-quotation-service.test.ts
git commit -m "feat: persist quotation discount fields"
```

## Task 4: Add Discount Inputs to Quotation Editor

**Files:**
- Modify: `src/components/company/quotation-editor.tsx`

- [ ] **Step 1: Write the UI change with explicit props**

Extend `QuotationEditorProps` and component state:

```ts
type DiscountType = "FIXED" | "PERCENTAGE";

type QuotationEditorProps = {
  // existing props...
  initialDiscountType?: DiscountType;
  initialDiscountValue?: number;
};

const [discountType, setDiscountType] = useState<DiscountType>(initialDiscountType ?? "FIXED");
const [discountValue, setDiscountValue] = useState(initialDiscountValue ?? 0);
```

Add derived values below `subtotal`:

```ts
const discountAmount =
  discountType === "PERCENTAGE"
    ? Math.min(Math.floor((subtotal * discountValue) / 100), subtotal)
    : Math.min(discountValue, subtotal);

const total = Math.max(subtotal - discountAmount, 0);
```

- [ ] **Step 2: Send the new payload fields**

Update the submit body:

```ts
body: JSON.stringify({
  leadId,
  status,
  lines,
  reviveLead,
  discountType,
  discountValue,
}),
```

- [ ] **Step 3: Render the discount controls and summary**

Insert a new block above the final action row:

```tsx
<div className="mt-4 grid gap-3 rounded-2xl border border-border bg-muted/30 p-4 sm:grid-cols-[180px_minmax(0,1fr)]">
  <label className="grid gap-1 text-sm">
    <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
      Discount type
    </span>
    <select
      value={discountType}
      onChange={(event) => setDiscountType(event.target.value as DiscountType)}
      disabled={isBusy}
      className="rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none"
    >
      <option value="FIXED">Nominal (Rp)</option>
      <option value="PERCENTAGE">Percentage (%)</option>
    </select>
  </label>

  <label className="grid gap-1 text-sm">
    <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
      {discountType === "PERCENTAGE" ? "Discount (%)" : "Discount (Rp)"}
    </span>
    <input
      type="number"
      min={0}
      max={discountType === "PERCENTAGE" ? 100 : undefined}
      value={discountValue}
      disabled={isBusy}
      onChange={(event) => setDiscountValue(Number(event.target.value || 0))}
      className="rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none"
    />
  </label>
</div>
```

Replace the summary block with:

```tsx
<div className="text-right">
  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Subtotal</p>
  <p className="text-lg font-semibold text-card-foreground">
    Rp{subtotal.toLocaleString("id-ID")}
  </p>
  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
    Discount {discountType === "PERCENTAGE" ? `(${discountValue}%)` : "(Rp)"}
  </p>
  <p className="text-sm text-muted-foreground">
    Rp{discountAmount.toLocaleString("id-ID")}
  </p>
  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">Total</p>
  <p className="text-lg font-semibold text-card-foreground">
    Rp{total.toLocaleString("id-ID")}
  </p>
</div>
```

- [ ] **Step 4: Verify the file typechecks**

Run: `npx tsc --noEmit`

Expected: PASS, including the new props and local derived values.

- [ ] **Step 5: Commit**

```bash
git add src/components/company/quotation-editor.tsx
git commit -m "feat(ui): add quotation discount editor controls"
```

## Task 5: Render Stored Discount in Detail Page and Prefill Revisions

**Files:**
- Modify: `src/app/company/[companyId]/quotations/[quotationId]/page.tsx`

- [ ] **Step 1: Prefill revision editor with discount fields**

Update the `QuotationEditor` call in the latest-revision section:

```tsx
<QuotationEditor
  quotationId={quotation.id}
  leadId={quotation.lead.id}
  initialStatus="DRAFT"
  initialLines={quotation.lines.map((line) => ({
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
  }))}
  initialDiscountType={quotation.discountType}
  initialDiscountValue={quotation.discountValue}
  title="Create next revision"
  description="Adjust pricing, line items, or discount. A new revision is always created as a Draft — use the status control above to change status of the current revision."
  submitLabel="Create revision"
  hideStatusField
/>
```

- [ ] **Step 2: Render the discount row in printable totals**

Replace the totals block with:

```tsx
<dl className="w-full max-w-sm space-y-3 text-sm">
  <div className="flex items-center justify-between text-slate-600">
    <dt>Subtotal</dt>
    <dd>Rp{quotation.subtotal.toLocaleString("id-ID")}</dd>
  </div>
  <div className="flex items-center justify-between text-slate-600">
    <dt>
      {quotation.discountType === "PERCENTAGE"
        ? `Discount (${quotation.discountValue}%)`
        : "Discount (Rp)"}
    </dt>
    <dd>Rp{quotation.discountAmount.toLocaleString("id-ID")}</dd>
  </div>
  <div className="flex items-center justify-between text-lg font-semibold text-slate-950">
    <dt>Total</dt>
    <dd>Rp{quotation.total.toLocaleString("id-ID")}</dd>
  </div>
</dl>
```

- [ ] **Step 3: Verify the page typechecks**

Run: `npx tsc --noEmit`

Expected: PASS. If Prisma types are stale, generate client before rerunning.

- [ ] **Step 4: Commit**

```bash
git add "src/app/company/[companyId]/quotations/[quotationId]/page.tsx"
git commit -m "feat(ui): show quotation discount breakdown"
```

## Task 6: Regenerate Prisma Client and Full Verification

**Files:**
- Generated/runtime side effect: Prisma client
- Verify only: quotation API/UI paths

- [ ] **Step 1: Regenerate Prisma client**

Run: `npx prisma generate`

Expected: PASS and updated client types for `discountType`, `discountValue`, and `discountAmount`.

- [ ] **Step 2: Run focused automated verification**

Run:

```bash
node --test --experimental-strip-types src/lib/validators/company-quotation.test.ts
node --test --experimental-strip-types src/lib/company-quotation-service.test.ts
npx tsc --noEmit
```

Expected: all PASS.

- [ ] **Step 3: Run manual QA in the app**

Run the dev server and verify these scenarios:

1. Open `/company/<companyId>/quotations`, create a quotation with no discount, confirm total equals subtotal.
2. Create a quotation with `FIXED` discount, confirm detail page shows subtotal, discount, total.
3. Create a quotation with `PERCENTAGE` discount, confirm rendered discount amount matches `floor(subtotal * percent / 100)`.
4. Enter fixed discount above subtotal, confirm editor preview total is `0` and saved detail page also shows total `0`.
5. Open the latest quotation detail page, click create revision, confirm prior discount type/value are prefilled.
6. Change line items while keeping percentage discount, save revision, confirm discount amount recalculates from the new subtotal.

- [ ] **Step 4: Commit final implementation**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/validators/company-quotation.ts src/lib/validators/company-quotation.test.ts src/lib/company-quotation-service.ts src/lib/company-quotation-service.test.ts src/components/company/quotation-editor.tsx "src/app/company/[companyId]/quotations/[quotationId]/page.tsx"
git commit -m "feat: add quotation discount support"
```

## Self-Review

- Spec coverage check:
  - Data model: Task 3.
  - Calculation rules: Tasks 2 and 3.
  - API payload/validation: Tasks 1 and 3.
  - UI editor/detail/revision prefill: Tasks 4 and 5.
  - Testing/manual verification: Tasks 1, 2, 3, and 6.
- Placeholder scan: all tasks list explicit files, code, commands, and expected results.
- Type consistency: plan uses `discountType`, `discountValue`, `discountAmount`, and `calculateQuotationTotals` consistently across validator, service, and UI tasks.
