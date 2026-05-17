type OverviewMetricsProps = {
  metrics: {
    openPipelineValue: number;
    quotationDraftValue: number;
    wonValueThisMonth: number;
    activeProjectCount: number;
  };
};

const currencyFormatter = new Intl.NumberFormat("id-ID");

function formatRupiah(value: number) {
  return `Rp${currencyFormatter.format(value)}`;
}

export function OverviewMetrics({ metrics }: OverviewMetricsProps) {
  const items = [
    {
      label: "Open pipeline",
      value: formatRupiah(metrics.openPipelineValue),
      description: "Active lead value still in motion across the pipeline.",
    },
    {
      label: "Draft quotations",
      value: formatRupiah(metrics.quotationDraftValue),
      description: "Quotation value still being prepared before sending.",
    },
    {
      label: "Won this month",
      value: formatRupiah(metrics.wonValueThisMonth),
      description: "Closed-won lead value inside the current calendar month.",
    },
    {
      label: "Active projects",
      value: String(metrics.activeProjectCount),
      description: "Open company delivery boards converted from won leads.",
    },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <article
          key={item.label}
          className="rounded-3xl border border-white/10 bg-white/6 p-5 text-slate-100 ring-1 ring-white/5"
        >
          <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/80">{item.label}</p>
          <p className="mt-3 text-2xl font-semibold text-white">{item.value}</p>
          <p className="mt-2 text-sm text-slate-400">{item.description}</p>
        </article>
      ))}
    </section>
  );
}
