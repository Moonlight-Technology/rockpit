# All Boards View Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted `Board` / `List` view selector to the `All Boards` page and show progress bars for list-mode items without changing any board APIs.

**Architecture:** Keep `src/app/boards/page.tsx` as the client entry point and add one small pure helper module for parsing persisted view mode values. The page continues to own fetch/filter/sort/pin state, but branches rendering between the existing grid cards and a new single-column list layout that reuses the current progress calculations.

**Tech Stack:** Next.js 16 App Router client component, React 19 hooks, TypeScript, Tailwind/shadcn UI primitives, lucide-react, Node 22 `node --test --experimental-strip-types`, ESLint.

---

## File Structure

- Create `src/lib/board-view-mode.ts` — validates persisted storage values and exports the `BoardViewMode` type plus a parser.
- Create `src/lib/board-view-mode.test.ts` — Node tests for the parser so persistence logic has a small deterministic safety net.
- Modify `src/app/boards/page.tsx` — add persisted view state, selector UI, list-mode rendering, and shared progress bar markup.

### Task 1: Add a Small Tested Helper for Persisted View Mode

**Files:**
- Create: `src/lib/board-view-mode.ts`
- Create: `src/lib/board-view-mode.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/board-view-mode.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { parseBoardViewMode } from "./board-view-mode.ts";

test("parseBoardViewMode keeps valid stored values", () => {
  assert.equal(parseBoardViewMode("board"), "board");
  assert.equal(parseBoardViewMode("list"), "list");
});

test("parseBoardViewMode falls back to board for invalid values", () => {
  assert.equal(parseBoardViewMode(null), "board");
  assert.equal(parseBoardViewMode(undefined), "board");
  assert.equal(parseBoardViewMode("kanban"), "board");
  assert.equal(parseBoardViewMode(""), "board");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types src/lib/board-view-mode.test.ts`

Expected: FAIL with a module resolution error for `./board-view-mode.ts` or a missing export error for `parseBoardViewMode`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/board-view-mode.ts`:

```ts
export type BoardViewMode = "board" | "list";

