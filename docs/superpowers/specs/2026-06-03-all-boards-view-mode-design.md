# All Boards View Mode Design

Date: 2026-06-03  
Project: personal-journal  
Status: Approved for planning

## 1. Goal

Add a view selector to the `All Boards` page so the user can switch between:
- the current card-based board view
- a compact list view

The selected view must persist per browser using `localStorage`. In list view, each item must show board progress as both a percentage and a visual progress bar.

## 2. Scope

In scope:
- Add a `Board` / `List` view selector on `src/app/boards/page.tsx`.
- Persist the selected view in `localStorage`.
- Keep the existing board card layout as the `Board` mode.
- Add a single-column `List` mode for boards and the personal tasks entry.
- Show progress in list mode as:
  - numeric percentage
  - horizontal progress indicator

Out of scope:
- Persisting the preference to the backend.
- Changing board progress calculation rules.
- Changing filtering, sorting, board pinning, or board scope behavior.
- Redesigning the board cards beyond what is needed to support the new selector.

## 3. Current Context

The page is already a client component and already owns the UI state for:
- board search
- tag filter
- sort option
- open/all scope
- pin interactions

That makes `localStorage` persistence a good fit because no server state is required and no API changes are needed.

## 4. Design

### 4.1 View State

Add a local state value:
- `viewMode: "board" | "list"`

Behavior:
- Default to `"board"` on first load.
- On mount, read the saved preference from `localStorage`.
- When the user changes the selector, update state immediately and write the new value to `localStorage`.

Storage contract:
- Use a dedicated key for this page only, for example `all-boards-view-mode`.
- If the stored value is missing or invalid, fall back to `"board"`.

### 4.2 View Selector Placement

Place the selector in the existing filter card so it feels like another page-level display control rather than a separate setting.

Expected behavior:
- It should be visible alongside scope, search, tag, and sort controls.
- Switching modes should not reset filters or trigger a board refetch.

### 4.3 Board Mode

Keep the current grid card presentation as the `Board` mode.

Allowed changes:
- only the minimal structural refactor needed so the page can branch between `Board` and `List` rendering cleanly
- optional extraction of shared display helpers if that reduces duplication

### 4.4 List Mode

Render boards in a single-column list with denser rows than the card grid.

Each open board row should include:
- title
- short description
- due date or `No due date`
- tags
- pin/unpin action
- open-board action
- progress percentage
- progress bar

Each closed board row should include:
- the same metadata where relevant
- visible closed status
- non-interactive treatment consistent with the current closed-board behavior

### 4.5 Personal Entry

The existing `Personal` item should also support list mode so the page remains consistent when the user switches display style.

List-mode personal item should include:
- title
- short description
- task count
- due date or `No due date`
- progress percentage
- progress bar

The existing search/filter rule for showing the personal item should remain unchanged.

### 4.6 Progress Indicator

List-mode progress must present two signals together:
- textual percentage such as `65% done`
- visual bar showing the same completion value

Implementation expectation:
- reuse the existing progress percentage calculations already used on the page
- do not introduce a second source of truth for progress

## 5. Data and Rendering Rules

No backend changes are required.

The page should continue to use:
- current board API payload
- current personal task fetch
- current board progress calculation
- current sorting and filtering pipeline

The only new state is the persisted `viewMode`.

## 6. Error Handling

- If `localStorage` is unavailable or throws, keep the page usable by falling back to in-memory state.
- Invalid stored values should be ignored.
- Switching modes must not affect loading, fetch errors, or pinning behavior.

## 7. Testing

At minimum, verify:
- default first-load behavior is `Board`
- selecting `List` persists and survives reload/navigation back to the page
- list mode shows progress bars for open boards
- list mode shows progress bar for the personal item
- closed boards still appear visually closed and are not accidentally made interactive
- existing filters and sorting still apply in both modes

## 8. Implementation Notes

Likely change surface:
- `src/app/boards/page.tsx`

Optional extraction only if it clearly improves readability:
- small local render helpers inside the page component

No API, schema, or route changes are expected.
