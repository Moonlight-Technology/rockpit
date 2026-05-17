"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Building2, FileText, LayoutKanban, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

type CompanyShellProps = {
  children: React.ReactNode;
  company: {
    id: string;
    name: string;
    slug: string;
    quotationPrefix: string;
    description: string;
  };
  canManageSettings?: boolean;
  isOnboarding?: boolean;
};

export function CompanyShell({
  children,
  company,
  canManageSettings = true,
  isOnboarding = false,
}: CompanyShellProps) {
  const pathname = usePathname();
  const leadsHref = `/company/${company.id}/leads`;
  const quotationsHref = `/company/${company.id}/quotations`;
  const settingsHref = `/company/${company.id}/settings`;
  const navItems = isOnboarding
    ? [{ href: settingsHref, label: "Settings", icon: Settings }]
    : [
        { href: leadsHref, label: "Leads", icon: LayoutKanban },
        ...(canManageSettings
          ? [{ href: quotationsHref, label: "Quotations", icon: FileText }]
          : []),
        ...(canManageSettings ? [{ href: settingsHref, label: "Settings", icon: Settings }] : []),
      ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1f2937_0%,#0f172a_35%,#020617_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 md:px-8 md:py-8">
        <header className="rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/20 backdrop-blur md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white"
              >
                <ArrowLeft className="size-4" />
                Back to personal workspace
              </Link>
              <div className="flex items-start gap-3">
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">
                  <Building2 className="size-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                      {company.name}
                    </h1>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">
                      {company.quotationPrefix}
                    </span>
                  </div>
                  <p className="max-w-2xl text-sm text-slate-300">
                    {isOnboarding
                      ? "Set up the first company workspace and default sales pipeline."
                      : company.description || "Company sales pipeline and workspace context."}
                  </p>
                </div>
              </div>
            </div>
            <nav className="flex flex-wrap gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition",
                      isActive
                        ? "border-cyan-300/30 bg-cyan-300/15 text-cyan-50"
                        : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>
        <main className="flex-1 py-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}
