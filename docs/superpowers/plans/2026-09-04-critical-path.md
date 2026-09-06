# Critical Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add same-board task dependencies and a Critical Path tab in Helicopter View that supports dependency editing and SVG network visualization with CPM metrics.

**Architecture:** Persist directed dependency edges through a Prisma join model and update them through a single transactional endpoint. Keep graph validation, CPM calculations, and deterministic layout in pure TypeScript helpers; the new Helicopter components render and edit the API data without owning database logic.

**Tech Stack:** Next.js 16 App Router route handlers, React 19, TypeScript, Prisma 6, PostgreSQL, Zod 4, date-fns 4, Tailwind CSS 4, Lucide React, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-critical-path-design.md`

## Global Constraints

- Persist dependencies permanently; expose editing and visualization only from Helicopter View in this phase.
- A dependency is finish-to-start and may only connect two tasks from the same non-closed board.
- Reject self-dependencies and every direct or indirect cycle; do not partially save an invalid update.
- Use inclusive calendar-day duration from `startDate` through `dueDate`, minimum one day, for CPM.
- Do not add a diagram library; render the diagram with local SVG components.
- Tasks without both dates remain visible but are excluded from CPM metrics.
- Read the relevant Next.js guide in `node_modules/next/dist/docs/` before changing route or client-component code.

---

## File Structure

- `prisma/schema.prisma`: Task-to-TaskDependency relations and constraints.
- `prisma/migrations/20260904000000_add_task_dependencies/migration.sql`: database table, foreign keys, indexes, and unique constraint.
- `src/lib/critical-path.ts`: pure graph validation, duration, CPM, and layered SVG layout types/functions.
- `src/lib/critical-path.test.ts`: unit coverage for the pure graph helper.
- `src/lib/validators/board.ts`: dependency update payload schema.
- `src/lib/board-service.ts`: authenticated board-scoped dependency read/update service functions and task-list include.
- `src/app/api/tasks/[id]/dependencies/route.ts`: authenticated PATCH endpoint for replacing one task's dependency set.
- `src/app/api/tasks/[id]/dependencies/route.test.ts`: mocked route/service request tests.
- `src/components/helicopter/task-dependencies-table.tsx`: focused dependency table and multi-select editor.
- `src/components/helicopter/critical-path-network.tsx`: SVG network, controls, summary, empty/error states, and node focus.
- `src/app/helicopter/page.tsx`: task response type, board selector state, nested Critical Path tabs, dependency mutation wiring.
- `package.json`, `vitest.config.ts`: test command and test-runner setup.

## Task 1: Establish Test Runner and Pure Critical-Path Domain

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`
- Create: `src/lib/critical-path.ts`
- Create: `src/lib/critical-path.test.ts`

**Interfaces:**
- Produces `DependencyTask`, `DependencyEdge`, `CriticalPathAnalysis`, `hasDependencyCycle`, `getDependencyCandidateIds`, `analyzeCriticalPath`, and `buildNetworkLayout` from `src/lib/critical-path.ts`.
- `DependencyTask` has `id`, `title`, `status`, `startDate`, and `dueDate` fields; dates are ISO strings or `null`.
- `analyzeCriticalPath(tasks, edges)` returns `{ criticalTaskIds, criticalEdgeKeys, projectDurationDays, slackDaysByTaskId, excludedTaskIds }`.

- [ ] **Step 1: Read the local test and TypeScript configuration**

Run: `sed -n '1,240p' package.json && sed -n '1,240p' tsconfig.json`

Expected: no existing unit-test command; the TypeScript alias maps `@/*` to `src/*`.

- [ ] **Step 2: Add a failing unit test for inclusive duration and a linear critical path**

Create `src/lib/critical-path.test.ts` with this initial contract:

```ts
import { describe, expect, it } from "vitest";
import { analyzeCriticalPath } from "@/lib/critical-path";

describe("analyzeCriticalPath", () => {
  it("uses inclusive calendar-day durations for a linear dependency chain", () => {
    const analysis = analyzeCriticalPath(
      [
        { id: "a", title: "Design", status: "TODO", startDate: "2026-09-01T00:00:00.000Z", dueDate: "2026-09-02T00:00:00.000Z" },
        { id: "b", title: "Build", status: "TODO", startDate: "2026-09-03T00:00:00.000Z", dueDate: "2026-09-05T00:00:00.000Z" },
      ],
      [{ taskId: "b", dependsOnTaskId: "a" }]
    );

    expect(analysis.projectDurationDays).toBe(5);
    expect(analysis.criticalTaskIds).toEqual(new Set(["a", "b"]));
    expect(analysis.slackDaysByTaskId).toEqual({ a: 0, b: 0 });
  });
});
```

