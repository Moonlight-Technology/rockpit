import Link from "next/link";
import { ArrowRight, FolderOpen, KanbanSquare } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUserId } from "@/lib/api";
import { listCompanyProjectBoardsForUser } from "@/lib/board-service";

export default async function CompanyProjectsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  const { companyId } = await params;
  const result = await listCompanyProjectBoardsForUser(userId, companyId);
  if ("error" in result) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_320px]">
        <Card className="border-white/10 bg-linear-to-br from-[#1a1a1a] to-[#121212] text-zinc-100">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-white/10 bg-[#202020] text-zinc-200">
                Projects
              </Badge>
            </div>
            <CardTitle className="text-3xl text-white">Company project boards</CardTitle>
            <CardDescription className="max-w-2xl text-zinc-400">
              Won leads become delivery boards here, keeping the originating sales context
              attached to the project workspace.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <Card className="border-white/10 bg-[#181818] text-zinc-100">
            <CardHeader>
              <CardDescription className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                Open boards
              </CardDescription>
              <CardTitle className="text-2xl text-white">{result.boards.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-white/10 bg-[#181818] text-zinc-100">
            <CardHeader>
              <CardDescription className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                Converted leads
              </CardDescription>
              <CardTitle className="text-2xl text-white">
                {result.boards.filter((board) => board.sourceLeadId).length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </section>

      {result.boards.length > 0 ? (
        <section className="grid gap-4 xl:grid-cols-2">
          {result.boards.map((board) => (
            <Card
              key={board.id}
              className="border-white/10 bg-[#181818] text-zinc-100 transition hover:bg-[#1d1d1d]"
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg text-white">{board.title}</CardTitle>
                  <CardDescription className="mt-2 text-zinc-400">
                    {board.description || "Company delivery board created from a won lead."}
                  </CardDescription>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#202020] p-3 text-zinc-200">
                  <KanbanSquare className="size-4" />
                </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
                <span className="rounded-full border border-white/10 bg-[#232323] px-3 py-1">
                  {board._count.columns} columns
                </span>
                <span className="rounded-full border border-white/10 bg-[#232323] px-3 py-1">
                  {board._count.tasks} tasks
                </span>
                {board.sourceLead ? (
                  <span className="rounded-full border border-white/10 bg-[#232323] px-3 py-1">
                    {board.sourceLead.stage}
                  </span>
                ) : null}
                </div>

                {board.sourceLead ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-[#1d1d1d] p-4 text-sm text-zinc-300">
                    <p className="font-medium text-white">{board.sourceLead.prospectName}</p>
                    <p className="mt-1">{board.sourceLead.title}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
                      Pipeline value Rp{board.sourceLead.estimatedValue.toLocaleString("id-ID")}
                    </p>
                  </div>
                ) : null}

                <Link
                  href={`/boards/${board.id}`}
                  className="mt-4 inline-flex items-center gap-1 text-sm text-zinc-200"
                >
                  Open board
                  <ArrowRight className="size-4" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : (
        <section className="rounded-3xl border border-dashed border-white/10 bg-[#181818] p-6 text-zinc-300">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-[#202020] p-3">
              <FolderOpen className="size-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">No project boards yet</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Convert a won lead from the sales pipeline to create the first company project
                board.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
