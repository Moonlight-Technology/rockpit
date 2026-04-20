"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useParams } from "next/navigation";
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
import { ArrowLeft, CalendarDays, Pencil, Plus, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Member = {
  id: string;
  name: string;
  email: string;
};

type BoardTask = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  assignee: Member | null;
  position: number;
};

type BoardColumn = {
  id: string;
  title: string;
  position: number;
  tasks: BoardTask[];
};

type BoardDetail = {
  id: string;
  title: string;
  description: string;
  theme: string;
  tags: string[];
  dueDate: string | null;
  updatedAt: string;
  columns: BoardColumn[];
  members: { user: Member }[];
};

type RenameState = { columnId: string; value: string } | null;
type DragPayload = { taskId: string; fromColumnId: string };
const DONE_COLUMN_TITLE = "done";

function isDoneColumnTitle(title: string) {
  return title.trim().toLowerCase() === DONE_COLUMN_TITLE;
}

type TaskForm = {
  title: string;
  description: string;
  dueDate: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  assigneeId: string;
};

type CardEditForm = {
  taskId: string;
  title: string;
  description: string;
  dueDate: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  assigneeId: string;
};

type BoardSettingsForm = {
  title: string;
  description: string;
  theme: string;
  tags: string[];
  dueDate: string;
};

const themes = ["Slate", "Ocean", "Sunset", "Forest", "Carbon"];

const themeClassMap: Record<string, string> = {
  Slate: "bg-[linear-gradient(180deg,#f9fafc_0%,#f3f5fa_48%,#eef2f9_100%)]",
  Ocean: "bg-[linear-gradient(180deg,#eff7ff_0%,#e5f2ff_45%,#dbecff_100%)]",
  Sunset: "bg-[linear-gradient(180deg,#fff6ef_0%,#ffefe4_45%,#ffe5d6_100%)]",
  Forest: "bg-[linear-gradient(180deg,#f0fbf6_0%,#e4f6ed_45%,#d7efdf_100%)]",
  Carbon: "bg-[linear-gradient(180deg,#f6f6f7_0%,#efeff1_45%,#e7e8eb_100%)]",
};

function moveTaskLocally(columns: BoardColumn[], payload: DragPayload, toColumnId: string) {
  if (payload.fromColumnId === toColumnId) return columns;
  const sourceColumn = columns.find((column) => column.id === payload.fromColumnId);
  const task = sourceColumn?.tasks.find((item) => item.id === payload.taskId);
  if (!task) return columns;

  return columns.map((column) => {
    if (column.id === payload.fromColumnId) {
      return { ...column, tasks: column.tasks.filter((item) => item.id !== payload.taskId) };
    }
    if (column.id === toColumnId) {
      return { ...column, tasks: [...column.tasks, task] };
    }
    return column;
  });
}

