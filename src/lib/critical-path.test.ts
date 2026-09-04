import { describe, expect, it } from "vitest";
import {
  analyzeCriticalPath,
  buildNetworkLayout,
  getDependencyCandidateIds,
  hasDependencyCycle,
} from "@/lib/critical-path";

describe("analyzeCriticalPath", () => {
  it("uses inclusive calendar-day durations for a linear dependency chain", () => {
    const analysis = analyzeCriticalPath(
      [
        {
          id: "design",
          title: "Design",
          status: "TODO",
          startDate: "2026-09-01T00:00:00.000Z",
          dueDate: "2026-09-02T00:00:00.000Z",
        },
        {
          id: "build",
          title: "Build",
          status: "TODO",
          startDate: "2026-09-03T00:00:00.000Z",
          dueDate: "2026-09-05T00:00:00.000Z",
        },
      ],
      [{ taskId: "build", dependsOnTaskId: "design" }]
    );

    expect(analysis.projectDurationDays).toBe(5);
    expect(analysis.criticalTaskIds).toEqual(new Set(["design", "build"]));
    expect(analysis.slackDaysByTaskId).toEqual({ design: 0, build: 0 });
  });

  it("identifies the longest parallel branch and its critical edges", () => {
    const analysis = analyzeCriticalPath(
      [
        { id: "a", title: "Research", status: "TODO", startDate: "2026-09-01T00:00:00.000Z", dueDate: "2026-09-02T00:00:00.000Z" },
        { id: "b", title: "Build", status: "TODO", startDate: "2026-09-01T00:00:00.000Z", dueDate: "2026-09-04T00:00:00.000Z" },
        { id: "c", title: "Copy", status: "TODO", startDate: "2026-09-01T00:00:00.000Z", dueDate: "2026-09-03T00:00:00.000Z" },
        { id: "d", title: "Launch", status: "TODO", startDate: "2026-09-01T00:00:00.000Z", dueDate: "2026-09-01T00:00:00.000Z" },
      ],
      [
        { taskId: "b", dependsOnTaskId: "a" },
        { taskId: "d", dependsOnTaskId: "b" },
        { taskId: "d", dependsOnTaskId: "c" },
      ]
    );

    expect(analysis.projectDurationDays).toBe(7);
    expect(analysis.criticalTaskIds).toEqual(new Set(["a", "b", "d"]));
    expect(analysis.criticalEdgeKeys).toEqual(new Set(["a:b", "b:d"]));
    expect(analysis.slackDaysByTaskId.c).toBe(3);
  });

  it("excludes tasks without complete dates from CPM", () => {
    const analysis = analyzeCriticalPath(
      [
        { id: "ready", title: "Ready", status: "TODO", startDate: "2026-09-01T00:00:00.000Z", dueDate: "2026-09-01T00:00:00.000Z" },
        { id: "unscheduled", title: "Unscheduled", status: "TODO", startDate: null, dueDate: null },
      ],
      [{ taskId: "unscheduled", dependsOnTaskId: "ready" }]
    );

    expect(analysis.projectDurationDays).toBe(1);
    expect(analysis.excludedTaskIds).toEqual(new Set(["unscheduled"]));
    expect(analysis.criticalTaskIds).toEqual(new Set(["ready"]));
  });

  it("detects direct and indirect dependency cycles", () => {
    expect(hasDependencyCycle(["a", "b"], [{ taskId: "a", dependsOnTaskId: "b" }, { taskId: "b", dependsOnTaskId: "a" }])).toBe(true);
    expect(hasDependencyCycle(["a", "b", "c"], [{ taskId: "b", dependsOnTaskId: "a" }, { taskId: "c", dependsOnTaskId: "b" }])).toBe(false);
  });

  it("omits candidates that are the task itself or would create a cycle", () => {
    const candidateIds = getDependencyCandidateIds(
      "a",
      ["a", "b", "c", "d"],
      [{ taskId: "b", dependsOnTaskId: "a" }, { taskId: "c", dependsOnTaskId: "b" }]
    );

    expect(candidateIds).toEqual(new Set(["d"]));
  });

  it("places prerequisites before their dependents in the network layout", () => {
    const layout = buildNetworkLayout(
      [
        { id: "a", title: "Alpha", status: "TODO", startDate: null, dueDate: null },
        { id: "b", title: "Beta", status: "TODO", startDate: null, dueDate: null },
      ],
      [{ taskId: "b", dependsOnTaskId: "a" }]
    );

    expect(layout.nodes.a.layer).toBeLessThan(layout.nodes.b.layer);
    expect(layout.nodes.a.x).toBeLessThan(layout.nodes.b.x);
  });
});
