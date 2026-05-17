import { differenceInCalendarDays, isSameDay } from "date-fns";

export type HelicopterDashboardTaskBase = {
  id: string;
  title: string;
  dueDate: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "TODO" | "DONE";
  board: { id: string; title: string } | null;
  column: { id: string; title: string } | null;
};

export type RiskBucketId = "today" | "tomorrow" | "next3Days";

export type RiskBucket = {
  id: RiskBucketId;
  label: "Today" | "Tomorrow" | "Next 3 Days";
  count: number;
  preview: HelicopterDashboardTaskBase[];
  tasks: HelicopterDashboardTaskBase[];
};

export type TypedRiskBucket<T extends HelicopterDashboardTaskBase> = {
  id: RiskBucketId;
  label: RiskBucket["label"];
  count: number;
  preview: T[];
  tasks: T[];
};

export type OverloadProjectRow = {
  id: string;
  title: string;
  dueSoonCount: number;
  openCount: number;
};

export type CompletionSnapshotRow = {
  id: string;
  title: string;
  openCount: number;
  doneCount: number;
};

export type SignalSummary = {
  openCount: number;
  dueSoonCount: number;
  personalCount: number;
  boardCount: number;
};

const priorityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;

function sortTasks<T extends HelicopterDashboardTaskBase>(tasks: T[]) {
  return [...tasks].sort((a, b) => {
    const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    if (aDue !== bDue) return aDue - bDue;

    return a.title.localeCompare(b.title);
  });
}

function buildTypedRiskBucket<T extends HelicopterDashboardTaskBase>(
  id: RiskBucketId,
  label: RiskBucket["label"],
  tasks: T[]
): TypedRiskBucket<T> {
  const sortedTasks = sortTasks(tasks);
  return {
    id,
    label,
    count: sortedTasks.length,
    preview: sortedTasks.slice(0, 4),
    tasks: sortedTasks,
  };
}

export function buildHelicopterDashboardData<T extends HelicopterDashboardTaskBase>(
  tasks: T[],
  now = new Date()
): {
  buckets: TypedRiskBucket<T>[];
  overloadProjects: OverloadProjectRow[];
  completionSnapshot: CompletionSnapshotRow[];
  signalSummary: SignalSummary;
} {
  const openTasks = tasks.filter((task) => task.status === "TODO");

  const todayTasks = openTasks.filter(
    (task) => task.dueDate && isSameDay(new Date(task.dueDate), now)
  );
  const tomorrowTasks = openTasks.filter(
    (task) =>
      task.dueDate &&
      differenceInCalendarDays(new Date(task.dueDate), now) === 1
  );
  const next3DaysTasks = openTasks.filter((task) => {
    if (!task.dueDate) return false;
    const dayDiff = differenceInCalendarDays(new Date(task.dueDate), now);
    return dayDiff >= 2 && dayDiff <= 3;
  });

  const dueSoonTasks = [...todayTasks, ...tomorrowTasks, ...next3DaysTasks];
  const completionMap = new Map<string, CompletionSnapshotRow>();
  const dueSoonByBoard = new Map<string, OverloadProjectRow>();

  for (const task of tasks) {
    const boardId = task.board?.id ?? "personal";
    const boardTitle = task.board?.title ?? "Personal";
    const current = completionMap.get(boardId) ?? {
      id: boardId,
      title: boardTitle,
      openCount: 0,
      doneCount: 0,
    };

    if (task.status === "DONE") current.doneCount += 1;
    else current.openCount += 1;

    completionMap.set(boardId, current);
  }

  for (const task of dueSoonTasks) {
    if (!task.board?.id) continue;

    const current = dueSoonByBoard.get(task.board.id) ?? {
      id: task.board.id,
      title: task.board.title,
      dueSoonCount: 0,
      openCount: completionMap.get(task.board.id)?.openCount ?? 0,
    };

    current.dueSoonCount += 1;
    dueSoonByBoard.set(task.board.id, current);
  }

  return {
    buckets: [
      buildTypedRiskBucket("today", "Today", todayTasks),
      buildTypedRiskBucket("tomorrow", "Tomorrow", tomorrowTasks),
      buildTypedRiskBucket("next3Days", "Next 3 Days", next3DaysTasks),
    ],
    overloadProjects: [...dueSoonByBoard.values()].sort((a, b) => {
      if (b.dueSoonCount !== a.dueSoonCount) return b.dueSoonCount - a.dueSoonCount;
      if (b.openCount !== a.openCount) return b.openCount - a.openCount;
      return a.title.localeCompare(b.title);
    }),
    completionSnapshot: [...completionMap.values()]
      .sort((a, b) => {
        if (b.openCount !== a.openCount) return b.openCount - a.openCount;
        return a.title.localeCompare(b.title);
      })
      .slice(0, 4),
    signalSummary: {
      openCount: openTasks.length,
      dueSoonCount: dueSoonTasks.length,
      personalCount: openTasks.filter((task) => !task.board).length,
      boardCount: openTasks.filter((task) => Boolean(task.board)).length,
    },
  };
}
