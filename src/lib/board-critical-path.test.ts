import { describe, expect, it } from "vitest";
import { toBoardCriticalPathTasks } from "@/lib/board-critical-path";

describe("toBoardCriticalPathTasks", () => {
  it("preserves board task status, dependencies, and column for Critical Path", () => {
    expect(
      toBoardCriticalPathTasks([
        {
          id: "task-1",
          title: "Deploy",
          startDate: "2026-09-15T00:00:00.000Z",
          dueDate: "2026-09-16T00:00:00.000Z",
          status: "TODO",
          columnTitle: "In Progress",
          dependencies: [{ dependsOnTaskId: "task-0" }],
        },
      ]),
    ).toEqual([
      {
        id: "task-1",
        title: "Deploy",
        startDate: "2026-09-15T00:00:00.000Z",
        dueDate: "2026-09-16T00:00:00.000Z",
        status: "TODO",
        dependencies: [{ dependsOnTaskId: "task-0" }],
        column: { title: "In Progress" },
      },
    ]);
  });
});
