# Lead Detail Page + CRM Nav Group Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated `/company/[companyId]/leads/[leadId]` detail page with Overview & Quotations tabs (clickable from each kanban card), and regroup the company sidebar so Leads and Quotations live under a new **CRM** section.

**Architecture:** New server-rendered detail page under `/leads/[leadId]/page.tsx`. A new `getLeadDetailForUser` service in `company-lead-service` returns the lead plus its quotation series in one call. Tabs are URL-driven via `?tab=overview|quotations` (Next.js `searchParams`) so deep links work and each tab is bookmark-able. Kanban cards become clickable links wrapped around the existing draggable card — clicks navigate, drags still reorder (handled by checking the drag state in the click handler). The sidebar nav adds a new `SidebarGroup` "CRM" containing Leads and Quotations, leaving Workspace with Overview, Client, Projects.

**Tech Stack:** Next.js 16 App Router, React 19 server + client components, TypeScript, Prisma 6 with PostgreSQL, Tailwind/shadcn UI primitives, lucide-react, Node 22 `node --test --experimental-strip-types`, ESLint.

**Out of scope (deferred):**
- Activity tab, Files tab (`<future>`)
- Removing the "Create quotation" entry from the top-level Quotations menu (user said leave it for now)
- Refactoring top-level Quotations menu into analytical view
- Blocking quotation creation on NEW-stage leads
- Auto-forwarding lead stage when first quotation is created

---

## File Structure

**Created:**
- `src/app/company/[companyId]/leads/[leadId]/page.tsx` — server component for lead detail
- `src/components/company/lead-detail-tabs.tsx` — client component rendering tab triggers (URL-driven)
- `src/components/company/lead-overview-panel.tsx` — Overview tab content (inline edit form)
- `src/components/company/lead-quotations-panel.tsx` — Quotations tab content (list + create button)
- `src/lib/company-lead-service.test.ts` additions — tests for the new lead detail service helper

**Modified:**
- `src/lib/company-lead-service.ts` — add `getLeadDetailForUser(input)` returning lead + quotation series
- `src/components/company/lead-board.tsx` — wrap each kanban card in `<Link>` (or `useRouter().push` on click), suppress click when dragging
- `src/components/company/company-shell.tsx` — split `primaryNav` into two arrays (`workspaceNav`, `crmNav`); render two SidebarGroups
- `src/lib/company-navigation.ts` — no change required (its `isActive` helper still works per-href)

---

### Task 1: Service — `getLeadDetailForUser`

**Files:**
- Modify: `src/lib/company-lead-service.ts`
- Modify: `src/lib/company-lead-service.test.ts`

- [ ] **Step 1: Write failing service-helper test**

Append to `src/lib/company-lead-service.test.ts`:

