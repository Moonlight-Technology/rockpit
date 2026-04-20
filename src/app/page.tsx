"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { format } from "date-fns";
import { Plus, PlaneTakeoff, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { PwaInstallButton } from "@/components/pwa-install-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Task = {
  id: string;
  description: string | null;
  title: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: "TODO" | "DONE";
  dueDate: string | null;
  plannedStartAt: string | null;
  plannedDurationMinutes: number | null;
  assignee: { id: string; name: string; email: string } | null;
  column: { id: string; title: string } | null;
  board: { id: string; title: string } | null;
};

type BoardListItem = {
  id: string;
  title: string;
  description: string;
  theme: string;
  tags: string[];
  updatedAt: string;
  _count: { columns: number };
};

type BoardColumnOption = {
  id: string;
  title: string;
};

const themes = ["Slate", "Ocean", "Sunset", "Forest", "Carbon"];

const todaySeedTasks: Task[] = [];

const themeClassMap: Record<string, string> = {
  Slate: "border-slate-300/80 bg-slate-50/60",
  Ocean: "border-sky-300/80 bg-sky-50/70",
  Sunset: "border-orange-300/80 bg-orange-50/70",
  Forest: "border-emerald-300/80 bg-emerald-50/70",
  Carbon: "border-zinc-300/80 bg-zinc-50/70",
};

type BoardModalForm = {
  title: string;
  description: string;
  theme: string;
  tags: string[];
  dueDate: string;
};

type TaskModalForm = {
  boardId: string;
  columnId: string;
  title: string;
  description: string;
  dueDate: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
};

type SelectedTaskForm = {
  title: string;
  description: string;
  dueDate: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  useTimeRange: boolean;
  startTime: string;
  endTime: string;
};

const initialBoardForm: BoardModalForm = {
  title: "",
  description: "",
  theme: themes[0],
  tags: [],
  dueDate: "",
};

const initialTaskForm: TaskModalForm = {
  boardId: "",
  columnId: "",
  title: "",
  description: "",
  dueDate: "",
  priority: "MEDIUM",
};

const initialSelectedTaskForm: SelectedTaskForm = {
  title: "",
  description: "",
  dueDate: "",
  priority: "MEDIUM",
  useTimeRange: false,
  startTime: "09:00",
  endTime: "10:00",
};