export function parseBoardViewMode(value: unknown): BoardViewMode {
  return value === "list" ? "list" : "board";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types src/lib/board-view-mode.test.ts`

Expected: PASS with 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/board-view-mode.ts src/lib/board-view-mode.test.ts
git commit -m "test: add board view mode parser"
```

### Task 2: Wire the Persisted Selector and List Layout Into `All Boards`

**Files:**
- Modify: `src/app/boards/page.tsx`
- Modify: `src/lib/board-view-mode.ts`
- Test: `src/lib/board-view-mode.test.ts`

- [ ] **Step 1: Add the view-mode imports, storage key, and persisted state wiring**

In `src/app/boards/page.tsx`, update imports and state setup near the top of the file.

Add the helper import:

```tsx
import { BoardViewMode, parseBoardViewMode } from "@/lib/board-view-mode";
```

Add a storage key near `themeClassMap`:

```tsx
const ALL_BOARDS_VIEW_MODE_STORAGE_KEY = "all-boards-view-mode";
```

Add the new state next to the existing filter state:

```tsx
const [viewMode, setViewMode] = useState<BoardViewMode>("board");
```

Add the persistence effects after the existing `personalTasks` fetch effect:

```tsx
useEffect(() => {
  try {
    setViewMode(parseBoardViewMode(window.localStorage.getItem(ALL_BOARDS_VIEW_MODE_STORAGE_KEY)));
  } catch {
    setViewMode("board");
  }
}, []);

useEffect(() => {
  try {
    window.localStorage.setItem(ALL_BOARDS_VIEW_MODE_STORAGE_KEY, viewMode);
  } catch {
    // Ignore storage failures and keep the page usable with in-memory state.
  }
}, [viewMode]);
```

- [ ] **Step 2: Add a shared progress bar fragment and selector control**

In `src/app/boards/page.tsx`, add a small local helper before the `return` statement:

```tsx
  const renderProgressBar = (value: number) => (
    <div
      aria-hidden="true"
      className="h-2 overflow-hidden rounded-full bg-black/10"
    >
      <div
        className="h-full rounded-full bg-slate-900 transition-[width]"
        style={{ width: `${value}%` }}
      />
    </div>
  );
```

Then update the filter card grid from `md:grid-cols-4` to `md:grid-cols-5` and add this selector block after the sort select:

```tsx
<select
  value={viewMode}
  onChange={(event) => setViewMode(event.target.value as BoardViewMode)}
  className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
>
  <option value="board">View: Board</option>
  <option value="list">View: List</option>
</select>
```

- [ ] **Step 3: Keep the existing card grid as `board` mode and add the new `list` mode branch**

In `src/app/boards/page.tsx`, replace the current non-loading render block:

```tsx
<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
  ...
</div>
```

with a mode branch:

```tsx
{viewMode === "board" ? (
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    {/* keep the existing personal card + board cards here */}
  </div>
) : (
  <div className="space-y-3">
    {selectedTag === "all" && "personal".includes(searchTitle.trim().toLowerCase() || "personal") ? (
      <Link href="/tasks" className="block">
        <Card className="border-indigo-300/80 bg-indigo-50/70 transition-colors hover:bg-indigo-100/70">
          <CardHeader className="gap-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Personal</CardTitle>
                <CardDescription>Personal tasks (not inside any board).</CardDescription>
              </div>
              <Badge variant="secondary">Pinned</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{personalProgress}% done</span>
              <span>{personalDueDate ? `Due ${format(personalDueDate, "MMM d, yyyy")}` : "No due date"}</span>
            </div>
            {renderProgressBar(personalProgress)}
            <div className="flex items-center justify-between gap-2">
              <Badge variant="outline">{personalTasks.length} tasks</Badge>
              <Button variant="ghost" size="sm">Open list</Button>
            </div>
          </CardContent>
        </Card>
      </Link>
    ) : null}

    {visibleBoards.length === 0 ? <p className="text-sm text-muted-foreground">No board found.</p> : null}

    {visibleBoards.map((board) => {
      const progress = boardProgressPercent(board);

      if (board.closedAt) {
        return (
          <Card
            key={board.id}
            size="sm"
            className={`relative overflow-hidden opacity-75 ${themeClassMap[board.theme] ?? "bg-muted/30"}`}
          >
            <CardHeader className="gap-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>{board.title}</CardTitle>
                  <CardDescription>{board.description}</CardDescription>
                </div>
                <Badge variant="secondary">Closed</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{progress}% done</span>
                <span>{board.dueDate ? `Due ${format(new Date(board.dueDate), "MMM d, yyyy")}` : "No due date"}</span>
              </div>
              {renderProgressBar(progress)}
              {board.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {board.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </CardContent>
            <div className="absolute inset-0 grid place-items-center bg-slate-900/35 backdrop-blur-[1px]">
              <span className="rounded-md border border-white/70 bg-black/45 px-3 py-1 text-sm font-semibold tracking-[0.2em] text-white">
                CLOSED
              </span>
            </div>
          </Card>
        );
      }

      return (
        <Card
          key={board.id}
          size="sm"
          className={`transition-colors hover:bg-muted/70 ${themeClassMap[board.theme] ?? "bg-muted/30"}`}
        >
          <CardHeader className="gap-2">
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => router.push(`/boards/${board.id}`)}
                className="text-left"
              >
                <CardTitle>{board.title}</CardTitle>
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void onTogglePin(board)}
                disabled={pinLoadingBoardId === board.id}
              >
                {board.isPinnedForUser ? <PinOff data-icon="inline-start" /> : <Pin data-icon="inline-start" />}
                {board.isPinnedForUser ? "Unpin" : "Pin"}
              </Button>
            </div>
            <CardDescription>{board.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{progress}% done</span>
              <span>{board.dueDate ? `Due ${format(new Date(board.dueDate), "MMM d, yyyy")}` : "No due date"}</span>
            </div>
            {renderProgressBar(progress)}
            {board.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {board.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => router.push(`/boards/${board.id}`)}>
                Open board
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    })}
  </div>
)}
```

Do not change the existing board-mode card content beyond moving it inside the `viewMode === "board"` branch.

- [ ] **Step 4: Run focused verification**

Run:

```bash
node --test --experimental-strip-types src/lib/board-view-mode.test.ts
npm run lint -- src/app/boards/page.tsx src/lib/board-view-mode.ts src/lib/board-view-mode.test.ts
```

Expected:
- Node test exits `0` with 2 passing tests.
- ESLint exits `0`.

Then run the app locally and manually verify:

```bash
npm run dev
```

Manual checks on `/boards`:
- switch from `Board` to `List`
- reload the page and confirm `List` remains selected
- confirm personal item shows a progress bar in list mode
- confirm open boards show percent + progress bar
- confirm closed boards still look closed and are not opened by mistake

- [ ] **Step 5: Commit**

```bash
git add src/app/boards/page.tsx src/lib/board-view-mode.ts src/lib/board-view-mode.test.ts
git commit -m "feat: add board and list views for all boards"
```

## Self-Review

- Spec coverage:
  - selector added in Task 2 Step 2
  - localStorage persistence added in Task 2 Step 1
  - existing board mode preserved in Task 2 Step 3
  - list-mode board rows with progress bars added in Task 2 Step 3
  - personal item list rendering with progress bar added in Task 2 Step 3
  - no backend/API changes preserved across both tasks
- Placeholder scan: no `TODO`, `TBD`, or implied “handle later” steps remain.
- Type consistency: `BoardViewMode` and `parseBoardViewMode` are introduced in Task 1 and used with the same names in Task 2.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-03-all-boards-view-mode-implementation.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
