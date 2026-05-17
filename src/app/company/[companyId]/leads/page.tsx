import { notFound, redirect } from "next/navigation";
import { LeadBoard } from "@/components/company/lead-board";
import { getSessionUserId } from "@/lib/api";
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

      <LeadBoard
        companyId={companyId}
        canManage={isOwner}
        collaboratorCount={leadBoard.members.length + 1}
        columns={columns}
      />
    </div>
  );
}
