# Planner Mode Focus Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a denser 30-minute planner grid plus a timer-backed `Focus Time Today` summary without changing the existing planner interaction model.

**Architecture:** Keep `src/app/planner/page.tsx` as the single client entry point, but move focus aggregation and formatting into a small pure helper so analytics logic stays testable. Persist timer-specific metadata directly on `Task` through the existing task creation paths, then let the planner page derive the right-panel summary from the fetched planner task list.

**Tech Stack:** Next.js 16 App Router client component, React 19 hooks, TypeScript, Prisma/PostgreSQL, Zod, Tailwind/shadcn UI primitives, Node 22 `node --test --experimental-strip-types`, ESLint.

---

## File Structure

- Create `src/lib/planner-focus.ts` — pure helper for daily focus aggregation and compact duration formatting.
- Create `src/lib/planner-focus.test.ts` — deterministic Node tests for aggregation rules and formatting.
- Create `src/lib/validators/board.test.ts` — focused schema tests for new timer metadata fields on task-creation payloads.
- Modify `prisma/schema.prisma` — add `trackedByTimer` and `actualDurationMinutes` to `Task`.
- Create `prisma/migrations/20260614120000_planner_timer_focus_fields/migration.sql` — add the new task columns in PostgreSQL.
- Modify `src/lib/validators/board.ts` — allow timer metadata through standalone and board task create schemas.
- Modify `src/lib/board-service.ts` — persist timer metadata in both standalone-task and board-task creation flows.
- Modify `src/app/api/tasks/route.ts` — forward timer metadata for personal timer-created tasks.
- Modify `src/app/api/boards/[id]/tasks/route.ts` — forward timer metadata for board timer-created tasks.
- Modify `src/app/planner/page.tsx` — add timer metadata to the local `Task` type, pass timer fields during timer save, render half-hour separators, compute focus summary from fetched tasks, and show the new right-panel card only when Timer Mode is enabled.

### Task 1: Add a Pure Helper for Focus Aggregation

**Files:**
- Create: `src/lib/planner-focus.ts`
- Create: `src/lib/planner-focus.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/planner-focus.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { summarizeDailyFocus, formatFocusMinutes } from "./planner-focus.ts";

const selectedDate = new Date("2026-06-14T00:00:00.000Z");

test("summarizeDailyFocus counts only timer-tracked tasks on the selected day", () => {
  const summary = summarizeDailyFocus(
    [
      {
        id: "timer-1",
        trackedByTimer: true,
        actualDurationMinutes: 90,
        startDate: "2026-06-14T08:00:00.000Z",
      },
      {
        id: "timer-2",
        trackedByTimer: true,
        actualDurationMinutes: 45,
        startDate: "2026-06-14T14:30:00.000Z",
      },
      {
        id: "scheduled-only",
        trackedByTimer: false,
        actualDurationMinutes: 240,
        startDate: "2026-06-14T10:00:00.000Z",
      },
      {
        id: "different-day",
        trackedByTimer: true,
        actualDurationMinutes: 30,
        startDate: "2026-06-13T22:00:00.000Z",
      },
      {
        id: "missing-duration",
        trackedByTimer: true,
        actualDurationMinutes: null,
        startDate: "2026-06-14T16:00:00.000Z",
      },
    ],
    selectedDate
  );

  assert.deepEqual(summary, {
    totalFocusMinutes: 135,
    sessionCount: 2,
  });
});

test("formatFocusMinutes returns compact hour and minute labels", () => {
  assert.equal(formatFocusMinutes(0), "0m");
  assert.equal(formatFocusMinutes(25), "25m");
  assert.equal(formatFocusMinutes(60), "1j 0m");
  assert.equal(formatFocusMinutes(145), "2j 25m");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types src/lib/planner-focus.test.ts`

Expected: FAIL with a module resolution error for `./planner-focus.ts` or a missing export error for `summarizeDailyFocus`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/planner-focus.ts`:

```ts
import { isSameDay } from "date-fns";

type FocusTask = {
  id: string;
  trackedByTimer: boolean;
  actualDurationMinutes: number | null;
  startDate: string | null;
};

export function summarizeDailyFocus(tasks: FocusTask[], selectedDate: Date) {
  return tasks.reduce(
    (summary, task) => {
      if (!task.trackedByTimer || task.actualDurationMinutes == null || !task.startDate) {
        return summary;
      }

      if (!isSameDay(new Date(task.startDate), selectedDate)) {
        return summary;
      }

      return {
        totalFocusMinutes: summary.totalFocusMinutes + task.actualDurationMinutes,
        sessionCount: summary.sessionCount + 1,
      };
    },
    { totalFocusMinutes: 0, sessionCount: 0 }
  );
}

export function formatFocusMinutes(totalMinutes: number) {
  const safeMinutes = Math.max(0, totalMinutes);
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}j ${minutes}m`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types src/lib/planner-focus.test.ts`

