"use client";

import type { CSSProperties, ComponentType, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  FileText,
  FolderOpen,
  KanbanSquare,
  LayoutDashboard,
  PlusCircle,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

type CompanyShellProps = {
  children: ReactNode;
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

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

export function CompanyShell({
  children,
  company,
  canManageSettings = true,
  isOnboarding = false,
}: CompanyShellProps) {
  const pathname = usePathname();
  const overviewHref = `/company/${company.id}`;
  const leadsHref = `/company/${company.id}/leads`;
  const projectsHref = `/company/${company.id}/projects`;
  const quotationsHref = `/company/${company.id}/quotations`;
  const settingsHref = `/company/${company.id}/settings`;

  const primaryNav: NavItem[] = isOnboarding
    ? [{ href: settingsHref, label: "Settings", icon: Settings }]
    : [
        ...(canManageSettings
          ? [{ href: overviewHref, label: "Overview", icon: LayoutDashboard }]
          : []),
        { href: leadsHref, label: "Leads", icon: KanbanSquare },
        ...(canManageSettings
          ? [{ href: projectsHref, label: "Projects", icon: FolderOpen }]
          : []),
        ...(canManageSettings
          ? [{ href: quotationsHref, label: "Quotations", icon: FileText }]
          : []),
      ];

  const secondaryNav: NavItem[] = canManageSettings
    ? [{ href: settingsHref, label: "Settings", icon: Settings }]
    : [];

  return (
    <SidebarProvider
      className="min-h-screen bg-[#0a0a0a] text-zinc-100 print:block print:min-h-0 print:bg-white print:text-slate-950"
      style={
        {
          "--sidebar-width": "20rem",
          "--sidebar-width-icon": "4rem",
          "--header-height": "3.5rem",
        } as CSSProperties
      }
    >
      <Sidebar
        variant="inset"
        collapsible="offcanvas"
        className="print:hidden [&_[data-slot=sidebar-container]]:bg-[#171717] [&_[data-slot=sidebar-container]]:p-0 [&_[data-slot=sidebar-inner]]:rounded-none [&_[data-slot=sidebar-inner]]:bg-[#171717] [&_[data-slot=sidebar-inner]]:text-zinc-100"
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                className="bg-transparent text-zinc-100 hover:bg-[#232323] hover:text-white"
                render={<Link href={overviewHref} />}
              >
                <div className="flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-[#222] text-zinc-100">
                  <Building2 className="size-5" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{company.name}</span>
                  <span className="truncate text-xs text-zinc-500">
                    {company.quotationPrefix} · {canManageSettings ? "Owner" : "Collaborator"}
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-zinc-500">Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {primaryNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        className="text-zinc-400 hover:bg-[#232323] hover:text-white data-active:bg-[#f2f2f2] data-active:text-[#111]"
                        render={<Link href={item.href} />}
                      >
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {secondaryNav.length > 0 ? (
            <SidebarGroup>
              <SidebarGroupLabel className="text-zinc-500">Admin</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {secondaryNav.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          isActive={isActive}
                          className="text-zinc-400 hover:bg-[#232323] hover:text-white data-active:bg-[#f2f2f2] data-active:text-[#111]"
                          render={<Link href={item.href} />}
                        >
                          <Icon className="size-4" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}
        </SidebarContent>

        <SidebarFooter>
          <div className="rounded-2xl border border-white/10 bg-[#1d1d1d] p-3 text-sm">
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Context</p>
            <p className="mt-2 font-medium text-white">
              {isOnboarding ? "Creating first company workspace" : company.slug}
            </p>
            <p className="mt-2 text-xs leading-5 text-zinc-400">
              {isOnboarding
                ? "Set up identity and pipeline defaults before inviting anyone in."
                : company.description || "Business-in-a-box workspace for sales and delivery."}
            </p>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-[#0b0b0b] shadow-none md:rounded-none md:border md:border-white/10 md:border-l-0 md:bg-[#0b0b0b]">
        <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b border-white/10 bg-[#0b0b0b] px-4 print:hidden lg:px-6">
          <SidebarTrigger className="-ml-1 text-zinc-400 hover:text-white" />
          <Separator orientation="vertical" className="mx-2 h-4 bg-white/10" />
          <div className="flex flex-1 items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                Company Mode
              </p>
              <h1 className="text-sm font-medium text-white">
                {isOnboarding ? "Initial workspace setup" : company.name}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {canManageSettings && !isOnboarding ? (
                <Link
                  href="/company/new/settings"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-zinc-300 transition hover:bg-[#232323] hover:text-white"
                >
                  <PlusCircle className="size-4" />
                  New Company
                </Link>
              ) : null}
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-zinc-300 transition hover:bg-[#232323] hover:text-white"
              >
                <ArrowLeft className="size-4" />
                Personal
              </Link>
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-1 flex-col gap-4 px-4 py-4 md:px-6 md:py-6 print:px-0 print:py-0">
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
