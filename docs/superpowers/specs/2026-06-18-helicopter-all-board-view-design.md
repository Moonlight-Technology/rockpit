# Helicopter All Board View Design

Date: 2026-06-18  
Project: personal-journal  
Status: Approved for planning

## 1. Goal

Add a new `All Board View` tab to `Helicopter View`, placed beside `Calendar`, so the user can scan remaining work across every board in one horizontal surface.

The tab should answer these questions quickly:

- Which board has the most unfinished work right now?
- What are the next due tasks inside each board?
- How much unfinished work is left compared with the board's total task count?

This is a cross-board workload view, not a replacement for board detail pages.

## 2. Scope

In scope:

- Add a new `All Board View` tab to `src/app/helicopter/page.tsx`.
- Render every board as a horizontal column from left to right.
- Include a `Personal` column for tasks without a board.
- Show board header counts as `open / total`.
- Show up to 7 unfinished task cards per column.
- Sort columns by highest unfinished task count first.
- Sort task cards inside each column by nearest due date first.
- Add inline checklist completion on each task card.
- Add a `View all` or `+N more` path to the board detail page.
- Keep boards with `0 open` visible in the layout.

Out of scope:

- New backend endpoints or schema changes.
- Inline expansion to show every task inside the tab.
- Full task editing inside `All Board View`.
- Changing task status rules or board progress rules globally.
- Redesigning the existing `Dashboard`, `Timeline`, `Calendar`, or `List` tabs beyond adding the new tab trigger.

## 3. Current Context

`Helicopter View` already operates on a shared cross-project task source and already supports quick task completion patterns elsewhere in the page.

That makes this feature a presentation and interaction extension rather than a data-model feature:

- existing task fetch remains the source of truth
- existing task status update flow remains the completion mechanism
- existing board detail pages remain the deep inspection surface

The new tab should stay consistent with that architecture instead of introducing a second task pipeline.

## 4. Design

### 4.1 Tab Placement and Role

Add a new top-level tab trigger labeled `All Board View` beside `Calendar`.

Its role is to provide a horizontal workload scan across all boards plus `Personal`.

Relationship to the other tabs:

- `Dashboard` stays focused on short-horizon risk.
- `Timeline` stays focused on scheduled span reading.
- `Calendar` stays focused on date-specific inspection.
- `List` stays the dense cross-project browsing surface.
- `All Board View` becomes the board-by-board remaining-work surface.

### 4.2 Column Layout

Render one column per board in a horizontally scrollable layout.

Column ordering:

1. highest `open` count first
2. lower `open` counts after that
3. ties can fall back to title for stable rendering

`Personal` participates in the same ranking rules as boards.

Boards with `0 open` must still render. They should appear after heavier columns because of the open-count sort, but they are not removed from the page.

### 4.3 Column Header

Each column header should include:

- board title
- count summary in the form `12 open / 20 total`
- a direct action to open the detailed surface

For normal boards, the detail action should route to the board detail page.

For `Personal`, the detail action should route to the most relevant personal-task surface, expected to be `/tasks`.

The count contract is:

- `open` = tasks whose status is not `DONE`
- `total` = all tasks belonging to that board or the `Personal` group

### 4.4 Task Card List

Under each column header, render a card list containing only unfinished tasks.

Default visible count:

- show at most 7 task cards per column

If more unfinished tasks exist:

- show a compact `+N more` affordance
- route that affordance to the board detail page rather than expanding inline

This keeps the tab scannable and avoids turning it into a second full board page.

### 4.5 Task Card Content

Each task card should stay compact and optimized for scanning.

Required content:

- inline checklist / checkbox for completion
- task title
- due date
- priority
- board column/stage title when present

The card does not need rich editing controls. The main purpose is quick reading plus quick completion.

### 4.6 Sorting Rules Inside a Column

Unfinished tasks inside each column should be sorted by due date nearest first.

Recommended handling:

- tasks with due dates come before tasks without due dates
- among dated tasks, earlier due dates appear first
- ties can fall back to title for stable rendering

This ensures the first visible cards are the most time-sensitive ones.

### 4.7 Inline Completion Behavior

Each task card checkbox should allow the user to mark the task `DONE` directly from `All Board View`.

Expected behavior after a successful completion:

- the task leaves the open-task list for that column
- the header count updates immediately, for example `12 open / 20 total` to `11 open / 20 total`
- if hidden open tasks remain beyond the first 7, the next task moves into the visible list

If the request is pending:

- disable repeated interaction for that row
- show the same lightweight saving treatment already used by the page's existing completion patterns

If the update fails:

- leave the task visible as unfinished
- show the existing page-level error feedback pattern rather than inventing a new one

### 4.8 Empty Columns

Boards with no unfinished tasks should still render as valid columns.

Expected presentation:

- keep the title and `0 open / total` count visible
- replace the task list with a calm empty state such as `No open tasks`

This preserves the value of the tab as a full portfolio overview.

## 5. Data and Rendering Rules

No API or schema changes are required.

The new tab should derive its display model from the same task payload already loaded by `Helicopter View`.

Rendering model:

- group tasks by `board.id`
- group tasks without a board into `Personal`
- compute `total` from all tasks in the group
- compute `open` from tasks whose status is not `DONE`
- sort groups by `open` descending
- sort each group's unfinished tasks by due date ascending
- render only the first 7 unfinished tasks plus a `+N more` link when needed

This design deliberately avoids introducing a second source of truth for board counts or task completion.

## 6. Error Handling

- If board detail routing is unavailable for some reason, the column should still render counts and tasks.
- If a task update fails, the checkbox interaction should recover gracefully and preserve the unfinished state.
- Missing optional metadata should stay quiet:
  - no column title if the task has no board stage
  - tasks without due dates should not show noisy placeholders beyond a simple `No due date` style
- If there are no tasks at all, the tab should still render a valid empty surface rather than appearing broken.

## 7. Testing

At minimum, verify:

- the new `All Board View` tab appears beside `Calendar`
- all boards plus `Personal` are rendered as columns
- columns are ordered by open-task count descending
- boards with `0 open` still appear
- each column shows `open / total` correctly
- task cards show at most 7 unfinished tasks by default
- `+N more` appears when a column has more than 7 unfinished tasks
- unfinished tasks inside a column are ordered by nearest due date first
- checking a task marks it done and updates the count and visible list correctly
- `Personal` completion and routing behavior matches the same rules as board columns

## 8. Implementation Notes

Likely change surface:

- `src/app/helicopter/page.tsx`

Optional extractions only if they clearly improve readability:

- a small local helper for grouping and sorting board columns
- a focused presentational subcomponent for the horizontal board lane

No new persistence, backend fetches, or schema work is expected.
