import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ArrowRight, FolderOpen } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { LeadBoard } from "@/components/company/lead-board";
import { getSessionUserId } from "@/lib/api";
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
      <section className="rounded-3xl border border-white/10 bg-white/6 p-6 text-slate-100 ring-1 ring-white/5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">Lead board</p>
            <div>
              <h1 className="text-2xl font-semibold text-white">{leadBoard.name}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                {leadBoard.description ||
                  (isOwner
                    ? "Track qualified prospects and deal value by stage."
                    : "Shared sales pipeline you have been invited to collaborate on.")}
              </p>
            </div>
          </div>
          <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                Active pipeline
              </p>
              <p className="mt-1 text-lg font-semibold text-white">{activeLeadCount}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                Pipeline value
              </p>
              <p className="mt-1 text-lg font-semibold text-white">
                Rp{totalPipelineValue.toLocaleString("id-ID")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {isOwner ? (
        <section className="rounded-3xl border border-white/10 bg-white/6 p-6 text-slate-100 ring-1 ring-white/5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">
                Won leads
              </p>
              <div>
                <h2 className="text-xl font-semibold text-white">Convert sales wins into projects</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-300">
                  Each won lead can create exactly one company project board, preserving the
                  source lead relationship for delivery work.
                </p>
              </div>
            </div>
            <Link
              href={`/company/${companyId}/projects`}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              View project boards
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {wonLeads.length > 0 ? (
              wonLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/10 p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{lead.prospectName}</p>
                    <p className="mt-1 text-sm text-slate-300">{lead.title}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                      <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1">
                        {lead.stage}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1">
                        Rp{lead.estimatedValue.toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>

                  {lead.convertedProjectBoardId ? (
                    <Link
                      href={`/boards/${lead.convertedProjectBoardId}`}
                      className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100 transition hover:bg-cyan-300/15"
                    >
                      Open project board
                      <ArrowRight className="size-4" />
                    </Link>
                  ) : (
                    <form action={convertLeadAction}>
                      <input type="hidden" name="leadId" value={lead.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-200"
                      >
                        <FolderOpen className="size-4" />
                        Convert to project
                      </button>
                    </form>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-5 text-sm text-slate-400">
                No won leads yet. Move a lead into the won stage to unlock project conversion.
              </div>
            )}
          </div>
        </section>
      ) : null}

      <LeadBoard
        companyId={companyId}
        canManage={isOwner}
        collaboratorCount={leadBoard.members.length + 1}
        columns={columns}
      />
    </div>
  );
}
