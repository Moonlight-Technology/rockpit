# Persisted Critical Path Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users drag Critical Path nodes and persist each board's custom network layout without affecting dependencies or Kanban ordering.

**Architecture:** Store coordinates in `TaskNetworkPosition`, keyed by board and task. The Helicopter page owns layout API calls; the SVG panel combines automatic graph positions with saved and active-drag overrides through pure helpers.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma/PostgreSQL, Zod, Vitest, SVG Pointer Events.

**Spec:** `docs/superpowers/specs/2026-09-15-critical-path-persisted-layout-design.md`

## Global Constraints

- Persist only by `(boardId, taskId)`; never reuse `Task.position`.
- Reject layout writes when the task is not a member of the target board.
- Keep auto-layout for nodes with no saved position.
- Preserve node colors, critical-path calculations, filtering, zoom, and edit behavior.
- A click opens edit; only movement of at least four pixels is a drag.
- Do not add a diagram or drag-and-drop dependency.

---

## File Structure

- `prisma/schema.prisma`: `TaskNetworkPosition` model and relations.
- `prisma/migrations/20260915000000_add_task_network_positions/migration.sql`: table, keys, indexes, foreign keys.
- `src/lib/validators/board.ts`: request body schema.
- `src/lib/board-service.ts`: board access, membership validation, read, upsert, reset.
- `src/app/api/boards/[id]/network-layout/route.ts`: GET and DELETE handlers.
- `src/app/api/boards/[id]/network-layout/[taskId]/route.ts`: PUT handler.
- `src/lib/network-layout.ts`: position merge, bounds, clamp, and drag classification.
- `src/lib/network-layout.test.ts`: pure helper tests.
- `src/app/helicopter/page.tsx`: board layout fetch and persistence callbacks.
- `src/components/helicopter/critical-path-panel.tsx`: pointer interaction and Reset layout UI.

### Task 1: Add Persistent Position Schema

**Files:**
- Modify: `prisma/schema.prisma:134-150,411-443`
- Create: `prisma/migrations/20260915000000_add_task_network_positions/migration.sql`

**Interfaces:**
- Produces `TaskNetworkPosition { id, boardId, taskId, x, y, createdAt, updatedAt }`.
- Produces a unique compound key on `(boardId, taskId)`.

- [ ] **Step 1: Add the model and relations**

```prisma
model TaskNetworkPosition {
  id        String   @id @default(cuid())
  boardId   String
  taskId    String
  x         Int
  y         Int
  board     Board    @relation(fields: [boardId], references: [id], onDelete: Cascade)
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([boardId, taskId])
  @@index([boardId])
  @@index([taskId])
}
```

Add `networkPositions TaskNetworkPosition[]` to both `Board` and `Task`.

- [ ] **Step 2: Write migration SQL**

```sql
CREATE TABLE "TaskNetworkPosition" (
  "id" TEXT NOT NULL,
  "boardId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "x" INTEGER NOT NULL,
  "y" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaskNetworkPosition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TaskNetworkPosition_boardId_taskId_key" ON "TaskNetworkPosition"("boardId", "taskId");
ALTER TABLE "TaskNetworkPosition" ADD CONSTRAINT "TaskNetworkPosition_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskNetworkPosition" ADD CONSTRAINT "TaskNetworkPosition_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Add standalone indexes on `boardId` and `taskId`.

- [ ] **Step 3: Validate schema and migration artifact**

Run: `npx prisma validate && npx prisma migrate status`

Expected: Prisma validation passes and reports the new migration pending locally.

- [ ] **Step 4: Commit**

Run: `git add prisma/schema.prisma prisma/migrations/20260915000000_add_task_network_positions/migration.sql && git commit -m "feat: persist board network node positions"`

### Task 2: Implement Pure Layout Helpers

**Files:**
- Create: `src/lib/network-layout.ts`
- Create: `src/lib/network-layout.test.ts`

**Interfaces:**
- Produces `type NetworkPosition = { x: number; y: number }`.
- Produces `clampNetworkPosition(position: NetworkPosition): NetworkPosition` bounded to `0..20000`.
- Produces `mergeNetworkNodePositions(autoNodes, savedPositions)`.
- Produces `getNetworkCanvasBounds(nodes): { width: number; height: number }`.
- Produces `isNetworkNodeDrag(start, current): boolean` with a 4px threshold.

- [ ] **Step 1: Write failing helper tests**

```ts
it("overlays saved nodes and keeps automatic positions for the rest", () => {
  expect(mergeNetworkNodePositions(
    { a: { x: 36, y: 36, layer: 0 }, b: { x: 316, y: 36, layer: 1 } },
    [{ taskId: "b", x: 480, y: 200 }],
  )).toEqual({ a: { x: 36, y: 36, layer: 0 }, b: { x: 480, y: 200, layer: 1 } });
});

it("clamps invalid drag coordinates", () => {
  expect(clampNetworkPosition({ x: -24, y: 90000 })).toEqual({ x: 0, y: 20000 });
});

