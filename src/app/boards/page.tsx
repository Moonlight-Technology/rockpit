"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  updatedAt: string;
  _count: { columns: number };
};

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

  useEffect(() => {
    const fetchBoards = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/boards", { cache: "no-store" });
        const result = await response.json();
        if (response.ok && result?.ok) {
          setBoards(result.data);
        }
      } finally {
        setLoading(false);
      }
    };
    void fetchBoards();
  }, []);

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

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading boards...</p>
        ) : boards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No board found.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {boards.map((board) => (
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
        )}
      </main>
    </div>
  );
}
