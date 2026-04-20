"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { addDays, format, isSameDay, setHours, setMinutes, startOfDay } from "date-fns";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  GripVertical,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "DONE";
  priority: "HIGH" | "MEDIUM" | "LOW";
  dueDate: string | null;
  plannedStartAt: string | null;
  plannedDurationMinutes: number | null;
  assignee: { id: string; name: string; email: string } | null;
  board: { id: string; title: string } | null;
};

type AddTaskForm = {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate: string;
};

type EditTaskForm = {
  taskId: string;
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate: string;
  assigneeId: string | null;
};

type ResizeState = {
  taskId: string;
  startY: number;
  baseDurationMinutes: number;
  startHour: number;
};

const START_HOUR = 8;
const END_HOUR_EXCLUSIVE = 20;
const ROW_HEIGHT = 56;

const initialTaskForm: AddTaskForm = {
  title: "",
  description: "",
  priority: "MEDIUM",
  dueDate: "",
};

function timezoneLabel() {
  const offset = -new Date().getTimezoneOffset() / 60;
  const sign = offset >= 0 ? "+" : "-";
  return `GMT${sign}${Math.abs(offset)}`;
}

function hourLabel(hour: number) {
  const date = setMinutes(setHours(new Date(), hour), 0);
  return format(date, "h a");
}