function toDateInputValue(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function toTimeInputValue(date: Date) {
  return format(date, "HH:mm");
}

export default function Home() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [tasks, setTasks] = useState<Task[]>(todaySeedTasks);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState("board");
  const [boards, setBoards] = useState<BoardListItem[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(true);

  const [showBoardModal, setShowBoardModal] = useState(false);
  const [showBoardDueDatePicker, setShowBoardDueDatePicker] = useState(false);
  const [boardForm, setBoardForm] = useState<BoardModalForm>(initialBoardForm);
  const [tagInput, setTagInput] = useState("");
  const [boardFormError, setBoardFormError] = useState<string | null>(null);
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showTaskDueDatePicker, setShowTaskDueDatePicker] = useState(false);
  const [taskForm, setTaskForm] = useState<TaskModalForm>(initialTaskForm);
  const [taskFormError, setTaskFormError] = useState<string | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [boardColumnOptions, setBoardColumnOptions] = useState<BoardColumnOption[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedTaskForm, setSelectedTaskForm] = useState<SelectedTaskForm>(initialSelectedTaskForm);
  const [showSelectedTaskDueDatePicker, setShowSelectedTaskDueDatePicker] = useState(false);
  const [selectedTaskError, setSelectedTaskError] = useState<string | null>(null);
  const [savingSelectedTask, setSavingSelectedTask] = useState(false);
  const [deletingSelectedTask, setDeletingSelectedTask] = useState(false);
  const previewBoards = boards.slice(0, 4);
  const openTasks = tasks.filter((task) => task.status !== "DONE");
  const previewTasks = openTasks.slice(0, 4);

  const doneCount = useMemo(
    () => tasks.filter((task) => task.status === "DONE").length,
    [tasks]
  );
  const progressValue = tasks.length === 0 ? 0 : Math.round((doneCount / tasks.length) * 100);
  const taskDates = useMemo(
    () => tasks.filter((task) => task.dueDate).map((task) => new Date(task.dueDate as string)),
    [tasks]
  );

  useEffect(() => {
    const fetchBoards = async () => {
      setBoardsLoading(true);
      try {
        const response = await fetch("/api/boards", { cache: "no-store" });
        const result = await response.json();
        if (response.ok && result?.ok) {
          setBoards(result.data);
        }
      } finally {
        setBoardsLoading(false);
      }
    };

    void fetchBoards();
  }, []);

  useEffect(() => {
    if (!showTaskModal) return;
    if (!taskForm.boardId) return;

    const fetchColumns = async () => {
      const response = await fetch(`/api/boards/${taskForm.boardId}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result?.ok) {
        setBoardColumnOptions([]);
        return;
      }
      const columns = (result.data.columns ?? []).map((column: { id: string; title: string }) => ({
        id: column.id,
        title: column.title,
      }));
      setBoardColumnOptions(columns);
      setTaskForm((prev) => ({
        ...prev,
        columnId: prev.columnId && columns.some((c: BoardColumnOption) => c.id === prev.columnId)
          ? prev.columnId
          : (columns[0]?.id ?? ""),
      }));
    };

    void fetchColumns();
  }, [showTaskModal, taskForm.boardId]);

  const onToggleTaskStatus = async (taskId: string, checked: boolean | "indeterminate") => {
    const status = checked === true ? "DONE" : "TODO";
    const snapshot = tasks;
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, status } : task))
    );

    const response = await fetch(`/api/tasks/${taskId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      setTasks(snapshot);
      return;
    }

    const refreshTasks = await fetch("/api/tasks/my", { cache: "no-store" });
    const refreshResult = await refreshTasks.json();
    if (refreshTasks.ok && refreshResult?.ok) {
      setTasks(refreshResult.data);
    }
  };

  useEffect(() => {
    const fetchMyTasks = async () => {
      try {
        const response = await fetch("/api/tasks/my", { cache: "no-store" });
        const result = await response.json();
        if (response.ok && result?.ok) {
          setTasks(result.data);
        }
      } catch {
        setTasks([]);
      }
    };
    void fetchMyTasks();
  }, []);

  const openTaskModal = () => {
    const firstBoardId = boards[0]?.id ?? "";
    setTaskForm({
      ...initialTaskForm,
      boardId: firstBoardId,
    });
    setBoardColumnOptions([]);
    setShowTaskDueDatePicker(false);
    setTaskFormError(null);
    setShowTaskModal(true);
  };

  const onCreateTask = async () => {
    setTaskFormError(null);
    if (!taskForm.title.trim()) {
      setTaskFormError("Task title is required.");
      return;
    }
    if (taskForm.boardId && !taskForm.columnId) {
      setTaskFormError("Please select a column for this board task.");
      return;
    }

    setCreatingTask(true);
    const response = taskForm.boardId
      ? await fetch(`/api/boards/${taskForm.boardId}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            columnId: taskForm.columnId,
            title: taskForm.title.trim(),
            description: taskForm.description.trim() || null,
            dueDate: taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : null,
            priority: taskForm.priority,
          }),
        })
      : await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: taskForm.title.trim(),
            description: taskForm.description.trim() || null,
            dueDate: taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : null,
            priority: taskForm.priority,
          }),
        });
    setCreatingTask(false);
    if (!response.ok) {
      setTaskFormError("Failed to create task.");
      return;
    }

    setShowTaskModal(false);
    setShowTaskDueDatePicker(false);
    setTaskForm(initialTaskForm);

    const refreshTasks = await fetch("/api/tasks/my", { cache: "no-store" });
    const refreshResult = await refreshTasks.json();
    if (refreshTasks.ok && refreshResult?.ok) {
      setTasks(refreshResult.data);
    }
  };

  const onCreateBoard = async () => {
    setBoardFormError(null);
    if (!boardForm.title.trim() || !boardForm.description.trim() || !boardForm.theme.trim()) {
      setBoardFormError("Board name, description, and theme are required.");
      return;
    }

    setCreatingBoard(true);
    try {
      const payload = {
        title: boardForm.title.trim(),
        description: boardForm.description.trim(),
        theme: boardForm.theme,
        tags: boardForm.tags,
        dueDate: boardForm.dueDate ? new Date(boardForm.dueDate).toISOString() : null,
      };

      const response = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok || !result?.ok) {
        setBoardFormError(result?.error?.message ?? "Failed to create board.");
        return;
      }

      const boardId = result.data?.id as string;
      setShowBoardModal(false);
      setShowBoardDueDatePicker(false);
      setBoardForm(initialBoardForm);
      setTagInput("");
      router.push(`/boards/${boardId}`);
      router.refresh();
    } finally {
      setCreatingBoard(false);
    }
  };

  const refreshMyTasks = async () => {
    const response = await fetch("/api/tasks/my", { cache: "no-store" });
    const result = await response.json();
    if (response.ok && result?.ok) {
      setTasks(result.data);
    }
  };

  const openSelectedTaskModal = (task: Task) => {
    const dueDate = task.dueDate ? new Date(task.dueDate) : new Date();
    const hasRange = Boolean(task.plannedStartAt && task.plannedDurationMinutes);
    const plannedStart = task.plannedStartAt ? new Date(task.plannedStartAt) : null;
    const startTime = plannedStart ? toTimeInputValue(plannedStart) : "09:00";
    const endTime = plannedStart && task.plannedDurationMinutes
      ? toTimeInputValue(new Date(plannedStart.getTime() + task.plannedDurationMinutes * 60_000))
      : "10:00";

    setSelectedTask(task);
    setSelectedTaskError(null);
    setShowSelectedTaskDueDatePicker(false);
    setSelectedTaskForm({
      title: task.title,
      description: task.description ?? "",
      dueDate: toDateInputValue(dueDate),
      priority: task.priority,
      useTimeRange: hasRange,
      startTime,
      endTime,
    });
  };

  const onSaveSelectedTask = async () => {
    if (!selectedTask) return;
    setSelectedTaskError(null);

    if (!selectedTaskForm.title.trim()) {
      setSelectedTaskError("Task title is required.");
      return;
    }

    if (selectedTaskForm.useTimeRange && selectedTaskForm.endTime <= selectedTaskForm.startTime) {
      setSelectedTaskError("End time must be later than start time.");
      return;
    }

    setSavingSelectedTask(true);

    const dueAtNoon = new Date(`${selectedTaskForm.dueDate}T12:00:00`);
    const updateTaskRes = await fetch(`/api/tasks/${selectedTask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: selectedTaskForm.title.trim(),
        description: selectedTaskForm.description.trim() || null,
        dueDate: dueAtNoon.toISOString(),
        priority: selectedTaskForm.priority,
        assigneeId: selectedTask.assignee?.id ?? null,
      }),
    });

    if (!updateTaskRes.ok) {
      setSavingSelectedTask(false);
      setSelectedTaskError("Failed to update task.");
      return;
    }

    const schedulePayload = selectedTaskForm.useTimeRange
      ? (() => {
          const [startHour, startMinute] = selectedTaskForm.startTime.split(":").map(Number);
          const [endHour, endMinute] = selectedTaskForm.endTime.split(":").map(Number);
          const startAt = new Date(`${selectedTaskForm.dueDate}T00:00:00`);
          startAt.setHours(startHour, startMinute, 0, 0);
          const endAt = new Date(`${selectedTaskForm.dueDate}T00:00:00`);
          endAt.setHours(endHour, endMinute, 0, 0);
          const duration = Math.max(30, Math.round((endAt.getTime() - startAt.getTime()) / 60000));
          return {
            plannedStartAt: startAt.toISOString(),
            plannedDurationMinutes: duration,
          };
        })()
      : {
          plannedStartAt: null,
          plannedDurationMinutes: null,
        };

    const scheduleRes = await fetch(`/api/tasks/${selectedTask.id}/schedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(schedulePayload),
    });

    setSavingSelectedTask(false);
    if (!scheduleRes.ok) {
      setSelectedTaskError("Task updated, but failed to update time range.");
      return;
    }

    setSelectedTask(null);
    setShowSelectedTaskDueDatePicker(false);
    await refreshMyTasks();
  };

  const onDeleteSelectedTask = async () => {
    if (!selectedTask) return;
    if (!window.confirm("Delete this task?")) return;

    setDeletingSelectedTask(true);
    const response = await fetch(`/api/tasks/${selectedTask.id}`, { method: "DELETE" });
    setDeletingSelectedTask(false);

    if (!response.ok) {
      setSelectedTaskError("Failed to delete task.");
      return;
    }

    setSelectedTask(null);
    setShowSelectedTaskDueDatePicker(false);
    await refreshMyTasks();
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f9fafc_0%,#f3f5fa_48%,#eef2f9_100%)]">
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              RockPit
            </h1>
            <p className="text-sm text-muted-foreground">
              Organize your week with one clear dashboard.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PwaInstallButton />
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push("/planner")}
            >
              <CalendarDays data-icon="inline-start" />
              Planner
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push("/helicopter")}
            >
              <PlaneTakeoff data-icon="inline-start" />
              Helicopter View
            </Button>
            <Badge variant="secondary">{format(new Date(), "EEEE, MMM d")}</Badge>
            <Button size="sm" variant="outline" onClick={() => signOut({ callbackUrl: "/login" })}>
              Sign Out
            </Button>
          </div>
        </header>

        <section className="grid flex-1 gap-6 lg:grid-cols-[22rem_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Calendar</CardTitle>
              <CardDescription>
                Focus date: {format(selectedDate, "PPP")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => setSelectedDate(date ?? new Date())}
                className="w-full rounded-lg border [&_.rdp-months]:w-full [&_.rdp-month]:w-full [&_.rdp-table]:w-full"
                modifiers={{ hasTask: taskDates }}
                modifiersClassNames={{
                  hasTask:
                    "relative after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
                }}
              />
              <Separator />
              <div className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Today Progress</span>
                <Progress value={progressValue} />
                <span className="text-muted-foreground">
                  {doneCount}/{tasks.length} tasks done
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="min-h-[32rem]">
            <CardHeader>
              <CardTitle>Workspace</CardTitle>
              <CardDescription>
                Switch between board overview and today task list.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex items-center justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    if (activeWorkspaceTab === "board") {
                      setShowBoardDueDatePicker(false);
                      setShowBoardModal(true);
                      return;
                    }
                    openTaskModal();
                  }}
                >
                  <Plus data-icon="inline-start" />
                  {activeWorkspaceTab === "board" ? "Add Board" : "Add Task"}
                </Button>
              </div>
              <Tabs
                value={activeWorkspaceTab}
                onValueChange={setActiveWorkspaceTab}
                className="w-full gap-4"
              >
                <TabsList className="inline-flex w-fit">
                  <TabsTrigger value="board">Board</TabsTrigger>
                  <TabsTrigger value="tasks">Tasks</TabsTrigger>
                </TabsList>
                <TabsContent value="board" className="pt-4">
                  {boardsLoading ? (
                    <p className="text-sm text-muted-foreground">Loading boards...</p>
                  ) : boards.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No board yet. Click Add Board to create your first one.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                      {previewBoards.map((board) => (
                        <Link
                          key={board.id}
                          href={`/boards/${board.id}`}
                          className="block"
                        >
                          <Card
                            size="sm"
                            className={`transition-colors hover:bg-muted/70 ${themeClassMap[board.theme] ?? "bg-muted/30"}`}
                          >
                            <CardHeader>
                              <CardTitle>{board.title}</CardTitle>
                              <CardDescription>{board.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{board._count.columns} columns</span>
                              <span>{format(new Date(board.updatedAt), "MMM d, yyyy")}</span>
                            </CardContent>
                            {board.tags.length > 0 ? (
                              <CardContent className="flex flex-wrap gap-1 pt-0">
                                {board.tags.map((tag) => (
                                  <Badge key={tag} variant="outline">
                                    {tag}
                                  </Badge>
                                ))}
                              </CardContent>
                            ) : null}
                          </Card>
                        </Link>
                      ))}
                      </div>
                      <div className="flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => router.push("/boards")}>
                          View all boards
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="tasks" className="pt-4">
                  <div className="space-y-3">
                    <div className="flex flex-col gap-3">
                    {openTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No open tasks assigned to your account.
                      </p>
                    ) : null}
                    {previewTasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => openSelectedTaskModal(task)}
                        className="block cursor-pointer rounded-lg border bg-card px-3 py-3 hover:bg-muted/40"
                      >
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
                            className={
                              task.status === "DONE"
                                ? "flex-1 text-sm text-muted-foreground line-through"
                                : "flex-1 text-sm"
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
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {task.board?.title ?? "Personal Task"}
                          {task.column ? ` • ${task.column.title}` : ""}
                          {task.dueDate
                            ? ` • Due ${format(new Date(task.dueDate), "MMM d, yyyy")}`
                            : ""}
                        </p>
                      </div>
                    ))}
                    </div>
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => router.push("/tasks")}>
                        View all tasks
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </section>
      </main>

      {showBoardModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/35 p-4">
          <Card className="w-full max-w-lg overflow-visible">
            <CardHeader>
              <CardTitle>Create Board</CardTitle>
              <CardDescription>
                Fill board details, then you will be redirected to the new board.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <input
                value={boardForm.title}
                onChange={(event) =>
                  setBoardForm((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Board Name"
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <textarea
                value={boardForm.description}
                onChange={(event) =>
                  setBoardForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Description"
                rows={3}
                className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <select
                value={boardForm.theme}
                onChange={(event) =>
                  setBoardForm((prev) => ({ ...prev, theme: event.target.value }))
                }
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {themes.map((theme) => (
                  <option key={theme} value={theme}>
                    {theme}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      const tag = tagInput.trim();
                      if (!tag) return;
                      if (boardForm.tags.includes(tag)) {
                        setTagInput("");
                        return;
                      }
                      setBoardForm((prev) => ({
                        ...prev,
                        tags: [...prev.tags, tag].slice(0, 10),
                      }));
                      setTagInput("");
                    }
                  }}
                  placeholder="Add tag and press Enter (optional)"
                  className="h-10 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    const tag = tagInput.trim();
                    if (!tag || boardForm.tags.includes(tag)) return;
                    setBoardForm((prev) => ({
                      ...prev,
                      tags: [...prev.tags, tag].slice(0, 10),
                    }));
                    setTagInput("");
                  }}
                >
                  Add Tag
                </Button>
              </div>
              {boardForm.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {boardForm.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setBoardForm((prev) => ({
                          ...prev,
                          tags: prev.tags.filter((item) => item !== tag),
                        }))
                      }
                      className="inline-flex items-center rounded-md border bg-background px-2 py-1 text-xs hover:bg-muted"
                    >
                      {tag} x
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No tags yet (optional).</p>
              )}
              <input
                type="hidden"
                value={boardForm.dueDate}
              />
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setShowBoardDueDatePicker((prev) => !prev)}
                >
                  <CalendarDays data-icon="inline-start" />
                  {boardForm.dueDate
                    ? format(new Date(`${boardForm.dueDate}T00:00:00`), "PPP")
                    : "Select due date (optional)"}
                </Button>
                {showBoardDueDatePicker ? (
                  <div className="absolute left-0 top-11 z-30 rounded-lg border bg-background shadow-lg">
                    <Calendar
                      mode="single"
                      selected={
                        boardForm.dueDate ? new Date(`${boardForm.dueDate}T00:00:00`) : undefined
                      }
                      onSelect={(date) => {
                        if (!date) return;
                        setBoardForm((prev) => ({
                          ...prev,
                          dueDate: format(date, "yyyy-MM-dd"),
                        }));
                        setShowBoardDueDatePicker(false);
                      }}
                    />
                  </div>
                ) : null}
              </div>

              {boardFormError ? (
                <p className="text-sm text-destructive">{boardFormError}</p>
              ) : null}

              <div className="mt-1 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowBoardModal(false);
                    setShowBoardDueDatePicker(false);
                    setBoardFormError(null);
                    setTagInput("");
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={onCreateBoard} disabled={creatingBoard}>
                  {creatingBoard ? "Creating..." : "Create Board"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {showTaskModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/35 p-4">
          <Card className="w-full max-w-lg overflow-visible">
            <CardHeader>
              <CardTitle>Add Task</CardTitle>
              <CardDescription>Create a new task assigned to your account.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={taskForm.boardId}
                  onChange={(event) =>
                    {
                      const nextBoardId = event.target.value;
                      if (!nextBoardId) {
                        setBoardColumnOptions([]);
                      }
                      setTaskForm((prev) => ({
                        ...prev,
                        boardId: nextBoardId,
                        columnId: "",
                      }));
                    }
                  }
                  className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">Personal Task (No Board)</option>
                  {boards.map((board) => (
                    <option key={board.id} value={board.id}>
                      {board.title}
                    </option>
                  ))}
                </select>
                {taskForm.boardId ? (
                  <select
                    value={taskForm.columnId}
                    onChange={(event) =>
                      setTaskForm((prev) => ({ ...prev, columnId: event.target.value }))
                    }
                    className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="">Select column</option>
                    {boardColumnOptions.map((column) => (
                      <option key={column.id} value={column.id}>
                        {column.title}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">
                    Standalone task (not linked to a board)
                  </div>
                )}
              </div>
              <input
                value={taskForm.title}
                onChange={(event) =>
                  setTaskForm((prev) => ({ ...prev, title: event.target.value }))
                }
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
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setShowTaskDueDatePicker((prev) => !prev)}
                  >
                    <CalendarDays data-icon="inline-start" />
                    {taskForm.dueDate
                      ? format(new Date(`${taskForm.dueDate}T00:00:00`), "PPP")
                      : "Select due date (optional)"}
                  </Button>
                  {showTaskDueDatePicker ? (
                    <div className="absolute left-0 top-11 z-30 rounded-lg border bg-background shadow-lg">
                      <Calendar
                        mode="single"
                        selected={
                          taskForm.dueDate ? new Date(`${taskForm.dueDate}T00:00:00`) : undefined
                        }
                        onSelect={(date) => {
                          if (!date) return;
                          setTaskForm((prev) => ({
                            ...prev,
                            dueDate: format(date, "yyyy-MM-dd"),
                          }));
                          setShowTaskDueDatePicker(false);
                        }}
                      />
                    </div>
                  ) : null}
                </div>
                <select
                  value={taskForm.priority}
                  onChange={(event) =>
                    setTaskForm((prev) => ({
                      ...prev,
                      priority: event.target.value as TaskModalForm["priority"],
                    }))
                  }
                  className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                </select>
              </div>

              {taskFormError ? <p className="text-sm text-destructive">{taskFormError}</p> : null}

              <div className="mt-1 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowTaskModal(false);
                    setShowTaskDueDatePicker(false);
                    setTaskFormError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={onCreateTask} disabled={creatingTask}>
                  {creatingTask ? "Creating..." : "Add Task"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {selectedTask ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/35 p-4">
          <Card className="w-full max-w-lg overflow-visible">
            <CardHeader>
              <CardTitle>Edit Task</CardTitle>
              <CardDescription>
                {selectedTask.board?.title ?? "Personal Task"}
                {selectedTask.column ? ` • ${selectedTask.column.title}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <input
                value={selectedTaskForm.title}
                onChange={(event) =>
                  setSelectedTaskForm((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Task title"
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <textarea
                rows={3}
                value={selectedTaskForm.description}
                onChange={(event) =>
                  setSelectedTaskForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Description (optional)"
                className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setShowSelectedTaskDueDatePicker((prev) => !prev)}
                  >
                    <CalendarDays data-icon="inline-start" />
                    {selectedTaskForm.dueDate
                      ? format(new Date(`${selectedTaskForm.dueDate}T00:00:00`), "PPP")
                      : "Select due date"}
                  </Button>
                  {showSelectedTaskDueDatePicker ? (
                    <div className="absolute left-0 top-11 z-30 rounded-lg border bg-background shadow-lg">
                      <Calendar
                        mode="single"
                        selected={
                          selectedTaskForm.dueDate
                            ? new Date(`${selectedTaskForm.dueDate}T00:00:00`)
                            : undefined
                        }
                        onSelect={(date) => {
                          if (!date) return;
                          setSelectedTaskForm((prev) => ({
                            ...prev,
                            dueDate: format(date, "yyyy-MM-dd"),
                          }));
                          setShowSelectedTaskDueDatePicker(false);
                        }}
                      />
                    </div>
                  ) : null}
                </div>
                <select
                  value={selectedTaskForm.priority}
                  onChange={(event) =>
                    setSelectedTaskForm((prev) => ({
                      ...prev,
                      priority: event.target.value as SelectedTaskForm["priority"],
                    }))
                  }
                  className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedTaskForm.useTimeRange}
                  onCheckedChange={(checked) =>
                    setSelectedTaskForm((prev) => ({ ...prev, useTimeRange: checked === true }))
                  }
                />
                <span>Set time range</span>
              </label>

              {selectedTaskForm.useTimeRange ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="time"
                    value={selectedTaskForm.startTime}
                    onChange={(event) =>
                      setSelectedTaskForm((prev) => ({ ...prev, startTime: event.target.value }))
                    }
                    className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                  <input
                    type="time"
                    value={selectedTaskForm.endTime}
                    onChange={(event) =>
                      setSelectedTaskForm((prev) => ({ ...prev, endTime: event.target.value }))
                    }
                    className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </div>
              ) : null}

              {selectedTaskError ? (
                <p className="text-sm text-destructive">{selectedTaskError}</p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Badge variant={selectedTask.status === "DONE" ? "secondary" : "outline"}>
                  {selectedTask.status}
                </Badge>
                {selectedTask.dueDate ? (
                  <Badge variant="outline">
                    Due {format(new Date(selectedTask.dueDate), "MMM d, yyyy")}
                  </Badge>
                ) : null}
              </div>

              <div className="flex justify-between gap-2">
                <Button
                  variant="destructive"
                  onClick={onDeleteSelectedTask}
                  disabled={deletingSelectedTask || savingSelectedTask}
                >
                  {deletingSelectedTask ? "Deleting..." : "Delete"}
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedTask(null);
                      setShowSelectedTaskDueDatePicker(false);
                      setSelectedTaskError(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={onSaveSelectedTask} disabled={savingSelectedTask || deletingSelectedTask}>
                    {savingSelectedTask ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
              {selectedTask.board ? (
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const boardId = selectedTask.board?.id;
                      setSelectedTask(null);
                      if (boardId) router.push(`/boards/${boardId}`);
                    }}
                  >
                    Open Board
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