- [ ] **Step 3: Add Vitest configuration and verify the test fails because the module is absent**

Add `test` and `test:watch` scripts using `vitest run` and `vitest`, add `vitest` as a development dependency, and create `vitest.config.ts` using `defineConfig` with the `@` path alias resolved from the repository root.

Run: `npm test -- src/lib/critical-path.test.ts`

Expected: FAIL with an unresolved `@/lib/critical-path` module.

- [ ] **Step 4: Implement the minimal typed CPM helper**

Create `src/lib/critical-path.ts` with:

```ts
export type DependencyTask = {
  id: string;
  title: string;
  status: "TODO" | "DONE";
  startDate: string | null;
  dueDate: string | null;
};

export type DependencyEdge = { taskId: string; dependsOnTaskId: string };

export function analyzeCriticalPath(
  tasks: DependencyTask[],
  edges: DependencyEdge[]
): CriticalPathAnalysis;
```

Use `differenceInCalendarDays` from `date-fns` plus one for duration. Filter incomplete-date tasks and their incident edges from CPM. Topologically order the remaining DAG, calculate earliest finish from the maximum predecessor finish, calculate latest values in reverse order, and mark zero-slack tasks and edges critical. Do not derive schedule dates from the stored dates; only derive durations.

- [ ] **Step 5: Extend unit coverage before expanding implementation**

Add explicit tests for:

```ts
it("identifies the longest branch while leaving the shorter branch with slack", () => {});
it("treats a converging task as waiting for every predecessor", () => {});
it("excludes incomplete-date tasks from CPM while retaining their graph data", () => {});
it("detects direct and indirect cycles", () => {});
it("does not offer self, current dependencies, or cycle-forming candidates", () => {});
it("assigns prerequisites to earlier layout layers than dependents", () => {});
```

Use a two-branch graph with durations `2 -> 4 -> 1` and `3 -> 1`, converging into a one-day final task. Assert the first branch is critical and the second branch has positive slack.

- [ ] **Step 6: Implement graph validation and deterministic SVG layout**

Add:

```ts
export function hasDependencyCycle(taskIds: string[], edges: DependencyEdge[]): boolean;
export function getDependencyCandidateIds(
  taskId: string,
  taskIds: string[],
  existingEdges: DependencyEdge[]
): Set<string>;
export function buildNetworkLayout(
  tasks: DependencyTask[],
  edges: DependencyEdge[]
): { nodes: Record<string, { x: number; y: number; layer: number }>; width: number; height: number };
```

Use Kahn-style layer assignment: roots start at layer 0; each dependent layer is one more than its latest prerequisite layer. Sort nodes by title then id inside each layer to make snapshots and UI stable. Keep coordinates as plain numbers so the React renderer owns all SVG markup.

- [ ] **Step 7: Run the focused unit suite and lint**

Run: `npm test -- src/lib/critical-path.test.ts && npm run lint`

Expected: PASS with all graph cases green and no lint errors.

- [ ] **Step 8: Commit the domain foundation**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/critical-path.ts src/lib/critical-path.test.ts
git commit -m "feat: add critical path graph helpers"
```

## Task 2: Persist Same-Board Dependencies and Expose an Atomic API

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260904000000_add_task_dependencies/migration.sql`
- Modify: `src/lib/validators/board.ts`
- Modify: `src/lib/board-service.ts`
- Create: `src/app/api/tasks/[id]/dependencies/route.ts`
- Create: `src/app/api/tasks/[id]/dependencies/route.test.ts`

**Interfaces:**
- Consumes `hasDependencyCycle` from `src/lib/critical-path.ts`.
- Produces `replaceTaskDependenciesForUser({ userId, taskId, dependsOnTaskIds }): Promise<{ ok: true; task: Task } | { ok: false; code: "NOT_FOUND" | "INVALID_DEPENDENCY" | "CYCLE"; message: string }>`.
- Produces `updateTaskDependenciesSchema`, accepting `{ dependsOnTaskIds: string[] }` with unique CUIDs and at most 100 items.

- [ ] **Step 1: Read Prisma migration conventions and applicable Next.js route guidance**

