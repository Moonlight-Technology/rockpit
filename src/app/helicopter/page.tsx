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
import { ArrowLeft, PlaneTakeoff, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function HelicopterPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());

  useEffect(() => {
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
    void fetchTasks();
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
                  <CardTitle>All Tasks</CardTitle>
                  <CardDescription>Cross-board and standalone tasks.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-3 py-3 font-medium">Task</th>
                          <th className="px-3 py-3 font-medium">Board</th>
                          <th className="px-3 py-3 font-medium">Column</th>
                          <th className="px-3 py-3 font-medium">Priority</th>
                          <th className="px-3 py-3 font-medium">Status</th>
                          <th className="px-3 py-3 font-medium">Due Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.map((task) => (
                          <tr key={task.id} className="border-b last:border-0">
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
    </div>
  );
}