Expected: PASS with 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/planner-focus.ts src/lib/planner-focus.test.ts
git commit -m "test: add planner focus summary helper"
```

### Task 2: Add Timer Metadata Fields to Prisma and Task Create Schemas

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260614120000_planner_timer_focus_fields/migration.sql`
- Modify: `src/lib/validators/board.ts`
- Create: `src/lib/validators/board.test.ts`

- [ ] **Step 1: Write the failing schema tests**

Create `src/lib/validators/board.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { addTaskSchema, createStandaloneTaskSchema } from "./board.ts";

test("createStandaloneTaskSchema accepts timer metadata", () => {
  const parsed = createStandaloneTaskSchema.parse({
    title: "Deep work block",
    description: "Tracked via Timer Mode (00:45:00).",
    startDate: "2026-06-14T08:00:00.000Z",
    dueDate: "2026-06-14T08:45:00.000Z",
    priority: "HIGH",
    trackedByTimer: true,
    actualDurationMinutes: 45,
  });

  assert.equal(parsed.trackedByTimer, true);
  assert.equal(parsed.actualDurationMinutes, 45);
});

test("addTaskSchema accepts timer metadata for board tasks", () => {
  const parsed = addTaskSchema.parse({
    columnId: "cmczx9ppl0000v8m9j9rj9rj9",
    title: "Client work session",
    description: "Tracked via Timer Mode (01:30:00).",
    startDate: "2026-06-14T10:00:00.000Z",
    dueDate: "2026-06-14T11:30:00.000Z",
    priority: "MEDIUM",
    trackedByTimer: true,
    actualDurationMinutes: 90,
  });

  assert.equal(parsed.trackedByTimer, true);
  assert.equal(parsed.actualDurationMinutes, 90);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types src/lib/validators/board.test.ts`

Expected: FAIL because `trackedByTimer` and `actualDurationMinutes` are rejected as unknown schema keys or missing parsed properties.

- [ ] **Step 3: Add Prisma fields, migration, and schema support**

In `prisma/schema.prisma`, update `model Task`:

```prisma
model Task {
  id                     String           @id @default(cuid())
  boardId                String?
  columnId               String?
  assigneeId             String?
  createdById            String
  title                  String
  description            String?
  startDate              DateTime?
  dueDate                DateTime?
  plannedStartAt         DateTime?
  plannedDurationMinutes Int?
  trackedByTimer         Boolean          @default(false)
  actualDurationMinutes  Int?
  priority               TaskPriority     @default(MEDIUM)
  status                 TaskStatus       @default(TODO)
  completedAt            DateTime?
  position               Int
  ...
}
```

Create `prisma/migrations/20260614120000_planner_timer_focus_fields/migration.sql`:

```sql
ALTER TABLE "public"."Task"
  ADD COLUMN "trackedByTimer" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "actualDurationMinutes" INTEGER;
```

In `src/lib/validators/board.ts`, extend both create schemas:

```ts
const timerMetadataSchema = {
  trackedByTimer: z.boolean().optional(),
  actualDurationMinutes: z.number().int().min(1).max(24 * 60).optional().nullable(),
};

export const addTaskSchema = z.object({
  columnId: z.string().cuid(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  priority: priorityEnum.optional(),
  assigneeId: z.string().cuid().optional().nullable(),
  assigneeIds: z.array(z.string().cuid()).max(20).optional(),
  ...timerMetadataSchema,
});

export const createStandaloneTaskSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  priority: priorityEnum.optional(),
  ...timerMetadataSchema,
});
```

- [ ] **Step 4: Run test and Prisma validation**

Run:

```bash
node --test --experimental-strip-types src/lib/validators/board.test.ts
npx prisma validate
```

