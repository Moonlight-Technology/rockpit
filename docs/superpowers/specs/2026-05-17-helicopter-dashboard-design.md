# Helicopter Dashboard Design

Date: 2026-05-17

## Goal

Refine the `Helicopter View` dashboard so it becomes a short-horizon risk view for cross-project work.

The page should help the user answer these questions quickly:

- What is due soon?
- Which task should I inspect first?
- Is the risk isolated to one task or concentrated in a specific project?

The dashboard should prioritize the next 1 to 3 days, not long-range planning and not full task administration.

## Primary Use Case

The main use case is mixed oversight, with `timeline risk` as the dominant lens.

This means the dashboard is primarily for:

- spotting tasks due today, tomorrow, and within the next 3 days
- opening task details quickly for inspection or editing
- checking whether timeline pressure is building up in a particular board

It is not primarily a project archive, a full analytics screen, or a replacement for the list, timeline, or calendar tabs.

## Product Approach

Use a `dual-pane split` layout on the dashboard tab:

- Left pane: actionable time-based risk feed
- Right pane: supporting context about project concentration and overall workload

This preserves the helicopter-level overview while keeping the first decision focused on urgent timeline risk.

## Information Hierarchy

The dashboard should follow this reading order:

1. Immediate time risk
2. Task-level inspection target
3. Project-level context
4. Overall workload summary

The current dashboard gives equal visual weight to `Urgent Focus` and `Workload by Board`.

The revised dashboard should make risk detection the dominant action path. Project context remains visible, but secondary.

## Dashboard Structure

### Left Pane: Risk Timeline

This is the primary area and should occupy more width than the right pane.

Top section:

- `Today`
- `Tomorrow`
- `Next 3 Days`

Each bucket shows:

- task count
- urgency styling
- up to 2 to 4 representative tasks

Below the bucket summary, show a `Focused Task List` for the currently selected bucket.

Each task row should include:

- title
- project name or `Personal`
- column name if available
- priority
- due date

The row should feel like an inbox item rather than a static report row.

### Right Pane: Context Panel

This pane supports interpretation after the user spots a risk.

It should include:

- `Overload Projects`
- `Completion Snapshot`
- `Signal Summary`

`Overload Projects` should rank boards by due-soon concentration, not by total open count alone.

`Completion Snapshot` should show a compact open vs done summary for the top few relevant boards only.

`Signal Summary` should show short metrics such as:

- total open tasks
- total due-soon tasks
- personal task count
- board task count

## Interaction Model

The dashboard should support this flow:

1. Scan the three short-horizon buckets.
2. Select the bucket that looks risky.
3. Review the tasks inside that bucket.
4. Open a task row to inspect or edit it.
5. Glance at the right pane to understand whether the risk clusters in one project.

The fastest action from the dashboard should be `open/edit task detail`.

The dashboard does not need to optimize for completion toggling as the primary action, although that can still exist as a secondary affordance if it remains visually quiet.

## Sorting and Grouping Rules

For the left-pane focused task list:

- group by time bucket first
- within a bucket, show `HIGH` priority tasks first
- then sort by earliest due date
- if still tied, sort alphabetically by title

For the right-pane overload list:

- sort by number of due-soon tasks descending
- use total open task count only as a supporting metric

## Visual Direction

Urgency should drive contrast.

Recommended emphasis:

- `Today`: strongest contrast
- `Tomorrow`: medium contrast
- `Next 3 Days`: lighter but still prominent

The layout should not use color as decoration. Color should mainly communicate urgency and concentration.

The dashboard should feel more like a control center than a report screen.

## Relationship to Other Tabs

The dashboard should stay narrow in scope.

### `List`

Keep `List` as the deep inspection surface for:

- search
- filtering
- sorting
- full cross-project task browsing

### `Timeline`

Keep `Timeline` for longer-range schedule reading and span visualization.

The dashboard only needs short-horizon risk detection.

### `Calendar`

Keep `Calendar` for date-specific inspection.

The dashboard should not try to become a full calendar surface.

## Reuse From Current Implementation

Retain these strengths from the current page:

- one task source across personal and board tasks
- cross-tab consistency inside `Helicopter View`
- existing task edit flow
- ability to represent both board and standalone work

These pieces already fit the intended product direction and should not be replaced unnecessarily.

## Changes From Current Dashboard

Replace the current equal-weight dashboard cards with a clear hierarchy:

- current `Urgent Focus` becomes time-bucketed risk sections
- current `Workload by Board` becomes risk-aware project context
- top-level reading order changes from summary-first to action-first

This is a dashboard redesign in hierarchy and framing, not a change to the page's core purpose.

## Error Handling and Empty States

If there are no due-soon tasks:

- show a calm empty state in the left pane
- keep the right pane visible for context
- avoid making the page feel blank or broken

If task metadata is incomplete:

- show `Personal` when no board exists
- hide missing column labels rather than showing noisy placeholders

If all tasks are open but unscheduled:

- the dashboard should still show signal summary
- the timeline risk area should explain that there are no upcoming due dates yet

## Testing Focus

The implementation should be validated against these scenarios:

- tasks distributed across `Today`, `Tomorrow`, and `Next 3 Days`
- high-priority tasks appearing ahead of lower-priority tasks within the same time bucket
- mixed personal and board tasks
- boards with many due-soon tasks surfacing in `Overload Projects`
- empty state when no task is due soon
- mobile layout preserving the left-pane priority order before the context panel

## Success Criteria

The redesign is successful if the user can open the dashboard and, within a few seconds:

- identify which day bucket carries the highest risk
- find the next task to inspect
- tell whether the issue is concentrated in a specific board

If the page still feels like a generic task summary, the redesign has not gone far enough.
