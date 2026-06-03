import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUserId } from "@/lib/api";
import { listInvoicesForUser } from "@/lib/company-invoice-service";

export default async function CompanyInvoicesPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  const { companyId } = await params;
  const result = await listInvoicesForUser(userId, companyId);
  if ("error" in result) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card text-card-foreground">
        <CardHeader>
          <Badge variant="outline" className="w-fit border-border bg-muted text-muted-foreground">
            Invoices
          </Badge>
          <CardTitle className="text-3xl text-card-foreground">Company invoices</CardTitle>
          <CardDescription className="max-w-2xl text-muted-foreground">
            Track billing snapshots that were created from approved quotations and move them
            through manual collection states.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-3">
        {result.invoices.length > 0 ? (
          result.invoices.map((invoice) => (
            <Link
              key={invoice.id}
              href={`/company/${companyId}/invoices/${invoice.id}`}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/40 p-4 transition hover:bg-accent/50"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-card-foreground">{invoice.invoiceNumber}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {invoice.quotation.quotationNumber} · {invoice.lead.prospectName}
                  </p>
                </div>
                <span className="rounded-full border border-border bg-background px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {invoice.status}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <ReceiptText className="size-4" />
                  Rp{invoice.total.toLocaleString("id-ID")}
                </span>
                <span>{invoice.lead.title}</span>
              </div>
            </Link>
          ))
        ) : (
          <section className="rounded-3xl border border-dashed border-border bg-muted/30 p-6 text-muted-foreground">
            No invoices yet. Open an approved quotation to create the first billing record.
          </section>
        )}
      </div>
    </div>
  );
}
