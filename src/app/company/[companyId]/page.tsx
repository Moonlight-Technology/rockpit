import Link from "next/link";
import { ArrowRight, FileText, FolderOpen, KanbanSquare, Settings } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { OverviewMetrics } from "@/components/company/overview-metrics";
import { getSessionUserId } from "@/lib/api";
import { getCompanyOverviewForUser } from "@/lib/company-overview";

export default async function CompanyOverviewPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  const { companyId } = await params;
  const result = await getCompanyOverviewForUser(userId, companyId);
  if ("error" in result) {
    notFound();
  }

  const quickLinks = [
    {
      href: `/company/${companyId}/leads`,
      label: "Review sales pipeline",
      description: "Move opportunities, inspect stages, and convert won work.",
      icon: KanbanSquare,
    },
    {
      href: `/company/${companyId}/quotations`,
      label: "Manage quotations",
      description: "Create revisions, keep drafts moving, and inspect totals.",
      icon: FileText,
    },
    {
      href: `/company/${companyId}/projects`,
      label: "Open delivery boards",
      description: "Track the active project boards created from won leads.",
      icon: FolderOpen,
    },
    {
      href: `/company/${companyId}/settings`,
      label: "Adjust company settings",
      description: "Maintain company identity, prefix rules, and workspace defaults.",
      icon: Settings,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/6 p-6 text-slate-100 ring-1 ring-white/5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">Overview</p>
            <div>
              <h1 className="text-2xl font-semibold text-white">Owner dashboard snapshot</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Use this summary to track live pipeline value, draft quotation exposure, fresh wins,
                and converted delivery work across {result.company.name}.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-slate-300">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Company slug</p>
            <p className="mt-1 font-medium text-white">{result.company.slug}</p>
          </div>
        </div>
      </section>

      <OverviewMetrics metrics={result.metrics} />

      <section className="grid gap-4 xl:grid-cols-2">
        {quickLinks.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-3xl border border-white/10 bg-white/6 p-5 text-slate-100 ring-1 ring-white/5 transition hover:border-cyan-300/30 hover:bg-cyan-300/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-white">{item.label}</p>
                  <p className="mt-2 text-sm text-slate-400">{item.description}</p>
                </div>
                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-cyan-100">
                  <Icon className="size-4" />
                </div>
              </div>

              <div className="mt-4 inline-flex items-center gap-1 text-sm text-cyan-100">
                Open section
                <ArrowRight className="size-4" />
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
