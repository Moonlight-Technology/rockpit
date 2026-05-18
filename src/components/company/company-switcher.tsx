import Link from "next/link";

type CompanySwitcherProps = {
  hasCompanyMode: boolean;
  companies: { id: string; name: string; access: "OWNER" | "COLLABORATOR" }[];
  onOpenLockedMode: () => void;
};

export function CompanySwitcher({
  hasCompanyMode,
  companies,
  onOpenLockedMode,
}: CompanySwitcherProps) {
  const visibleCompanies = hasCompanyMode
    ? companies
    : companies.filter((company) => company.access === "COLLABORATOR");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/"
        className="rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
      >
        Personal
      </Link>
      {hasCompanyMode || visibleCompanies.length > 0 ? (
        <>
          {visibleCompanies.map((company) => (
            <Link
              key={company.id}
              href={
                company.access === "OWNER"
                  ? `/company/${company.id}/settings`
                  : `/company/${company.id}/leads`
              }
              className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-card-foreground transition hover:bg-accent hover:text-accent-foreground"
              title={
                company.access === "OWNER"
                  ? `${company.name} settings`
                  : `${company.name} lead board`
              }
            >
              {company.name} {company.access === "OWNER" ? "Settings" : "Leads"}
            </Link>
          ))}
          {hasCompanyMode ? (
            <Link
              href="/company/new/settings"
              className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-card-foreground transition hover:bg-accent hover:text-accent-foreground"
              title="Create another company"
            >
              Create Company
            </Link>
          ) : null}
        </>
      ) : (
        <button
          type="button"
          onClick={onOpenLockedMode}
          className="rounded-full border border-amber-400/40 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900"
        >
          Company Mode
        </button>
      )}
    </div>
  );
}
