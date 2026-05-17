type LeadBoardProps = {
  columns: Array<{
    id: string;
    title: string;
    totalEstimatedValue: number;
    leads: Array<{
      id: string;
      title: string;
      prospectName: string;
      estimatedValue: number;
      stage: string;
    }>;
  }>;
};

export function LeadBoard({ columns }: LeadBoardProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">
      {columns.map((column) => (
        <section
          key={column.id}
          className="rounded-2xl border border-white/10 bg-white/6 p-4 text-slate-100 ring-1 ring-white/5"
        >
          <header className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">{column.title}</h2>
              <p className="mt-1 text-xs text-slate-400">
                {column.leads.length} lead{column.leads.length === 1 ? "" : "s"}
              </p>
            </div>
            <span className="text-xs text-cyan-100">
              Rp{column.totalEstimatedValue.toLocaleString("id-ID")}
            </span>
          </header>
          <div className="space-y-3">
            {column.leads.map((lead) => (
              <article
                key={lead.id}
                className="rounded-xl border border-white/10 bg-black/20 p-3 shadow-sm"
              >
                <p className="text-sm font-medium text-white">{lead.title}</p>
                <p className="mt-1 text-xs text-slate-400">{lead.prospectName}</p>
                <div className="mt-3 flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  <span>{lead.stage}</span>
                  <span>Rp{lead.estimatedValue.toLocaleString("id-ID")}</span>
                </div>
              </article>
            ))}
            {column.leads.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-xs text-slate-500">
                No leads in this stage yet.
              </p>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}
