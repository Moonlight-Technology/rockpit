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
          className="border-border bg-card text-card-foreground shadow-none"
        >
          <CardHeader>
            <CardDescription className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              {item.label}
            </CardDescription>
            <CardTitle className="text-2xl font-semibold text-card-foreground">{item.value}</CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                <TrendingUpIcon className="size-3.5" />
                Live
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 border-border bg-muted/40 text-sm">
            <div className="flex items-center gap-2 font-medium text-card-foreground">
              {item.insight}
              <TrendingUpIcon className="size-4 text-muted-foreground" />
            </div>
            <div className="text-muted-foreground">{item.description}</div>
          </CardFooter>
        </Card>
      ))}
    </section>
  );
}
