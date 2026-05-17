# Helicopter Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the `Helicopter View` dashboard so it surfaces short-horizon timeline risk first, then project context, while keeping the existing task edit flow and other tabs intact.

**Architecture:** Keep the existing `/api/tasks/all` data source and current `Helicopter View` tabs. Move dashboard-specific derivation into a small pure helper module with Node tests, then replace the dashboard tab UI with a dual-pane split built from focused client components and a small selected-bucket state in `src/app/helicopter/page.tsx`.

**Tech Stack:** Next.js 16 App Router client components, React 19 hooks, TypeScript, date-fns, Tailwind/shadcn UI primitives, Node 22 `node --test --experimental-strip-types`, ESLint.

---

## Context And Constraints

- Read and follow `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`.
- Do not add or change API routes for this redesign.
- Keep `src/app/helicopter/page.tsx` as the `'use client'` entry point.
- Reuse the existing `Task` shape, `openEditTaskModal`, and task modal flow.
- Keep `list`, `timeline`, and `calendar` tabs behaviorally unchanged.
- Prefer extracting dashboard-only UI into focused components because `src/app/helicopter/page.tsx` is already 976 lines.
- Treat `due soon` as three explicit buckets: `Today`, `Tomorrow`, and `Next 3 Days`.
- Use `apply_patch` for edits.

## File Map

- Create `src/lib/helicopter-dashboard.ts`: pure bucketing and summary helpers for dashboard data.
- Create `src/lib/helicopter-dashboard.test.ts`: Node tests for time buckets, ordering, overload ranking, and signal summary.
- Create `src/components/helicopter/risk-timeline-panel.tsx`: left-pane dashboard UI for bucket strips and focused task list.
- Create `src/components/helicopter/context-panel.tsx`: right-pane dashboard UI for overload projects, completion snapshot, and signal summary.
- Modify `src/app/helicopter/page.tsx`: replace current dashboard-specific derivation and JSX with the new helper and components.

## Shared Types

Use these shared helper types in `src/lib/helicopter-dashboard.ts`:

```ts
export type HelicopterDashboardTask = {
  id: string;
  title: string;
  dueDate: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "TODO" | "DONE";
  board: { id: string; title: string } | null;
  column: { id: string; title: string } | null;
};

export type RiskBucketId = "today" | "tomorrow" | "next3Days";

export type RiskBucket = {
  id: RiskBucketId;
  label: "Today" | "Tomorrow" | "Next 3 Days";
  count: number;
  preview: HelicopterDashboardTask[];
  tasks: HelicopterDashboardTask[];
};

export type OverloadProjectRow = {
  id: string;
  title: string;
  dueSoonCount: number;
  openCount: number;
};

export type CompletionSnapshotRow = {
  id: string;
  title: string;
  openCount: number;
  doneCount: number;
};

export type SignalSummary = {
  openCount: number;
  dueSoonCount: number;
  personalCount: number;
  boardCount: number;
};
```

Expose one main entry point:

```ts
export function buildHelicopterDashboardData(
  tasks: HelicopterDashboardTask[],
  now = new Date()
): {
  buckets: RiskBucket[];
  overloadProjects: OverloadProjectRow[];
  completionSnapshot: CompletionSnapshotRow[];
  signalSummary: SignalSummary;
}
```

## Task 1: Write Failing Dashboard Data Tests

**Files:**
- Create: `src/lib/helicopter-dashboard.test.ts`
- Test: `src/lib/helicopter-dashboard.test.ts`

- [ ] **Step 1: Write the failing test file for time buckets and summaries**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildHelicopterDashboardData } from "./helicopter-dashboard.ts";

const now = new Date("2026-05-17T09:00:00.000Z");

