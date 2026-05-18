import assert from "node:assert/strict";
import test from "node:test";
import { buildHelicopterDashboardData } from "./helicopter-dashboard.ts";

const now = new Date("2026-05-17T09:00:00.000Z");

test("buildHelicopterDashboardData groups open tasks into today tomorrow and next 3 days", () => {
  const data = buildHelicopterDashboardData(
    [
      {
        id: "today-high",
        title: "Today high",
        dueDate: "2026-05-17T12:00:00.000Z",
        priority: "HIGH",
        status: "TODO",
        board: { id: "alpha", title: "Alpha" },
        column: { id: "doing", title: "Doing" },
      },
      {
        id: "today-low",
        title: "Today low",
        dueDate: "2026-05-17T15:00:00.000Z",
        priority: "LOW",
        status: "TODO",
        board: null,
        column: null,
      },
      {
        id: "tomorrow-medium",
        title: "Tomorrow medium",
        dueDate: "2026-05-18T12:00:00.000Z",
        priority: "MEDIUM",
        status: "TODO",
        board: { id: "beta", title: "Beta" },
        column: null,
      },
      {
        id: "next3",
        title: "Next three days",
        dueDate: "2026-05-20T12:00:00.000Z",
        priority: "MEDIUM",
        status: "TODO",
        board: { id: "alpha", title: "Alpha" },
        column: null,
      },
      {
        id: "done-task",
        title: "Done task",
        dueDate: "2026-05-17T12:00:00.000Z",
        priority: "HIGH",
        status: "DONE",
        board: { id: "alpha", title: "Alpha" },
        column: null,
      },
      {
        id: "later-task",
        title: "Later task",
        dueDate: "2026-05-25T12:00:00.000Z",
        priority: "HIGH",
        status: "TODO",
        board: { id: "gamma", title: "Gamma" },
        column: null,
      },
    ],
    now
  );

  assert.deepEqual(
    data.buckets.map((bucket) => [bucket.id, bucket.count]),
    [
      ["today", 2],
      ["tomorrow", 1],
      ["next3Days", 1],
    ]
  );

  assert.deepEqual(
    data.buckets[0].tasks.map((task) => task.id),
    ["today-high", "today-low"]
  );
  assert.deepEqual(
    data.buckets[1].tasks.map((task) => task.id),
    ["tomorrow-medium"]
  );
  assert.deepEqual(
    data.buckets[2].tasks.map((task) => task.id),
    ["next3"]
  );
});

test("buildHelicopterDashboardData ranks overload projects by due soon concentration and counts personal vs board tasks", () => {
  const data = buildHelicopterDashboardData(
    [
      {
        id: "alpha-1",
        title: "Alpha 1",
        dueDate: "2026-05-17T12:00:00.000Z",
        priority: "HIGH",
        status: "TODO",
        board: { id: "alpha", title: "Alpha" },
        column: null,
      },
      {
        id: "alpha-2",
        title: "Alpha 2",
        dueDate: "2026-05-18T12:00:00.000Z",
        priority: "MEDIUM",
        status: "TODO",
        board: { id: "alpha", title: "Alpha" },
        column: null,
      },
      {
        id: "beta-1",
        title: "Beta 1",
        dueDate: "2026-05-20T12:00:00.000Z",
        priority: "LOW",
        status: "TODO",
        board: { id: "beta", title: "Beta" },
        column: null,
      },
      {
        id: "personal-1",
        title: "Personal 1",
        dueDate: "2026-05-18T12:00:00.000Z",
        priority: "HIGH",
        status: "TODO",
        board: null,
        column: null,
      },
      {
        id: "done-beta",
        title: "Done Beta",
        dueDate: "2026-05-20T12:00:00.000Z",
        priority: "LOW",
        status: "DONE",
        board: { id: "beta", title: "Beta" },
        column: null,
      },
    ],
    now
  );

  assert.deepEqual(data.overloadProjects, [
    { id: "alpha", title: "Alpha", dueSoonCount: 2, openCount: 2 },
    { id: "beta", title: "Beta", dueSoonCount: 1, openCount: 1 },
  ]);

  assert.deepEqual(data.signalSummary, {
    openCount: 4,
    dueSoonCount: 4,
    personalCount: 1,
    boardCount: 3,
  });

  assert.deepEqual(data.completionSnapshot, [
    { id: "alpha", title: "Alpha", openCount: 2, doneCount: 0 },
    { id: "beta", title: "Beta", openCount: 1, doneCount: 1 },
    { id: "personal", title: "Personal", openCount: 1, doneCount: 0 },
  ]);
});
