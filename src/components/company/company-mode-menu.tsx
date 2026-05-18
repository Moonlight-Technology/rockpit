"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type CompanyModeMenuCompany = {
  id: string;
  name: string;
  access: "OWNER" | "COLLABORATOR";
};

type CompanyModeMenuProps = {
  hasCompanyMode: boolean;
  companies: CompanyModeMenuCompany[];
  onOpenLockedMode: () => void;
  mobile?: boolean;
  onNavigate?: () => void;
};

function ownerOverviewHref(companyId: string) {
  return `/company/${companyId}`;
}

function ownerSettingsHref(companyId: string) {
  return `/company/${companyId}/settings`;
}

function collaboratorLeadsHref(companyId: string) {
  return `/company/${companyId}/leads`;
}

export function CompanyModeMenu({
  hasCompanyMode,
  companies,
  onOpenLockedMode,
  mobile = false,
  onNavigate,
}: CompanyModeMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ownerCompanies = companies.filter((company) => company.access === "OWNER");
  const collaboratorCompanies = companies.filter((company) => company.access === "COLLABORATOR");
  const canOpenCompanyMenu = hasCompanyMode || companies.length > 0;

  function navigate(href: string) {
    setOpen(false);
    onNavigate?.();
    router.push(href);
  }

  function handleButtonClick() {
    if (!canOpenCompanyMenu) {
      onOpenLockedMode();
      return;
    }

    setOpen((current) => !current);
  }

  if (mobile) {
    return (
      <div className="flex flex-col gap-1 border-b border-border pb-2">
        <Button
          size="sm"
          variant="ghost"
          className="w-full justify-start"
          onClick={() => {
            if (!canOpenCompanyMenu) {
              onNavigate?.();
              onOpenLockedMode();
              return;
            }
            setOpen((current) => !current);
          }}
        >
          <Building2 data-icon="inline-start" />
          Company Mode
        </Button>

        {canOpenCompanyMenu && open ? (
          <div className="ml-3 flex flex-col gap-1 border-l border-border pl-2">
            {ownerCompanies.map((company) => (
              <div key={company.id} className="rounded-lg bg-muted/40 p-2">
                <p className="truncate text-xs font-medium text-foreground">{company.name}</p>
                <div className="mt-1 grid grid-cols-2 gap-1">
                  <Button
                    size="xs"
                    variant="ghost"
                    className="justify-start"
                    onClick={() => navigate(ownerOverviewHref(company.id))}
                  >
                    Overview
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    className="justify-start"
                    onClick={() => navigate(ownerSettingsHref(company.id))}
                  >
                    Settings
                  </Button>
                </div>
              </div>
            ))}
            {collaboratorCompanies.map((company) => (
              <Button
                key={company.id}
                size="xs"
                variant="ghost"
                className="justify-start"
                onClick={() => navigate(collaboratorLeadsHref(company.id))}
              >
                {company.name} Leads
              </Button>
            ))}
            {hasCompanyMode ? (
              <Button
                size="xs"
                variant="ghost"
                className="justify-start"
                onClick={() => navigate("/company/new/settings")}
              >
                <Plus data-icon="inline-start" />
                Create Company
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative">
      <Button
        size="icon-sm"
        variant="outline"
        aria-label="Company Mode"
        title="Company Mode"
        aria-expanded={open}
        onClick={handleButtonClick}
        className={
          canOpenCompanyMenu
            ? ""
            : "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
        }
      >
        <Building2 />
      </Button>

      {canOpenCompanyMenu && open ? (
        <>
          <button
            type="button"
            aria-label="Close Company Mode menu"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <Card className="absolute right-0 top-9 z-40 w-72 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Company Mode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-2 pt-0">
              {ownerCompanies.map((company) => (
                <div key={company.id} className="rounded-lg border border-border bg-muted/30 p-2">
                  <p className="truncate text-sm font-medium text-foreground">{company.name}</p>
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    <Button
                      size="xs"
                      variant="ghost"
                      className="justify-start"
                      onClick={() => navigate(ownerOverviewHref(company.id))}
                    >
                      <ChevronRight data-icon="inline-start" />
                      Overview
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      className="justify-start"
                      onClick={() => navigate(ownerSettingsHref(company.id))}
                    >
                      <Settings data-icon="inline-start" />
                      Settings
                    </Button>
                  </div>
                </div>
              ))}

              {collaboratorCompanies.map((company) => (
                <Button
                  key={company.id}
                  size="sm"
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => navigate(collaboratorLeadsHref(company.id))}
                >
                  <ChevronRight data-icon="inline-start" />
                  {company.name} Leads
                </Button>
              ))}

              {hasCompanyMode ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => navigate("/company/new/settings")}
                >
                  <Plus data-icon="inline-start" />
                  Create Company
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
