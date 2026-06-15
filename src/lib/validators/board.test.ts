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