```ts
import { buildLeadDetailViewModel } from "./company-lead-service.ts";

test("buildLeadDetailViewModel groups quotations by quotationNumber with latest revision first", () => {
  const leadId = "lead_1";
  const quotations = [
    {
      id: "q3",
      quotationNumber: "Q-001",
      revisionNumber: 3,
      status: "APPROVED" as const,
      total: 6000,
      issuedAt: new Date("2026-05-19"),
      createdAt: new Date("2026-05-19"),
    },
    {
      id: "q2",
      quotationNumber: "Q-001",
      revisionNumber: 2,
      status: "SENT" as const,
      total: 5500,
      issuedAt: new Date("2026-05-18"),
      createdAt: new Date("2026-05-18"),
    },
    {
      id: "q1",
      quotationNumber: "Q-001",
      revisionNumber: 1,
      status: "DRAFT" as const,
      total: 5000,
      issuedAt: null,
      createdAt: new Date("2026-05-17"),
    },
  ];
  const series = buildLeadDetailViewModel({ leadId, quotations });
  assert.equal(series.length, 1);
  assert.equal(series[0].quotationNumber, "Q-001");
  assert.equal(series[0].latest.id, "q3");
  assert.equal(series[0].revisions.length, 3);
  assert.deepEqual(
    series[0].revisions.map((r) => r.revisionNumber),
    [3, 2, 1]
  );
});

test("buildLeadDetailViewModel returns empty array when no quotations", () => {
  const series = buildLeadDetailViewModel({ leadId: "lead_1", quotations: [] });
  assert.deepEqual(series, []);
});

test("buildLeadDetailViewModel supports multiple series for one lead", () => {
  const series = buildLeadDetailViewModel({
    leadId: "lead_1",
    quotations: [
      {
        id: "a2",
        quotationNumber: "Q-002",
        revisionNumber: 1,
        status: "DRAFT" as const,
        total: 100,
        issuedAt: null,
        createdAt: new Date("2026-05-20"),
      },
      {
        id: "a1",
        quotationNumber: "Q-001",
        revisionNumber: 2,
        status: "REJECTED" as const,
        total: 90,
        issuedAt: new Date("2026-05-15"),
        createdAt: new Date("2026-05-15"),
      },
      {
        id: "a0",
        quotationNumber: "Q-001",
        revisionNumber: 1,
        status: "SENT" as const,
        total: 80,
        issuedAt: new Date("2026-05-14"),
        createdAt: new Date("2026-05-14"),
      },
    ],
  });
  // Sorted by createdAt of latest revision desc → Q-002 first, Q-001 second.
  assert.equal(series.length, 2);
  assert.equal(series[0].quotationNumber, "Q-002");
  assert.equal(series[1].quotationNumber, "Q-001");
  assert.equal(series[1].revisions.length, 2);
});
```

- [ ] **Step 2: Run tests — expect RED**

Run: `node --test --experimental-strip-types src/lib/company-lead-service.test.ts`

Expected: FAIL (`buildLeadDetailViewModel` not exported).

- [ ] **Step 3: Add the pure helper**

In `src/lib/company-lead-service.ts`, after `findStageColumn` (around line 89), add:

```ts
type LeadDetailQuotationRow = {
  id: string;
  quotationNumber: string;
  revisionNumber: number;
  status: "DRAFT" | "SENT" | "APPROVED" | "REJECTED";
  total: number;
  issuedAt: Date | null;
  createdAt: Date;
};

export type LeadDetailQuotationSeries = {
  quotationNumber: string;
  latest: LeadDetailQuotationRow;
  revisions: LeadDetailQuotationRow[];
};

export function buildLeadDetailViewModel(input: {
  leadId: string;
  quotations: LeadDetailQuotationRow[];
}): LeadDetailQuotationSeries[] {
  const byNumber = new Map<string, LeadDetailQuotationRow[]>();
  for (const row of input.quotations) {
    const list = byNumber.get(row.quotationNumber) ?? [];
    list.push(row);
    byNumber.set(row.quotationNumber, list);
  }

  const series: LeadDetailQuotationSeries[] = [];
  for (const [quotationNumber, rows] of byNumber.entries()) {
    const sorted = [...rows].sort((a, b) => b.revisionNumber - a.revisionNumber);
    series.push({
      quotationNumber,
      latest: sorted[0],
      revisions: sorted,
    });
  }

  // Sort series so the most recently touched one is first.
  series.sort(
    (a, b) => b.latest.createdAt.getTime() - a.latest.createdAt.getTime()
  );
  return series;
}
```

- [ ] **Step 4: Run tests — expect GREEN**

Run: `node --test --experimental-strip-types src/lib/company-lead-service.test.ts`

Expected: PASS (all existing + 3 new).

- [ ] **Step 5: Add the DB-touching service function**

Append to `src/lib/company-lead-service.ts` (after the existing exported async functions, before any closing-only content):