Expected:
- Node test exits `0` with 2 passing tests.
- Prisma validate exits `0`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260614120000_planner_timer_focus_fields/migration.sql src/lib/validators/board.ts src/lib/validators/board.test.ts
git commit -m "feat: add timer metadata task fields"
```

### Task 3: Persist Timer Metadata Through Existing Task Creation Paths

**Files:**
- Modify: `src/lib/board-service.ts`
- Modify: `src/app/api/tasks/route.ts`
- Modify: `src/app/api/boards/[id]/tasks/route.ts`
- Test: `src/lib/validators/board.test.ts`

- [ ] **Step 1: Extend the service input types and Prisma create payloads**

In `src/lib/board-service.ts`, extend the standalone-task input type and Prisma `data`:

```ts
export async function createStandaloneTaskForUser(input: {
  userId: string;
  title: string;
  description?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  priority?: TaskPriority;
  trackedByTimer?: boolean;
  actualDurationMinutes?: number | null;
}) {
  return prisma.task.create({
    data: {
      boardId: null,
      columnId: null,
      createdById: input.userId,
      assigneeId: input.userId,
      assignees: {
        create: {
          userId: input.userId,
        },
      },
      title: input.title,
      description: input.description ?? null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      trackedByTimer: input.trackedByTimer ?? false,
      actualDurationMinutes: input.actualDurationMinutes ?? null,
      priority: input.priority ?? TaskPriority.MEDIUM,
      status: "TODO",
      position: 0,
    },
    ...
  });
}
```

In the existing board-task creation helper signature and `prisma.task.create({ data: ... })`, add the same fields:

```ts
trackedByTimer: input.trackedByTimer ?? false,
actualDurationMinutes: input.actualDurationMinutes ?? null,
```

Do not change any non-timer create behavior beyond defaulting these fields.

- [ ] **Step 2: Forward timer metadata through the API routes**

In `src/app/api/tasks/route.ts`, keep the existing validation and pass through the parsed fields:

```ts
  const task = await createStandaloneTaskForUser({
    userId,
    ...parsed.data,
    priority: parsed.data.priority
      ? TaskPriority[parsed.data.priority]
      : TaskPriority.MEDIUM,
    trackedByTimer: parsed.data.trackedByTimer ?? false,
    actualDurationMinutes: parsed.data.actualDurationMinutes ?? null,
  });
```

In `src/app/api/boards/[id]/tasks/route.ts`, do the equivalent:

```ts
    const task = await addTaskToBoard({
      userId,
      boardId,
      ...parsed.data,
      priority: parsed.data.priority
        ? TaskPriority[parsed.data.priority]
        : TaskPriority.MEDIUM,
      trackedByTimer: parsed.data.trackedByTimer ?? false,
      actualDurationMinutes: parsed.data.actualDurationMinutes ?? null,
      assigneeIds:
        parsed.data.assigneeIds && parsed.data.assigneeIds.length > 0
          ? parsed.data.assigneeIds
          : parsed.data.assigneeId
            ? [parsed.data.assigneeId]
            : [userId],
      assigneeId: parsed.data.assigneeId ?? userId,
    });
```

- [ ] **Step 3: Run focused verification**

Run:

```bash
node --test --experimental-strip-types src/lib/validators/board.test.ts
npm run lint -- src/lib/board-service.ts src/app/api/tasks/route.ts 'src/app/api/boards/[id]/tasks/route.ts' src/lib/validators/board.ts
```

Expected:
- Node test exits `0` with 2 passing tests.
- ESLint exits `0`.

Then update the local database client and schema:

```bash
npx prisma generate
```

Expected: Prisma Client regeneration completes without schema errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/board-service.ts src/app/api/tasks/route.ts src/app/api/boards/[id]/tasks/route.ts src/lib/validators/board.ts
git commit -m "feat: persist timer metadata on tasks"
```

### Task 4: Add the 30-Minute Grid and Focus Summary Card to Planner

**Files:**
- Modify: `src/app/planner/page.tsx`
- Modify: `src/lib/planner-focus.ts`
- Test: `src/lib/planner-focus.test.ts`

- [ ] **Step 1: Add the helper import, task fields, and focus summary derivation**

In `src/app/planner/page.tsx`, add the helper import:

```tsx
import { formatFocusMinutes, summarizeDailyFocus } from "@/lib/planner-focus";
```

Extend the local `Task` type:

```tsx
type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "DONE";
  priority: "HIGH" | "MEDIUM" | "LOW";
  createdById: string;
  assigneeId: string | null;
  startDate: string | null;
  dueDate: string | null;
  plannedStartAt: string | null;
  plannedDurationMinutes: number | null;
  trackedByTimer: boolean;
  actualDurationMinutes: number | null;
  ...
};
```

Add a memo near the other derived planner collections:

```tsx
  const focusSummary = useMemo(
    () => summarizeDailyFocus(tasks, selectedDate),
    [tasks, selectedDate]
  );
```

- [ ] **Step 2: Send timer metadata when Timer Mode creates a task**

In `stopTimerSession`, update both create payload branches:

```tsx
            body: JSON.stringify({
              columnId: targetColumnId,
              title: timerTitle.trim(),
              description: `Tracked via Timer Mode (${formatElapsed(durationMs)}).`,
              startDate: timerStartAt.toISOString(),
              dueDate: endAt.toISOString(),
              priority: timerPriority,
              trackedByTimer: true,
              actualDurationMinutes: durationMinutes,
            }),
```

and

```tsx
            body: JSON.stringify({
              title: timerTitle.trim(),
              description: `Tracked via Timer Mode (${formatElapsed(durationMs)}).`,
              startDate: timerStartAt.toISOString(),
              dueDate: endAt.toISOString(),
              priority: timerPriority,
              trackedByTimer: true,
              actualDurationMinutes: durationMinutes,
            }),
```

