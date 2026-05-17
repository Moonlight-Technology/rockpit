import Link from "next/link";
import { ArrowRight, FolderOpen, LayoutKanban } from "lucide-react";
import { notFound, redirect } from "next/navigation";
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
      <section className="rounded-3xl border border-white/10 bg-white/6 p-6 text-slate-100 ring-1 ring-white/5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">Projects</p>
            <div>
              <h1 className="text-2xl font-semibold text-white">Company project boards</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Won leads become delivery boards here, keeping the originating sales context
                attached to the project workspace.
              </p>
            </div>
          </div>
          <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                Open boards
              </p>
              <p className="mt-1 text-lg font-semibold text-white">{result.boards.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                Converted leads
              </p>
              <p className="mt-1 text-lg font-semibold text-white">
                {result.boards.filter((board) => board.sourceLeadId).length}
              </p>
            </div>
          </div>
        </div>
      </section>

      {result.boards.length > 0 ? (
        <section className="grid gap-4 xl:grid-cols-2">
          {result.boards.map((board) => (
            <Link
              key={board.id}
              href={`/boards/${board.id}`}
              className="rounded-3xl border border-white/10 bg-white/6 p-5 text-slate-100 ring-1 ring-white/5 transition hover:border-cyan-300/30 hover:bg-cyan-300/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-white">{board.title}</p>
                  <p className="mt-2 text-sm text-slate-400">
                    {board.description || "Company delivery board created from a won lead."}
                  </p>
                </div>
                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-cyan-100">
                  <LayoutKanban className="size-4" />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1">
                  {board._count.columns} columns
                </span>
                <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1">
                  {board._count.tasks} tasks
                </span>
                {board.sourceLead ? (
                  <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1">
                    {board.sourceLead.stage}
                  </span>
                ) : null}
              </div>

              {board.sourceLead ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-slate-300">
                  <p className="font-medium text-white">{board.sourceLead.prospectName}</p>
                  <p className="mt-1">{board.sourceLead.title}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                    Pipeline value Rp{board.sourceLead.estimatedValue.toLocaleString("id-ID")}
                  </p>
                </div>
              ) : null}

              <div className="mt-4 inline-flex items-center gap-1 text-sm text-cyan-100">
                Open board
                <ArrowRight className="size-4" />
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <section className="rounded-3xl border border-dashed border-white/10 bg-white/4 p-6 text-slate-300">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
              <FolderOpen className="size-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">No project boards yet</h2>
              <p className="mt-1 text-sm text-slate-400">
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