test("buildHelicopterDashboardData groups open tasks into today tomorrow and next 3 days", () => {
  const data = buildHelicopterDashboardData(
    [
      {
        id: "today-high",
        title: "Today high",
        dueDate: "2026-05-17T12:00:00.000Z",
        priority: "HIGH",
        status: "TODO",
        board: { id: "alpha", title: "Alpha" },
        column: { id: "doing", title: "Doing" },
      },
      {
        id: "today-low",
        title: "Today low",
        dueDate: "2026-05-17T15:00:00.000Z",
        priority: "LOW",
        status: "TODO",
        board: null,
        column: null,
      },
      {
        id: "tomorrow-medium",
        title: "Tomorrow medium",
        dueDate: "2026-05-18T12:00:00.000Z",
        priority: "MEDIUM",
        status: "TODO",
        board: { id: "beta", title: "Beta" },
        column: null,
      },
      {
        id: "next3",
        title: "Next three days",
        dueDate: "2026-05-20T12:00:00.000Z",
        priority: "MEDIUM",
        status: "TODO",
        board: { id: "alpha", title: "Alpha" },
        column: null,
      },
      {
        id: "done-task",
        title: "Done task",
        dueDate: "2026-05-17T12:00:00.000Z",
        priority: "HIGH",
        status: "DONE",
        board: { id: "alpha", title: "Alpha" },
        column: null,
      },
      {
        id: "later-task",
        title: "Later task",
        dueDate: "2026-05-25T12:00:00.000Z",
        priority: "HIGH",
        status: "TODO",
        board: { id: "gamma", title: "Gamma" },
        column: null,
      },
    ],
    now
  );

  assert.deepEqual(
    data.buckets.map((bucket) => [bucket.id, bucket.count]),
    [
      ["today", 2],
      ["tomorrow", 1],
      ["next3Days", 1],
    ]
  );

  assert.deepEqual(
    data.buckets[0].tasks.map((task) => task.id),
    ["today-high", "today-low"]
  );
  assert.deepEqual(
    data.buckets[1].tasks.map((task) => task.id),
    ["tomorrow-medium"]
  );
  assert.deepEqual(
    data.buckets[2].tasks.map((task) => task.id),
    ["next3"]
  );
});

test("buildHelicopterDashboardData ranks overload projects by due soon concentration and counts personal vs board tasks", () => {
  const data = buildHelicopterDashboardData(
    [
      {
        id: "alpha-1",
        title: "Alpha 1",
        dueDate: "2026-05-17T12:00:00.000Z",
        priority: "HIGH",
        status: "TODO",
        board: { id: "alpha", title: "Alpha" },
        column: null,
      },
      {
        id: "alpha-2",
        title: "Alpha 2",
        dueDate: "2026-05-18T12:00:00.000Z",
        priority: "MEDIUM",
        status: "TODO",
        board: { id: "alpha", title: "Alpha" },
        column: null,
      },
      {
        id: "beta-1",
        title: "Beta 1",
        dueDate: "2026-05-20T12:00:00.000Z",
        priority: "LOW",
        status: "TODO",
        board: { id: "beta", title: "Beta" },
        column: null,
      },
      {
        id: "personal-1",
        title: "Personal 1",
        dueDate: "2026-05-18T12:00:00.000Z",
        priority: "HIGH",
        status: "TODO",
        board: null,
        column: null,
      },
      {
        id: "done-beta",
        title: "Done Beta",
        dueDate: "2026-05-20T12:00:00.000Z",
        priority: "LOW",
        status: "DONE",
        board: { id: "beta", title: "Beta" },
        column: null,
      },
    ],
    now
  );

  assert.deepEqual(data.overloadProjects, [
    { id: "alpha", title: "Alpha", dueSoonCount: 2, openCount: 2 },
    { id: "beta", title: "Beta", dueSoonCount: 1, openCount: 1 },
  ]);

  assert.deepEqual(data.signalSummary, {
    openCount: 4,
    dueSoonCount: 4,
    personalCount: 1,
    boardCount: 3,
  });

  assert.deepEqual(data.completionSnapshot, [
    { id: "alpha", title: "Alpha", openCount: 2, doneCount: 0 },
    { id: "beta", title: "Beta", openCount: 1, doneCount: 1 },
    { id: "personal", title: "Personal", openCount: 1, doneCount: 0 },
  ]);
});
```

- [ ] **Step 2: Run the new test file and verify it fails because the helper does not exist yet**

Run: `node --test --experimental-strip-types src/lib/helicopter-dashboard.test.ts`

Expected: FAIL with an import/module error for `./helicopter-dashboard.ts` or missing exported function.

- [ ] **Step 3: Commit the failing test**

```bash
git add src/lib/helicopter-dashboard.test.ts
git commit -m "test: define helicopter dashboard derivation"
```

## Task 2: Implement the Dashboard Data Helper

**Files:**
- Create: `src/lib/helicopter-dashboard.ts`
- Test: `src/lib/helicopter-dashboard.test.ts`

- [ ] **Step 1: Write the minimal helper implementation**

```ts
import { differenceInCalendarDays, isSameDay } from "date-fns";