export default function BoardDetailPage() {
  const params = useParams<{ id: string }>();
  const boardId = params.id;
  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [renameState, setRenameState] = useState<RenameState>(null);
  const [saving, setSaving] = useState(false);

  const [taskModalColumnId, setTaskModalColumnId] = useState<string | null>(null);
  const [showTaskDueDatePicker, setShowTaskDueDatePicker] = useState(false);
  const [taskForm, setTaskForm] = useState<TaskForm>({
    title: "",
    description: "",
    dueDate: "",
    priority: "MEDIUM",
    assigneeId: "",
  });
  const [taskModalError, setTaskModalError] = useState<string | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showCardDueDatePicker, setShowCardDueDatePicker] = useState(false);
  const [cardEditForm, setCardEditForm] = useState<CardEditForm | null>(null);
  const [cardEditError, setCardEditError] = useState<string | null>(null);

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSettingsDueDatePicker, setShowSettingsDueDatePicker] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [memberEmail, setMemberEmail] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [settingsForm, setSettingsForm] = useState<BoardSettingsForm>({
    title: "",
    description: "",
    theme: "Slate",
    tags: [],
    dueDate: "",
  });
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());

  const members = board?.members.map((member) => member.user) ?? [];
  const allTasks = (board?.columns ?? []).flatMap((column) =>
    column.tasks.map((task) => ({ ...task, columnTitle: column.title }))
  );
  const taskDueDates = allTasks
    .filter((task) => task.dueDate)
    .map((task) => new Date(task.dueDate as string));
  const tasksForSelectedDate = allTasks.filter((task) =>
    task.dueDate ? isSameDay(new Date(task.dueDate), calendarDate) : false
  );
  const timelineTasks = [...allTasks]
    .filter((task) => Boolean(task.dueDate))
    .sort((a, b) => new Date(a.dueDate as string).getTime() - new Date(b.dueDate as string).getTime());
  const unscheduledTasks = allTasks.filter((task) => !task.dueDate);

  const DAY_WIDTH = 44;
  const LEFT_PANEL_WIDTH = 280;
  const today = new Date();
  const scheduledTimelineTasks = timelineTasks.map((task) => {
    const end = new Date(task.dueDate as string);
    const duration = task.priority === "HIGH" ? 4 : task.priority === "MEDIUM" ? 3 : 2;
    const start = addDays(end, -(duration - 1));
    return { ...task, start, end, duration };
  });

  const timelineRangeStart = scheduledTimelineTasks.length
    ? minDate([
        startOfWeek(
          minDate(scheduledTimelineTasks.map((task) => task.start)),
          { weekStartsOn: 1 }
        ),
        startOfWeek(today, { weekStartsOn: 1 }),
      ])
    : startOfWeek(today, { weekStartsOn: 1 });

  const timelineRangeEnd = scheduledTimelineTasks.length
    ? maxDate([
        endOfWeek(
          maxDate(scheduledTimelineTasks.map((task) => task.end)),
          { weekStartsOn: 1 }
        ),
        endOfWeek(today, { weekStartsOn: 1 }),
      ])
    : endOfWeek(today, { weekStartsOn: 1 });

  const timelineDays = eachDayOfInterval({
    start: timelineRangeStart,
    end: timelineRangeEnd,
  });
  const weekChunks: Date[][] = [];
  for (let i = 0; i < timelineDays.length; i += 7) {
    weekChunks.push(timelineDays.slice(i, i + 7));
  }
  const todayIndex = timelineDays.findIndex((day) => isSameDay(day, today));

  const priorityBarClass: Record<"LOW" | "MEDIUM" | "HIGH", string> = {
    LOW: "bg-emerald-500/90",
    MEDIUM: "bg-amber-500/90",
    HIGH: "bg-red-500/90",
  };

  const fetchBoard = useMemo(
    () => async () => {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/boards/${boardId}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result?.ok) {
        setError(result?.error?.message ?? "Failed to load board.");
        setIsLoading(false);
        return;
      }

      setBoard(result.data);
      setSettingsForm({
        title: result.data.title,
        description: result.data.description,
        theme: result.data.theme,
        tags: result.data.tags ?? [],
        dueDate: result.data.dueDate ? result.data.dueDate.slice(0, 10) : "",
      });
      setIsLoading(false);
    },
    [boardId]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchBoard();
  }, [fetchBoard]);

  if (isLoading) {
    return (
      <main className="mx-auto flex min-h-full w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
        <p className="text-sm text-muted-foreground">Loading board...</p>
      </main>
    );
  }

  if (!board) {
    return (
      <main className="mx-auto flex min-h-full w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
        <Link href="/" className={buttonVariants({ variant: "outline", className: "w-fit" })}>
          <ArrowLeft data-icon="inline-start" />
          Back to Home
        </Link>
        <p className="text-sm text-destructive">{error ?? "Board not found."}</p>
      </main>
    );
  }

  const onDropToColumn = async (toColumnId: string, data: string) => {
    const snapshot = board.columns;
    try {
      const payload = JSON.parse(data) as DragPayload;
      if (!payload.taskId || !payload.fromColumnId) return;
      const updatedColumns = moveTaskLocally(board.columns, payload, toColumnId);
      setBoard((prev) => (prev ? { ...prev, columns: updatedColumns } : prev));

      await fetch(`/api/boards/${board.id}/tasks/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: payload.taskId,
          toColumnId,
          toIndex: updatedColumns.find((column) => column.id === toColumnId)?.tasks.length ?? 0,
        }),
      });
    } catch {
      setBoard((prev) => (prev ? { ...prev, columns: snapshot } : prev));
    }
  };

  const addColumn = async () => {
    const title = newColumnTitle.trim();
    if (!title || saving) return;
    setSaving(true);
    const response = await fetch(`/api/boards/${board.id}/columns`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "add", title }),
    });
    setSaving(false);
    if (response.ok) {
      setNewColumnTitle("");
      await fetchBoard();
    }
  };

  const renameColumn = async () => {
    if (!renameState || saving) return;
    const title = renameState.value.trim();
    if (!title) return;
    setSaving(true);
    const response = await fetch(`/api/boards/${board.id}/columns`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "rename", columnId: renameState.columnId, title }),
    });
    setSaving(false);
    if (response.ok) {
      setRenameState(null);
      await fetchBoard();
    }
  };

  const submitTaskModal = async () => {
    if (!taskModalColumnId || !taskForm.title.trim()) {
      setTaskModalError("Task title is required.");
      return;
    }

    setTaskModalError(null);
    setSaving(true);
    const response = await fetch(`/api/boards/${board.id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        columnId: taskModalColumnId,
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || null,
        dueDate: taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : null,
        priority: taskForm.priority,
        assigneeId: taskForm.assigneeId || null,
      }),
    });
    setSaving(false);
    if (!response.ok) {
      setTaskModalError("Failed to add task.");
      return;
    }

    setTaskModalColumnId(null);
    setShowTaskDueDatePicker(false);
    setTaskForm({
      title: "",
      description: "",
      dueDate: "",
      priority: "MEDIUM",
      assigneeId: "",
    });
    await fetchBoard();
  };

  const openCardModal = (task: BoardTask) => {
    setCardEditError(null);
    setShowCardDueDatePicker(false);
    setCardEditForm({
      taskId: task.id,
      title: task.title,
      description: task.description ?? "",
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
      priority: task.priority,
      assigneeId: task.assignee?.id ?? "",
    });
    setShowCardModal(true);
  };

  const saveCardEdit = async () => {
    if (!cardEditForm) return;
    if (!cardEditForm.title.trim()) {
      setCardEditError("Task title is required.");
      return;
    }

    setCardEditError(null);
    setSaving(true);
    const response = await fetch(`/api/tasks/${cardEditForm.taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: cardEditForm.title.trim(),
        description: cardEditForm.description.trim() || null,
        dueDate: cardEditForm.dueDate ? new Date(cardEditForm.dueDate).toISOString() : null,
        priority: cardEditForm.priority,
        assigneeId: cardEditForm.assigneeId || null,
      }),
    });
    setSaving(false);

    if (!response.ok) {
      setCardEditError("Failed to update task.");
      return;
    }

    setShowCardModal(false);
    setShowCardDueDatePicker(false);
    setCardEditForm(null);
    await fetchBoard();
  };

  const saveBoardSettings = async () => {
    setSettingsError(null);
    if (!settingsForm.title.trim() || !settingsForm.description.trim()) {
      setSettingsError("Board name and description are required.");
      return;
    }
    setSaving(true);
    const response = await fetch(`/api/boards/${board.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: settingsForm.title.trim(),
        description: settingsForm.description.trim(),
        theme: settingsForm.theme,
        tags: settingsForm.tags,
        dueDate: settingsForm.dueDate ? new Date(settingsForm.dueDate).toISOString() : null,
      }),
    });
    setSaving(false);
    if (!response.ok) {
      setSettingsError("Failed to update board settings.");
      return;
    }
    setShowSettingsModal(false);
    setShowSettingsDueDatePicker(false);
    await fetchBoard();
  };

  const addMemberByEmail = async () => {
    if (!memberEmail.trim()) return;
    setSaving(true);
    const response = await fetch(`/api/boards/${board.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: memberEmail.trim() }),
    });
    setSaving(false);
    if (!response.ok) {
      setSettingsError("Failed to add member. Ensure the user is already registered.");
      return;
    }
    setMemberEmail("");
    await fetchBoard();
  };

  return (
    <div className={`min-h-screen ${themeClassMap[board.theme] ?? themeClassMap.Slate}`}>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <Link
              href="/"
              className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}
            >
              <ArrowLeft data-icon="inline-start" />
              Back to Home
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{board.title}</h1>
            <p className="text-sm text-muted-foreground">{board.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowSettingsDueDatePicker(false);
                setShowSettingsModal(true);
              }}
            >
              <Settings data-icon="inline-start" />
              Board Settings
            </Button>
            <Badge variant="secondary">Theme: {board.theme}</Badge>
            {board.dueDate ? (
              <Badge variant="outline">Due {new Date(board.dueDate).toLocaleDateString()}</Badge>
            ) : null}
            {board.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        <Tabs defaultValue="board" className="w-full gap-4">
          <TabsList className="inline-flex w-fit">
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>
          <TabsContent value="board" className="pt-2">
            <section className="flex gap-4 overflow-x-auto px-1 py-1 pb-3">
            {board.columns.map((column) => (
              <Card
                key={column.id}
                className="h-fit min-h-80 w-[20rem] shrink-0 bg-muted/30"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const payload = event.dataTransfer.getData("application/json");
                  if (!payload) return;
                  void onDropToColumn(column.id, payload);
                }}
              >
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    {renameState?.columnId === column.id ? (
                      <input
                        value={renameState.value}
                        onChange={(event) =>
                          setRenameState((prev) => (prev ? { ...prev, value: event.target.value } : prev))
                        }
                        onBlur={() => void renameColumn()}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void renameColumn();
                          }
                        }}
                        className="h-8 flex-1 rounded-md border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        autoFocus
                      />
                    ) : (
                      <>
                        <CardTitle>{column.title}</CardTitle>
                        {isDoneColumnTitle(column.title) ? null : (
                          <button
                            type="button"
                            onClick={() => setRenameState({ columnId: column.id, value: column.title })}
                            className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                          >
                            <Pencil className="size-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  <CardDescription>{column.tasks.length} tasks</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {column.tasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onClick={() => openCardModal(task)}
                      onDragStart={(event) => {
                        const payload: DragPayload = { taskId: task.id, fromColumnId: column.id };
                        event.dataTransfer.setData("application/json", JSON.stringify(payload));
                      }}
                      className="cursor-grab rounded-lg bg-card px-3 py-2 text-sm shadow-sm ring-1 ring-foreground/10 active:cursor-grabbing"
                    >
                      <div className="font-medium">{task.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
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
                        {task.dueDate ? (
                          <Badge variant="outline">{format(new Date(task.dueDate), "MMM d")}</Badge>
                        ) : null}
                        {task.assignee ? <Badge variant="outline">{task.assignee.name}</Badge> : null}
                      </div>
                    </div>
                  ))}

                  <div className="mt-2">
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setShowTaskDueDatePicker(false);
                        setTaskModalColumnId(column.id);
                      }}
                    >
                      <Plus data-icon="inline-start" />
                      Add Task
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card
              className="h-fit w-[20rem] shrink-0 border-dashed bg-transparent"
            >
              <CardHeader>
                <CardTitle>Add Column</CardTitle>
                <CardDescription>Create a new workflow column</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <input
                  value={newColumnTitle}
                  onChange={(event) => setNewColumnTitle(event.target.value)}
                  placeholder="Column title"
                  className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <Button size="sm" onClick={addColumn}>
                  <Plus data-icon="inline-start" />
                  Add Column
                </Button>
              </CardContent>
            </Card>
            </section>
          </TabsContent>

          <TabsContent value="list" className="pt-2">
            <Card>
              <CardHeader>
                <CardTitle>Task List</CardTitle>
                <CardDescription>All tasks in this board.</CardDescription>
              </CardHeader>
              <CardContent>
                {allTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tasks in this board.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-3 py-3 font-medium">Task</th>
                          <th className="px-3 py-3 font-medium">Column</th>
                          <th className="px-3 py-3 font-medium">Priority</th>
                          <th className="px-3 py-3 font-medium">Due Date</th>
                          <th className="px-3 py-3 font-medium">Assignee</th>
                          <th className="px-3 py-3 text-right font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allTasks.map((task) => (
                          <tr key={task.id} className="border-b last:border-0">
                            <td className="px-3 py-3 font-medium">{task.title}</td>
                            <td className="px-3 py-3">{task.columnTitle}</td>
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
                            <td className="px-3 py-3 text-muted-foreground">
                              {task.dueDate ? format(new Date(task.dueDate), "MMM d, yyyy") : "-"}
                            </td>
                            <td className="px-3 py-3 text-muted-foreground">
                              {task.assignee?.name ?? "Unassigned"}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <button
                                type="button"
                                className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                aria-label={`Actions for ${task.title}`}
                              >
                                ...
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="pt-2">
            <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Gantt chart visualization of board tasks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {scheduledTimelineTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks with due date yet.</p>
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
                      <div className="flex">
                        {weekChunks.map((chunk) => (
                          <div
                            key={chunk[0].toISOString()}
                            className="border-r px-3 py-3 text-sm font-medium text-muted-foreground"
                            style={{ width: `${chunk.length * DAY_WIDTH}px` }}
                          >
                            Week of {format(chunk[0], "MMM d")}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div
                      className="grid border-b bg-muted/20"
                      style={{
                        gridTemplateColumns: `${LEFT_PANEL_WIDTH}px ${timelineDays.length * DAY_WIDTH}px`,
                      }}
                    >
                      <div className="border-r px-4 py-2 text-xs text-muted-foreground"> </div>
                      <div
                        className="grid"
                        style={{
                          gridTemplateColumns: `repeat(${timelineDays.length}, ${DAY_WIDTH}px)`,
                        }}
                      >
                        {timelineDays.map((day) => (
                          <div
                            key={day.toISOString()}
                            className="border-r px-1 py-2 text-center text-xs text-muted-foreground"
                          >
                            <div>{format(day, "EEE")}</div>
                            <div className="font-medium">{format(day, "d")}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {scheduledTimelineTasks.map((task) => {
                      const startIndex = timelineDays.findIndex((day) =>
                        isSameDay(day, task.start)
                      );

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
                            <p className="text-xs text-muted-foreground">
                              {task.assignee?.name ?? "Unassigned"} • {task.columnTitle}
                            </p>
                          </div>
                          <div className="relative h-14">
                            <div
                              className="absolute inset-0"
                              style={{
                                backgroundImage:
                                  "repeating-linear-gradient(to right, transparent 0, transparent 43px, rgba(148,163,184,0.35) 43px, rgba(148,163,184,0.35) 44px)",
                              }}
                            />
                            {todayIndex >= 0 ? (
                              <div
                                className="absolute top-0 h-full w-[2px] bg-amber-500/90"
                                style={{ left: `${todayIndex * DAY_WIDTH + DAY_WIDTH / 2}px` }}
                              />
                            ) : null}
                            <div
                              className={`absolute top-2 h-10 rounded-md px-2 py-1 text-xs font-medium text-white ${priorityBarClass[task.priority]}`}
                              style={{
                                left: `${startIndex * DAY_WIDTH + 4}px`,
                                width: `${task.duration * DAY_WIDTH - 8}px`,
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

              {unscheduledTasks.length > 0 ? (
                <div>
                  <p className="mb-2 text-sm font-medium">Unscheduled Tasks</p>
                  <div className="flex flex-wrap gap-2">
                    {unscheduledTasks.map((task) => (
                      <Badge key={task.id} variant="outline">
                        {task.title}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar" className="pt-2">
            <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Calendar</CardTitle>
                <CardDescription>Task due dates in this board.</CardDescription>
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
              <CardContent className="flex flex-col gap-2">
                {tasksForSelectedDate.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tasks due on this day.</p>
                ) : null}
                {tasksForSelectedDate.map((task) => (
                  <div key={task.id} className="rounded-md border bg-card px-3 py-2">
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.columnTitle}
                      {task.assignee ? ` • ${task.assignee.name}` : ""}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {taskModalColumnId ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/35 p-4">
          <Card className="w-full max-w-lg overflow-visible">
            <CardHeader>
              <CardTitle>Add Task</CardTitle>
              <CardDescription>Fill task details for this column.</CardDescription>
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
                        selected={taskForm.dueDate ? new Date(`${taskForm.dueDate}T00:00:00`) : undefined}
                        onSelect={(date) => {
                          if (!date) return;
                          setTaskForm((prev) => ({ ...prev, dueDate: format(date, "yyyy-MM-dd") }));
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
                      priority: event.target.value as TaskForm["priority"],
                    }))
                  }
                  className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                </select>
              </div>
              <select
                value={taskForm.assigneeId}
                onChange={(event) => setTaskForm((prev) => ({ ...prev, assigneeId: event.target.value }))}
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.email})
                  </option>
                ))}
              </select>
              {taskModalError ? <p className="text-sm text-destructive">{taskModalError}</p> : null}
              <div className="mt-1 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setTaskModalColumnId(null);
                    setShowTaskDueDatePicker(false);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={submitTaskModal} disabled={saving}>
                  {saving ? "Saving..." : "Add"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {showCardModal && cardEditForm ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/35 p-4">
          <Card className="w-full max-w-lg overflow-visible">
            <CardHeader>
              <CardTitle>Edit Task</CardTitle>
              <CardDescription>Update card information.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <input
                value={cardEditForm.title}
                onChange={(event) =>
                  setCardEditForm((prev) => (prev ? { ...prev, title: event.target.value } : prev))
                }
                placeholder="Task title"
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <textarea
                rows={3}
                value={cardEditForm.description}
                onChange={(event) =>
                  setCardEditForm((prev) =>
                    prev ? { ...prev, description: event.target.value } : prev
                  )
                }
                placeholder="Description"
                className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setShowCardDueDatePicker((prev) => !prev)}
                  >
                    <CalendarDays data-icon="inline-start" />
                    {cardEditForm.dueDate
                      ? format(new Date(`${cardEditForm.dueDate}T00:00:00`), "PPP")
                      : "Select due date (optional)"}
                  </Button>
                  {showCardDueDatePicker ? (
                    <div className="absolute left-0 top-11 z-30 rounded-lg border bg-background shadow-lg">
                      <Calendar
                        mode="single"
                        selected={
                          cardEditForm.dueDate ? new Date(`${cardEditForm.dueDate}T00:00:00`) : undefined
                        }
                        onSelect={(date) => {
                          if (!date) return;
                          setCardEditForm((prev) =>
                            prev ? { ...prev, dueDate: format(date, "yyyy-MM-dd") } : prev
                          );
                          setShowCardDueDatePicker(false);
                        }}
                      />
                    </div>
                  ) : null}
                </div>
                <select
                  value={cardEditForm.priority}
                  onChange={(event) =>
                    setCardEditForm((prev) =>
                      prev
                        ? { ...prev, priority: event.target.value as CardEditForm["priority"] }
                        : prev
                    )
                  }
                  className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                </select>
              </div>
              <select
                value={cardEditForm.assigneeId}
                onChange={(event) =>
                  setCardEditForm((prev) =>
                    prev ? { ...prev, assigneeId: event.target.value } : prev
                  )
                }
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.email})
                  </option>
                ))}
              </select>
              {cardEditError ? <p className="text-sm text-destructive">{cardEditError}</p> : null}
              <div className="mt-1 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCardModal(false);
                    setShowCardDueDatePicker(false);
                    setCardEditForm(null);
                  }}
                >
                  Close
                </Button>
                <Button onClick={saveCardEdit} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {showSettingsModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/35 p-4">
          <Card className="w-full max-w-2xl overflow-visible">
            <CardHeader>
              <CardTitle>Board Settings</CardTitle>
              <CardDescription>Update board info and assign members by email.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <input
                value={settingsForm.title}
                onChange={(event) => setSettingsForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Board name"
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <textarea
                rows={3}
                value={settingsForm.description}
                onChange={(event) => setSettingsForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Description"
                className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={settingsForm.theme}
                  onChange={(event) => setSettingsForm((prev) => ({ ...prev, theme: event.target.value }))}
                  className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {themes.map((theme) => (
                    <option key={theme} value={theme}>
                      {theme}
                    </option>
                  ))}
                </select>
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setShowSettingsDueDatePicker((prev) => !prev)}
                  >
                    <CalendarDays data-icon="inline-start" />
                    {settingsForm.dueDate
                      ? format(new Date(`${settingsForm.dueDate}T00:00:00`), "PPP")
                      : "Select due date (optional)"}
                  </Button>
                  {showSettingsDueDatePicker ? (
                    <div className="absolute left-0 top-11 z-30 rounded-lg border bg-background shadow-lg">
                      <Calendar
                        mode="single"
                        selected={
                          settingsForm.dueDate ? new Date(`${settingsForm.dueDate}T00:00:00`) : undefined
                        }
                        onSelect={(date) => {
                          if (!date) return;
                          setSettingsForm((prev) => ({ ...prev, dueDate: format(date, "yyyy-MM-dd") }));
                          setShowSettingsDueDatePicker(false);
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  placeholder="Add tag"
                  className="h-10 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    const tag = tagInput.trim();
                    if (!tag || settingsForm.tags.includes(tag)) return;
                    setSettingsForm((prev) => ({ ...prev, tags: [...prev.tags, tag].slice(0, 10) }));
                    setTagInput("");
                  }}
                >
                  Add Tag
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {settingsForm.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setSettingsForm((prev) => ({ ...prev, tags: prev.tags.filter((item) => item !== tag) }))
                    }
                    className="inline-flex items-center rounded-md border bg-background px-2 py-1 text-xs hover:bg-muted"
                  >
                    {tag} x
                  </button>
                ))}
              </div>

              <div className="mt-2 border-t pt-3">
                <p className="mb-2 text-sm font-medium">Assign Board Member</p>
                <div className="flex gap-2">
                  <input
                    value={memberEmail}
                    onChange={(event) => setMemberEmail(event.target.value)}
                    placeholder="member@email.com"
                    className="h-10 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                  <Button variant="outline" onClick={addMemberByEmail}>
                    Add Member
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {members.map((member) => (
                    <Badge key={member.id} variant="outline">
                      {member.name} ({member.email})
                    </Badge>
                  ))}
                </div>
              </div>

              {settingsError ? <p className="text-sm text-destructive">{settingsError}</p> : null}
              <div className="mt-1 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSettingsModal(false);
                    setShowSettingsDueDatePicker(false);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={saveBoardSettings} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