Keep the schedule patch after task creation exactly as-is except for using the same created task id.

- [ ] **Step 3: Add half-hour separators without changing task-block sizing**

Near the existing planner constants, add:

```tsx
const HALF_HOUR_LINE_OFFSET = ROW_HEIGHT / 2;
```

In the planner grid render, keep the hourly rows and labels, but add a second separator inside each row:

```tsx
                {hours.map((hour, idx) => (
                  <div
                    key={hour}
                    className="absolute left-3 right-3 grid grid-cols-[72px_1fr] items-start border-t first:border-t-0 pointer-events-none"
                    style={{ top: `${12 + idx * ROW_HEIGHT}px`, height: `${ROW_HEIGHT}px` }}
                  >
                    <div className="pt-1 text-xs text-muted-foreground">{hourLabel(hour)}</div>
                    <div className="relative h-full border-l">
                      {idx < hours.length - 1 ? (
                        <div className="absolute inset-x-0 border-t border-dashed border-border/70" style={{ top: `${HALF_HOUR_LINE_OFFSET}px` }} />
                      ) : null}
                    </div>
                  </div>
                ))}
```

Do not change:
- `scheduledBlocks` start-hour math
- task block top/height calculation
- drag/drop slot math
- resize stepping

This task is intentionally visual-only for the half-hour grid.

- [ ] **Step 4: Render the focus summary card under the right panel sections**

In the right column branch, after the existing task sections card, add:

```tsx
          {timerModeEnabled ? (
            <Card>
              <CardHeader>
                <CardTitle>Focus Time Today</CardTitle>
                <CardDescription>
                  Logged focus time for {format(selectedDate, "MMM d, yyyy")}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-end justify-between gap-3 rounded-xl border bg-muted/20 p-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Total Focus
                    </p>
                    <p className="text-2xl font-semibold text-zinc-900">
                      {formatFocusMinutes(focusSummary.totalFocusMinutes)}
                    </p>
                  </div>
                  <Badge variant="outline">{focusSummary.sessionCount} sesi</Badge>
                </div>

                {focusSummary.sessionCount === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Belum ada focus time tercatat hari ini.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Timer Mode sudah mencatat {focusSummary.sessionCount} sesi fokus untuk hari ini.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}
```

This card must remain hidden when `Timer Mode` is off.

- [ ] **Step 5: Run focused verification**

Run:

```bash
node --test --experimental-strip-types src/lib/planner-focus.test.ts src/lib/validators/board.test.ts
npm run lint -- src/app/planner/page.tsx src/lib/planner-focus.ts src/lib/planner-focus.test.ts src/lib/validators/board.ts src/lib/validators/board.test.ts
npm run build
```

Expected:
- Node test exits `0` with all planner-focus and validator tests passing.
- ESLint exits `0`.
- Next build exits `0`.

Then run the app locally:

```bash
npm run dev
```

Manual checks on `/planner`:
- hour labels still render once per hour
- each hour row shows a visible mid-row half-hour separator
- scheduled task blocks keep the same large-row height behavior
- enabling `Timer Mode` reveals the `Focus Time Today` card
- with no timer-created tasks on the selected day, the empty state appears
- stopping a timer creates a task and increments the daily focus total
- changing the selected day changes the focus total based on timer task `startDate`

- [ ] **Step 6: Commit**

```bash
git add src/app/planner/page.tsx src/lib/planner-focus.ts src/lib/planner-focus.test.ts src/lib/validators/board.test.ts prisma/schema.prisma prisma/migrations/20260614120000_planner_timer_focus_fields/migration.sql src/lib/validators/board.ts src/lib/board-service.ts src/app/api/tasks/route.ts src/app/api/boards/[id]/tasks/route.ts
git commit -m "feat: add planner focus time summary"
```

## Self-Review

- Spec coverage:
  - 30-minute visual grid with hourly labels only is implemented in Task 4 Step 3.
  - unchanged scheduling interaction model is explicitly preserved in Task 4 Step 3.
  - timer metadata on `Task` is implemented in Task 2 Step 3 and Task 3 Step 1.
  - focus summary card gated by `Timer Mode` is implemented in Task 4 Step 4.
  - daily aggregation by selected day using `startDate` is implemented in Task 1 Step 3 and wired in Task 4 Step 1.
  - timer save flow carrying metadata is implemented in Task 4 Step 2.
- Placeholder scan: no `TODO`, `TBD`, “implement later,” or vague “add tests” instructions remain.
- Type consistency:
  - `trackedByTimer` and `actualDurationMinutes` are the same names across Prisma, Zod schemas, service inputs, route payloads, and planner UI.
  - `summarizeDailyFocus` and `formatFocusMinutes` are introduced in Task 1 and reused with the same names in Task 4.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-14-planner-mode-focus-time-implementation.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
