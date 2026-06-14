# Planner Mode 30-Minute Grid and Focus Time Design

## Goal

Improve Planner Mode in two focused ways:

1. Change the planner grid from a 1-hour reading cadence to a 30-minute reading cadence without changing the existing scheduling interaction model.
2. Add a daily focus-time summary sourced from Timer Mode so the user can see how much focused work has been logged for the selected day.

## Status

Approved for planning

## Current Context

The current planner page lives in `src/app/planner/page.tsx`.

Existing behavior:

- The left timeline is rendered per hour from `START_HOUR` to `END_HOUR_EXCLUSIVE`.
- Scheduled task blocks assume hourly placement and visually occupy large single rows.
- Drag-drop, resize, and modal scheduling flows are designed around the current interaction model and should remain behaviorally unchanged in this iteration.
- Timer Mode creates a task on stop, writes a timer summary into the task description, and schedules the task using `plannedStartAt` plus `plannedDurationMinutes`.

Current limitation:

- The planner gives only coarse hourly reading cues.
- Focus time is not modeled explicitly; it is only indirectly represented through task description text and planned duration.

## Scope

In scope:

- Add 30-minute visual separators to the planner grid.
- Keep hour labels as the only visible labels on the left axis.
- Preserve the current large block rendering style for scheduled tasks.
- Persist timer-produced focus metadata directly on tasks.
- Show a `Focus Time Today` summary card in the right panel when Timer Mode is enabled.
- Compute daily focus totals from timer-tagged tasks for the selected day.

Out of scope:

- Reworking drag-drop to place tasks on `:30` slots.
- Changing resize behavior to half-hour increments.
- Turning scheduled task blocks into half-slot-height blocks.
- Building a standalone timer session table.
- Weekly or monthly focus analytics.
- Recurring planning, conflict detection, or advanced planner automation.

## Requirements

### 1. Planner Grid

The planner timeline should visually read in 30-minute increments while preserving the existing interaction model.

Requirements:

- Keep the current planner hour range.
- Keep the primary left-axis labels hourly only.
- Render an additional horizontal separator halfway through each hour row to represent the `:30` point.
- Keep the current scheduled task block height model. A 60-minute task should still appear as one large visual row rather than two smaller half-hour rows.
- Keep current drop, resize, and edit interactions unchanged for this phase.
- Keep the current-time indicator compatible with the denser grid so the layout remains readable.

Design intent:

- This change improves visual time reading, not scheduling precision.
- The user should perceive a more detailed timeline without needing to relearn planner interaction behavior.

### 2. Timer Metadata on Task

Timer-generated tasks need explicit fields so focus analytics do not depend on planner scheduling fields.

Requirements:

- Add `trackedByTimer: Boolean` to `Task`, default `false`.
- Add `actualDurationMinutes: Int?` to `Task`.
- When Timer Mode creates a task, the created task must persist:
  - `trackedByTimer = true`
  - `actualDurationMinutes = actual rounded timer duration in minutes`
- Existing non-timer task creation flows should continue to leave `trackedByTimer = false` and `actualDurationMinutes = null` unless explicitly set by a timer-specific flow.
- Planner scheduling fields (`plannedStartAt`, `plannedDurationMinutes`) remain available for planner rendering and are not used as the analytics source of truth.

Design intent:

- Planner layout data and actual focus data remain separate.
- Manual schedule edits must not corrupt focus analytics.

### 3. Focus Time Summary Card

When Timer Mode is enabled, the right panel should show a new card below the existing right-side sections summarizing logged focus time for the selected date.

Requirements:

- Only show the card when `Timer Mode` is enabled.
- Place the card below the existing right-panel task sections.
- Card title: `Focus Time Today`.
- Minimum displayed metrics:
  - Total logged focus time for the selected day.
  - Number of timer-tracked sessions/tasks for that day.
- If no timer-tracked entries exist for the selected day, show a concise empty state.
- The summary should feel consistent with the planner panel design and should not dominate the existing task workflow.

Display behavior:

- The selected planner date remains the date context for the card.
- The label can stay `Focus Time Today` even though it follows the selected planner date, because the planner itself already frames the page around the selected day.

## Data Flow

### Timer Save Flow

When the user stops Timer Mode:

1. The planner calculates actual elapsed duration.
2. The app creates a task as it does today.
3. The task creation payload includes timer metadata so the task is explicitly marked as timer-tracked.
4. The app may still schedule the task for planner visualization using `plannedStartAt` and `plannedDurationMinutes`.
5. The planner refetches task data after save and the focus summary updates from persisted task data.

### Focus Aggregation

Daily focus totals should be derived from tasks that satisfy all of the following:

- `trackedByTimer = true`
- `actualDurationMinutes` is not null
- `startDate` falls on the selected planner day

Aggregation outputs:

- `totalFocusMinutes`
- `sessionCount`

This keeps analytics tied to actual tracked work rather than mutable planner layout values.

## Error Handling

- If timer task creation fails, no focus data is recorded and the existing timer error state remains the user-facing fallback.
- If task creation succeeds but schedule patching fails, focus analytics remain valid because timer metadata lives on the task itself.
- If planner task fetch fails, the focus card should follow the same loading/failure lifecycle as the rest of planner data and avoid showing misleading totals.
- Non-timer tasks must never be counted in focus totals.
- Editing task schedule, moving a task between boards, or changing planner placement must not alter previously stored `actualDurationMinutes`.

## Testing

### Data and Service Tests

- Task creation/update paths preserve default non-timer behavior.
- Timer-driven task creation stores `trackedByTimer = true`.
- Timer-driven task creation stores the rounded `actualDurationMinutes`.
- Planner task listing returns enough task data for focus aggregation.

### Planner UI Tests

- Hour labels remain hourly.
- Half-hour separators render inside each hour row.
- Scheduled task blocks keep the current large-row visual treatment.
- Focus summary card appears only when Timer Mode is enabled.
- Focus summary card shows correct totals for the selected day.
- Focus summary card shows the empty state when no timer-tracked tasks exist for the selected day.

### Regression Checks

- Existing drag-drop still works as before.
- Existing resize interaction still works as before.
- Existing manual task add/edit flows still work as before.
- Existing timer flow still creates and schedules a task after stop.

## Recommended Follow-Up Backlog

After this scope lands, the highest-value next improvements for Planner Mode are:

1. Live focus tally while a timer is still running.
2. Daily and weekly focus history views.
3. Focus breakdown by board or project.
4. Planned-versus-actual comparisons between scheduled time and tracked focus time.
5. Overlap and conflict warnings in planner scheduling.
6. Timer resume/continue flows.
7. Manual focus-time corrections or entry.

## Implementation Notes for Planning

- This work should remain narrowly focused on planner mode and timer metadata.
- Avoid refactoring unrelated board, task, or dashboard flows.
- Prefer extending existing planner task fetches over introducing a separate analytics endpoint unless planning discovers a strong performance or separation-of-concerns reason.
- If the UI logic becomes crowded, the planning phase should consider extracting small planner-focused view helpers rather than broad refactors.
