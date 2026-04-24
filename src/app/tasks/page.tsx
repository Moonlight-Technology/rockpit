"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Task = {
  id: string;
  description: string | null;
  title: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: "TODO" | "DONE";
  dueDate: string | null;
  column: { id: string; title: string } | null;
  board: { id: string; title: string } | null;
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

function getOverdueDays(dueDate: string) {
  const due = new Date(dueDate);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const msDiff = today.getTime() - due.getTime();
  if (msDiff <= 0) return 0;
  return Math.floor(msDiff / 86_400_000);
}

export default function AllTasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "done">("all");
  const [dueSort, setDueSort] = useState<"asc" | "desc">("asc");
  const [boards, setBoards] = useState<BoardOption[]>([]);
  const [columnOptions, setColumnOptions] = useState<ColumnOption[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState<TaskFormState>({
    title: "",
    description: "",
    dueDate: format(new Date(), "yyyy-MM-dd"),
    priority: "MEDIUM",
    boardId: "",
    columnId: "",
  });
  const [taskModalError, setTaskModalError] = useState<string | null>(null);
  const [taskModalSaving, setTaskModalSaving] = useState(false);
  const [taskModalDeleting, setTaskModalDeleting] = useState(false);

  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/tasks/my", { cache: "no-store" });
        const result = await response.json();
        if (response.ok && result?.ok) {
          setTasks(result.data);
        }
      } finally {
        setLoading(false);
      }
    };

    void fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/tasks/my", { cache: "no-store" });
      const result = await response.json();
      if (response.ok && result?.ok) {
        setTasks(result.data);
      }
    } finally {
      setLoading(false);
    }
  };

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

  const doneCount = useMemo(
    () => tasks.filter((task) => task.status === "DONE").length,
    [tasks]
  );
  const filteredTasks = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    return tasks.filter((task) => {
      const statusPass =
        statusFilter === "all" ||
        (statusFilter === "done" ? task.status === "DONE" : task.status !== "DONE");
      if (!statusPass) return false;

      if (!keyword) return true;

      const text = [
        task.title,
        task.description ?? "",
        task.board?.title ?? "",
        task.column?.title ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(keyword);
    });
  }, [searchQuery, statusFilter, tasks]);

  const sortedTasks = useMemo(
    () =>
      [...filteredTasks].sort((a, b) => {
        if (statusFilter === "all" && a.status !== b.status) return a.status === "DONE" ? 1 : -1;

        const aIsOverdue = a.status !== "DONE" && a.dueDate ? getOverdueDays(a.dueDate) > 0 : false;
        const bIsOverdue = b.status !== "DONE" && b.dueDate ? getOverdueDays(b.dueDate) > 0 : false;
        if (aIsOverdue !== bIsOverdue) return aIsOverdue ? -1 : 1;

        if (a.dueDate && b.dueDate) {
          const diff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          return dueSort === "asc" ? diff : -diff;
        }
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return a.title.localeCompare(b.title);
      }),
    [dueSort, filteredTasks, statusFilter]
  );

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

  const onToggleTaskStatus = async (taskId: string, checked: boolean | "indeterminate") => {
    const status = checked === true ? "DONE" : "TODO";
    const snapshot = tasks;

    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, status } : task)));

    const response = await fetch(`/api/tasks/${taskId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      setTasks(snapshot);
      return;
    }

    await fetchTasks();
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f9fafc_0%,#f3f5fa_48%,#eef2f9_100%)]">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ArrowLeft data-icon="inline-start" />
            Back to Home
          </Link>
          <div className="text-sm text-muted-foreground">
            {doneCount}/{tasks.length} tasks done
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>All Tasks</CardTitle>
                <CardDescription>Tasks assigned to your account.</CardDescription>
              </div>
              <Button size="sm" onClick={openCreateTaskModal}>
                <Plus data-icon="inline-start" />
                Add Task
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_180px]">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search task title, board, or description..."
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "all" | "open" | "done")}
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="all">All Status</option>
                <option value="open">Open Only</option>
                <option value="done">Done Only</option>
              </select>
              <select
                value={dueSort}
                onChange={(event) => setDueSort(event.target.value as "asc" | "desc")}
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="asc">Due Date: Earliest</option>
                <option value="desc">Due Date: Latest</option>
              </select>
            </div>

            {loading ? <p className="text-sm text-muted-foreground">Loading tasks...</p> : null}
            {!loading && sortedTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {tasks.length === 0
                  ? "No tasks assigned to your account yet."
                  : "No tasks match your search/filter."}
              </p>
            ) : null}

            {sortedTasks.map((task) => {
              const overdueDays = task.status !== "DONE" && task.dueDate ? getOverdueDays(task.dueDate) : 0;
              return (
                <div key={task.id} className="block cursor-default rounded-lg border bg-card px-3 py-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void onToggleTaskStatus(task.id, task.status !== "DONE");
                    }}
                    className="rounded-sm"
                  >
                    <Checkbox checked={task.status === "DONE"} />
                  </button>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => void openEditTaskModal(task)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        void openEditTaskModal(task);
                      }
                    }}
                    className={
                      task.status === "DONE"
                        ? "flex-1 cursor-pointer text-sm text-muted-foreground line-through"
                        : "flex-1 cursor-pointer text-sm"
                    }
                  >
                    {task.title}
                  </span>
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
                  {overdueDays > 0 ? (
                    <Badge variant="destructive">
                      Overdue {overdueDays}d
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {task.board?.title ?? "Personal Task"}
                  {task.column ? ` • ${task.column.title}` : ""}
                  {task.dueDate ? ` • Due ${format(new Date(task.dueDate), "MMM d, yyyy")}` : ""}
                </p>
                {task.board?.id ? (
                  <div className="mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        router.push(`/boards/${task.board?.id}`);
                      }}
                    >
                      Open board
                    </Button>
                  </div>
                ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
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
