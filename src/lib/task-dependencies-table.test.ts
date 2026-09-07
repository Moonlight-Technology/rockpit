import { describe, expect, it } from "vitest";
import { filterAndSortDependencyTasks } from "@/lib/task-dependencies-table";

const tasks = [
  { id: "late", status: "TODO" as const, startDate: "2026-09-03T12:00:00.000Z", dueDate: "2026-09-05T12:00:00.000Z" },
  { id: "done", status: "DONE" as const, startDate: "2026-09-01T12:00:00.000Z", dueDate: "2026-09-02T12:00:00.000Z" },
  { id: "none", status: "TODO" as const, startDate: null, dueDate: null },
];

describe("filterAndSortDependencyTasks", () => {
  it("filters open tasks and keeps missing dates last when sorting start date", () => {
    expect(filterAndSortDependencyTasks(tasks, "open", { key: "startDate", direction: "asc" }).map((task) => task.id)).toEqual(["late", "none"]);
  });
});
