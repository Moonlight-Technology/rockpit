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
  UsersRound,
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
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { isCompanyNavItemActive } from "@/lib/company-navigation";

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
  const clientsHref = `/company/${company.id}/clients`;
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
        ...(canManageSettings
          ? [{ href: clientsHref, label: "Client", icon: UsersRound }]
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
      className="min-h-screen bg-background text-foreground print:block print:min-h-0 print:bg-white print:text-slate-950"
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
        className="print:hidden [&_[data-slot=sheet-content]]:bg-sidebar [&_[data-slot=sheet-content]]:text-sidebar-foreground"
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                className="bg-transparent hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                render={<Link href={overviewHref} />}
              >
                <div className="flex size-10 items-center justify-center rounded-2xl border border-sidebar-border bg-sidebar-accent text-sidebar-foreground">
                  <Building2 className="size-5" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{company.name}</span>
                  <span className="truncate text-xs text-sidebar-foreground/70">
                    {company.quotationPrefix} · {canManageSettings ? "Owner" : "Collaborator"}
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {primaryNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = isCompanyNavItemActive({
                    pathname,
                    href: item.href,
                    overviewHref,
                  });

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive}
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
              <SidebarGroupLabel>Admin</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {secondaryNav.map((item) => {
                    const Icon = item.icon;
                    const isActive = isCompanyNavItemActive({
                      pathname,
                      href: item.href,
                      overviewHref,
                    });

                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          isActive={isActive}
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
          <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/40 p-3 text-sm">
            <p className="text-xs uppercase tracking-[0.22em] text-sidebar-foreground/60">Context</p>
            <p className="mt-2 font-medium text-sidebar-foreground">
              {isOnboarding ? "Creating first company workspace" : company.slug}
            </p>
            <p className="mt-2 text-xs leading-5 text-sidebar-foreground/70">
              {isOnboarding
                ? "Set up identity and pipeline defaults before inviting anyone in."
                : company.description || "Business-in-a-box workspace for sales and delivery."}
            </p>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-background shadow-none md:border md:border-border md:bg-card/40 md:backdrop-blur-sm">
        <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b border-border bg-background/80 px-4 print:hidden lg:px-6">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <Separator orientation="vertical" className="mx-2 h-4 bg-border" />
          <div className="flex flex-1 items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Company Mode
              </p>
              <h1 className="text-sm font-medium text-foreground">
                {isOnboarding ? "Initial workspace setup" : company.name}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {canManageSettings && !isOnboarding ? (
                <Link
                  href="/company/new/settings"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
                >
                  <PlusCircle className="size-4" />
                  New Company
                </Link>
              ) : null}
              <ThemeToggle />
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
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