export type HelicopterDashboardTask = {
  id: string;
  title: string;
  dueDate: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "TODO" | "DONE";
  board: { id: string; title: string } | null;
  column: { id: string; title: string } | null;
};

export type RiskBucketId = "today" | "tomorrow" | "next3Days";

const priorityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;

function sortTasks(tasks: HelicopterDashboardTask[]) {
  return [...tasks].sort((a, b) => {
    const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    if (aDue !== bDue) return aDue - bDue;

    return a.title.localeCompare(b.title);
  });
}

export function buildHelicopterDashboardData(
  tasks: HelicopterDashboardTask[],
  now = new Date()
) {
  const openTasks = tasks.filter((task) => task.status === "TODO");
  const today = openTasks.filter(
    (task) => task.dueDate && isSameDay(new Date(task.dueDate), now)
  );
  const tomorrow = openTasks.filter(
    (task) =>
      task.dueDate &&
      differenceInCalendarDays(new Date(task.dueDate), now) === 1
  );
  const next3Days = openTasks.filter((task) => {
    if (!task.dueDate) return false;
    const dayDiff = differenceInCalendarDays(new Date(task.dueDate), now);
    return dayDiff >= 2 && dayDiff <= 3;
  });

  const dueSoonTasks = [...today, ...tomorrow, ...next3Days];
  const dueSoonByBoard = new Map<string, { id: string; title: string; dueSoonCount: number; openCount: number }>();
  const completionMap = new Map<string, { id: string; title: string; openCount: number; doneCount: number }>();

  for (const task of tasks) {
    const boardId = task.board?.id ?? "personal";
    const boardTitle = task.board?.title ?? "Personal";
    const completion = completionMap.get(boardId) ?? {
      id: boardId,
      title: boardTitle,
      openCount: 0,
      doneCount: 0,
    };
    if (task.status === "DONE") completion.doneCount += 1;
    else completion.openCount += 1;
    completionMap.set(boardId, completion);
  }

  for (const task of dueSoonTasks) {
    if (!task.board?.id) continue;
    const current = dueSoonByBoard.get(task.board.id) ?? {
      id: task.board.id,
      title: task.board.title,
      dueSoonCount: 0,
      openCount: completionMap.get(task.board.id)?.openCount ?? 0,
    };
    current.dueSoonCount += 1;
    dueSoonByBoard.set(task.board.id, current);
  }

  return {
    buckets: [
      { id: "today", label: "Today", tasks: sortTasks(today), count: today.length, preview: sortTasks(today).slice(0, 4) },
      { id: "tomorrow", label: "Tomorrow", tasks: sortTasks(tomorrow), count: tomorrow.length, preview: sortTasks(tomorrow).slice(0, 4) },
      { id: "next3Days", label: "Next 3 Days", tasks: sortTasks(next3Days), count: next3Days.length, preview: sortTasks(next3Days).slice(0, 4) },
    ],
    overloadProjects: [...dueSoonByBoard.values()].sort((a, b) => {
      if (b.dueSoonCount !== a.dueSoonCount) return b.dueSoonCount - a.dueSoonCount;
      if (b.openCount !== a.openCount) return b.openCount - a.openCount;
      return a.title.localeCompare(b.title);
    }),
    completionSnapshot: [...completionMap.values()]
      .sort((a, b) => {
        if (b.openCount !== a.openCount) return b.openCount - a.openCount;
        return a.title.localeCompare(b.title);
      })
      .slice(0, 4),
    signalSummary: {
      openCount: openTasks.length,
      dueSoonCount: dueSoonTasks.length,
      personalCount: openTasks.filter((task) => !task.board).length,
      boardCount: openTasks.filter((task) => Boolean(task.board)).length,
    },
  };
}
```

- [ ] **Step 2: Run the helper tests and verify they pass**

Run: `node --test --experimental-strip-types src/lib/helicopter-dashboard.test.ts`

Expected: PASS with 2 passing tests.

- [ ] **Step 3: Commit the helper**

```bash
git add src/lib/helicopter-dashboard.ts src/lib/helicopter-dashboard.test.ts
git commit -m "feat: add helicopter dashboard data helpers"
```

## Task 3: Extract the Dashboard Panels

**Files:**
- Create: `src/components/helicopter/risk-timeline-panel.tsx`
- Create: `src/components/helicopter/context-panel.tsx`
- Modify: `src/app/helicopter/page.tsx`

- [ ] **Step 1: Create the left-pane risk timeline component**

```tsx
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { HelicopterDashboardTask, RiskBucket, RiskBucketId } from "@/lib/helicopter-dashboard";

