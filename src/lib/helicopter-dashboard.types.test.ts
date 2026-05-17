import { buildHelicopterDashboardData } from "./helicopter-dashboard";

const task = {
  id: "task-1",
  title: "Task 1",
  description: "Extra fields must survive dashboard shaping",
  dueDate: "2026-05-17T12:00:00.000Z",
  priority: "HIGH" as const,
  status: "TODO" as const,
  board: { id: "alpha", title: "Alpha" },
  column: { id: "doing", title: "Doing" },
  assignee: null,
};

const dashboardData = buildHelicopterDashboardData([task]);
const bucketTask = dashboardData.buckets[0]?.tasks[0];

if (!bucketTask) {
  throw new Error("Expected dashboard bucket task");
}

const fullTask: typeof task = bucketTask;

void fullTask;