Run: `sed -n '1,220p' prisma/migrations/20260614120000_planner_timer_focus_fields/migration.sql && rg -n "Route Handlers|route.ts" node_modules/next/dist/docs -g '*.md' | head -20`

Expected: migration SQL and current Next.js route-handler documentation are available before edits.

- [ ] **Step 2: Write failing API tests for payload rejection and service outcomes**

Create `src/app/api/tasks/[id]/dependencies/route.test.ts`. Mock `@/lib/api` and `@/lib/board-service`; call `PATCH` with resolved params. Cover:

```ts
it("returns 401 when no session user exists", async () => {});
it("returns 400 for duplicate or invalid dependency ids", async () => {});
it("returns 422 and preserves the cycle message from the service", async () => {});
it("returns 404 when the target task is inaccessible", async () => {});
it("returns the updated task for a valid replacement", async () => {});
```

Assert the valid call invokes `replaceTaskDependenciesForUser` with the authenticated user id, route param task id, and de-duplicated payload ids.

- [ ] **Step 3: Run route tests to verify they fail before the endpoint exists**

Run: `npm test -- src/app/api/tasks/[id]/dependencies/route.test.ts`

Expected: FAIL because the dependencies route and validator/service exports do not exist.

- [ ] **Step 4: Add the Prisma relation and migration**

Add two named relations to `Task`:

```prisma
dependencies       TaskDependency[] @relation("TaskDependencyTask")
dependentTasks     TaskDependency[] @relation("TaskDependencyPrerequisite")
```

Add:

```prisma
model TaskDependency {
  id               String   @id @default(cuid())
  taskId           String
  dependsOnTaskId  String
  task             Task     @relation("TaskDependencyTask", fields: [taskId], references: [id], onDelete: Cascade)
  dependsOnTask    Task     @relation("TaskDependencyPrerequisite", fields: [dependsOnTaskId], references: [id], onDelete: Cascade)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@unique([taskId, dependsOnTaskId])
  @@index([dependsOnTaskId])
}
```

Generate the matching migration through Prisma, inspect its SQL, and confirm it creates both foreign keys, the compound unique key, and the reverse lookup index.

Run: `npx prisma validate && npx prisma migrate dev --name add_task_dependencies`

Expected: schema validation and migration complete successfully in the local development database.

- [ ] **Step 5: Add request validation and transactional service logic**

In `src/lib/validators/board.ts`, add:

```ts
export const updateTaskDependenciesSchema = z.object({
  dependsOnTaskIds: z.array(z.string().cuid()).max(100).superRefine((ids, ctx) => {
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", message: "Dependency ids must be unique." });
    }
  }),
});
```

In `replaceTaskDependenciesForUser`, read the target task with its board id using the same accessible-board conditions as `listAllTasksForUser`. Require a non-null board id. Fetch all selected prerequisite tasks using the same board id. Return `INVALID_DEPENDENCY` if a selection is missing, foreign to the board, or equals the target task. Within one Prisma transaction, read all existing same-board dependency edges, replace only the target task's rows, run `hasDependencyCycle` against the proposed edge list, and create the new rows only when acyclic. Return the reloaded task with `dependencies` included.

Extend `listAllTasksForUser` to include each task's `dependencies`, selecting its prerequisite's `id`, `title`, `startDate`, `dueDate`, and `status`.

- [ ] **Step 6: Add the route handler**

Create `src/app/api/tasks/[id]/dependencies/route.ts` following the existing task schedule route shape:

```ts
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();
  const { id: taskId } = await params;
  const parsed = updateTaskDependenciesSchema.safeParse(await req.json());
  if (!parsed.success) return validationError("Invalid dependency payload.");
  const result = await replaceTaskDependenciesForUser({ userId, taskId, ...parsed.data });
}
```

Use `NextResponse.json({ ok: false, error: result.message }, { status: 422 })` for cycles so the UI can render the service message.

- [ ] **Step 7: Run route tests, Prisma validation, and lint**

Run: `npm test -- src/app/api/tasks/[id]/dependencies/route.test.ts && npx prisma validate && npm run lint`

Expected: all mocked route cases pass, Prisma schema validates, and lint is clean.

