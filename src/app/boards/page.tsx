"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Pin, PinOff } from "lucide-react";
import { BoardViewMode, parseBoardViewMode } from "@/lib/board-view-mode";
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
  isPinnedForUser?: boolean;
  pinnedAtForUser?: string | null;
};

type PersonalTask = {
  id: string;
  status: "TODO" | "DONE";
  dueDate: string | null;
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
const ALL_BOARDS_VIEW_MODE_STORAGE_KEY = "all-boards-view-mode";

function getStoredBoardViewMode(): BoardViewMode {
  if (typeof window === "undefined") return "board";
  try {
    return parseBoardViewMode(window.localStorage.getItem(ALL_BOARDS_VIEW_MODE_STORAGE_KEY));
  } catch {
    return "board";
  }
}

function subscribeToBoardViewMode(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const handleStorage = (event: Event) => {
    if (event instanceof StorageEvent && event.key !== ALL_BOARDS_VIEW_MODE_STORAGE_KEY) return;
    onStoreChange();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener("board-view-mode-change", handleStorage);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("board-view-mode-change", handleStorage);
  };
}

export default function AllBoardsPage() {
  const router = useRouter();
  const [boards, setBoards] = useState<BoardListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTitle, setSearchTitle] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("updatedAt");
  const [boardScope, setBoardScope] = useState<BoardScope>("open");
  const [personalTasks, setPersonalTasks] = useState<PersonalTask[]>([]);
  const [pinSwapModalOpen, setPinSwapModalOpen] = useState(false);
  const [pinSwapCandidates, setPinSwapCandidates] = useState<{ id: string; title: string }[]>([]);
  const [pinPendingBoard, setPinPendingBoard] = useState<BoardListItem | null>(null);
  const [swapBoardId, setSwapBoardId] = useState("");
  const [pinLoadingBoardId, setPinLoadingBoardId] = useState<string | null>(null);
  const viewMode = useSyncExternalStore(
    subscribeToBoardViewMode,
    getStoredBoardViewMode,
    () => "board"
  );

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

  useEffect(() => {
    const fetchMyTasks = async () => {
      const response = await fetch("/api/tasks/my", { cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        setPersonalTasks([]);
        return;
      }
      setPersonalTasks(
        (result.data ?? [])
          .filter((task: { board: { id: string } | null }) => task.board == null)
          .map((task: { id: string; status: "TODO" | "DONE"; dueDate: string | null }) => ({
            id: task.id,
            status: task.status,
            dueDate: task.dueDate,
          }))
      );
    };
    void fetchMyTasks();
  }, []);

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
      if (a.isPinnedForUser !== b.isPinnedForUser) {
        return a.isPinnedForUser ? -1 : 1;
      }
      if (sortBy === "dueDate") {
        const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return aDue - bDue;
      }
      if (sortBy === "progress") {
        return boardProgressPercent(b) - boardProgressPercent(a);
      }
      if (a.isPinnedForUser && b.isPinnedForUser) {
        const aPinnedAt = a.pinnedAtForUser ? new Date(a.pinnedAtForUser).getTime() : 0;
        const bPinnedAt = b.pinnedAtForUser ? new Date(b.pinnedAtForUser).getTime() : 0;
        if (aPinnedAt !== bPinnedAt) return aPinnedAt - bPinnedAt;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return filtered;
  }, [boards, searchTitle, selectedTag, sortBy]);

  const personalProgress = useMemo(() => {
    if (personalTasks.length === 0) return 0;
    const done = personalTasks.filter((task) => task.status === "DONE").length;
    return Math.round((done / personalTasks.length) * 100);
  }, [personalTasks]);

  const personalDueDate = useMemo(() => {
    const dueDates = personalTasks
      .map((task) => task.dueDate)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .sort((a, b) => a - b);
    if (dueDates.length === 0) return null;
    return new Date(dueDates[0]);
  }, [personalTasks]);

  const shouldShowPersonal =
    selectedTag === "all" && "personal".includes(searchTitle.trim().toLowerCase() || "personal");

  const openSwapModal = (board: BoardListItem, candidates: { id: string; title: string }[]) => {
    setPinPendingBoard(board);
    setPinSwapCandidates(candidates);
    setSwapBoardId(candidates[0]?.id ?? "");
    setPinSwapModalOpen(true);
  };

  const refreshBoards = async () => {
    const response = await fetch(`/api/boards?scope=${boardScope}`, { cache: "no-store" });
    const result = await response.json().catch(() => null);
    if (response.ok && result?.ok) {
      setBoards(result.data);
    }
  };

  const onTogglePin = async (board: BoardListItem) => {
    setPinLoadingBoardId(board.id);
    const response = await fetch(`/api/boards/${board.id}/pin`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: board.isPinnedForUser ? "unpin" : "pin",
      }),
    });
    const result = await response.json().catch(() => null);

    if (response.status === 409 && result?.error?.code === "PIN_LIMIT") {
      openSwapModal(board, result?.data?.pinnedBoards ?? []);
      setPinLoadingBoardId(null);
      return;
    }

    setPinLoadingBoardId(null);
    if (!response.ok) {
      window.alert("Failed to update pin.");
      return;
    }
    await refreshBoards();
  };

  const confirmSwapPin = async () => {
    if (!pinPendingBoard || !swapBoardId) return;
    setPinLoadingBoardId(pinPendingBoard.id);
    const response = await fetch(`/api/boards/${pinPendingBoard.id}/pin`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "pin",
        replaceBoardId: swapBoardId,
      }),
    });
    setPinLoadingBoardId(null);
    if (!response.ok) {
      window.alert("Failed to swap pinned board.");
      return;
    }
    setPinSwapModalOpen(false);
    setPinPendingBoard(null);
    setPinSwapCandidates([]);
    setSwapBoardId("");
    await refreshBoards();
  };

  const renderProgressBar = (value: number) => (
    <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-black/10">
      <div
        className="h-full rounded-full bg-slate-900 transition-[width]"
        style={{ width: `${value}%` }}
      />
    </div>
  );

  const updateViewMode = (nextViewMode: BoardViewMode) => {
    try {
      window.localStorage.setItem(ALL_BOARDS_VIEW_MODE_STORAGE_KEY, nextViewMode);
      window.dispatchEvent(new Event("board-view-mode-change"));
    } catch {
      // Ignore storage failures and keep the page usable with the default view.
    }
  };

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
          <CardContent className="grid gap-3 p-4 md:grid-cols-5">
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
            <select
              value={viewMode}
              onChange={(event) => updateViewMode(event.target.value as BoardViewMode)}
              className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="board">View: Board</option>
              <option value="list">View: List</option>
            </select>
          </CardContent>
        </Card>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading boards...</p>
        ) : (
          viewMode === "board" ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {shouldShowPersonal ? (
                <Link href="/tasks" className="block">
                  <Card
                    size="sm"
                    className="border-indigo-300/80 bg-indigo-50/70 transition-colors hover:bg-indigo-100/70"
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle>Personal</CardTitle>
                        <Badge variant="secondary">Pinned</Badge>
                      </div>
                      <CardDescription>Personal tasks (not inside any board).</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{personalProgress}% done</span>
                      <span>
                        {personalDueDate ? `Due ${format(personalDueDate, "MMM d, yyyy")}` : "No due date"}
                      </span>
                    </CardContent>
                    <CardContent className="pt-0">
                      <Badge variant="outline">{personalTasks.length} tasks</Badge>
                    </CardContent>
                  </Card>
                </Link>
              ) : null}

              {visibleBoards.length === 0 ? (
                <p className="text-sm text-muted-foreground">No board found.</p>
              ) : null}
              {visibleBoards.map((board) =>
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
                  <div key={board.id} className="block">
                    <Card
                      size="sm"
                      className={`transition-colors hover:bg-muted/70 ${themeClassMap[board.theme] ?? "bg-muted/30"}`}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => router.push(`/boards/${board.id}`)}
                            className="text-left"
                          >
                            <CardTitle>{board.title}</CardTitle>
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void onTogglePin(board)}
                            disabled={pinLoadingBoardId === board.id}
                          >
                            {board.isPinnedForUser ? (
                              <PinOff data-icon="inline-start" />
                            ) : (
                              <Pin data-icon="inline-start" />
                            )}
                            {board.isPinnedForUser ? "Unpin" : "Pin"}
                          </Button>
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
                      <CardContent className="pt-0">
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/boards/${board.id}`)}>
                          Open board
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {shouldShowPersonal ? (
                <Link href="/tasks" className="block">
                  <Card className="border-indigo-300/80 bg-indigo-50/70 transition-colors hover:bg-indigo-100/70">
                    <CardHeader className="gap-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <CardTitle>Personal</CardTitle>
                          <CardDescription>Personal tasks (not inside any board).</CardDescription>
                        </div>
                        <Badge variant="secondary">Pinned</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{personalProgress}% done</span>
                        <span>
                          {personalDueDate ? `Due ${format(personalDueDate, "MMM d, yyyy")}` : "No due date"}
                        </span>
                      </div>
                      {renderProgressBar(personalProgress)}
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline">{personalTasks.length} tasks</Badge>
                        <span className="text-sm font-medium text-foreground">Open list</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ) : null}

              {visibleBoards.length === 0 ? (
                <p className="text-sm text-muted-foreground">No board found.</p>
              ) : null}

              {visibleBoards.map((board) => {
                const progress = boardProgressPercent(board);

                if (board.closedAt) {
                  return (
                    <Card
                      key={board.id}
                      size="sm"
                      className={`relative overflow-hidden opacity-75 ${themeClassMap[board.theme] ?? "bg-muted/30"}`}
                    >
                      <CardHeader className="gap-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <CardTitle>{board.title}</CardTitle>
                            <CardDescription>{board.description}</CardDescription>
                          </div>
                          <Badge variant="secondary">Closed</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>{progress}% done</span>
                          <span>
                            {board.dueDate ? `Due ${format(new Date(board.dueDate), "MMM d, yyyy")}` : "No due date"}
                          </span>
                        </div>
                        {renderProgressBar(progress)}
                        {board.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {board.tags.map((tag) => (
                              <Badge key={tag} variant="outline">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </CardContent>
                      <div className="absolute inset-0 grid place-items-center bg-slate-900/35 backdrop-blur-[1px]">
                        <span className="rounded-md border border-white/70 bg-black/45 px-3 py-1 text-sm font-semibold tracking-[0.2em] text-white">
                          CLOSED
                        </span>
                      </div>
                    </Card>
                  );
                }

                return (
                  <Card
                    key={board.id}
                    size="sm"
                    className={`transition-colors hover:bg-muted/70 ${themeClassMap[board.theme] ?? "bg-muted/30"}`}
                  >
                    <CardHeader className="gap-2">
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => router.push(`/boards/${board.id}`)}
                          className="text-left"
                        >
                          <CardTitle>{board.title}</CardTitle>
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void onTogglePin(board)}
                          disabled={pinLoadingBoardId === board.id}
                        >
                          {board.isPinnedForUser ? (
                            <PinOff data-icon="inline-start" />
                          ) : (
                            <Pin data-icon="inline-start" />
                          )}
                          {board.isPinnedForUser ? "Unpin" : "Pin"}
                        </Button>
                      </div>
                      <CardDescription>{board.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{progress}% done</span>
                        <span>
                          {board.dueDate ? `Due ${format(new Date(board.dueDate), "MMM d, yyyy")}` : "No due date"}
                        </span>
                      </div>
                      {renderProgressBar(progress)}
                      {board.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {board.tags.map((tag) => (
                            <Badge key={tag} variant="outline">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                      <div className="flex justify-end">
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/boards/${board.id}`)}>
                          Open board
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )
        )}
      </main>

      {pinSwapModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
          <Card className="w-full max-w-xl">
            <CardHeader>
              <CardTitle>Easy, Ken. Kamu Bukan Avengers</CardTitle>
              <CardDescription>
                Kamu udah pin 3 project. Tetap keren, tapi otak butuh napas. Lepas satu dulu biar
                fokus tetap tajam dan burnout nggak ikut meeting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <select
                value={swapBoardId}
                onChange={(event) => setSwapBoardId(event.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {pinSwapCandidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.title}
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPinSwapModalOpen(false);
                    setPinPendingBoard(null);
                    setPinSwapCandidates([]);
                    setSwapBoardId("");
                  }}
                >
                  Tarik Napas Dulu
                </Button>
                <Button onClick={() => void confirmSwapPin()} disabled={!swapBoardId}>
                  Lepas Satu Dulu
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
