"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  max as maxDate,
  min as minDate,
  startOfWeek,
} from "date-fns";
import { ArrowLeft, ArrowUpDown, CalendarDays, Pencil, Plus, Settings, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskDatePickerPanel } from "@/components/task-date-picker-panel";

type Member = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
};

type BoardTask = {
  id: string;
  title: string;
  description: string | null;
  startDate: string | null;
  dueDate: string | null;
  plannedStartAt: string | null;
  plannedDurationMinutes: number | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  assignee: Member | null;
  assignees?: { user: Member }[];
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
type ListSortKey = "task" | "column" | "priority" | "dueDate" | "assignee";
type ListStatusFilter = "all" | "open" | "done";
type ListAssigneeFilter = "all" | "unassigned" | string;
type TimelineStatusFilter = "all" | "open" | "done";
type TimelineAssigneeFilter = "all" | "unassigned" | string;
const DONE_COLUMN_TITLE = "done";

function isDoneColumnTitle(title: string) {
  return title.trim().toLowerCase() === DONE_COLUMN_TITLE;
}

function getInitials(name: string) {
  const initials = name
    .split(" ")
    .map((part) => part.trim().charAt(0))
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return initials || "U";
}

function getTaskAssignees(task: BoardTask) {
  if (task.assignees && task.assignees.length > 0) {
    return task.assignees.map((item) => item.user);
  }
  return task.assignee ? [task.assignee] : [];
}

function combineDateAndTime(dateString: string, timeString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  const [hour, minute] = timeString.split(":").map(Number);
  date.setHours(hour, minute, 0, 0);
  return date;
}

type TaskForm = {
  title: string;
  description: string;
  dueDate: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  assigneeIds: string[];
};

type CardEditForm = {
  taskId: string;
  title: string;
  description: string;
  startDate: string;
  dueDate: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  assigneeIds: string[];
  useDateRange: boolean;
  useTimeRange: boolean;
  startTime: string;
  endTime: string;
};

type CardPickerSnapshot = Pick<
  CardEditForm,
  "startDate" | "dueDate" | "useDateRange" | "useTimeRange" | "startTime" | "endTime"
>;

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

function moveColumnLocally(columns: BoardColumn[], movingColumnId: string, toIndex: number) {
  const moving = columns.find((column) => column.id === movingColumnId);
  if (!moving || isDoneColumnTitle(moving.title)) return columns;

  const movable = columns.filter((column) => !isDoneColumnTitle(column.title));
  const remaining = movable.filter((column) => column.id !== movingColumnId);
  const safeIndex = Math.max(0, Math.min(toIndex, remaining.length));
  const reordered = [...remaining];
  reordered.splice(safeIndex, 0, moving);
  const doneColumns = columns.filter((column) => isDoneColumnTitle(column.title));
  return [...reordered, ...doneColumns];
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
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);
  const [columnDragSnapshot, setColumnDragSnapshot] = useState<BoardColumn[] | null>(null);
  const [didColumnDrop, setDidColumnDrop] = useState(false);
  const [columnDragOverId, setColumnDragOverId] = useState<string | null>(null);

  const [taskModalColumnId, setTaskModalColumnId] = useState<string | null>(null);
  const [showTaskDueDatePicker, setShowTaskDueDatePicker] = useState(false);
  const [taskForm, setTaskForm] = useState<TaskForm>({
    title: "",
    description: "",
    dueDate: "",
    priority: "MEDIUM",
    assigneeIds: [],
  });
  const [taskModalError, setTaskModalError] = useState<string | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showCardDueDatePicker, setShowCardDueDatePicker] = useState(false);
  const [cardDatePickerTarget, setCardDatePickerTarget] = useState<"start" | "due">("due");
  const [cardPickerSnapshot, setCardPickerSnapshot] = useState<CardPickerSnapshot | null>(null);
  const [cardEditForm, setCardEditForm] = useState<CardEditForm | null>(null);
  const [cardEditError, setCardEditError] = useState<string | null>(null);

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSettingsDueDatePicker, setShowSettingsDueDatePicker] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [showBoardMembers, setShowBoardMembers] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [activeViewTab, setActiveViewTab] = useState<"board" | "list" | "timeline" | "calendar">(
    "board"
  );
  const [memberEmail, setMemberEmail] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [listSort, setListSort] = useState<{ key: ListSortKey; direction: "asc" | "desc" }>({
    key: "dueDate",
    direction: "asc",
  });
  const [listStatusFilter, setListStatusFilter] = useState<ListStatusFilter>("all");
  const [listAssigneeFilter, setListAssigneeFilter] = useState<ListAssigneeFilter>("all");
  const [timelineStatusFilter, setTimelineStatusFilter] = useState<TimelineStatusFilter>("all");
  const [timelineAssigneeFilter, setTimelineAssigneeFilter] = useState<TimelineAssigneeFilter>("all");
  const [settingsForm, setSettingsForm] = useState<BoardSettingsForm>({
    title: "",
    description: "",
    theme: "Slate",
    tags: [],
    dueDate: "",
  });
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());

  const takeCardPickerSnapshot = (form: CardEditForm): CardPickerSnapshot => ({
    startDate: form.startDate,
    dueDate: form.dueDate,
    useDateRange: form.useDateRange,
    useTimeRange: form.useTimeRange,
    startTime: form.startTime,
    endTime: form.endTime,
  });

  const members = board?.members.map((member) => member.user) ?? [];
  const allTasks = (board?.columns ?? []).flatMap((column) =>
    column.tasks.map((task) => ({
      ...task,
      columnTitle: column.title,
      columnId: column.id,
      isDone: isDoneColumnTitle(column.title),
    }))
  );
  const doneColumnId = board?.columns.find((column) => isDoneColumnTitle(column.title))?.id ?? null;
  const defaultTaskColumnIdForList =
    board?.columns.find((column) => !isDoneColumnTitle(column.title))?.id ??
    board?.columns[0]?.id ??
    null;

  const listTasks = useMemo(() => {
    const filtered = allTasks.filter((task) => {
      const statusPass =
        listStatusFilter === "all" ||
        (listStatusFilter === "done" ? task.isDone : !task.isDone);

      const assigneeIds = getTaskAssignees(task).map((member) => member.id);
      const assigneePass =
        listAssigneeFilter === "all" ||
        (listAssigneeFilter === "unassigned"
          ? assigneeIds.length === 0
          : assigneeIds.includes(listAssigneeFilter));

      return statusPass && assigneePass;
    });

    const priorityRank: Record<BoardTask["priority"], number> = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
    };

    filtered.sort((a, b) => {
      let base = 0;
      if (listSort.key === "task") {
        base = a.title.localeCompare(b.title);
      } else if (listSort.key === "column") {
        base = a.columnTitle.localeCompare(b.columnTitle);
      } else if (listSort.key === "priority") {
        base = priorityRank[a.priority] - priorityRank[b.priority];
      } else if (listSort.key === "dueDate") {
        const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        base = aTime - bTime;
      } else {
        const aAssignee = getTaskAssignees(a).map((member) => member.name).join(", ");
        const bAssignee = getTaskAssignees(b).map((member) => member.name).join(", ");
        base = aAssignee.localeCompare(bAssignee);
      }
      return listSort.direction === "asc" ? base : -base;
    });

    return filtered;
  }, [allTasks, listAssigneeFilter, listSort.direction, listSort.key, listStatusFilter]);
  const taskDueDates = allTasks
    .filter((task) => task.dueDate)
    .map((task) => new Date(task.dueDate as string));
  const tasksForSelectedDate = allTasks.filter((task) =>
    task.dueDate ? isSameDay(new Date(task.dueDate), calendarDate) : false
  );
  const scheduledTimelineTasks = allTasks
    .map((task) => {
      const plannedStart = task.plannedStartAt ? new Date(task.plannedStartAt) : null;
      const plannedEnd =
        plannedStart && task.plannedDurationMinutes
          ? new Date(plannedStart.getTime() + task.plannedDurationMinutes * 60_000)
          : null;
      const startDate = task.startDate ? new Date(task.startDate) : null;
      const dueDate = task.dueDate ? new Date(task.dueDate) : null;

      let start = plannedStart ?? startDate ?? dueDate;
      let end = plannedEnd ?? dueDate ?? startDate ?? plannedStart;
      if (!start || !end) return null;
      if (end.getTime() < start.getTime()) {
        const swap = start;
        start = end;
        end = swap;
      }

      const startDay = new Date(start);
      startDay.setHours(0, 0, 0, 0);
      const endDay = new Date(end);
      endDay.setHours(0, 0, 0, 0);

      return {
        ...task,
        start: startDay,
        end: endDay,
        duration: Math.max(1, differenceInCalendarDays(endDay, startDay) + 1),
      };
    })
    .filter((task): task is NonNullable<typeof task> => task !== null)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const unscheduledTasks = allTasks.filter(
    (task) => !task.dueDate && !task.startDate && !task.plannedStartAt
  );
  const filteredTimelineTasks = useMemo(
    () =>
      scheduledTimelineTasks.filter((task) => {
        const statusPass =
          timelineStatusFilter === "all" ||
          (timelineStatusFilter === "done" ? task.isDone : !task.isDone);
        const assigneeIds = getTaskAssignees(task).map((member) => member.id);
        const assigneePass =
          timelineAssigneeFilter === "all" ||
          (timelineAssigneeFilter === "unassigned"
            ? assigneeIds.length === 0
            : assigneeIds.includes(timelineAssigneeFilter));
        return statusPass && assigneePass;
      }),
    [scheduledTimelineTasks, timelineAssigneeFilter, timelineStatusFilter]
  );
  const filteredUnscheduledTasks = useMemo(
    () =>
      unscheduledTasks.filter((task) => {
        const statusPass =
          timelineStatusFilter === "all" ||
          (timelineStatusFilter === "done" ? task.isDone : !task.isDone);
        const assigneeIds = getTaskAssignees(task).map((member) => member.id);
        const assigneePass =
          timelineAssigneeFilter === "all" ||
          (timelineAssigneeFilter === "unassigned"
            ? assigneeIds.length === 0
            : assigneeIds.includes(timelineAssigneeFilter));
        return statusPass && assigneePass;
      }),
    [timelineAssigneeFilter, timelineStatusFilter, unscheduledTasks]
  );

  const DAY_WIDTH = 44;
  const LEFT_PANEL_WIDTH = 280;
  const today = new Date();

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

  const reorderColumn = async (
    movingColumnId: string,
    toIndex: number,
    fallbackSnapshot?: BoardColumn[]
  ) => {
    if (!board) return;
    const baseColumns = fallbackSnapshot ?? board.columns;
    const movingColumn = baseColumns.find((column) => column.id === movingColumnId);
    if (!movingColumn || isDoneColumnTitle(movingColumn.title)) return;

    const snapshot = baseColumns;
    const updatedColumns = moveColumnLocally(baseColumns, movingColumnId, toIndex);
    setBoard((prev) => (prev ? { ...prev, columns: updatedColumns } : prev));

    const response = await fetch(`/api/boards/${board.id}/columns`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "reorder",
        columnId: movingColumnId,
        toIndex,
      }),
    });

    if (!response.ok) {
      setBoard((prev) => (prev ? { ...prev, columns: snapshot } : prev));
      setColumnDragSnapshot(null);
      setColumnDragOverId(null);
      return;
    }
    setColumnDragSnapshot(null);
    setColumnDragOverId(null);
    await fetchBoard();
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
        assigneeIds: taskForm.assigneeIds,
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
      assigneeIds: [],
    });
    await fetchBoard();
  };

  const openCardModal = (task: BoardTask) => {
    setCardEditError(null);
    setShowCardDueDatePicker(false);
    setCardDatePickerTarget("due");
    const assignees = getTaskAssignees(task);
    const dueDate = task.dueDate ? task.dueDate.slice(0, 10) : "";
    const startDate = task.startDate ? task.startDate.slice(0, 10) : "";
    const plannedStart = task.plannedStartAt ? new Date(task.plannedStartAt) : null;
    const startTime = plannedStart ? format(plannedStart, "HH:mm") : "11:00";
    const endTime =
      plannedStart && task.plannedDurationMinutes
        ? format(new Date(plannedStart.getTime() + task.plannedDurationMinutes * 60_000), "HH:mm")
        : "12:00";
    const nextForm: CardEditForm = {
      taskId: task.id,
      title: task.title,
      description: task.description ?? "",
      startDate,
      dueDate,
      priority: task.priority,
      assigneeIds: assignees.map((member) => member.id),
      useDateRange: Boolean(startDate),
      useTimeRange: Boolean(task.plannedStartAt && task.plannedDurationMinutes),
      startTime,
      endTime,
    };
    setCardEditForm(nextForm);
    setCardPickerSnapshot(takeCardPickerSnapshot(nextForm));
    setShowCardModal(true);
    setShowCardDueDatePicker(true);
  };

  const saveCardEdit = async () => {
    if (!cardEditForm) return;
    if (!cardEditForm.title.trim()) {
      setCardEditError("Task title is required.");
      return;
    }

    setCardEditError(null);
    setSaving(true);

    if (!cardEditForm.dueDate) {
      setSaving(false);
      setCardEditError("Due date is required.");
      return;
    }

    if (cardEditForm.useDateRange && !cardEditForm.startDate) {
      setSaving(false);
      setCardEditError("Start date is required when Start date toggle is active.");
      return;
    }

    const dueAt = cardEditForm.useTimeRange
      ? combineDateAndTime(
          cardEditForm.dueDate,
          cardEditForm.useDateRange ? cardEditForm.endTime : cardEditForm.startTime
        )
      : new Date(`${cardEditForm.dueDate}T00:00:00`);

    const startAt = cardEditForm.useDateRange
      ? cardEditForm.useTimeRange
        ? combineDateAndTime(cardEditForm.startDate, cardEditForm.startTime)
        : new Date(`${cardEditForm.startDate}T00:00:00`)
      : null;

    if (cardEditForm.useDateRange && startAt && dueAt.getTime() < startAt.getTime()) {
      setSaving(false);
      setCardEditError("Due date/time must be later than start date/time.");
      return;
    }

    const assigneeIds = cardEditForm.assigneeIds;
    const response = await fetch(`/api/tasks/${cardEditForm.taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: cardEditForm.title.trim(),
        description: cardEditForm.description.trim() || null,
        startDate: startAt ? startAt.toISOString() : null,
        dueDate: dueAt.toISOString(),
        priority: cardEditForm.priority,
        assigneeIds,
      }),
    });

    if (!response.ok) {
      setSaving(false);
      setCardEditError("Failed to update task.");
      return;
    }

    const schedulePayload = cardEditForm.useTimeRange
      ? (() => {
          const scheduleStart = startAt ?? combineDateAndTime(cardEditForm.dueDate, cardEditForm.startTime);
          const scheduleEnd = cardEditForm.useDateRange
            ? dueAt
            : new Date(scheduleStart.getTime() + 60 * 60_000);
          const duration = Math.max(30, Math.round((scheduleEnd.getTime() - scheduleStart.getTime()) / 60000));
          return {
            plannedStartAt: scheduleStart.toISOString(),
            plannedDurationMinutes: duration,
          };
        })()
      : { plannedStartAt: null, plannedDurationMinutes: null };

    const scheduleResponse = await fetch(`/api/tasks/${cardEditForm.taskId}/schedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(schedulePayload),
    });
    setSaving(false);

    if (!scheduleResponse.ok) {
      setCardEditError("Task saved, but failed to update time range.");
      return;
    }

    setShowCardModal(false);
    setShowCardDueDatePicker(false);
    setCardPickerSnapshot(null);
    setCardEditForm(null);
    await fetchBoard();
  };

  const deleteCardTask = async () => {
    if (!cardEditForm || saving) return;

    const confirmed = window.confirm("Delete this card? This action cannot be undone.");
    if (!confirmed) return;

    setCardEditError(null);
    setSaving(true);
    const response = await fetch(`/api/tasks/${cardEditForm.taskId}`, {
      method: "DELETE",
    });
    setSaving(false);

    if (!response.ok) {
      setCardEditError("Failed to delete task.");
      return;
    }

    setShowCardModal(false);
    setShowCardDueDatePicker(false);
    setCardPickerSnapshot(null);
    setCardEditForm(null);
    await fetchBoard();
  };

  const openAddTaskFromList = () => {
    if (!defaultTaskColumnIdForList) return;
    setTaskModalError(null);
    setShowTaskDueDatePicker(false);
    setTaskModalColumnId(defaultTaskColumnIdForList);
  };

  const toggleListSort = (key: ListSortKey) => {
    setListSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  };

  const setTaskDoneFromList = async (taskId: string) => {
    if (!board || !doneColumnId) return;
    const sourceColumn = board.columns.find((column) => column.tasks.some((task) => task.id === taskId));
    if (!sourceColumn || sourceColumn.id === doneColumnId) return;

    const snapshot = board.columns;
    const updatedColumns = moveTaskLocally(
      board.columns,
      { taskId, fromColumnId: sourceColumn.id },
      doneColumnId
    );
    setBoard((prev) => (prev ? { ...prev, columns: updatedColumns } : prev));

    const doneTasksLength = updatedColumns.find((column) => column.id === doneColumnId)?.tasks.length ?? 0;
    const response = await fetch(`/api/boards/${board.id}/tasks/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId,
        toColumnId: doneColumnId,
        toIndex: Math.max(0, doneTasksLength - 1),
      }),
    });

    if (!response.ok) {
      setBoard((prev) => (prev ? { ...prev, columns: snapshot } : prev));
      return;
    }
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

  const inviteMemberToBoard = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setInviteError("Email is required.");
      return;
    }

    setInviteError(null);
    setInviteSuccess(null);
    setSaving(true);
    const response = await fetch(`/api/boards/${board.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const result = await response.json().catch(() => null);
    setSaving(false);

    if (!response.ok) {
      setInviteError(result?.error?.message ?? "Failed to invite member.");
      return;
    }

    setInviteSuccess("Invitation successful. Board is now visible in that account.");
    setInviteEmail("");
    await fetchBoard();
  };

  return (
    <div className={`min-h-screen ${themeClassMap[board.theme] ?? themeClassMap.Slate}`}>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
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
          <div className="w-full md:w-auto">
            <div className="flex w-full flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBoardMembers((prev) => !prev)}
              >
                <Users data-icon="inline-start" />
                {showBoardMembers ? "Hide Members" : "Show Members"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setInviteError(null);
                  setInviteSuccess(null);
                  setInviteEmail("");
                  setShowInviteModal(true);
                }}
              >
                <UserPlus data-icon="inline-start" />
                Invite
              </Button>
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
        </div>

        {showBoardMembers ? (
          <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
            {members.map((member) => {
              return (
                <div
                  key={member.id}
                  title={`${member.name} (${member.email})`}
                  className="flex items-center gap-2 rounded-full border bg-background px-2 py-1"
                >
                  <span className="grid size-7 place-items-center overflow-hidden rounded-full bg-muted text-xs font-semibold">
                    {member.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={member.avatarUrl} alt={member.name} className="size-full object-cover" />
                    ) : (
                      getInitials(member.name)
                    )}
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">{member.name}</span>
                </div>
              );
            })}
          </div>
        ) : null}

        <Tabs
          value={activeViewTab}
          onValueChange={(value) =>
            setActiveViewTab(value as "board" | "list" | "timeline" | "calendar")
          }
          className="w-full gap-4"
        >
          <TabsList className="inline-flex w-full flex-wrap justify-start md:w-fit">
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>
          <TabsContent value="board" className="pt-2">
            <section className="flex gap-3 overflow-x-auto px-1 py-1 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4">
            {board.columns.map((column) => (
              <Card
                key={column.id}
                draggable={!isDoneColumnTitle(column.title)}
                onDragStart={(event) => {
                  if (isDoneColumnTitle(column.title)) return;
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/column-id", column.id);
                  setDraggingColumnId(column.id);
                  setColumnDragSnapshot(board.columns);
                  setDidColumnDrop(false);
                  setColumnDragOverId(column.id);
                }}
                onDragEnd={() => {
                  if (!didColumnDrop && columnDragSnapshot) {
                    setBoard((prev) => (prev ? { ...prev, columns: columnDragSnapshot } : prev));
                  }
                  setDraggingColumnId(null);
                  setColumnDragSnapshot(null);
                  setDidColumnDrop(false);
                  setColumnDragOverId(null);
                }}
                className={`h-fit min-h-80 w-[16.5rem] shrink-0 bg-muted/30 transition-all duration-200 sm:w-[20rem] ${
                  draggingColumnId === column.id ? "opacity-70" : ""
                } ${
                  columnDragOverId === column.id && draggingColumnId ? "ring-2 ring-primary/40" : ""
                }`}
                onDragOver={(event) => event.preventDefault()}
                onDragEnter={(event) => {
                  const movingColumnId = event.dataTransfer.getData("text/column-id");
                  if (!movingColumnId || isDoneColumnTitle(column.title) || !board) return;
                  setColumnDragOverId(column.id);
                  const base = columnDragSnapshot ?? board.columns;
                  const movableColumns = base.filter((item) => !isDoneColumnTitle(item.title));
                  const targetIndex = movableColumns.findIndex((item) => item.id === column.id);
                  if (targetIndex < 0) return;
                  const preview = moveColumnLocally(base, movingColumnId, targetIndex);
                  setBoard((prev) => (prev ? { ...prev, columns: preview } : prev));
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const movingColumnId = event.dataTransfer.getData("text/column-id");
                  if (movingColumnId) {
                    setDraggingColumnId(null);
                    if (isDoneColumnTitle(column.title)) return;
                    const movableColumns = board.columns.filter((item) => !isDoneColumnTitle(item.title));
                    const targetIndex = movableColumns.findIndex((item) => item.id === column.id);
                    if (targetIndex >= 0) {
                      setDidColumnDrop(true);
                      void reorderColumn(movingColumnId, targetIndex, columnDragSnapshot ?? board.columns);
                    }
                    return;
                  }
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
                        event.stopPropagation();
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
                        {getTaskAssignees(task).length > 0 ? (
                          <div className="ml-auto flex -space-x-2">
                            {getTaskAssignees(task).slice(0, 4).map((member) => (
                              <div
                                key={member.id}
                                title={member.name}
                                className="size-6 overflow-hidden rounded-full border-2 border-background bg-muted"
                              >
                                {member.avatarUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={member.avatarUrl}
                                    alt={member.name}
                                    className="size-full object-cover"
                                  />
                                ) : (
                                  <span className="grid size-full place-items-center text-[10px] font-semibold">
                                    {getInitials(member.name)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : null}
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
              className={`h-fit w-[16.5rem] shrink-0 border-dashed bg-transparent transition-all duration-200 sm:w-[20rem] ${
                columnDragOverId === "add-column-tail" && draggingColumnId ? "ring-2 ring-primary/40" : ""
              }`}
              onDragOver={(event) => event.preventDefault()}
              onDragEnter={(event) => {
                const movingColumnId = event.dataTransfer.getData("text/column-id");
                if (!movingColumnId || !board) return;
                setColumnDragOverId("add-column-tail");
                const base = columnDragSnapshot ?? board.columns;
                const movableColumns = base.filter((item) => !isDoneColumnTitle(item.title));
                const preview = moveColumnLocally(base, movingColumnId, movableColumns.length);
                setBoard((prev) => (prev ? { ...prev, columns: preview } : prev));
              }}
              onDrop={(event) => {
                event.preventDefault();
                const movingColumnId = event.dataTransfer.getData("text/column-id");
                if (!movingColumnId) return;
                setDraggingColumnId(null);
                const movableColumns = board.columns.filter((item) => !isDoneColumnTitle(item.title));
                setDidColumnDrop(true);
                void reorderColumn(movingColumnId, movableColumns.length, columnDragSnapshot ?? board.columns);
              }}
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
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={listStatusFilter}
                      onChange={(event) => setListStatusFilter(event.target.value as ListStatusFilter)}
                      className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <option value="all">All status</option>
                      <option value="open">Open</option>
                      <option value="done">Done</option>
                    </select>
                    <select
                      value={listAssigneeFilter}
                      onChange={(event) => setListAssigneeFilter(event.target.value)}
                      className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <option value="all">All assignees</option>
                      <option value="unassigned">Unassigned</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button size="sm" onClick={openAddTaskFromList} disabled={!defaultTaskColumnIdForList}>
                    <Plus data-icon="inline-start" />
                    Add Task
                  </Button>
                </div>

                {allTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tasks in this board.</p>
                ) : listTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tasks match the active filters.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-3 py-3 font-medium">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 hover:text-foreground"
                              onClick={() => toggleListSort("task")}
                            >
                              Task
                              <ArrowUpDown className="size-3.5" />
                            </button>
                          </th>
                          <th className="px-3 py-3 font-medium">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 hover:text-foreground"
                              onClick={() => toggleListSort("column")}
                            >
                              Column
                              <ArrowUpDown className="size-3.5" />
                            </button>
                          </th>
                          <th className="px-3 py-3 font-medium">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 hover:text-foreground"
                              onClick={() => toggleListSort("priority")}
                            >
                              Priority
                              <ArrowUpDown className="size-3.5" />
                            </button>
                          </th>
                          <th className="px-3 py-3 font-medium">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 hover:text-foreground"
                              onClick={() => toggleListSort("dueDate")}
                            >
                              Due Date
                              <ArrowUpDown className="size-3.5" />
                            </button>
                          </th>
                          <th className="px-3 py-3 font-medium">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 hover:text-foreground"
                              onClick={() => toggleListSort("assignee")}
                            >
                              Assignee
                              <ArrowUpDown className="size-3.5" />
                            </button>
                          </th>
                          <th className="px-3 py-3 text-right font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listTasks.map((task) => (
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
                              {(() => {
                                const assignees = getTaskAssignees(task);
                                return assignees.length > 0
                                  ? assignees.map((member) => member.name).join(", ")
                                  : "Unassigned";
                              })()}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={task.isDone || !doneColumnId || saving}
                                  onClick={() => setTaskDoneFromList(task.id)}
                                >
                                  Set Done
                                </Button>
                                <Button type="button" size="sm" onClick={() => openCardModal(task)}>
                                  View
                                </Button>
                              </div>
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={timelineStatusFilter}
                    onChange={(event) =>
                      setTimelineStatusFilter(event.target.value as TimelineStatusFilter)
                    }
                    className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="all">All status</option>
                    <option value="open">Open</option>
                    <option value="done">Done</option>
                  </select>
                  <select
                    value={timelineAssigneeFilter}
                    onChange={(event) => setTimelineAssigneeFilter(event.target.value)}
                    className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="all">All assignees</option>
                    <option value="unassigned">Unassigned</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button size="sm" onClick={openAddTaskFromList} disabled={!defaultTaskColumnIdForList}>
                  <Plus data-icon="inline-start" />
                  Add Task
                </Button>
              </div>

              {filteredTimelineTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No scheduled tasks match current filters.</p>
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

                    {filteredTimelineTasks.map((task) => {
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
                            <label className="flex items-start gap-2">
                              <Checkbox
                                checked={task.isDone}
                                onCheckedChange={(checked) => {
                                  if (checked === true && !task.isDone) {
                                    void setTaskDoneFromList(task.id);
                                  }
                                }}
                                disabled={task.isDone || !doneColumnId || saving}
                              />
                              <span className={`text-sm font-medium ${task.isDone ? "line-through text-muted-foreground" : ""}`}>
                                {task.title}
                              </span>
                            </label>
                            <p className="text-xs text-muted-foreground">
                              {(() => {
                                const assignees = getTaskAssignees(task);
                                return `${assignees.length > 0 ? assignees.map((member) => member.name).join(", ") : "Unassigned"} • ${task.columnTitle}`;
                              })()}
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
                              className={`absolute top-2 h-10 cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-white ${priorityBarClass[task.priority]}`}
                              style={{
                                left: `${startIndex * DAY_WIDTH + 4}px`,
                                width: `${task.duration * DAY_WIDTH - 8}px`,
                              }}
                              onClick={() => openCardModal(task)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  openCardModal(task);
                                }
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

              {filteredUnscheduledTasks.length > 0 ? (
                <div>
                  <p className="mb-2 text-sm font-medium">Unscheduled Tasks</p>
                  <div className="flex flex-wrap gap-2">
                    {filteredUnscheduledTasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => openCardModal(task)}
                        className="inline-flex h-6 items-center rounded-full border px-2 text-xs hover:bg-muted"
                      >
                        {task.title}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar" className="pt-2">
            <Card>
              <CardHeader>
                <CardTitle>Calendar</CardTitle>
                <CardDescription>Task due dates in this board.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Calendar
                  mode="single"
                  selected={calendarDate}
                  onSelect={(date) => setCalendarDate(date ?? new Date())}
                  className="w-full rounded-lg border p-4 [&_.rdp-months]:w-full [&_.rdp-month]:w-full [&_.rdp-month_caption]:text-base [&_.rdp-nav]:px-1 [&_.rdp-table]:w-full [&_.rdp-weekday]:py-1 [&_.rdp-week]:py-1"
                  modifiers={{ hasTask: taskDueDates }}
                  modifiersClassNames={{
                    hasTask:
                      "relative after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
                  }}
                />
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium">{format(calendarDate, "PPP")}</p>
                  <p className="mb-3 text-xs text-muted-foreground">Tasks due on selected date.</p>
                {tasksForSelectedDate.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tasks due on this day.</p>
                ) : null}
                {tasksForSelectedDate.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => openCardModal(task)}
                      className="mb-2 w-full rounded-md border bg-card px-3 py-2 text-left last:mb-0"
                    >
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.columnTitle}
                      {(() => {
                        const assignees = getTaskAssignees(task);
                        return assignees.length > 0 ? ` • ${assignees.map((member) => member.name).join(", ")}` : "";
                      })()}
                    </p>
                    </button>
                ))}
                </div>
              </CardContent>
            </Card>
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
              <div className="rounded-md border bg-background p-2">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Assignees
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {members.map((member) => {
                    const checked = taskForm.assigneeIds.includes(member.id);
                    return (
                      <label key={member.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            setTaskForm((prev) => ({
                              ...prev,
                              assigneeIds:
                                value === true
                                  ? [...prev.assigneeIds, member.id]
                                  : prev.assigneeIds.filter((id) => id !== member.id),
                            }))
                          }
                        />
                        <span>{member.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/35 p-4 md:p-6">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-3 pt-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Card className="w-full overflow-visible">
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
                    onClick={() => {
                      if (!showCardDueDatePicker && cardEditForm) {
                        setCardPickerSnapshot(takeCardPickerSnapshot(cardEditForm));
                      }
                      setShowCardDueDatePicker(true);
                    }}
                  >
                    <CalendarDays data-icon="inline-start" />
                    {cardEditForm.dueDate
                      ? format(new Date(`${cardEditForm.dueDate}T00:00:00`), "PPP")
                      : "Select due date (optional)"}
                  </Button>
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

              <div className="rounded-md border bg-background p-2">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Assignees
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {members.map((member) => {
                    const checked = cardEditForm.assigneeIds.includes(member.id);
                    return (
                      <label key={member.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            setCardEditForm((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    assigneeIds:
                                      value === true
                                        ? [...prev.assigneeIds, member.id]
                                        : prev.assigneeIds.filter((id) => id !== member.id),
                                  }
                                : prev
                            )
                          }
                        />
                        <span>{member.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              {cardEditError ? <p className="text-sm text-destructive">{cardEditError}</p> : null}
              <div className="mt-1 flex items-center justify-between gap-2">
                <Button variant="destructive" onClick={deleteCardTask} disabled={saving}>
                  {saving ? "Deleting..." : "Delete"}
                </Button>
                <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCardModal(false);
                    setShowCardDueDatePicker(false);
                    setCardPickerSnapshot(null);
                    setCardEditForm(null);
                  }}
                >
                  Close
                </Button>
                <Button onClick={saveCardEdit} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          {showCardDueDatePicker ? (
            <TaskDatePickerPanel
              value={cardEditForm}
              target={cardDatePickerTarget}
              onTargetChange={setCardDatePickerTarget}
              onChange={(next) => setCardEditForm((prev) => (prev ? { ...prev, ...next } : prev))}
              onCancel={() => {
                if (cardPickerSnapshot) {
                  setCardEditForm((prev) =>
                    prev
                      ? {
                          ...prev,
                          ...cardPickerSnapshot,
                        }
                      : prev
                  );
                }
                setShowCardDueDatePicker(false);
              }}
              onConfirm={() => {
                if (cardEditForm) {
                  setCardPickerSnapshot(takeCardPickerSnapshot(cardEditForm));
                }
                setShowCardDueDatePicker(false);
              }}
            />
          ) : null}
          </div>
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

      {showInviteModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/35 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Invite Member</CardTitle>
              <CardDescription>
                Invite user by email so this board appears in their account.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="member@email.com"
                  className="h-10 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <Button onClick={inviteMemberToBoard} disabled={saving}>
                  {saving ? "Inviting..." : "Invite"}
                </Button>
              </div>
              {inviteError ? <p className="text-sm text-destructive">{inviteError}</p> : null}
              {inviteSuccess ? <p className="text-sm text-emerald-600">{inviteSuccess}</p> : null}
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Current Members
                </p>
                <div className="flex flex-wrap gap-2">
                  {members.map((member) => (
                    <Badge key={member.id} variant="outline">
                      {member.name} ({member.email})
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteError(null);
                    setInviteSuccess(null);
                  }}
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
