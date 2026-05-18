import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ArrowRight, FolderOpen } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { LeadBoard } from "@/components/company/lead-board";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUserId } from "@/lib/api";
import { listClientsForUser } from "@/lib/company-client-service";
import { convertLeadToProjectForUser } from "@/lib/company-conversion-service";
import { getLeadBoardAccessForUser } from "@/lib/company-lead-service";
import { groupLeadsByColumn } from "@/lib/company-overview";

export default async function CompanyLeadsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  const { companyId } = await params;
  const result = await getLeadBoardAccessForUser(userId, companyId);
  if ("error" in result) {
    notFound();
  }
  const leadBoard = result.board;
  const isOwner = result.isOwner;
  const clientsResult = isOwner
    ? await listClientsForUser({ userId, companyId })
    : { data: [] };
  const clients = "data" in clientsResult ? clientsResult.data : [];
  const wonLeads = leadBoard.leads.filter((lead) => lead.stage === "WON");

  async function convertLeadAction(formData: FormData) {
    "use server";

    const currentUserId = await getSessionUserId();
    if (!currentUserId) {
      redirect("/login");
    }

    const leadId = formData.get("leadId");
    if (typeof leadId !== "string" || leadId.length === 0) {
      redirect(`/company/${companyId}/leads`);
    }

    const conversionResult = await convertLeadToProjectForUser({
      userId: currentUserId,
      companyId,
      leadId,
    });

    revalidatePath(`/company/${companyId}/leads`);
    revalidatePath(`/company/${companyId}/projects`);

    if ("error" in conversionResult) {
      redirect(`/company/${companyId}/leads`);
    }

    redirect(`/company/${companyId}/projects`);
  }

  const columns = groupLeadsByColumn(leadBoard.columns, leadBoard.leads);
  const activeLeadCount = leadBoard.leads.filter(
    (lead) => lead.stage !== "WON" && lead.stage !== "LOST"
  ).length;
  const totalPipelineValue = leadBoard.leads.reduce(
    (sum, lead) => sum + lead.estimatedValue,
    0
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_320px]">
        <Card className="border-border bg-card text-card-foreground">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                Lead board
              </Badge>
              <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                {isOwner ? "Owner control" : "Shared access"}
              </Badge>
            </div>
            <CardTitle className="text-3xl text-card-foreground">{leadBoard.name}</CardTitle>
            <CardDescription className="max-w-2xl text-muted-foreground">
              {leadBoard.description ||
                (isOwner
                  ? "Track qualified prospects and deal value by stage."
                  : "Shared sales pipeline you have been invited to collaborate on.")}
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <Card className="border-border bg-card text-card-foreground">
            <CardHeader>
              <CardDescription className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Active pipeline
              </CardDescription>
              <CardTitle className="text-2xl text-card-foreground">{activeLeadCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-border bg-card text-card-foreground">
            <CardHeader>
              <CardDescription className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Pipeline value
              </CardDescription>
              <CardTitle className="text-2xl text-card-foreground">
                Rp{totalPipelineValue.toLocaleString("id-ID")}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </section>

      {isOwner ? (
        <Card className="border-border bg-card text-card-foreground">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                  Won leads
                </Badge>
                <div>
                  <CardTitle className="text-xl text-card-foreground">
                    Convert sales wins into projects
                  </CardTitle>
                  <CardDescription className="mt-2 max-w-2xl text-muted-foreground">
                    Each won lead can create exactly one company project board, preserving the
                    source lead relationship for delivery work.
                  </CardDescription>
                </div>
              </div>
              <Link
                href={`/company/${companyId}/projects`}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
              >
                View project boards
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {wonLeads.length > 0 ? (
              wonLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex flex-col gap-4 rounded-2xl border border-border bg-muted/40 p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">{lead.prospectName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{lead.title}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      <span className="rounded-full border border-border bg-background px-3 py-1">
                        {lead.stage}
                      </span>
                      <span className="rounded-full border border-border bg-background px-3 py-1">
                        Rp{lead.estimatedValue.toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>

                  {lead.convertedProjectBoardId ? (
                    <Link
                      href={`/boards/${lead.convertedProjectBoardId}`}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
                    >
                      Open project board
                      <ArrowRight className="size-4" />
                    </Link>
                  ) : (
                    <form action={convertLeadAction}>
                      <input type="hidden" name="leadId" value={lead.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
                      >
                        <FolderOpen className="size-4" />
                        Convert to project
                      </button>
                    </form>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
                No won leads yet. Move a lead into the won stage to unlock project conversion.
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <LeadBoard
        companyId={companyId}
        canManage={isOwner}
        collaboratorCount={leadBoard.members.length + 1}
        columns={columns}
        clients={clients}
      />
    </div>
  );
}
