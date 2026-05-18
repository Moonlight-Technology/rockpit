import { TrendingUpIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

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
      insight: "Sales coverage in progress",
    },
    {
      label: "Draft quotations",
      value: formatRupiah(metrics.quotationDraftValue),
      description: "Quotation value still being prepared before sending.",
      insight: "Pricing work pending release",
    },
    {
      label: "Won this month",
      value: formatRupiah(metrics.wonValueThisMonth),
      description: "Closed-won lead value inside the current calendar month.",
      insight: "Closed revenue this month",
    },
    {
      label: "Active projects",
      value: String(metrics.activeProjectCount),
      description: "Open company delivery boards converted from won leads.",
      insight: "Execution workload live",
    },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card
          key={item.label}
          className="border-white/10 bg-linear-to-b from-[#1b1b1b] to-[#191919] text-zinc-100 shadow-none"
        >
          <CardHeader>
            <CardDescription className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">
              {item.label}
            </CardDescription>
            <CardTitle className="text-2xl font-semibold text-white">{item.value}</CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-white/10 bg-[#202020] text-zinc-300">
                <TrendingUpIcon className="size-3.5" />
                Live
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 border-white/10 bg-[#1f1f1f] text-sm">
            <div className="flex items-center gap-2 font-medium text-white">
              {item.insight}
              <TrendingUpIcon className="size-4 text-zinc-300" />
            </div>
            <div className="text-zinc-400">{item.description}</div>
          </CardFooter>
        </Card>
      ))}
    </section>
  );
}