function toDateInputValue(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function PlannerPage() {
  const plannerGridRef = useRef<HTMLDivElement | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [showMainDatePicker, setShowMainDatePicker] = useState(false);
  const [now, setNow] = useState<Date>(new Date());
  const [resizing, setResizing] = useState<ResizeState | null>(null);
  const [draftDurationMinutes, setDraftDurationMinutes] = useState<Record<string, number>>({});

  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showAddDatePicker, setShowAddDatePicker] = useState(false);
  const [addTaskError, setAddTaskError] = useState<string | null>(null);
  const [addingTask, setAddingTask] = useState(false);
  const [addTaskForm, setAddTaskForm] = useState<AddTaskForm>({
    ...initialTaskForm,
    dueDate: toDateInputValue(new Date()),
  });

  const [editTaskForm, setEditTaskForm] = useState<EditTaskForm | null>(null);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [editTaskError, setEditTaskError] = useState<string | null>(null);
  const [updatingTask, setUpdatingTask] = useState(false);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchTasks();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const hours = useMemo(
    () => Array.from({ length: END_HOUR_EXCLUSIVE - START_HOUR }, (_, idx) => START_HOUR + idx),
    []
  );

  const dueOnSelectedDate = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.status !== "DONE" &&
          task.dueDate &&
          isSameDay(new Date(task.dueDate), selectedDate)
      ),
    [tasks, selectedDate]
  );

  const scheduledBlocks = useMemo(
    () =>
      dueOnSelectedDate
        .filter(
          (task) => task.plannedStartAt && isSameDay(new Date(task.plannedStartAt), selectedDate)
        )
        .map((task) => ({
          ...task,
          startHour: new Date(task.plannedStartAt as string).getHours(),
          durationMinutes:
            draftDurationMinutes[task.id] ?? Math.max(60, task.plannedDurationMinutes ?? 60),
        }))
        .filter((task) => task.startHour >= START_HOUR && task.startHour < END_HOUR_EXCLUSIVE)
        .sort((a, b) => a.startHour - b.startHour),
    [dueOnSelectedDate, draftDurationMinutes, selectedDate]
  );

  const unscheduledTasks = useMemo(
    () =>
      dueOnSelectedDate.filter(
        (task) => !task.plannedStartAt || !isSameDay(new Date(task.plannedStartAt), selectedDate)
      ),
    [dueOnSelectedDate, selectedDate]
  );

  const patchTaskSchedule = async (
    taskId: string,
    plannedStartAt: string | null,
    plannedDurationMinutes: number | null
  ) => {
    setSavingTaskId(taskId);
    const response = await fetch(`/api/tasks/${taskId}/schedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plannedStartAt, plannedDurationMinutes }),
    });
    setSavingTaskId(null);
    return response.ok;
  };

  const moveTaskToHour = async (taskId: string, hour: number) => {
    const nextDate = setMinutes(setHours(new Date(selectedDate), hour), 0);
    const snapshot = tasks;
    const existingTask = snapshot.find((task) => task.id === taskId);
    const durationMinutes = Math.max(60, existingTask?.plannedDurationMinutes ?? 60);

    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              plannedStartAt: nextDate.toISOString(),
              plannedDurationMinutes: durationMinutes,
            }
          : task
      )
    );

    const ok = await patchTaskSchedule(taskId, nextDate.toISOString(), durationMinutes);
    if (!ok) {
      setTasks(snapshot);
    }
  };

  const unscheduleTask = async (taskId: string) => {
    const snapshot = tasks;

    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              plannedStartAt: null,
              plannedDurationMinutes: null,
            }
          : task
      )
    );

    const ok = await patchTaskSchedule(taskId, null, null);
    if (!ok) {
      setTasks(snapshot);
    }
  };

  const onDropTaskIntoPlanner = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const taskId =
      event.dataTransfer.getData("text/task-id") || event.dataTransfer.getData("text/plain");
    if (!taskId || !plannerGridRef.current) return;

    const rect = plannerGridRef.current.getBoundingClientRect();
    const relativeY = event.clientY - rect.top;
    const slot = clamp(Math.floor(relativeY / ROW_HEIGHT), 0, hours.length - 1);
    const hour = START_HOUR + slot;
    void moveTaskToHour(taskId, hour);
  };

  useEffect(() => {
    if (!resizing) return;

    const onMouseMove = (event: MouseEvent) => {
      const deltaHours = Math.round((event.clientY - resizing.startY) / ROW_HEIGHT);
      const maxDurationMinutes = Math.max(60, (END_HOUR_EXCLUSIVE - resizing.startHour) * 60);
      const nextDuration = clamp(
        resizing.baseDurationMinutes + deltaHours * 60,
        60,
        maxDurationMinutes
      );
      setDraftDurationMinutes((prev) => ({ ...prev, [resizing.taskId]: nextDuration }));
    };

    const onMouseUp = () => {
      const task = tasks.find((item) => item.id === resizing.taskId);
      const nextDuration = draftDurationMinutes[resizing.taskId] ?? resizing.baseDurationMinutes;
      setResizing(null);

      if (!task?.plannedStartAt) return;
      if ((task.plannedDurationMinutes ?? 60) === nextDuration) return;

      const snapshot = tasks;
      setTasks((current) =>
        current.map((item) =>
          item.id === resizing.taskId ? { ...item, plannedDurationMinutes: nextDuration } : item
        )
      );

      void (async () => {
        const ok = await patchTaskSchedule(resizing.taskId, task.plannedStartAt, nextDuration);
        if (!ok) {
          setTasks(snapshot);
        }
      })();
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [draftDurationMinutes, resizing, tasks]);

  const openAddTaskModal = () => {
    setAddTaskError(null);
    setShowAddDatePicker(false);
    setAddTaskForm({
      ...initialTaskForm,
      dueDate: toDateInputValue(selectedDate),
    });
    setShowAddTaskModal(true);
  };

  const submitAddTask = async () => {
    setAddTaskError(null);
    if (!addTaskForm.title.trim()) {
      setAddTaskError("Task title is required.");
      return;
    }

    setAddingTask(true);
    const due = new Date(`${addTaskForm.dueDate}T12:00:00`);
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: addTaskForm.title.trim(),
        description: addTaskForm.description.trim() || null,
        priority: addTaskForm.priority,
        dueDate: due.toISOString(),
      }),
    });
    setAddingTask(false);

    if (!response.ok) {
      setAddTaskError("Failed to add task.");
      return;
    }

    setShowAddTaskModal(false);
    setShowAddDatePicker(false);
    await fetchTasks();
  };

  const openEditTaskModal = (task: Task) => {
    setEditTaskError(null);
    setShowEditDatePicker(false);
    setEditTaskForm({
      taskId: task.id,
      title: task.title,
      description: task.description ?? "",
      priority: task.priority,
      dueDate: task.dueDate ? toDateInputValue(new Date(task.dueDate)) : toDateInputValue(selectedDate),
      assigneeId: task.assignee?.id ?? null,
    });
  };

  const submitEditTask = async () => {
    if (!editTaskForm) return;
    setEditTaskError(null);

    if (!editTaskForm.title.trim()) {
      setEditTaskError("Task title is required.");
      return;
    }

    setUpdatingTask(true);
    const due = new Date(`${editTaskForm.dueDate}T12:00:00`);
    const response = await fetch(`/api/tasks/${editTaskForm.taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTaskForm.title.trim(),
        description: editTaskForm.description.trim() || null,
        dueDate: due.toISOString(),
        priority: editTaskForm.priority,
        assigneeId: editTaskForm.assigneeId,
      }),
    });
    setUpdatingTask(false);

    if (!response.ok) {
      setEditTaskError("Failed to update task.");
      return;
    }

    setEditTaskForm(null);
    setShowEditDatePicker(false);
    await fetchTasks();
  };

  const showCurrentTimeLine = isSameDay(selectedDate, now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const plannerStartMinutes = START_HOUR * 60;
  const plannerEndMinutes = END_HOUR_EXCLUSIVE * 60;
  const isNowInsidePlanner = nowMinutes >= plannerStartMinutes && nowMinutes <= plannerEndMinutes;
  const nowLineTop =
    12 + ((nowMinutes - plannerStartMinutes) / 60) * ROW_HEIGHT;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f9fafc_0%,#f3f5fa_48%,#eef2f9_100%)] text-zinc-900">
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}
            >
              <ArrowLeft data-icon="inline-start" />
              Back to Home
            </Link>
            <Badge variant="secondary">
              <CalendarDays data-icon="inline-start" />
              Planner
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">{timezoneLabel()}</div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock3 className="size-5 text-violet-500" />
                    Day Planner
                  </CardTitle>
                  <CardDescription>{format(selectedDate, "EEEE, MMM d, yyyy")}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedDate((prev) => startOfDay(addDays(prev, -1)));
                      setShowMainDatePicker(false);
                    }}
                  >
                    <ChevronLeft data-icon="inline-start" />
                    Back
                  </Button>
                  <div className="relative">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowMainDatePicker((prev) => !prev)}
                      aria-label="Open date picker"
                    >
                      <CalendarDays />
                    </Button>
                    {showMainDatePicker ? (
                      <div className="absolute right-0 top-11 z-30 rounded-lg border bg-background shadow-lg">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => {
                            setSelectedDate(startOfDay(date ?? new Date()));
                            setShowMainDatePicker(false);
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedDate(startOfDay(new Date()));
                      setShowMainDatePicker(false);
                    }}
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedDate((prev) => startOfDay(addDays(prev, 1)));
                      setShowMainDatePicker(false);
                    }}
                  >
                    Next
                    <ChevronRight data-icon="inline-end" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div
                ref={plannerGridRef}
                onDragOver={(event) => event.preventDefault()}
                onDrop={onDropTaskIntoPlanner}
                className="relative rounded-lg border bg-background p-3"
                style={{ height: `${hours.length * ROW_HEIGHT + 24}px` }}
              >
                {hours.map((hour, idx) => (
                  <div
                    key={hour}
                    className="absolute left-3 right-3 grid grid-cols-[72px_1fr] items-start border-t first:border-t-0 pointer-events-none"
                    style={{ top: `${12 + idx * ROW_HEIGHT}px`, height: `${ROW_HEIGHT}px` }}
                  >
                    <div className="pt-1 text-xs text-muted-foreground">{hourLabel(hour)}</div>
                    <div className="h-full border-l" />
                  </div>
                ))}

                {showCurrentTimeLine && isNowInsidePlanner ? (
                  <div
                    className="pointer-events-none absolute left-3 right-3 z-20"
                    style={{ top: `${nowLineTop}px` }}
                  >
                    <div className="grid grid-cols-[72px_1fr] items-center gap-0">
                      <span className="pr-2 text-right text-[10px] font-medium text-rose-500">
                        {format(now, "h:mm a")}
                      </span>
                      <div className="h-[2px] bg-rose-500/80" />
                    </div>
                  </div>
                ) : null}

                <div className="absolute inset-0 left-[88px] top-3 right-3 bottom-3">
                  {scheduledBlocks.map((task) => {
                    const topIndex = task.startHour - START_HOUR;
                    const durationHours = Math.max(1, Math.round(task.durationMinutes / 60));
                    const endHour = Math.min(task.startHour + durationHours, END_HOUR_EXCLUSIVE);
                    const timeRange = `${hourLabel(task.startHour)} - ${hourLabel(endHour)}`;
                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/task-id", task.id);
                          event.dataTransfer.setData("text/plain", task.id);
                        }}
                        className="absolute left-2 right-2 cursor-grab rounded-md border border-violet-300 bg-violet-50 px-2 py-1.5 pb-5 shadow-sm active:cursor-grabbing"
                        style={{
                          top: `${topIndex * ROW_HEIGHT + 4}px`,
                          height: `${durationHours * ROW_HEIGHT - 8}px`,
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-xs font-medium">{task.title}</p>
                          <span className="shrink-0 text-[10px] font-medium text-violet-700">
                            {timeRange}
                          </span>
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {task.board?.title ?? "Personal"}
                          {savingTaskId === task.id ? " • Saving..." : ""}
                        </p>
                        <button
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setResizing({
                              taskId: task.id,
                              startY: event.clientY,
                              baseDurationMinutes: task.durationMinutes,
                              startHour: task.startHour,
                            });
                          }}
                          className="absolute bottom-0 left-0 right-0 flex h-4 items-center justify-center rounded-b-md bg-violet-100/90 text-violet-700"
                          aria-label={`Resize ${task.title}`}
                        >
                          <GripVertical className="size-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const taskId =
                event.dataTransfer.getData("text/task-id") || event.dataTransfer.getData("text/plain");
              if (!taskId) return;
              void unscheduleTask(taskId);
            }}
          >
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>Tasks ({format(selectedDate, "MMM d")})</CardTitle>
                  <CardDescription>Due date sesuai hari yang dipilih.</CardDescription>
                </div>
                <Button size="sm" onClick={openAddTaskModal}>
                  <Plus data-icon="inline-start" />
                  Add Task
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? <p className="text-sm text-muted-foreground">Loading tasks...</p> : null}
              {!loading && unscheduledTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Semua task hari ini sudah terjadwal.</p>
              ) : null}

              {unscheduledTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  draggable
                  onClick={() => openEditTaskModal(task)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/task-id", task.id);
                    event.dataTransfer.setData("text/plain", task.id);
                  }}
                  className="w-full rounded-lg border bg-card px-3 py-2 text-left hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{task.title}</span>
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
                    {savingTaskId === task.id ? " • Saving..." : ""}
                  </p>
                </button>
              ))}
            </CardContent>
          </Card>
        </section>
      </main>

      {showAddTaskModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/35 p-4">
          <Card className="w-full max-w-lg overflow-visible">
            <CardHeader>
              <CardTitle>Add Task</CardTitle>
              <CardDescription>Create personal task for selected date.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <input
                value={addTaskForm.title}
                onChange={(event) => setAddTaskForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Task title"
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <textarea
                rows={3}
                value={addTaskForm.description}
                onChange={(event) => setAddTaskForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Description (optional)"
                className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setShowAddDatePicker((prev) => !prev)}
                  >
                    <CalendarDays data-icon="inline-start" />
                    {format(new Date(`${addTaskForm.dueDate}T00:00:00`), "PPP")}
                  </Button>
                  {showAddDatePicker ? (
                    <div className="absolute left-0 top-11 z-30 rounded-lg border bg-background shadow-lg">
                      <Calendar
                        mode="single"
                        selected={new Date(`${addTaskForm.dueDate}T00:00:00`)}
                        onSelect={(date) => {
                          if (!date) return;
                          setAddTaskForm((prev) => ({ ...prev, dueDate: toDateInputValue(date) }));
                          setShowAddDatePicker(false);
                        }}
                      />
                    </div>
                  ) : null}
                </div>
                <select
                  value={addTaskForm.priority}
                  onChange={(event) =>
                    setAddTaskForm((prev) => ({
                      ...prev,
                      priority: event.target.value as AddTaskForm["priority"],
                    }))
                  }
                  className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                </select>
              </div>

              {addTaskError ? <p className="text-sm text-destructive">{addTaskError}</p> : null}

              <div className="mt-1 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddTaskModal(false);
                    setShowAddDatePicker(false);
                    setAddTaskError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={submitAddTask} disabled={addingTask}>
                  {addingTask ? "Adding..." : "Add"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {editTaskForm ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/35 p-4">
          <Card className="w-full max-w-lg overflow-visible">
            <CardHeader>
              <CardTitle>Edit Task</CardTitle>
              <CardDescription>Update task details.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <input
                value={editTaskForm.title}
                onChange={(event) =>
                  setEditTaskForm((prev) => (prev ? { ...prev, title: event.target.value } : prev))
                }
                placeholder="Task title"
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <textarea
                rows={3}
                value={editTaskForm.description}
                onChange={(event) =>
                  setEditTaskForm((prev) => (prev ? { ...prev, description: event.target.value } : prev))
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
                    onClick={() => setShowEditDatePicker((prev) => !prev)}
                  >
                    <CalendarDays data-icon="inline-start" />
                    {format(new Date(`${editTaskForm.dueDate}T00:00:00`), "PPP")}
                  </Button>
                  {showEditDatePicker ? (
                    <div className="absolute left-0 top-11 z-30 rounded-lg border bg-background shadow-lg">
                      <Calendar
                        mode="single"
                        selected={new Date(`${editTaskForm.dueDate}T00:00:00`)}
                        onSelect={(date) => {
                          if (!date) return;
                          setEditTaskForm((prev) =>
                            prev ? { ...prev, dueDate: toDateInputValue(date) } : prev
                          );
                          setShowEditDatePicker(false);
                        }}
                      />
                    </div>
                  ) : null}
                </div>
                <select
                  value={editTaskForm.priority}
                  onChange={(event) =>
                    setEditTaskForm((prev) =>
                      prev
                        ? { ...prev, priority: event.target.value as EditTaskForm["priority"] }
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

              {editTaskError ? <p className="text-sm text-destructive">{editTaskError}</p> : null}

              <div className="mt-1 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditTaskForm(null);
                    setShowEditDatePicker(false);
                    setEditTaskError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={submitEditTask} disabled={updatingTask}>
                  {updatingTask ? "Saving..." : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
