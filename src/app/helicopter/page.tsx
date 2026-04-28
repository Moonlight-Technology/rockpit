"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  max as maxDate,
  min as minDate,
  startOfWeek,
} from "date-fns";
import { ArrowLeft, PlaneTakeoff, Plus, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Task = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "TODO" | "DONE";
  board: { id: string; title: string; theme?: string | null } | null;
  column: { id: string; title: string } | null;
  assignee: { id: string; name: string; email: string } | null;
};

type BoardOption = {
  id: string;
  title: string;
};

type ColumnOption = {
  id: string;
  title: string;
};

type TaskFormState = {
  title: string;
  description: string;
  dueDate: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  boardId: string;
  columnId: string;
};

type ListSortKey = "title" | "board" | "column" | "priority" | "status" | "dueDate";

export default function HelicopterPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "done">("all");
  const [listSort, setListSort] = useState<{ key: ListSortKey; direction: "asc" | "desc" }>({
    key: "dueDate",
    direction: "asc",
  });
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [boards, setBoards] = useState<BoardOption[]>([]);
  const [columnOptions, setColumnOptions] = useState<ColumnOption[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskModalError, setTaskModalError] = useState<string | null>(null);
  const [taskModalSaving, setTaskModalSaving] = useState(false);
  const [taskModalDeleting, setTaskModalDeleting] = useState(false);
  const [taskForm, setTaskForm] = useState<TaskFormState>({
    title: "",
    description: "",
    dueDate: format(new Date(), "yyyy-MM-dd"),
    priority: "MEDIUM",
    boardId: "",
    columnId: "",
  });

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/tasks/all", { cache: "no-store" });
      const result = await response.json();
      if (response.ok && result?.ok) {
        setTasks(result.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchTasks();
  }, []);

  useEffect(() => {
    const fetchBoards = async () => {
      const response = await fetch("/api/boards", { cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        setBoards([]);
        return;
      }
      setBoards(
        (result.data ?? []).map((board: { id: string; title: string }) => ({
          id: board.id,
          title: board.title,
        }))
      );
    };
    void fetchBoards();
  }, []);

  const openTasks = useMemo(() => tasks.filter((task) => task.status === "TODO"), [tasks]);
  const urgentTasks = useMemo(() => {
    const now = new Date();
    const soon = addDays(now, 3);
    return openTasks.filter((task) => {
      if (task.priority === "HIGH") return true;
      if (!task.dueDate) return false;
      const due = new Date(task.dueDate);
      return due <= soon;
    });
  }, [openTasks]);

  const groupedByBoard = useMemo(() => {
    const map = new Map<string, { name: string; open: number; done: number }>();
    tasks.forEach((task) => {
      const key = task.board?.id ?? "personal";
      const name = task.board?.title ?? "Personal";
      const current = map.get(key) ?? { name, open: 0, done: 0 };
      if (task.status === "DONE") current.done += 1;
      else current.open += 1;
      map.set(key, current);
    });
    return Array.from(map.values()).sort((a, b) => b.open - a.open);
  }, [tasks]);

  const timelineTasks = useMemo(
    () =>
      openTasks
        .filter((task) => Boolean(task.dueDate))
        .sort((a, b) => new Date(a.dueDate as string).getTime() - new Date(b.dueDate as string).getTime()),
    [openTasks]
  );

  const DAY_WIDTH = 36;
  const LEFT_PANEL_WIDTH = 250;
  const today = new Date();
  const scheduledTimelineTasks = timelineTasks.map((task) => {
    const end = new Date(task.dueDate as string);
    const duration = task.priority === "HIGH" ? 4 : task.priority === "MEDIUM" ? 3 : 2;
    const start = addDays(end, -(duration - 1));
    return { ...task, start, end, duration };
  });
  const timelineRangeStart = scheduledTimelineTasks.length
    ? minDate([startOfWeek(minDate(scheduledTimelineTasks.map((t) => t.start)), { weekStartsOn: 1 }), startOfWeek(today, { weekStartsOn: 1 })])
    : startOfWeek(today, { weekStartsOn: 1 });
  const timelineRangeEnd = scheduledTimelineTasks.length
    ? maxDate([endOfWeek(maxDate(scheduledTimelineTasks.map((t) => t.end)), { weekStartsOn: 1 }), endOfWeek(today, { weekStartsOn: 1 })])
    : endOfWeek(today, { weekStartsOn: 1 });
  const timelineDays = eachDayOfInterval({ start: timelineRangeStart, end: timelineRangeEnd });
  const todayIndex = timelineDays.findIndex((day) => isSameDay(day, today));
  const taskDueDates = openTasks.filter((task) => task.dueDate).map((task) => new Date(task.dueDate as string));
  const tasksForSelectedDate = openTasks.filter((task) =>
    task.dueDate ? isSameDay(new Date(task.dueDate), calendarDate) : false
  );
  const projectOptions = useMemo(() => {
    const rows = new Map<string, string>();
    rows.set("personal", "Personal");
    tasks.forEach((task) => {
      if (task.board?.id) rows.set(task.board.id, task.board.title);
    });
    return Array.from(rows.entries()).map(([id, title]) => ({ id, title }));
  }, [tasks]);

  const listTasks = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    const filtered = tasks.filter((task) => {
      const statusPass =
        statusFilter === "all" ||
        (statusFilter === "done" ? task.status === "DONE" : task.status !== "DONE");
      if (!statusPass) return false;

      const projectKey = task.board?.id ?? "personal";
      const projectPass = selectedProjects.length === 0 || selectedProjects.includes(projectKey);
      if (!projectPass) return false;

      if (!keyword) return true;
      const haystack = [
        task.title,
        task.description ?? "",
        task.board?.title ?? "personal",
        task.column?.title ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });

    filtered.sort((a, b) => {
      const priorityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      let base = 0;
      if (listSort.key === "title") {
        base = a.title.localeCompare(b.title);
      } else if (listSort.key === "board") {
        base = (a.board?.title ?? "Personal").localeCompare(b.board?.title ?? "Personal");
      } else if (listSort.key === "column") {
        base = (a.column?.title ?? "").localeCompare(b.column?.title ?? "");
      } else if (listSort.key === "priority") {
        base = priorityRank[a.priority] - priorityRank[b.priority];
      } else if (listSort.key === "status") {
        base = a.status.localeCompare(b.status);
      } else {
        const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        base = aDue - bDue;
      }

      if (base === 0) return a.title.localeCompare(b.title);
      return listSort.direction === "asc" ? base : -base;
    });
    return filtered;
  }, [listSort.direction, listSort.key, searchQuery, selectedProjects, statusFilter, tasks]);

  const toggleListSort = (key: ListSortKey) => {
    setListSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  };

  const setTaskStatus = async (taskId: string, checked: boolean) => {
    const status = checked ? "DONE" : "TODO";
    const previous = tasks;
    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, status } : task)));
    const response = await fetch(`/api/tasks/${taskId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      setTasks(previous);
      alert("Failed to update task status.");
    }
  };

  const loadColumnsForBoard = async (boardId: string) => {
    if (!boardId) {
      setColumnOptions([]);
      setTaskForm((prev) => ({ ...prev, columnId: "" }));
      return;
    }

    const response = await fetch(`/api/boards/${boardId}`, { cache: "no-store" });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) {
      setColumnOptions([]);
      setTaskForm((prev) => ({ ...prev, columnId: "" }));
      return;
    }
    const columns = (result.data.columns ?? [])
      .map((column: { id: string; title: string }) => ({ id: column.id, title: column.title }))
      .filter((column: { title: string }) => column.title.trim().toLowerCase() !== "done");
    setColumnOptions(columns);
    setTaskForm((prev) => ({
      ...prev,
      columnId:
        prev.columnId && columns.some((column: { id: string }) => column.id === prev.columnId)
          ? prev.columnId
          : (columns[0]?.id ?? ""),
    }));
  };

  const openCreateTaskModal = () => {
    setModalMode("create");
    setSelectedTaskId(null);
    setTaskModalError(null);
    setColumnOptions([]);
    setTaskForm({
      title: "",
      description: "",
      dueDate: format(new Date(), "yyyy-MM-dd"),
      priority: "MEDIUM",
      boardId: "",
      columnId: "",
    });
    setShowTaskModal(true);
  };

  const openEditTaskModal = async (task: Task) => {
    setModalMode("edit");
    setSelectedTaskId(task.id);
    setTaskModalError(null);
    setTaskForm({
      title: task.title,
      description: task.description ?? "",
      dueDate: task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      priority: task.priority,
      boardId: task.board?.id ?? "",
      columnId: task.column?.id ?? "",
    });
    setShowTaskModal(true);
    if (task.board?.id) {
      await loadColumnsForBoard(task.board.id);
    } else {
      setColumnOptions([]);
    }
  };

  const closeTaskModal = () => {
    setShowTaskModal(false);
    setTaskModalError(null);
    setTaskModalSaving(false);
    setTaskModalDeleting(false);
  };

  const submitTaskModal = async () => {
    setTaskModalError(null);
    if (!taskForm.title.trim()) {
      setTaskModalError("Task title is required.");
      return;
    }
    if (!taskForm.dueDate) {
      setTaskModalError("Due date is required.");
      return;
    }
    if (taskForm.boardId && !taskForm.columnId) {
      setTaskModalError("Please select column for selected board.");
      return;
    }

    setTaskModalSaving(true);
    const payloadBase = {
      title: taskForm.title.trim(),
      description: taskForm.description.trim() || null,
      dueDate: new Date(`${taskForm.dueDate}T12:00:00`).toISOString(),
      priority: taskForm.priority,
    };

    const response =
      modalMode === "create"
        ? taskForm.boardId
          ? await fetch(`/api/boards/${taskForm.boardId}/tasks`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...payloadBase,
                columnId: taskForm.columnId,
              }),
            })
          : await fetch("/api/tasks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payloadBase),
            })
        : await fetch(`/api/tasks/${selectedTaskId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...payloadBase,
              startDate: null,
              boardId: taskForm.boardId || null,
              columnId: taskForm.boardId ? taskForm.columnId || null : null,
              assigneeId: null,
            }),
          });

    setTaskModalSaving(false);
    if (!response.ok) {
      setTaskModalError(modalMode === "create" ? "Failed to create task." : "Failed to update task.");
      return;
    }

    closeTaskModal();
    await fetchTasks();
  };

  const deleteTaskFromModal = async () => {
    if (modalMode !== "edit" || !selectedTaskId) return;
    const confirmed = window.confirm("Delete this task? This action cannot be undone.");
    if (!confirmed) return;

    setTaskModalDeleting(true);
    setTaskModalError(null);
    const response = await fetch(`/api/tasks/${selectedTaskId}`, { method: "DELETE" });
    setTaskModalDeleting(false);
    if (!response.ok) {
      setTaskModalError("Failed to delete task.");
      return;
    }

    closeTaskModal();
    await fetchTasks();
  };

  const priorityBarClass: Record<"LOW" | "MEDIUM" | "HIGH", string> = {
    LOW: "bg-emerald-500/90",
    MEDIUM: "bg-amber-500/90",
    HIGH: "bg-red-500/90",
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fafc_0%,#edf3fb_50%,#e4edf8_100%)]">
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft data-icon="inline-start" />
              Back
            </Button>
            <Badge variant="secondary">
              <PlaneTakeoff data-icon="inline-start" />
              Helicopter View
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            {openTasks.length} open task(s) • {tasks.length} total
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading tasks...</p>
        ) : (
          <Tabs defaultValue="dashboard" className="w-full gap-4">
            <TabsList className="inline-flex w-fit">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="pt-2">
              <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TriangleAlert className="size-5 text-amber-500" />
                      Urgent Focus
                    </CardTitle>
                    <CardDescription>High priority or due in next 3 days.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {urgentTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No urgent tasks right now.</p>
                    ) : null}
                    {urgentTasks.map((task) => (
                      <div key={task.id} className="rounded-md border bg-card px-3 py-2">
                        <p className="text-sm font-medium">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {task.board?.title ?? "Personal"}
                          {task.column ? ` • ${task.column.title}` : ""}
                          {task.dueDate ? ` • Due ${format(new Date(task.dueDate), "MMM d")}` : ""}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Workload by Board</CardTitle>
                    <CardDescription>Open vs done tasks overview.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {groupedByBoard.map((row) => (
                      <div key={row.name} className="rounded-md border bg-card px-3 py-2">
                        <p className="text-sm font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Open {row.open} • Done {row.done}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="list" className="pt-2">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle>All Tasks</CardTitle>
                      <CardDescription>Cross-board and standalone tasks.</CardDescription>
                    </div>
                    <Button size="sm" onClick={openCreateTaskModal}>
                      <Plus data-icon="inline-start" />
                      Add Task
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-3">
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search tasks..."
                      className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:col-span-2"
                    />
                    <select
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(event.target.value as "all" | "open" | "done")
                      }
                      className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <option value="all">All status</option>
                      <option value="open">Open only</option>
                      <option value="done">Done only</option>
                    </select>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Project filter:</span>
                    {projectOptions.map((project) => {
                      const active = selectedProjects.includes(project.id);
                      return (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() =>
                            setSelectedProjects((prev) =>
                              prev.includes(project.id)
                                ? prev.filter((item) => item !== project.id)
                                : [...prev, project.id]
                            )
                          }
                          className={`rounded-full border px-2.5 py-1 text-xs transition ${
                            active
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : "border-border bg-background text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {project.title}
                        </button>
                      );
                    })}
                    {selectedProjects.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setSelectedProjects([])}
                        className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="w-12 px-3 py-3 font-medium">Done</th>
                          <th className="px-3 py-3 font-medium">
                            <button type="button" className="hover:text-foreground" onClick={() => toggleListSort("title")}>
                              Task
                            </button>
                          </th>
                          <th className="px-3 py-3 font-medium">
                            <button type="button" className="hover:text-foreground" onClick={() => toggleListSort("board")}>
                              Board
                            </button>
                          </th>
                          <th className="px-3 py-3 font-medium">
                            <button type="button" className="hover:text-foreground" onClick={() => toggleListSort("column")}>
                              Column
                            </button>
                          </th>
                          <th className="px-3 py-3 font-medium">
                            <button type="button" className="hover:text-foreground" onClick={() => toggleListSort("priority")}>
                              Priority
                            </button>
                          </th>
                          <th className="px-3 py-3 font-medium">
                            <button type="button" className="hover:text-foreground" onClick={() => toggleListSort("status")}>
                              Status
                            </button>
                          </th>
                          <th className="px-3 py-3 font-medium">
                            <button type="button" className="hover:text-foreground" onClick={() => toggleListSort("dueDate")}>
                              Due Date
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {listTasks.map((task) => (
                          <tr
                            key={task.id}
                            className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                            onClick={() => void openEditTaskModal(task)}
                          >
                            <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                              <Checkbox
                                checked={task.status === "DONE"}
                                onCheckedChange={(checked) => {
                                  void setTaskStatus(task.id, checked === true);
                                }}
                              />
                            </td>
                            <td className="px-3 py-3 font-medium">{task.title}</td>
                            <td className="px-3 py-3">{task.board?.title ?? "Personal"}</td>
                            <td className="px-3 py-3">{task.column?.title ?? "-"}</td>
                            <td className="px-3 py-3">
                              <Badge
                                variant={
                                  task.priority === "HIGH"
                                    ? "destructive"
                                    : task.priority === "MEDIUM"
                                      ? "secondary"
                                      : "outline"
                                }
                              >
                                {task.priority}
                              </Badge>
                            </td>
                            <td className="px-3 py-3">
                              <Badge variant={task.status === "DONE" ? "secondary" : "outline"}>
                                {task.status}
                              </Badge>
                            </td>
                            <td className="px-3 py-3">
                              {task.dueDate ? format(new Date(task.dueDate), "MMM d, yyyy") : "-"}
                            </td>
                          </tr>
                        ))}
                        {listTasks.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                              No tasks match current search/filter.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timeline" className="pt-2">
              <Card>
                <CardHeader>
                  <CardTitle>Timeline</CardTitle>
                  <CardDescription>Gantt overview of open tasks.</CardDescription>
                </CardHeader>
                <CardContent>
                  {scheduledTimelineTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tasks with due date.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border bg-card">
                      <div className="min-w-max">
                        <div
                          className="grid border-b bg-muted/40"
                          style={{
                            gridTemplateColumns: `${LEFT_PANEL_WIDTH}px ${timelineDays.length * DAY_WIDTH}px`,
                          }}
                        >
                          <div className="border-r px-4 py-3 text-sm font-medium">Task</div>
                          <div
                            className="grid"
                            style={{ gridTemplateColumns: `repeat(${timelineDays.length}, ${DAY_WIDTH}px)` }}
                          >
                            {timelineDays.map((day) => (
                              <div key={day.toISOString()} className="border-r px-1 py-2 text-center text-xs text-muted-foreground">
                                <div>{format(day, "EEE")}</div>
                                <div className="font-medium">{format(day, "d")}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {scheduledTimelineTasks.map((task) => {
                          const startIndex = timelineDays.findIndex((day) => isSameDay(day, task.start));
                          return (
                            <div
                              key={task.id}
                              className="grid border-b last:border-0"
                              style={{
                                gridTemplateColumns: `${LEFT_PANEL_WIDTH}px ${timelineDays.length * DAY_WIDTH}px`,
                              }}
                            >
                              <div className="border-r px-4 py-3">
                                <p className="text-sm font-medium">{task.title}</p>
                                <p className="text-xs text-muted-foreground">{task.board?.title ?? "Personal"}</p>
                              </div>
                              <div className="relative h-12">
                                <div
                                  className="absolute inset-0"
                                  style={{
                                    backgroundImage:
                                      "repeating-linear-gradient(to right, transparent 0, transparent 35px, rgba(148,163,184,0.3) 35px, rgba(148,163,184,0.3) 36px)",
                                  }}
                                />
                                {todayIndex >= 0 ? (
                                  <div
                                    className="absolute top-0 h-full w-[2px] bg-amber-500/90"
                                    style={{ left: `${todayIndex * DAY_WIDTH + DAY_WIDTH / 2}px` }}
                                  />
                                ) : null}
                                <div
                                  className={`absolute top-2 h-8 rounded-md px-2 py-1 text-xs font-medium text-white ${priorityBarClass[task.priority]}`}
                                  style={{
                                    left: `${startIndex * DAY_WIDTH + 3}px`,
                                    width: `${task.duration * DAY_WIDTH - 6}px`,
                                  }}
                                >
                                  <div className="truncate">{task.title}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="calendar" className="pt-2">
              <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
                <Card className="h-fit">
                  <CardHeader>
                    <CardTitle>Calendar</CardTitle>
                    <CardDescription>All open task due dates.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Calendar
                      mode="single"
                      selected={calendarDate}
                      onSelect={(date) => setCalendarDate(date ?? new Date())}
                      className="w-full rounded-lg border [&_.rdp-months]:w-full [&_.rdp-month]:w-full [&_.rdp-table]:w-full"
                      modifiers={{ hasTask: taskDueDates }}
                      modifiersClassNames={{
                        hasTask:
                          "relative after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
                      }}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>{format(calendarDate, "PPP")}</CardTitle>
                    <CardDescription>Tasks due on selected date.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {tasksForSelectedDate.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No tasks due on this day.</p>
                    ) : null}
                    {tasksForSelectedDate.map((task) => (
                      <div key={task.id} className="rounded-md border bg-card px-3 py-2">
                        <p className="text-sm font-medium">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {task.board?.title ?? "Personal"}
                          {task.column ? ` • ${task.column.title}` : ""}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </main>

      {showTaskModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/35 p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle>{modalMode === "create" ? "Add Task" : "Edit Task"}</CardTitle>
              <CardDescription>
                {modalMode === "create" ? "Create a new task." : "Update task details or delete it."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <input
                value={taskForm.title}
                onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Task title"
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <textarea
                rows={3}
                value={taskForm.description}
                onChange={(event) =>
                  setTaskForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Description (optional)"
                className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(event) =>
                    setTaskForm((prev) => ({ ...prev, dueDate: event.target.value }))
                  }
                  className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <select
                  value={taskForm.priority}
                  onChange={(event) =>
                    setTaskForm((prev) => ({
                      ...prev,
                      priority: event.target.value as TaskFormState["priority"],
                    }))
                  }
                  className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={taskForm.boardId}
                  onChange={(event) => {
                    const nextBoardId = event.target.value;
                    setTaskForm((prev) => ({ ...prev, boardId: nextBoardId, columnId: "" }));
                    void loadColumnsForBoard(nextBoardId);
                  }}
                  className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">Personal Task (No Board)</option>
                  {boards.map((board) => (
                    <option key={board.id} value={board.id}>
                      {board.title}
                    </option>
                  ))}
                </select>
                <select
                  value={taskForm.columnId}
                  onChange={(event) =>
                    setTaskForm((prev) => ({ ...prev, columnId: event.target.value }))
                  }
                  disabled={!taskForm.boardId}
                  className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {taskForm.boardId ? "Select Column" : "No column (personal task)"}
                  </option>
                  {columnOptions.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.title}
                    </option>
                  ))}
                </select>
              </div>

              {taskModalError ? <p className="text-sm text-destructive">{taskModalError}</p> : null}

              <div className="mt-1 flex items-center justify-between gap-2">
                {modalMode === "edit" ? (
                  <Button
                    variant="destructive"
                    onClick={deleteTaskFromModal}
                    disabled={taskModalSaving || taskModalDeleting}
                  >
                    {taskModalDeleting ? "Deleting..." : "Delete"}
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={closeTaskModal}
                    disabled={taskModalSaving || taskModalDeleting}
                  >
                    Cancel
                  </Button>
                  <Button onClick={submitTaskModal} disabled={taskModalSaving || taskModalDeleting}>
                    {taskModalSaving ? "Saving..." : modalMode === "create" ? "Create" : "Save"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
