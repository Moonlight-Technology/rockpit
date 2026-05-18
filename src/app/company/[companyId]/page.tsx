import Link from "next/link";
import { ArrowRight, FileText, FolderOpen, KanbanSquare, Settings } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { OverviewMetrics } from "@/components/company/overview-metrics";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_320px]">
        <Card className="border-white/10 bg-linear-to-br from-[#1a1a1a] to-[#121212] text-zinc-100 shadow-none">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-white/10 bg-[#202020] text-zinc-200">
                Overview
              </Badge>
              <Badge variant="outline" className="border-white/10 bg-[#202020] text-zinc-400">
                Owner workspace
              </Badge>
            </div>
            <CardTitle className="text-3xl font-semibold text-white">
              Owner dashboard snapshot
            </CardTitle>
            <CardDescription className="max-w-3xl text-zinc-400">
              Use this summary to track live pipeline value, draft quotation exposure, fresh wins,
              and converted delivery work across {result.company.name}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Link
              href={`/company/${companyId}/leads`}
              className="inline-flex items-center gap-2 rounded-full bg-[#f2f2f2] px-4 py-2 text-sm font-medium text-[#111] transition hover:bg-white"
            >
              Open lead pipeline
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href={`/company/${companyId}/quotations`}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#1d1d1d] px-4 py-2 text-sm text-zinc-200 transition hover:bg-[#242424] hover:text-white"
            >
              Review quotations
              <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#181818] text-zinc-100 shadow-none">
          <CardHeader>
            <CardDescription className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              Company slug
            </CardDescription>
            <CardTitle className="text-xl text-white">{result.company.slug}</CardTitle>
            <CardDescription className="text-zinc-400">
              Company shell, quotations, and project boards all attach to this workspace identity.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>

      <OverviewMetrics metrics={result.metrics} />

      <section className="grid gap-4 xl:grid-cols-2">
        {quickLinks.map((item) => {
          const Icon = item.icon;

          return (
            <Card
              key={item.href}
              className="border-white/10 bg-[#181818] text-zinc-100 shadow-none transition hover:bg-[#1d1d1d]"
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg text-white">{item.label}</CardTitle>
                    <CardDescription className="mt-2 text-zinc-400">
                      {item.description}
                    </CardDescription>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#202020] p-3 text-zinc-200">
                    <Icon className="size-4" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-1 text-sm text-zinc-200"
                >
                  Open section
                  <ArrowRight className="size-4" />
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