it("does not classify a short movement as dragging", () => {
  expect(isNetworkNodeDrag({ x: 20, y: 20 }, { x: 23, y: 22 })).toBe(false);
});

it("classifies exactly four pixels as a drag", () => {
  expect(isNetworkNodeDrag({ x: 100, y: 100 }, { x: 104, y: 100 })).toBe(true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/network-layout.test.ts`

Expected: FAIL because helper exports do not exist.

- [ ] **Step 3: Implement deterministic helpers**

```ts
export function isNetworkNodeDrag(start: NetworkPosition, current: NetworkPosition) {
  return Math.hypot(current.x - start.x, current.y - start.y) >= 4;
}

export function clampNetworkPosition({ x, y }: NetworkPosition): NetworkPosition {
  return { x: Math.max(0, Math.min(20000, Math.round(x))), y: Math.max(0, Math.min(20000, Math.round(y))) };
}
```

Merge only positions whose task id exists in auto-layout. Calculate canvas bounds from merged nodes with current SVG node margins: 260px horizontal and 112px vertical.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/network-layout.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add src/lib/network-layout.ts src/lib/network-layout.test.ts && git commit -m "feat: add network layout helpers"`

### Task 3: Add Validation, Service, and Routes

**Files:**
- Modify: `src/lib/validators/board.ts:1-110`
- Modify: `src/lib/board-service.ts:282-303,734-810`
- Create: `src/app/api/boards/[id]/network-layout/route.ts`
- Create: `src/app/api/boards/[id]/network-layout/[taskId]/route.ts`
- Test: `src/lib/board-service.network-layout.test.ts`
- Test: `src/app/api/boards/[id]/network-layout/route.test.ts`
- Test: `src/app/api/boards/[id]/network-layout/[taskId]/route.test.ts`

**Interfaces:**
- Produces `updateTaskNetworkPositionSchema` for `{ x: number; y: number }`, finite integers only.
- Produces `listTaskNetworkPositionsForUser`, `saveTaskNetworkPositionForUser`, and `resetTaskNetworkPositionsForUser`.
- Produces authenticated `GET`, `PUT`, and `DELETE` board layout routes.

- [ ] **Step 1: Write failing validation and service tests**

```ts
it("rejects a position for a task outside the board", async () => {
  await expect(saveTaskNetworkPositionForUser({ userId: "user", boardId: "board-a", taskId: "task-b", x: 40, y: 60 }))
    .resolves.toMatchObject({ ok: false, code: "TASK_NOT_IN_BOARD" });
});

it("resets only positions from the requested board", async () => {
  await resetTaskNetworkPositionsForUser({ userId: "user", boardId: "board-a" });
  expect(deleteMany).toHaveBeenCalledWith({ where: { boardId: "board-a" } });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/board-service.network-layout.test.ts`

Expected: FAIL because service functions do not exist.

- [ ] **Step 3: Implement validation and service functions**

```ts
export const updateTaskNetworkPositionSchema = z.object({
  x: z.number().finite().int(),
  y: z.number().finite().int(),
});
```

Each service checks `canAccessBoard(userId, boardId)`. Save then checks `prisma.task.findFirst({ where: { id: taskId, boardId } })`; on success it clamps coordinates and calls `prisma.taskNetworkPosition.upsert` with `where: { boardId_taskId: { boardId, taskId } }`. List returns `null` for inaccessible boards and otherwise positions for that board. Reset uses `deleteMany({ where: { boardId } })` only after access succeeds.

- [ ] **Step 4: Write failing route tests**

```ts
it("returns 401 for an unauthenticated position write", async () => {
  const response = await PUT(new Request("http://localhost", { method: "PUT", body: JSON.stringify({ x: 20, y: 30 }) }), { params: Promise.resolve({ id: "board", taskId: "task" }) });
  expect(response.status).toBe(401);
});
```

For the success test, mock `getSessionUserId` to resolve `"user"` and `saveTaskNetworkPositionForUser` to resolve `{ ok: true, position: { taskId: "task", x: 20, y: 30 } }`; then assert the returned JSON matches `{ ok: true, data: { taskId: "task", x: 20, y: 30 } }`.

- [ ] **Step 5: Implement board layout routes**

Use `getSessionUserId`, `unauthorized`, `notFound`, and `validationError` from `@/lib/api`, matching existing board routes. `GET` returns `{ ok: true, data: positions }`; `DELETE` returns `{ ok: true }`. `PUT` validates with `updateTaskNetworkPositionSchema`; return `validationError("Task does not belong to this board.")` for `TASK_NOT_IN_BOARD` and `notFound("Board not found.")` for access failure.

- [ ] **Step 6: Run service and route tests**

Run: `npm test -- src/lib/board-service.network-layout.test.ts src/app/api/boards/[id]/network-layout/route.test.ts src/app/api/boards/[id]/network-layout/[taskId]/route.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

Run: `git add src/lib/validators/board.ts src/lib/board-service.ts src/lib/board-service.network-layout.test.ts src/app/api/boards/[id]/network-layout && git commit -m "feat: add board network layout API"`

### Task 4: Load and Save Layout From Helicopter Page

**Files:**
- Modify: `src/app/helicopter/page.tsx:118-270,589-610`
- Modify: `src/lib/network-layout.ts`
- Test: `src/lib/network-layout-response.test.ts`

**Interfaces:**
- Produces `toNetworkPositionMap(rows): Record<string, NetworkPosition>`.
- Passes `boardId`, `networkPositions`, `onSaveNetworkPosition`, and `onResetNetworkLayout` to `CriticalPathPanel`.

- [ ] **Step 1: Write failing response-normalization test**

```ts
it("maps layout response rows by task id", () => {
  expect(toNetworkPositionMap([{ taskId: "a", x: 40, y: 60 }])).toEqual({ a: { x: 40, y: 60 } });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/network-layout-response.test.ts`

Expected: FAIL because `toNetworkPositionMap` is not exported.

- [ ] **Step 3: Implement layout state and callbacks**

Add `networkPositions` state. Fetch `GET /api/boards/${criticalBoardId}/network-layout` when the selected board changes, clearing stale positions first. Save through `PUT /api/boards/${criticalBoardId}/network-layout/${taskId}` and update local state only after a successful response. Reset through `DELETE /api/boards/${criticalBoardId}/network-layout` and clear local state only after success. Every failed request returns `{ error: "Failed to ..." }` to the panel.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/lib/network-layout.test.ts src/lib/network-layout-response.test.ts src/lib/critical-path.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add src/app/helicopter/page.tsx src/lib/network-layout.ts src/lib/network-layout-response.test.ts && git commit -m "feat: connect critical path layout persistence"`

### Task 5: Add SVG Pointer Dragging and Reset UI

**Files:**
- Modify: `src/components/helicopter/critical-path-panel.tsx:28-430`
- Modify: `src/lib/network-layout.test.ts`

**Interfaces:**
- Consumes `NetworkPosition`, merge, bounds, clamp, and drag helpers.
- Consumes page props `networkPositions`, `onSaveNetworkPosition(taskId, position)`, and `onResetNetworkLayout()`.

- [ ] **Step 1: Implement pointer state and node movement**

```ts
const [dragging, setDragging] = useState<{
  taskId: string;
  startPointer: NetworkPosition;
  startNode: NetworkPosition;
  previousNode: NetworkPosition;
} | null>(null);
```

On pointer down, capture pointer and record unscaled SVG coordinates. On pointer move, update a local transient position using movement divided by `networkZoom`, then clamp it. Use merged positions for both node transforms and edge endpoints. On pointer up, save only if `isNetworkNodeDrag` is true; revert to `previousNode` if save returns an error. Suppress the edit callback only after a drag; retain keyboard `Enter` and `Space` edit activation.

Add `Reset layout` beside current zoom controls. Disable it while reset is pending, call `onResetNetworkLayout`, and show errors in the existing panel error region. Use `getNetworkCanvasBounds` for SVG width and height so moved nodes are not clipped.

- [ ] **Step 2: Run focused tests**

Run: `npm test -- src/lib/network-layout.test.ts src/lib/critical-path.test.ts src/lib/network-node-interaction.test.ts src/lib/network-node-style.test.ts`

Expected: PASS.

- [ ] **Step 3: Manually verify the interaction**

Run: `npm run dev`

In `/helicopter`, select a board and verify: drag updates edges; reload preserves placement; click opens edit; Reset layout restores automatic positions; board switching does not leak positions; colors, zoom, filtering, and dependency editing still work.

- [ ] **Step 4: Commit**

Run: `git add src/components/helicopter/critical-path-panel.tsx src/lib/network-layout.test.ts && git commit -m "feat: drag critical path nodes"`

### Task 6: Final Verification

**Files:**
- Verify only; fix only defects discovered by these checks.

- [ ] **Step 1: Run relevant tests**

Run: `npm test -- src/lib/critical-path.test.ts src/lib/network-layout.test.ts src/lib/network-layout-response.test.ts src/lib/network-node-style.test.ts src/lib/network-node-interaction.test.ts src/lib/network-status-filter.test.ts src/lib/task-dependency-candidates.test.ts src/lib/task-modal-dependencies.test.ts`

Expected: every test passes with zero failures.

- [ ] **Step 2: Validate schema and lint**

Run: `npx prisma validate && npm run lint`

Expected: both commands succeed with no errors.

- [ ] **Step 3: Build production bundle**

Run: `npm run build`

Expected: Next.js build succeeds.

- [ ] **Step 4: Confirm deployment migration readiness**

Run: `npx prisma migrate status`

Expected: `20260915000000_add_task_network_positions` is the only new migration awaiting deployment.
