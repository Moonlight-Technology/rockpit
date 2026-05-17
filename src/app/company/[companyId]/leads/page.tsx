import { notFound, redirect } from "next/navigation";
import { LeadBoard } from "@/components/company/lead-board";
import { getSessionUserId } from "@/lib/api";
import { getLeadBoardForUser } from "@/lib/company-lead-service";
import { groupLeadsByColumn } from "@/lib/company-overview";
import { prisma } from "@/lib/prisma";

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
  const [leadBoard, company] = await Promise.all([
    getLeadBoardForUser(userId, companyId),
    prisma.company.findFirst({
      where: { id: companyId },
      select: { ownerId: true },
    }),
  ]);
  if (!leadBoard) {
    notFound();
  }
  const isOwner = company?.ownerId === userId;

  const columns = groupLeadsByColumn(leadBoard.columns, leadBoard.leads);

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
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Open leads</p>
              <p className="mt-1 text-lg font-semibold text-white">{leadBoard.leads.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Collaborators</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {leadBoard.members.length + 1}
              </p>
            </div>
          </div>
        </div>
      </section>

      <LeadBoard columns={columns} />
    </div>
  );
}
