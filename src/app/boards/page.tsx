"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type BoardListItem = {
  id: string;
  title: string;
  description: string;
  theme: string;
  tags: string[];
  dueDate: string | null;
  closedAt: string | null;
  updatedAt: string;
  columns: {
    title: string;
    tasks: { status: "TODO" | "DONE" }[];
  }[];
  _count: { columns: number };
};

type SortKey = "updatedAt" | "dueDate" | "progress";
type BoardScope = "open" | "all";

const themeClassMap: Record<string, string> = {
  Slate: "border-slate-300/80 bg-slate-50/60",
  Ocean: "border-sky-300/80 bg-sky-50/70",
  Sunset: "border-orange-300/80 bg-orange-50/70",
  Forest: "border-emerald-300/80 bg-emerald-50/70",
  Carbon: "border-zinc-300/80 bg-zinc-50/70",
};

export default function AllBoardsPage() {
  const router = useRouter();
  const [boards, setBoards] = useState<BoardListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTitle, setSearchTitle] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("updatedAt");
  const [boardScope, setBoardScope] = useState<BoardScope>("open");

  useEffect(() => {
    const fetchBoards = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/boards?scope=${boardScope}`, { cache: "no-store" });
        const result = await response.json();
        if (response.ok && result?.ok) {
          setBoards(result.data);
        }
      } finally {
        setLoading(false);
      }
    };
    void fetchBoards();
  }, [boardScope]);

  const boardProgressPercent = (board: BoardListItem) => {
    let doneTasks = 0;
    let openTasks = 0;

    for (const column of board.columns) {
      const isDoneColumn = column.title.trim().toLowerCase() === "done";
      if (isDoneColumn) {
        doneTasks += column.tasks.length;
      } else {
        openTasks += column.tasks.length;
      }
    }

    const total = doneTasks + openTasks;
    if (total === 0) return 0;
    return Math.round((doneTasks / total) * 100);
  };

  const allTags = useMemo(
    () => Array.from(new Set(boards.flatMap((board) => board.tags))).sort((a, b) => a.localeCompare(b)),
    [boards]
  );

  const visibleBoards = useMemo(() => {
    const filtered = boards.filter((board) => {
      const titlePass = board.title.toLowerCase().includes(searchTitle.trim().toLowerCase());
      const tagPass = selectedTag === "all" || board.tags.includes(selectedTag);
      return titlePass && tagPass;
    });

    filtered.sort((a, b) => {
      if (sortBy === "dueDate") {
        const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return aDue - bDue;
      }
      if (sortBy === "progress") {
        return boardProgressPercent(b) - boardProgressPercent(a);
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return filtered;
  }, [boards, searchTitle, selectedTag, sortBy]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f9fafc_0%,#f3f5fa_48%,#eef2f9_100%)]">
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft data-icon="inline-start" />
            Back
          </Button>
          <h1 className="text-xl font-semibold md:text-2xl">All Boards</h1>
        </div>

        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-4">
            <select
              value={boardScope}
              onChange={(event) => setBoardScope(event.target.value as BoardScope)}
              className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="open">Open boards only</option>
              <option value="all">All boards</option>
            </select>
            <input
              value={searchTitle}
              onChange={(event) => setSearchTitle(event.target.value)}
              placeholder="Search by board title"
              className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <select
              value={selectedTag}
              onChange={(event) => setSelectedTag(event.target.value)}
              className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="all">All tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortKey)}
              className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="updatedAt">Sort by: Updated date</option>
              <option value="dueDate">Sort by: Due date</option>
              <option value="progress">Sort by: Progress percentage</option>
            </select>
          </CardContent>
        </Card>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading boards...</p>
        ) : visibleBoards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No board found.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleBoards.map((board) => (
              board.closedAt ? (
                <Card
                  key={board.id}
                  size="sm"
                  className={`relative overflow-hidden opacity-75 ${themeClassMap[board.theme] ?? "bg-muted/30"}`}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle>{board.title}</CardTitle>
                      <Badge variant="secondary">Closed</Badge>
                    </div>
                    <CardDescription>{board.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{boardProgressPercent(board)}% done</span>
                    <span>
                      {board.dueDate ? `Due ${format(new Date(board.dueDate), "MMM d, yyyy")}` : "No due date"}
                    </span>
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
                  <div className="absolute inset-0 grid place-items-center bg-slate-900/35 backdrop-blur-[1px]">
                    <span className="rounded-md border border-white/70 bg-black/45 px-3 py-1 text-sm font-semibold tracking-[0.2em] text-white">
                      CLOSED
                    </span>
                  </div>
                </Card>
              ) : (
                <Link key={board.id} href={`/boards/${board.id}`} className="block">
                  <Card
                    size="sm"
                    className={`transition-colors hover:bg-muted/70 ${themeClassMap[board.theme] ?? "bg-muted/30"}`}
                  >
                    <CardHeader>
                      <CardTitle>{board.title}</CardTitle>
                      <CardDescription>{board.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{boardProgressPercent(board)}% done</span>
                      <span>
                        {board.dueDate ? `Due ${format(new Date(board.dueDate), "MMM d, yyyy")}` : "No due date"}
                      </span>
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
              )
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
