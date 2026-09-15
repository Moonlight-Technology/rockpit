# Persisted Critical Path Node Layout Design

## Goal

Allow users to drag nodes in a Critical Path network diagram and preserve the resulting layout independently for each board. Manual layout must not alter task dates, dependencies, task status, or Kanban ordering.

## Scope

- Persist a node position for each task within a board.
- Load persisted positions when a board is selected in the Critical Path tab.
- Use automatic layout for tasks that have no saved position.
- Drag a node to reposition it and save the final position on pointer release.
- Provide `Reset layout` to delete the selected board's manual positions and return to automatic layout.

Out of scope:

- Changing task dependencies via dragging between nodes.
- Sharing a layout across boards.
- Reusing `Task.position`, which controls Kanban order.
- Collaborative conflict resolution beyond last successful save wins.

## Data Model

Add `TaskNetworkPosition`:

- `id`
- `boardId`, related to `Board` with cascade delete
- `taskId`, related to `Task` with cascade delete
- `x` and `y` integer canvas coordinates
- `createdAt` and `updatedAt`

The model has a unique constraint on `(boardId, taskId)`. `Board` and `Task` receive relation fields. The migration creates only this table and does not modify existing tasks or dependency data.

The service verifies that the task belongs to the supplied board before writing a position. This prevents a position for a personal task or a task from another board.

## API

Authenticated board-scoped endpoints:

- `GET /api/boards/[id]/network-layout`: return saved positions for accessible board tasks.
- `PUT /api/boards/[id]/network-layout/[taskId]`: validate finite integer coordinates and upsert one node position.
- `DELETE /api/boards/[id]/network-layout`: delete all saved node positions for the board.

Every endpoint first checks board access. Invalid task-board membership returns a client-safe validation error. The write endpoint clamps coordinates to a non-negative bounded canvas range before persistence.

## Client Layout Flow

1. The existing graph helper computes the automatic layout from task dependencies.
2. When a board is selected, the client fetches saved positions for that board.
3. The renderer overlays saved coordinates on automatic node coordinates. Nodes missing a saved coordinate remain automatically positioned.
4. On pointer down, a node records its origin and pointer offset. Pointer movement updates local coordinates and connected edges immediately.
5. A pointer release after movement saves the node position. A click without movement retains the existing edit-modal behavior.
6. A failed save restores the node's pre-drag coordinates and shows an error in the Critical Path panel.
7. `Reset layout` deletes positions for the active board and clears client overrides, revealing automatic placement.

New tasks use automatic placement. Changing a dependency, task title, dates, or status keeps an existing manual position. Deleting a task removes its position through database cascade.

## Interaction Details

- Dragging is available only inside the Network Diagram canvas.
- Nodes use a move cursor during drag; existing keyboard activation continues to open the edit modal.
- The diagram viewport expands to include manual coordinates, preventing clipped nodes after a drag.
- Pointer events support mouse and touch. Zoom remains independent from the stored unscaled coordinates.
- Existing status colors, critical-path highlighting, zoom, filtering, and edit behavior remain unchanged.

## Error Handling

- Layout read failure leaves the automatic layout usable and shows a non-blocking error.
- Position write failure reverts only the node that failed to save.
- Reset failure keeps current manual positions visible and reports the failure.
- Network updates are not blocked by layout API failures.

## Testing

- Unit test overlaying saved positions on automatic positions, including a partial saved layout.
- Unit test coordinate clamping and viewport-bound calculation.
- Test drag classification so a click still opens edit while a drag does not.
- Test board-scoped service validation: access, task-board membership, upsert, and reset isolation.
- Run Prisma validation and migration checks, targeted tests, lint, and production build.