- [ ] **Step 8: Commit persistence and API work**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/validators/board.ts src/lib/board-service.ts src/app/api/tasks/[id]/dependencies/route.ts src/app/api/tasks/[id]/dependencies/route.test.ts
git commit -m "feat: persist task dependencies"
```

## Task 3: Build the Dependency Table Component

**Files:**
- Create: `src/components/helicopter/task-dependencies-table.tsx`
- Modify: `src/app/helicopter/page.tsx`

**Interfaces:**
- Consumes `DependencyTask`, `DependencyEdge`, and `getDependencyCandidateIds` from `src/lib/critical-path.ts`.
- Produces `TaskDependenciesTable({ tasks, edges, isSavingTaskId, onReplaceDependencies })`.
- `onReplaceDependencies(taskId: string, dependsOnTaskIds: string[]): Promise<{ ok: boolean; error?: string }>` is implemented by Helicopter page.

- [ ] **Step 1: Read existing UI controls and the installed component catalog**

Run: `rg --files src/components/ui | sort && sed -n '1,220p' src/components/ui/popover.tsx 2>/dev/null || true`

Expected: determine whether the repository already has a popover/command component; if absent, use an accessible inline absolute-positioned panel with native checkbox inputs and a search field instead of adding UI dependencies.

- [ ] **Step 2: Add failing component interaction coverage**

Create a minimal `src/components/helicopter/task-dependencies-table.test.tsx` using React Testing Library and `@testing-library/user-event`; add those packages only if not already present. Cover opening one row's editor, filtering candidates, selecting two prerequisites, saving, and rendering a server cycle error.

Use this expected assertion shape:

```tsx
await user.click(screen.getByRole("button", { name: /edit dependencies for build/i }));
await user.click(screen.getByRole("checkbox", { name: "Design" }));
await user.click(screen.getByRole("checkbox", { name: "API" }));
await user.click(screen.getByRole("button", { name: "Save dependencies" }));
expect(onReplaceDependencies).toHaveBeenCalledWith("build", ["api", "design"]);
```

- [ ] **Step 3: Run the component test to verify it fails**

Run: `npm test -- src/components/helicopter/task-dependencies-table.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 4: Implement the table and inline multi-select**

Create a focused client component. Render task, start date, due date, status, and `Dependency` columns. In the dependency cell, show selected prerequisite titles or `None`; clicking the dedicated edit button must not trigger surrounding row navigation.

Use `getDependencyCandidateIds` to display only valid same-board candidates. Keep unsaved selections local to the open row. Disable the save button while `isSavingTaskId === task.id`. On success, close the editor; on error, retain selections and render the returned error in a `role="alert"` element.

- [ ] **Step 5: Wire the table to Helicopter page data and mutation**

Extend `Task` in `src/app/helicopter/page.tsx` with `startDate` and `dependencies`. Derive `criticalPathTasks` from `tasks` by filtering the selected board id; derive edges from the dependency response. Add `replaceDependencies` that calls:

```ts
fetch(`/api/tasks/${taskId}/dependencies`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ dependsOnTaskIds }),
});
```

On a successful result, refresh `/api/tasks/all` without full-page loading. On any non-OK response, return the API error string to the table and preserve current state.

- [ ] **Step 6: Run focused component tests and lint**

Run: `npm test -- src/components/helicopter/task-dependencies-table.test.tsx && npm run lint`

Expected: interaction and error-state tests pass; lint has no errors.

- [ ] **Step 7: Commit the dependency editor**

```bash
git add package.json package-lock.json vitest.config.ts src/components/helicopter/task-dependencies-table.tsx src/components/helicopter/task-dependencies-table.test.tsx src/app/helicopter/page.tsx
git commit -m "feat: edit helicopter task dependencies"
```

## Task 4: Build the SVG Network and Critical Path Experience

**Files:**
- Create: `src/components/helicopter/critical-path-network.tsx`
- Create: `src/components/helicopter/critical-path-network.test.tsx`
- Modify: `src/app/helicopter/page.tsx`

**Interfaces:**
- Consumes `analyzeCriticalPath` and `buildNetworkLayout` from `src/lib/critical-path.ts`.
- Produces `CriticalPathNetwork({ tasks, edges })`.
- The component owns selected-node id, status filter, zoom scale, and pan offset; it does not persist layout state.

- [ ] **Step 1: Write failing visual-state component tests**

Create `src/components/helicopter/critical-path-network.test.tsx` that renders a two-branch graph and asserts:

```tsx
expect(screen.getByText("Critical path: 7 days")).toBeInTheDocument();
expect(screen.getByText("3 critical tasks")).toBeInTheDocument();
expect(screen.getByTestId("critical-node-build")).toHaveAttribute("data-critical", "true");
expect(screen.getByTestId("node-copy-review")).toHaveAttribute("data-critical", "false");
```

