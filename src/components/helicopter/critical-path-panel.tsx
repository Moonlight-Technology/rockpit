"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  analyzeCriticalPath,
  buildNetworkLayout,
  type DependencyEdge,
  type DependencyTask,
} from "@/lib/critical-path";
import { clampNetworkZoom, NETWORK_ZOOM_DEFAULT } from "@/lib/network-zoom";
import { isNodeEditActivation } from "@/lib/network-node-interaction";
import {
  getVisibleNetworkTaskIds,
  type NetworkStatusFilter,
} from "@/lib/network-status-filter";
import {
  filterAndSortDependencyTasks,
  type DependencyTableSort,
  type DependencyTableStatus,
} from "@/lib/task-dependencies-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type CriticalPathTask = DependencyTask & {
  dependencies: Array<{ dependsOnTaskId: string }>;
};

export function CriticalPathPanel({
  tasks,
  onSave,
  onEditTask,
  onUpdateStatus,
}: {
  tasks: CriticalPathTask[];
  onSave: (
    taskId: string,
    dependsOnTaskIds: string[],
  ) => Promise<{ error?: string }>;
  onEditTask: (taskId: string) => void;
  onUpdateStatus: (
    taskId: string,
    done: boolean,
  ) => Promise<{ error?: string }>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkZoom, setNetworkZoom] = useState(NETWORK_ZOOM_DEFAULT);
  const [networkStatusFilter, setNetworkStatusFilter] =
    useState<NetworkStatusFilter>("all");
  const [statusFilter, setStatusFilter] =
    useState<DependencyTableStatus>("all");
  const [tableSort, setTableSort] = useState<DependencyTableSort>({
    key: "startDate",
    direction: "asc",
  });
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);
  const edges = useMemo<DependencyEdge[]>(
    () =>
      tasks.flatMap((task) =>
        task.dependencies.map((dependency) => ({
          taskId: task.id,
          dependsOnTaskId: dependency.dependsOnTaskId,
        })),
      ),
    [tasks],
  );
  const analysis = useMemo(
    () => analyzeCriticalPath(tasks, edges),
    [tasks, edges],
  );
  const layout = useMemo(
    () => buildNetworkLayout(tasks, edges),
    [tasks, edges],
  );
  const taskById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );
  const visibleNetworkTaskIds = useMemo(
    () => getVisibleNetworkTaskIds(tasks, networkStatusFilter),
    [networkStatusFilter, tasks],
  );
  const visibleTasks = useMemo(
    () => filterAndSortDependencyTasks(tasks, statusFilter, tableSort),
    [statusFilter, tableSort, tasks],
  );

  const save = async (formData: FormData) => {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    const result = await onSave(
      editingId,
      formData.getAll("dependency").map(String),
    );
    setSaving(false);
    if (result.error) setError(result.error);
    else setEditingId(null);
  };

  const toggleTableSort = (key: DependencyTableSort["key"]) => {
    setTableSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  };

  const updateStatus = async (taskId: string, done: boolean) => {
    setStatusSavingId(taskId);
    setError(null);
    const result = await onUpdateStatus(taskId, done);
    setStatusSavingId(null);
    if (result.error) setError(result.error);
  };

  return (
    <Tabs defaultValue="network" className="space-y-4">
      <TabsList>
        <TabsTrigger value="network">Network Diagram</TabsTrigger>
      </TabsList>
      <TabsContent value="dependencies">
        <div className="space-y-3">
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as DependencyTableStatus)
            }
            className="h-9 rounded border bg-background px-2 text-sm"
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="done">Done</option>
          </select>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[940px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3">Done</th>
                  <th className="p-3">Task</th>
                  <th className="p-3">
                    <button
                      type="button"
                      onClick={() => toggleTableSort("startDate")}
                    >
                      Start{" "}
                      {tableSort.key === "startDate"
                        ? tableSort.direction === "asc"
                          ? "↑"
                          : "↓"
                        : ""}
                    </button>
                  </th>
                  <th className="p-3">
                    <button
                      type="button"
                      onClick={() => toggleTableSort("dueDate")}
                    >
                      Due{" "}
                      {tableSort.key === "dueDate"
                        ? tableSort.direction === "asc"
                          ? "↑"
                          : "↓"
                        : ""}
                    </button>
                  </th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Dependency</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleTasks.map((task) => (
                  <tr key={task.id} className="border-b last:border-0">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        aria-label={`Mark ${task.title} done`}
                        checked={task.status === "DONE"}
                        disabled={statusSavingId === task.id}
                        onChange={(event) =>
                          void updateStatus(task.id, event.target.checked)
                        }
                      />
                    </td>
                    <td className="p-3 font-medium">{task.title}</td>
                    <td className="p-3">
                      {task.startDate
                        ? format(new Date(task.startDate), "MMM d, yyyy")
                        : "-"}
                    </td>
                    <td className="p-3">
                      {task.dueDate
                        ? format(new Date(task.dueDate), "MMM d, yyyy")
                        : "-"}
                    </td>
                    <td className="p-3">{task.status}</td>
                    <td className="p-3">
                      {editingId === task.id ? (
                        <form action={save} className="space-y-2">
                          <select
                            name="dependency"
                            multiple
                            defaultValue={task.dependencies.map(
                              (dependency) => dependency.dependsOnTaskId,
                            )}
                            className="min-h-24 w-full rounded border bg-background p-2"
                          >
                            {tasks
                              .filter((candidate) => candidate.id !== task.id)
                              .map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                  {candidate.title}
                                </option>
                              ))}
                          </select>
                          <div className="flex gap-2">
                            <button
                              disabled={saving}
                              className="rounded bg-primary px-2 py-1 text-primary-foreground"
                            >
                              Save dependencies
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded border px-2 py-1"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          onClick={() => setEditingId(task.id)}
                          className="text-left hover:underline"
                        >
                          {task.dependencies.length
                            ? task.dependencies
                                .map(
                                  (dependency) =>
                                    taskById.get(dependency.dependsOnTaskId)
                                      ?.title,
                                )
                                .join(", ")
                            : "None"}
                        </button>
                      )}
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => onEditTask(task.id)}
                        className="rounded border px-2 py-1 text-xs hover:bg-muted"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="network">
        <div className="space-y-3 rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-4 text-sm">
              <span>
                Critical path:{" "}
                <strong>{analysis.projectDurationDays} days</strong>
              </span>
              <span>{analysis.criticalTaskIds.size} critical tasks</span>
              <span>{analysis.excludedTaskIds.size} missing dates</span>
            </div>
            <div className="flex items-center gap-1">
              <select
                aria-label="Filter network status"
                value={networkStatusFilter}
                onChange={(event) => setNetworkStatusFilter(event.target.value as NetworkStatusFilter)}
                className="mr-2 h-8 rounded border bg-background px-2 text-xs"
              >
                <option value="all">All tasks</option>
                <option value="open">Open</option>
                <option value="done">Done</option>
              </select>
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() =>
                  setNetworkZoom((value) => clampNetworkZoom(value - 0.1))
                }
                className="rounded border px-2 py-1"
              >
                −
              </button>
              <span className="w-12 text-center text-xs tabular-nums">
                {Math.round(networkZoom * 100)}%
              </span>
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() =>
                  setNetworkZoom((value) => clampNetworkZoom(value + 0.1))
                }
                className="rounded border px-2 py-1"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setNetworkZoom(NETWORK_ZOOM_DEFAULT)}
                className="ml-1 rounded border px-2 py-1 text-xs"
              >
                Reset
              </button>
            </div>
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tasks in this board.
            </p>
          ) : (
            <div
              onWheel={(event) => {
                if (!event.ctrlKey && !event.metaKey) return;
                event.preventDefault();
                setNetworkZoom((value) =>
                  clampNetworkZoom(value + (event.deltaY < 0 ? 0.1 : -0.1)),
                );
              }}
              className="min-h-[420px] overflow-auto rounded bg-slate-50"
            >
              <svg
                role="img"
                aria-label="Task dependency network"
                viewBox={`0 0 ${layout.width} ${layout.height}`}
                style={{
                  width: `${Math.max(600, layout.width * networkZoom)}px`,
                  minWidth: "100%",
                  height: `${Math.max(420, layout.height * networkZoom)}px`,
                }}
                className="block bg-slate-50"
              >
                <defs>
                  <marker
                    id="arrow"
                    markerWidth="10"
                    markerHeight="10"
                    refX="9"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L0,6 L9,3 z" />
                  </marker>
                </defs>
                {edges.map((edge) => {
                  const from = layout.nodes[edge.dependsOnTaskId];
                  const to = layout.nodes[edge.taskId];
                  if (!from || !to || !visibleNetworkTaskIds.has(edge.dependsOnTaskId) || !visibleNetworkTaskIds.has(edge.taskId)) return null;
                  const critical = analysis.criticalEdgeKeys.has(
                    `${edge.dependsOnTaskId}:${edge.taskId}`,
                  );
                  return (
                    <line
                      key={`${edge.dependsOnTaskId}:${edge.taskId}`}
                      x1={from.x + 190}
                      y1={from.y + 38}
                      x2={to.x}
                      y2={to.y + 38}
                      stroke={critical ? "#dc2626" : "#64748b"}
                      strokeWidth={critical ? 3 : 1.5}
                      markerEnd="url(#arrow)"
                    />
                  );
                })}
                {tasks.map((task) => {
                  const node = layout.nodes[task.id];
                  if (!node || !visibleNetworkTaskIds.has(task.id)) return null;
                  const critical = analysis.criticalTaskIds.has(task.id);
                  return (
                    <g
                      key={task.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Edit ${task.title}`}
                      onClick={() => onEditTask(task.id)}
                      onKeyDown={(event) => {
                        if (isNodeEditActivation(event.key)) {
                          event.preventDefault();
                          onEditTask(task.id);
                        }
                      }}
                      className="cursor-pointer outline-none [&:focus_rect]:stroke-sky-500"
                      transform={`translate(${node.x},${node.y})`}
                    >
                      <rect
                        width="190"
                        height="76"
                        rx="8"
                        fill={critical ? "#fef2f2" : "white"}
                        stroke={critical ? "#dc2626" : "#94a3b8"}
                        strokeWidth={critical ? 2 : 1}
                      />
                      <text x="12" y="27" fontSize="13" fontWeight="600">
                        {task.title.slice(0, 24)}
                      </text>
                      <text x="12" y="49" fontSize="11" fill="#64748b">
                        {task.startDate && task.dueDate
                          ? `${format(new Date(task.startDate), "MMM d")} - ${format(new Date(task.dueDate), "MMM d")}`
                          : "Missing dates"}
                      </text>
                      <text x="12" y="66" fontSize="11" fill="#64748b">
                        {critical
                          ? "Critical"
                          : `${analysis.slackDaysByTaskId[task.id] ?? "-"} days slack`}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
