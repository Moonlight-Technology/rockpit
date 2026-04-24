"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
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

    const refresh = await fetch("/api/tasks/my", { cache: "no-store" });
    const result = await refresh.json();
    if (refresh.ok && result?.ok) {
      setTasks(result.data);
    }
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
            <CardTitle>All Tasks</CardTitle>
            <CardDescription>Tasks assigned to your account.</CardDescription>
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
                    onClick={() => void onToggleTaskStatus(task.id, task.status !== "DONE")}
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
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/boards/${task.board?.id}`)}>
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
    </div>
  );
}
