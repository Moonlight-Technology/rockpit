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
        <Card className="border-border bg-card text-card-foreground">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                Projects
              </Badge>
            </div>
            <CardTitle className="text-3xl text-card-foreground">Company project boards</CardTitle>
            <CardDescription className="max-w-2xl text-muted-foreground">
              Won leads become delivery boards here, keeping the originating sales context
              attached to the project workspace.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <Card className="border-border bg-card text-card-foreground">
            <CardHeader>
              <CardDescription className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Open boards
              </CardDescription>
              <CardTitle className="text-2xl text-card-foreground">{result.boards.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-border bg-card text-card-foreground">
            <CardHeader>
              <CardDescription className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Converted leads
              </CardDescription>
              <CardTitle className="text-2xl text-card-foreground">
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
              className="border-border bg-card text-card-foreground transition hover:bg-accent/40"
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg text-card-foreground">{board.title}</CardTitle>
                  <CardDescription className="mt-2 text-muted-foreground">
                    {board.description || "Company delivery board created from a won lead."}
                  </CardDescription>
                </div>
                <div className="rounded-2xl border border-border bg-muted p-3 text-muted-foreground">
                  <KanbanSquare className="size-4" />
                </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <span className="rounded-full border border-border bg-background px-3 py-1">
                  {board._count.columns} columns
                </span>
                <span className="rounded-full border border-border bg-background px-3 py-1">
                  {board._count.tasks} tasks
                </span>
                {board.sourceLead ? (
                  <span className="rounded-full border border-border bg-background px-3 py-1">
                    {board.sourceLead.stage}
                  </span>
                ) : null}
                </div>

                {board.sourceLead ? (
                  <div className="mt-4 rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-card-foreground">{board.sourceLead.prospectName}</p>
                    <p className="mt-1">{board.sourceLead.title}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Pipeline value Rp{board.sourceLead.estimatedValue.toLocaleString("id-ID")}
                    </p>
                  </div>
                ) : null}

                <Link
                  href={`/boards/${board.id}`}
                  className="mt-4 inline-flex items-center gap-1 text-sm text-foreground"
                >
                  Open board
                  <ArrowRight className="size-4" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : (
        <section className="rounded-3xl border border-dashed border-border bg-muted/30 p-6 text-muted-foreground">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border bg-background p-3">
              <FolderOpen className="size-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">No project boards yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
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
