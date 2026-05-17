type CompanySwitcherProps = {
  hasCompanyMode: boolean;
  companies: { id: string; name: string }[];
  onOpenLockedMode: () => void;
};

export function CompanySwitcher({
  hasCompanyMode,
  companies,
  onOpenLockedMode,
}: CompanySwitcherProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="rounded-full border px-3 py-1.5 text-sm font-medium"
      >
        Personal
      </button>
      {hasCompanyMode ? (
        companies.length > 0 ? (
          companies.map((company) => (
            <span
              key={company.id}
              aria-disabled="true"
              title="Company workspace routes are not available yet."
              className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
            >
              {company.name}
            </span>
          ))
        ) : (
          <button
            type="button"
            aria-disabled="true"
            title="Company mode is unlocked. Company workspace routes are not available yet."
            className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            Company Mode Ready
          </button>
        )
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