Also test missing-date summary, no-dependency explanation, status filter behavior, Fit to screen reset, and selecting a node adds a visible `data-focused="true"` marker to its direct predecessor and dependent.

- [ ] **Step 2: Run the network component test to verify it fails**

Run: `npm test -- src/components/helicopter/critical-path-network.test.tsx`

Expected: FAIL because the network component does not exist.

- [ ] **Step 3: Implement accessible SVG rendering and controls**

Create the component with:

```tsx
<svg aria-label="Task dependency network" role="img" viewBox={`0 0 ${layout.width} ${layout.height}`}>
  <defs>
    <marker id="dependency-arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
      <path d="M0,0 L0,6 L9,3 z" />
    </marker>
  </defs>
</svg>
```

Render edges first with `markerEnd`; add a critical edge class when `criticalEdgeKeys` contains `${dependsOnTaskId}:${taskId}`. Render each node as a focusable SVG group with `data-testid={`node-${task.id}`}`, `data-critical`, and `data-focused`. Use a red critical treatment and a neutral slate treatment for other nodes. Node body contains a truncated title, formatted date range, duration or `Missing dates`, and status.

Add native select controls for All/Open/Done, zoom-in, zoom-out, and Fit to screen buttons. Implement wheel zoom and pointer-drag panning on the outer diagram viewport, clamped to `0.5` through `2.5`. Keep the SVG layout unfiltered so edges stay stable; hide filtered-out nodes and their attached edges visually.

- [ ] **Step 4: Add Critical Path tab and nested tabs to Helicopter page**

Add the top-level trigger `<TabsTrigger value="critical-path">Critical Path</TabsTrigger>`. In its content, render a board `<select>` with a placeholder option and board-only options (exclude `personal`). Do not auto-select a board: show a prompt until one is selected.

Add nested tabs with `Task Dependencies` as the default and `Network Diagram` as the second trigger. Pass selected-board tasks and their dependency edges to both components. Provide explicit empty states for no board, no tasks, no dependencies, and incomplete dates. The existing Dashboard, List, Timeline, Calendar, task modal, and task status behavior must remain unchanged.

- [ ] **Step 5: Run all focused tests and production build**

Run: `npm test -- src/lib/critical-path.test.ts src/app/api/tasks/[id]/dependencies/route.test.ts src/components/helicopter/task-dependencies-table.test.tsx src/components/helicopter/critical-path-network.test.tsx && npm run lint && npm run build`

Expected: all tests pass, lint succeeds, and Next.js production build succeeds.

- [ ] **Step 6: Manual browser verification**

Run: `npm run dev`

Verify in Helicopter View:

1. Critical Path requires a board selection and defaults to `Task Dependencies`.
2. Two same-board prerequisites can be saved for one task.
3. A cycle selection is unavailable client-side and a forced invalid request displays a warning without changing saved dependencies.
4. The diagram renders a parallel branch and marks only the longest chain red.
5. Zoom, pan, fit, status filtering, and node focus work at desktop and mobile widths.

- [ ] **Step 7: Commit the network UI**

```bash
git add src/components/helicopter/critical-path-network.tsx src/components/helicopter/critical-path-network.test.tsx src/app/helicopter/page.tsx
git commit -m "feat: visualize helicopter critical path"
```

## Task 5: Final Regression Verification

**Files:**
- Modify only if verification exposes a defect: the smallest relevant file from Tasks 1-4.

**Interfaces:**
- Consumes all shipped routes and components from Tasks 1-4.
- Produces final verification evidence; no broad refactor is allowed.

- [ ] **Step 1: Inspect the final diff and generated migration**

Run: `git diff --check && git status --short && npx prisma validate`

Expected: no whitespace errors, no unexpected worktree changes, and valid Prisma schema.

- [ ] **Step 2: Run the full automated verification suite**

Run: `npm test && npm run lint && npm run build`

Expected: all tests, lint, and build pass.

- [ ] **Step 3: Verify database dependency cleanup behavior**

Use a local development fixture to create two dependency rows, delete either task through the existing task endpoint/service, and query `TaskDependency` afterward.

Expected: cascade foreign keys remove edges that reference the deleted task.

- [ ] **Step 4: Commit only required verification fixes**

If a regression fix is needed, stage only the files changed by that fix and commit with `git commit -m "fix: harden critical path behavior"`. If no fix is needed, do not create an empty commit.
