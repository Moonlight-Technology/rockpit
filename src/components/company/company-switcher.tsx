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
        className="rounded-full border px-3 py-1.5 text-sm font-medium transition hover:bg-zinc-50"
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
              className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:border-zinc-700 hover:bg-zinc-800"
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
              className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:border-zinc-700 hover:bg-zinc-800"
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
