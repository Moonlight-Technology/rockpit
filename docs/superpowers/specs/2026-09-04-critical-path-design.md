# Critical Path in Helicopter View Design

## Goal

Add a `Critical Path` tab to Helicopter View so users can define persistent, same-board task dependencies and inspect the resulting dependency network. The feature identifies the longest dependency chain, highlights its critical tasks, and makes parallel work visible.

## Scope

- Store task dependencies permanently in the database.
- Expose dependency editing and visualization only in Helicopter View for this phase.
- Restrict every dependency relationship to tasks in the same board.
- Add two sub-tabs: `Task Dependencies` and `Network Diagram`.
- Use each task's inclusive calendar duration from `startDate` through `dueDate` for critical-path analysis.

Out of scope:

- Dependencies across boards.
- Dragging nodes to persist a custom diagram layout.
- Automatic rescheduling of task dates.
- Editing dependencies from board views, task modals, or other task surfaces.

## Data Model

Introduce a `TaskDependency` join model with these fields:

- `id`
- `taskId`: the task that must wait
- `dependsOnTaskId`: the prerequisite task
- creation and update timestamps, following the repository's schema conventions

The model has relations to `Task` for both directions, a unique compound constraint on `(taskId, dependsOnTaskId)`, and indexes for efficient traversal from either side.

The relationship semantics are finish-to-start: a task may start only after all of its prerequisite tasks finish.

## API and Validation

The Helicopter task listing includes every task's prerequisite relationships and the minimal prerequisite task metadata required by the client.

A dedicated authenticated endpoint updates the complete dependency set for one task in a transaction. It must:

1. Verify the user can access the target task and its board.
2. Verify every selected prerequisite exists and belongs to the same board as the target task.
3. Reject self-dependency.
4. Evaluate the proposed graph and reject any direct or indirect cycle.
5. Replace the target task's dependency set atomically only if all validation succeeds.

Validation failures return a structured client-safe error. The UI shows a warning and leaves the previously saved dependency set intact. A cycle error names the task relationship that caused the invalid loop when available.

## Helicopter View UX

`Critical Path` becomes a new top-level tab in Helicopter View. It contains a mandatory board selector and two nested tabs:

### Task Dependencies

This is the default nested tab. It lists the selected board's tasks in a table with the usual task context and a new `Dependency` column.

Clicking a dependency cell opens a searchable multi-select. The selected values are prerequisite tasks. The control supports zero or more selections and saves to the dedicated dependency endpoint. It excludes the current task, prevents choosing tasks from another board, and disables choices that would form a cycle; server validation remains authoritative.

### Network Diagram

This sub-tab renders a client-side SVG diagram with automatic left-to-right layering:

- Prerequisite tasks are to the left of the tasks that await them.
- Tasks with no ordering relationship may appear on the same level, revealing parallel work.
- Directed arrows run from prerequisite to dependent task.
- Nodes show title, dates, duration, and status.
- Users can zoom, pan, fit the graph to the viewport, filter by task status, and select a node to emphasize its direct prerequisites and dependents.

The diagram is implemented with focused local layout and SVG components rather than adding a diagram framework. It does not persist manual node positions.

## Critical-Path Calculation

The calculation runs only on tasks with both `startDate` and `dueDate`. Task duration is the inclusive number of calendar days between those dates, with a minimum of one day.

The client derives a directed acyclic graph from the selected board and uses a forward pass to calculate earliest start and finish, then a backward pass to calculate latest start and finish and total slack. A task is critical when its slack is zero. The critical path is the zero-slack chain that defines the project duration.

The diagram marks critical nodes and arrows in red. Non-critical tasks show their slack in days. A summary displays:

- Total critical-path duration.
- Number of tasks on the critical path.
- Number of tasks excluded because either date is missing.

Existing task dates are treated as duration inputs for simulation. The feature does not modify dates or reject a dependency merely because dates appear inconsistent with the relationship.

## Error and Empty States

- No board selected: prompt the user to choose a board.
- No tasks in board: show the existing empty-state styling with an explanation.
- No dependencies: show independent nodes and an explanation that all displayed tasks can start in parallel.
- Missing dates: retain the task in the dependency table and network, but mark it excluded from critical-path metrics.
- Invalid update: show a destructive warning with the server's validation message and preserve saved state.

## Testing

- Unit test graph helpers for duration calculation, independent branches, converging branches, multiple dependencies, slack, and critical-path selection.
- Unit test cycle detection for direct and indirect cycles.
- Test dependency update validation for self-reference, cross-board references, duplicates, and cycles.
- Test the task-list response includes dependency data scoped to the authenticated user's accessible boards.
- Run lint, relevant targeted tests, Prisma validation/migration checks, and production build before completion.