```ts
export type LeadDetailResult =
  | {
      lead: {
        id: string;
        title: string;
        prospectName: string;
        estimatedValue: number;
        notes: string;
        stage: CompanyLeadStage;
        wonAt: Date | null;
        columnId: string;
        column: { id: string; title: string };
        client: { id: string; name: string; companyName: string } | null;
        createdAt: Date;
        updatedAt: Date;
      };
      board: {
        id: string;
        columns: Array<{ id: string; title: string; position: number }>;
      };
      quotationSeries: LeadDetailQuotationSeries[];
      isOwner: boolean;
      isMember: boolean;
    }
  | { error: LeadWorkflowError };

export async function getLeadDetailForUser(input: {
  userId: string;
  companyId: string;
  leadId: string;
}): Promise<LeadDetailResult> {
  const context = await getPrimaryLeadBoardContext(input.userId, input.companyId);
  if ("error" in context) {
    return context;
  }

  const lead = await prisma.companyLead.findFirst({
    where: {
      id: input.leadId,
      companyId: context.companyId,
      leadBoardId: context.boardId,
    },
    select: {
      id: true,
      title: true,
      prospectName: true,
      estimatedValue: true,
      notes: true,
      stage: true,
      wonAt: true,
      columnId: true,
      createdAt: true,
      updatedAt: true,
      column: { select: { id: true, title: true } },
      client: { select: { id: true, name: true, companyName: true } },
      quotations: {
        orderBy: [{ quotationNumber: "asc" }, { revisionNumber: "desc" }],
        select: {
          id: true,
          quotationNumber: true,
          revisionNumber: true,
          status: true,
          total: true,
          issuedAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!lead) {
    return { error: "NOT_FOUND" };
  }

  const { quotations, ...rest } = lead;
  const quotationSeries = buildLeadDetailViewModel({
    leadId: lead.id,
    quotations,
  });

  return {
    lead: rest,
    board: { id: context.boardId, columns: context.columns },
    quotationSeries,
    isOwner: context.isOwner,
    isMember: context.isMember,
  };
}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/company-lead-service.ts src/lib/company-lead-service.test.ts
git commit -m "feat(lead): add getLeadDetailForUser service + view-model helper"
```

---

### Task 2: Overview Panel — Inline Edit Form

**Files:**
- Create: `src/components/company/lead-overview-panel.tsx`

- [ ] **Step 1: Scaffold the client component**