type RiskTimelinePanelProps = {
  buckets: RiskBucket[];
  selectedBucketId: RiskBucketId;
  onSelectBucket: (bucketId: RiskBucketId) => void;
  onOpenTask: (task: HelicopterDashboardTask) => void;
};

const bucketTone: Record<RiskBucketId, string> = {
  today: "border-red-300 bg-red-50",
  tomorrow: "border-amber-300 bg-amber-50",
  next3Days: "border-sky-300 bg-sky-50",
};

export function RiskTimelinePanel({
  buckets,
  selectedBucketId,
  onSelectBucket,
  onOpenTask,
}: RiskTimelinePanelProps) {
  const selectedBucket = buckets.find((bucket) => bucket.id === selectedBucketId) ?? buckets[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk Timeline</CardTitle>
        <CardDescription>Short-horizon task risk across all work.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          {buckets.map((bucket) => (
            <button
              key={bucket.id}
              type="button"
              onClick={() => onSelectBucket(bucket.id)}
              className={`rounded-xl border p-3 text-left transition ${bucketTone[bucket.id]} ${
                selectedBucketId === bucket.id ? "ring-2 ring-zinc-900/15" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{bucket.label}</span>
                <Badge variant="secondary">{bucket.count}</Badge>
              </div>
              <div className="mt-2 space-y-1">
                {bucket.preview.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No due-soon tasks.</p>
                ) : (
                  bucket.preview.slice(0, 3).map((task) => (
                    <p key={task.id} className="truncate text-xs text-muted-foreground">
                      {task.title}
                    </p>
                  ))
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <div>
            <h3 className="text-sm font-medium">{selectedBucket.label}</h3>
            <p className="text-xs text-muted-foreground">Open a task to inspect or edit it.</p>
          </div>
          {selectedBucket.tasks.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
              No tasks in this bucket.
            </div>
          ) : (
            selectedBucket.tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => onOpenTask(task)}
                className="flex w-full flex-col rounded-lg border bg-card px-4 py-3 text-left transition hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium">{task.title}</span>
                  <Badge variant={task.priority === "HIGH" ? "destructive" : task.priority === "MEDIUM" ? "secondary" : "outline"}>
                    {task.priority}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {task.board?.title ?? "Personal"}
                  {task.column ? ` • ${task.column.title}` : ""}
                  {task.dueDate ? ` • Due ${format(new Date(task.dueDate), "MMM d")}` : ""}
                </p>
              </button>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create the right-pane context panel**

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  CompletionSnapshotRow,
  OverloadProjectRow,
  SignalSummary,
} from "@/lib/helicopter-dashboard";

type ContextPanelProps = {
  overloadProjects: OverloadProjectRow[];
  completionSnapshot: CompletionSnapshotRow[];
  signalSummary: SignalSummary;
};

export function ContextPanel({
  overloadProjects,
  completionSnapshot,
  signalSummary,
}: ContextPanelProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Overload Projects</CardTitle>
          <CardDescription>Boards with the highest due-soon concentration.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {overloadProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No board deadlines in the next 3 days.</p>
          ) : (
            overloadProjects.slice(0, 4).map((row) => (
              <div key={row.id} className="rounded-lg border bg-card px-3 py-2">
                <p className="text-sm font-medium">{row.title}</p>
                <p className="text-xs text-muted-foreground">
                  Due soon {row.dueSoonCount} • Open {row.openCount}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Completion Snapshot</CardTitle>
          <CardDescription>Open vs done for the busiest work areas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {completionSnapshot.map((row) => (
            <div key={row.id} className="rounded-lg border bg-card px-3 py-2">
              <p className="text-sm font-medium">{row.title}</p>
              <p className="text-xs text-muted-foreground">
                Open {row.openCount} • Done {row.doneCount}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signal Summary</CardTitle>
          <CardDescription>Quick workload totals across personal and board tasks.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg border bg-card px-3 py-2">
            <p className="text-xs text-muted-foreground">Open</p>
            <p className="font-medium">{signalSummary.openCount}</p>
          </div>
          <div className="rounded-lg border bg-card px-3 py-2">
            <p className="text-xs text-muted-foreground">Due Soon</p>
            <p className="font-medium">{signalSummary.dueSoonCount}</p>
          </div>
          <div className="rounded-lg border bg-card px-3 py-2">
            <p className="text-xs text-muted-foreground">Personal</p>
            <p className="font-medium">{signalSummary.personalCount}</p>
          </div>
          <div className="rounded-lg border bg-card px-3 py-2">
            <p className="text-xs text-muted-foreground">Board</p>
            <p className="font-medium">{signalSummary.boardCount}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Commit the extracted panels**

```bash
git add src/components/helicopter/risk-timeline-panel.tsx src/components/helicopter/context-panel.tsx
git commit -m "feat: add helicopter dashboard panels"
```

## Task 4: Wire the New Dashboard Into `src/app/helicopter/page.tsx`

**Files:**
- Modify: `src/app/helicopter/page.tsx`
- Modify: `src/components/helicopter/risk-timeline-panel.tsx`
- Modify: `src/components/helicopter/context-panel.tsx`
- Test: `src/lib/helicopter-dashboard.test.ts`

- [ ] **Step 1: Replace old dashboard derivation with the new helper and selection state**

Update imports near the top of `src/app/helicopter/page.tsx`:

```tsx
import { ContextPanel } from "@/components/helicopter/context-panel";
import { RiskTimelinePanel } from "@/components/helicopter/risk-timeline-panel";
import {
  buildHelicopterDashboardData,
  type RiskBucketId,
} from "@/lib/helicopter-dashboard";
```

Replace the old dashboard memo blocks and add selected bucket state:

```tsx
const [selectedRiskBucket, setSelectedRiskBucket] = useState<RiskBucketId>("today");

const dashboardData = useMemo(
  () => buildHelicopterDashboardData(tasks),
  [tasks]
);

useEffect(() => {
  const availableBucket =
    dashboardData.buckets.find((bucket) => bucket.id === selectedRiskBucket && bucket.count > 0)?.id ??
    dashboardData.buckets.find((bucket) => bucket.count > 0)?.id ??
    "today";
  if (availableBucket !== selectedRiskBucket) {
    setSelectedRiskBucket(availableBucket);
  }
}, [dashboardData.buckets, selectedRiskBucket]);
```

Delete these old dashboard-only memo blocks:

```tsx
const urgentTasks = useMemo(/* ... */);
const groupedByBoard = useMemo(/* ... */);
```

- [ ] **Step 2: Replace the current dashboard tab markup with the split layout**

Replace the current `TabsContent value="dashboard"` block with:

```tsx
<TabsContent value="dashboard" className="pt-2">
  <div className="grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
    <RiskTimelinePanel
      buckets={dashboardData.buckets}
      selectedBucketId={selectedRiskBucket}
      onSelectBucket={setSelectedRiskBucket}
      onOpenTask={(task) => void openEditTaskModal(task)}
    />
    <ContextPanel
      overloadProjects={dashboardData.overloadProjects}
      completionSnapshot={dashboardData.completionSnapshot}
      signalSummary={dashboardData.signalSummary}
    />
  </div>
</TabsContent>
```

Keep these existing sections unchanged:

```tsx
<TabsContent value="list" ... />
<TabsContent value="timeline" ... />
<TabsContent value="calendar" ... />
```

- [ ] **Step 3: Run lint and helper tests together**

Run: `npm run lint -- src/app/helicopter/page.tsx src/components/helicopter/context-panel.tsx src/components/helicopter/risk-timeline-panel.tsx src/lib/helicopter-dashboard.ts src/lib/helicopter-dashboard.test.ts`

Expected: PASS with no ESLint errors.

Run: `node --test --experimental-strip-types src/lib/helicopter-dashboard.test.ts`

Expected: PASS with 2 passing tests.

- [ ] **Step 4: Commit the dashboard integration**

```bash
git add src/app/helicopter/page.tsx src/components/helicopter/context-panel.tsx src/components/helicopter/risk-timeline-panel.tsx src/lib/helicopter-dashboard.ts src/lib/helicopter-dashboard.test.ts
git commit -m "feat: redesign helicopter dashboard"
```

## Task 5: Responsive QA And Final Verification

**Files:**
- Modify: `src/components/helicopter/risk-timeline-panel.tsx`
- Modify: `src/components/helicopter/context-panel.tsx`
- Modify: `src/app/helicopter/page.tsx`

- [ ] **Step 1: Polish mobile ordering and empty states if verification reveals layout issues**

Use these adjustments if needed:

```tsx
<div className="grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
```

```tsx
<div className="grid gap-3 md:grid-cols-3">
```

```tsx
<div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
  No tasks in this bucket.
</div>
```

```tsx
<p className="text-sm text-muted-foreground">No board deadlines in the next 3 days.</p>
```

The intended outcome is:

- left pane stays first on mobile
- bucket strips stack cleanly on narrow widths
- empty states remain informative without collapsing the layout

- [ ] **Step 2: Run full project verification for touched code**

Run: `npm run lint -- src/app/helicopter/page.tsx src/components/helicopter/context-panel.tsx src/components/helicopter/risk-timeline-panel.tsx src/lib/helicopter-dashboard.ts src/lib/helicopter-dashboard.test.ts`

Expected: PASS.

Run: `node --test --experimental-strip-types src/lib/helicopter-dashboard.test.ts`

Expected: PASS.

- [ ] **Step 3: Commit the QA polish**

```bash
git add src/app/helicopter/page.tsx src/components/helicopter/context-panel.tsx src/components/helicopter/risk-timeline-panel.tsx
git commit -m "fix: polish helicopter dashboard responsiveness"
```

## Self-Review

- Spec coverage check:
  - time-first `Today` / `Tomorrow` / `Next 3 Days` hierarchy is covered in Tasks 1, 2, and 4
  - task-detail-first interaction is covered in Tasks 3 and 4 via `onOpenTask`
  - overload project, completion snapshot, and signal summary context are covered in Tasks 2, 3, and 4
  - keeping list, timeline, and calendar unchanged is enforced in Task 4
  - mobile-first left-pane priority and empty states are covered in Task 5
- Placeholder scan:
  - no `TODO`, `TBD`, or “handle appropriately” placeholders remain
- Type consistency:
  - `RiskBucketId`, `HelicopterDashboardTask`, `buildHelicopterDashboardData`, `ContextPanel`, and `RiskTimelinePanel` names are consistent across tasks