Create `src/components/company/lead-overview-panel.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Stage = "NEW" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST";

type Column = { id: string; title: string };
type Lead = {
  id: string;
  title: string;
  prospectName: string;
  estimatedValue: number;
  notes: string;
  stage: Stage;
  columnId: string;
  client: { id: string; name: string; companyName: string } | null;
};

type Props = {
  companyId: string;
  lead: Lead;
  columns: Column[];
  canEdit: boolean;
};

export function LeadOverviewPanel({ companyId, lead, columns, canEdit }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(lead.title);
  const [estimatedValue, setEstimatedValue] = useState(String(lead.estimatedValue));
  const [notes, setNotes] = useState(lead.notes);
  const [columnId, setColumnId] = useState(lead.columnId);
  const [isSaving, setIsSaving] = useState(false);
  const [, startTransition] = useTransition();

  const isDirty =
    title !== lead.title ||
    String(lead.estimatedValue) !== estimatedValue ||
    notes !== lead.notes ||
    columnId !== lead.columnId;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || !isDirty || isSaving) return;
    setIsSaving(true);

    const response = await fetch(
      `/api/companies/${companyId}/leads/${lead.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          estimatedValue: Number(estimatedValue),
          notes,
          columnId,
        }),
      }
    );
    const result = await response.json().catch(() => null);
    setIsSaving(false);

    if (!response.ok || !result?.ok) {
      toast.error(result?.error?.message ?? "Unable to save lead.");
      return;
    }
    toast.success("Lead updated.");
    startTransition(() => router.refresh());
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-4 rounded-3xl border border-border bg-card p-5 text-card-foreground sm:grid-cols-2"
    >
      <label className="grid gap-1 text-sm">
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Title
        </span>
        <input
          value={title}
          disabled={!canEdit || isSaving}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Stage (column)
        </span>
        <select
          value={columnId}
          disabled={!canEdit || isSaving}
          onChange={(e) => setColumnId(e.target.value)}
          className="rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none"
        >
          {columns.map((column) => (
            <option key={column.id} value={column.id}>
              {column.title}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-1 text-sm">
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Client
        </span>
        <div className="rounded-xl border border-border bg-muted px-3 py-2 text-muted-foreground">
          {lead.client
            ? `${lead.client.name}${lead.client.companyName ? ` — ${lead.client.companyName}` : ""}`
            : "—"}
        </div>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Estimated value
        </span>
        <input
          value={estimatedValue}
          disabled={!canEdit || isSaving}
          onChange={(e) => setEstimatedValue(e.target.value)}
          inputMode="numeric"
          className="rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none"
        />
      </label>

      <label className="grid gap-1 text-sm sm:col-span-2">
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Notes
        </span>
        <textarea
          value={notes}
          disabled={!canEdit || isSaving}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none"
        />
      </label>

      {canEdit ? (
        <div className="sm:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={!isDirty || isSaving}
            className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save changes"}
          </button>
        </div>
      ) : null}
    </form>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/company/lead-overview-panel.tsx
git commit -m "feat(ui): add LeadOverviewPanel inline edit form"
```

---

### Task 3: Quotations Panel — Series List + Create Button

**Files:**
- Create: `src/components/company/lead-quotations-panel.tsx`

- [ ] **Step 1: Create the panel**

Create `src/components/company/lead-quotations-panel.tsx`:

```tsx
"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { QuotationEditorSheet } from "@/components/company/quotation-editor-sheet";

type Stage = "NEW" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST";
type Status = "DRAFT" | "SENT" | "APPROVED" | "REJECTED";

type Revision = {
  id: string;
  revisionNumber: number;
  status: Status;
  total: number;
  issuedAt: Date | null;
};

type Series = {
  quotationNumber: string;
  latest: Revision;
  revisions: Revision[];
};

type Props = {
  companyId: string;
  leadId: string;
  prospectName: string;
  leadStage: Stage;
  series: Series[];
};

export function LeadQuotationsPanel({
  companyId,
  leadId,
  prospectName,
  leadStage,
  series,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {series.length === 0
            ? "No quotations yet. Create the first one to start a numbered series."
            : `${series.length} quotation series · ${series.reduce(
                (sum, s) => sum + s.revisions.length,
                0
              )} revisions total`}
        </p>
        <QuotationEditorSheet
          leadId={leadId}
          prospectName={prospectName}
          leadStage={leadStage}
        />
      </div>

      {series.map((s) => (
        <div
          key={s.quotationNumber}
          className="rounded-3xl border border-border bg-card p-4 text-card-foreground"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{s.quotationNumber}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Latest Rev {s.latest.revisionNumber} · {s.latest.status}
              </p>
            </div>
            <Link
              href={`/company/${companyId}/quotations/${s.latest.id}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              Open latest
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <ul className="mt-4 space-y-2 border-t border-border pt-3">
            {s.revisions.map((rev) => (
              <li key={rev.id}>
                <Link
                  href={`/company/${companyId}/quotations/${rev.id}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm transition hover:bg-accent/40"
                >
                  <span>Rev {rev.revisionNumber}</span>
                  <span className="text-muted-foreground">
                    {rev.status} · Rp{rev.total.toLocaleString("id-ID")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/company/lead-quotations-panel.tsx
git commit -m "feat(ui): add LeadQuotationsPanel listing quotation series for a lead"
```

---

### Task 4: Tabs Switcher — URL-Driven

**Files:**
- Create: `src/components/company/lead-detail-tabs.tsx`

- [ ] **Step 1: Create the tabs nav (client)**

Create `src/components/company/lead-detail-tabs.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Tab = { key: "overview" | "quotations"; label: string };

const TABS: Tab[] = [
  { key: "overview", label: "Overview" },
  { key: "quotations", label: "Quotations" },
];

type Props = {
  basePath: string; // e.g. /company/<id>/leads/<leadId>
};

export function LeadDetailTabs({ basePath }: Props) {
  const params = useSearchParams();
  const active = (params.get("tab") as Tab["key"]) ?? "overview";

  return (
    <nav className="flex gap-1 rounded-full border border-border bg-card p-1 text-sm">
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <Link
            key={tab.key}
            href={`${basePath}?tab=${tab.key}`}
            scroll={false}
            className={
              isActive
                ? "rounded-full bg-foreground px-4 py-1.5 font-medium text-background"
                : "rounded-full px-4 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`

```bash
git add src/components/company/lead-detail-tabs.tsx
git commit -m "feat(ui): add URL-driven LeadDetailTabs nav"
```

---

### Task 5: Lead Detail Server Page

**Files:**
- Create: `src/app/company/[companyId]/leads/[leadId]/page.tsx`

- [ ] **Step 1: Write the page**

Create `src/app/company/[companyId]/leads/[leadId]/page.tsx`:

```tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { LeadDetailTabs } from "@/components/company/lead-detail-tabs";
import { LeadOverviewPanel } from "@/components/company/lead-overview-panel";
import { LeadQuotationsPanel } from "@/components/company/lead-quotations-panel";
import { getSessionUserId } from "@/lib/api";
import { getLeadDetailForUser } from "@/lib/company-lead-service";

export default async function CompanyLeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string; leadId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  const { companyId, leadId } = await params;
  const { tab } = await searchParams;
  const activeTab = tab === "quotations" ? "quotations" : "overview";

  const result = await getLeadDetailForUser({ userId, companyId, leadId });
  if ("error" in result) {
    notFound();
  }
  const { lead, board, quotationSeries, isOwner } = result;
  const basePath = `/company/${companyId}/leads/${leadId}`;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-card p-5 text-card-foreground">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href={`/company/${companyId}/leads`}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to leads board
            </Link>
            <h1 className="mt-2 text-2xl font-semibold">{lead.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {lead.prospectName} · Rp{lead.estimatedValue.toLocaleString("id-ID")} ·{" "}
              <span className="uppercase tracking-[0.18em]">{lead.stage}</span>
            </p>
          </div>
          <LeadDetailTabs basePath={basePath} />
        </div>
      </section>

      {activeTab === "overview" ? (
        <LeadOverviewPanel
          companyId={companyId}
          lead={{
            id: lead.id,
            title: lead.title,
            prospectName: lead.prospectName,
            estimatedValue: lead.estimatedValue,
            notes: lead.notes,
            stage: lead.stage,
            columnId: lead.columnId,
            client: lead.client,
          }}
          columns={board.columns}
          canEdit={isOwner}
        />
      ) : (
        <LeadQuotationsPanel
          companyId={companyId}
          leadId={lead.id}
          prospectName={lead.prospectName}
          leadStage={lead.stage}
          series={quotationSeries}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check + smoke**

Run: `npx tsc --noEmit`

Expected: No errors.

Manual smoke: log in, visit `/company/<id>/leads/<existingLeadId>`. Verify:
1. Header shows lead title, prospect, value, stage.
2. Overview tab shows form; saving updates lead.
3. Quotations tab shows series list (empty state if no series) and a "Create quotation" button that opens the existing Sheet.
4. URL `?tab=quotations` deep-links into the Quotations tab.

- [ ] **Step 3: Commit**

```bash
git add "src/app/company/[companyId]/leads/[leadId]/page.tsx"
git commit -m "feat(ui): add lead detail page with Overview and Quotations tabs"
```

---

### Task 6: Make Kanban Cards Clickable

**Files:**
- Modify: `src/components/company/lead-board.tsx`

- [ ] **Step 1: Inspect existing card render**

Run: `grep -n "draggable\|LEAD_DRAG_MIME\|leadCard\|LeadCard.*key\|handleLeadDragStart" src/components/company/lead-board.tsx | head -10`

Note the location where each lead card is rendered (likely a `<div draggable ...>` inside a column `.map((lead) => ...)`).

- [ ] **Step 2: Wire click navigation, suppress when dragging**

Add `useRouter` import (already imported) and `companyId` is in scope (the prop). Locate the card-render block. Currently it's something like:

```tsx
<div
  key={lead.id}
  draggable={canManage}
  onDragStart={(e) => handleLeadDragStart(e, lead, column.id)}
  onDragEnd={handleLeadDragEnd}
  ...
>
  ...card content...
</div>
```

Add a `data-was-dragging` flag and click handler. Replace the card wrapper with:

```tsx
<div
  key={lead.id}
  role="link"
  tabIndex={0}
  draggable={canManage}
  onDragStart={(e) => handleLeadDragStart(e, lead, column.id)}
  onDragEnd={handleLeadDragEnd}
  onClick={(e) => {
    // Suppress click if a drag just ended on this element.
    if (draggingLeadId) return;
    if ((e.currentTarget as HTMLElement).dataset.suppressClick === "1") {
      delete (e.currentTarget as HTMLElement).dataset.suppressClick;
      return;
    }
    router.push(`/company/${companyId}/leads/${lead.id}`);
  }}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(`/company/${companyId}/leads/${lead.id}`);
    }
  }}
  onMouseDown={(e) => {
    // If user starts dragging, mark to suppress the trailing click.
    (e.currentTarget as HTMLElement).dataset.suppressClick = "0";
  }}
  className="cursor-pointer ..."  // KEEP existing classes; add cursor-pointer
  ...
>
  ...card content...
</div>
```

In `handleLeadDragStart`, also set the flag:

```ts
function handleLeadDragStart(
  event: React.DragEvent<HTMLElement>,
  lead: LeadCard,
  columnId: string
) {
  if (!canManage) return;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(LEAD_DRAG_MIME, lead.id);
  event.dataTransfer.setData("text/source-column-id", columnId);
  setDraggingLeadId(lead.id);
  (event.currentTarget as HTMLElement).dataset.suppressClick = "1";
}
```

`router` is already initialised at the top of the component (existing code uses `router.refresh()`). Confirm with: `grep -n "useRouter\|router =" src/components/company/lead-board.tsx` and re-use the existing `router` const.

- [ ] **Step 3: Smoke test**

Manual: open `/company/<id>/leads`.

1. Click a card → navigates to detail page.
2. Drag a card to another column → moves; no navigation triggered.
3. Tab to a card and press Enter → navigates.

- [ ] **Step 4: Type-check + commit**

```bash
npx tsc --noEmit
git add src/components/company/lead-board.tsx
git commit -m "feat(ui): make kanban lead cards clickable to open detail page"
```

---

### Task 7: Sidebar — Add CRM Group

**Files:**
- Modify: `src/components/company/company-shell.tsx`

- [ ] **Step 1: Split primary nav into Workspace + CRM**

In `src/components/company/company-shell.tsx`, replace the existing `primaryNav` block (around lines 69-86) with two arrays:

```tsx
const workspaceNav: NavItem[] = isOnboarding
  ? []
  : [
      ...(canManageSettings
        ? [{ href: overviewHref, label: "Overview", icon: LayoutDashboard }]
        : []),
      ...(canManageSettings
        ? [{ href: clientsHref, label: "Client", icon: UsersRound }]
        : []),
      ...(canManageSettings
        ? [{ href: projectsHref, label: "Projects", icon: FolderOpen }]
        : []),
    ];

const crmNav: NavItem[] = isOnboarding
  ? []
  : [
      { href: leadsHref, label: "Leads", icon: KanbanSquare },
      ...(canManageSettings
        ? [{ href: quotationsHref, label: "Quotations", icon: FileText }]
        : []),
    ];

// Onboarding still only shows Settings under primary nav.
const onboardingNav: NavItem[] = isOnboarding
  ? [{ href: settingsHref, label: "Settings", icon: Settings }]
  : [];
```

- [ ] **Step 2: Render the two SidebarGroups**

Locate the existing `SidebarGroup` with `<SidebarGroupLabel>Workspace</SidebarGroupLabel>` (around line 130) that maps over `primaryNav`. Replace that single group with three blocks (Workspace, CRM, and the onboarding-only fallback). The relevant JSX should look like:

```tsx
{isOnboarding ? (
  <SidebarGroup>
    <SidebarGroupLabel>Onboarding</SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        {onboardingNav.map((item) => {
          const isActive = isCompanyNavItemActive({
            pathname,
            href: item.href,
            overviewHref,
          });
          return (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={isActive}>
                <Link href={item.href}>
                  <item.icon className="size-4" />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
) : (
  <>
    {workspaceNav.length > 0 ? (
      <SidebarGroup>
        <SidebarGroupLabel>Workspace</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {workspaceNav.map((item) => {
              const isActive = isCompanyNavItemActive({
                pathname,
                href: item.href,
                overviewHref,
              });
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive}>
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    ) : null}

    {crmNav.length > 0 ? (
      <SidebarGroup>
        <SidebarGroupLabel>CRM</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {crmNav.map((item) => {
              const isActive = isCompanyNavItemActive({
                pathname,
                href: item.href,
                overviewHref,
              });
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive}>
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    ) : null}
  </>
)}
```

The existing `Admin` group (Settings) remains untouched below.

- [ ] **Step 3: Type-check + smoke**

Run: `npx tsc --noEmit`

Manual: load any company page. Sidebar should show:
- Workspace: Overview, Client, Projects
- CRM: Leads, Quotations
- Admin: Settings

Active state for Leads should persist across `/leads`, `/leads/[leadId]`, and `?tab=...` because `isCompanyNavItemActive` matches on `startsWith`.

- [ ] **Step 4: Commit**

```bash
git add src/components/company/company-shell.tsx
git commit -m "feat(ui): group Leads and Quotations under new CRM sidebar section"
```

---

### Task 8: End-to-End Smoke + Lint

**Files:**
- (verification only)

- [ ] **Step 1: Run lint**

Run: `npm run lint`

Expected: clean. Fix any unused imports left over from refactors.

- [ ] **Step 2: Run all unit tests**

Run:

```
node --test --experimental-strip-types $(find src -name "*.test.ts" -not -path "*/node_modules/*")
```

Expected: all PASS, including the 3 new `buildLeadDetailViewModel` tests from Task 1.

- [ ] **Step 3: Manual E2E flow**

Verify on a running dev server:

1. **Sidebar**: open any company page → see Workspace, CRM, Admin sections in that order.
2. **Kanban → detail**: open `/leads`, click a card → arrives at `/leads/<leadId>?tab=overview` (default). Overview form shows; tab into Quotations.
3. **Overview edit**: change title, notes, stage column; click "Save changes"; toast appears; reload — values persist.
4. **Quotations tab**: lists existing series for that lead; "Create quotation" opens the same Sheet flow we already built. Submitting creates a series and navigates to the new quotation detail. Hit browser Back → returns to lead detail Quotations tab.
5. **Drag-and-drop**: drag a card to another column on kanban → moves correctly; click does NOT navigate during drag.
6. **Deep link**: paste `/leads/<id>?tab=quotations` into URL bar → opens directly on Quotations tab.
7. **Non-owner**: log in as a board member (not owner). Overview form fields are disabled; Save button hidden. Cards still clickable for read access.

- [ ] **Step 4: Final tidy commit (only if needed)**

If lint/typecheck fixes were applied:

```bash
git add -A
git commit -m "chore: tidy up after lead detail E2E smoke"
```

Otherwise skip.

---

## Self-Review Notes

Cross-check against the agreed structure:

- **Sidebar CRM group with Leads + Quotations** → Task 7.
- **Lead detail page accessible via clicking a kanban card** → Tasks 5 + 6.
- **Tab: Overview (info + inline edit)** → Tasks 2 + 5.
- **Tab: Quotations (list + Create button reusing existing Sheet)** → Tasks 3 + 5.
- **Activity / Files tabs** → explicitly out of scope (covered in plan header).
- **Top-level Quotations menu unchanged** → no task touches it.
- **URL deep-linking per tab** → Tasks 4 + 5 via `?tab=…`.

Type consistency: `LeadDetailQuotationSeries`, `LeadDetailQuotationRow`, `LeadDetailResult` all referenced consistently across the service + panels. Stage union `"NEW" | "QUALIFIED" | ...` matches `CompanyLeadStage` enum.

No placeholders. Each step has concrete code or a concrete command.
