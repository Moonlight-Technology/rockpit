import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { InvoiceStatusControl } from "@/components/company/invoice-status-control";
import { getSessionUserId } from "@/lib/api";
import { getInvoiceDetailForUser } from "@/lib/company-invoice-service";

export default async function CompanyInvoiceDetailPage({
  params,
}: {
  params: Promise<{ companyId: string; invoiceId: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  const { companyId, invoiceId } = await params;
  const result = await getInvoiceDetailForUser({ userId, companyId, invoiceId });
  if ("error" in result) {
    notFound();
  }

  const { invoice } = result;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-card p-6 text-card-foreground">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Link
              href={`/company/${companyId}/invoices`}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to invoices
            </Link>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                Invoice detail
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-card-foreground">
                {invoice.invoiceNumber}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Snapshot from {invoice.quotation.quotationNumber} for {invoice.lead.prospectName}.
              </p>
            </div>
          </div>
          <InvoiceStatusControl invoiceId={invoice.id} currentStatus={invoice.status} />
        </div>
      </section>

      <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92)_0%,rgba(248,250,252,1)_18%,rgba(255,255,255,1)_100%)] p-4 shadow-2xl shadow-black/20 sm:p-6">
        <article className="mx-auto max-w-4xl rounded-[28px] bg-white p-6 text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.22)] sm:p-10">
          <div className="flex flex-col gap-6 border-b border-slate-200 pb-8 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Invoice</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                {result.company.name}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-slate-600">
                Billing snapshot sourced from an approved quotation in the company workspace.
              </p>
            </div>
            <dl className="grid gap-3 text-sm text-slate-600 sm:text-right">
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-slate-400">Number</dt>
                <dd className="mt-1 font-medium text-slate-950">{invoice.invoiceNumber}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-slate-400">Status</dt>
                <dd className="mt-1 font-medium text-slate-950">{invoice.status}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-slate-400">Quotation</dt>
                <dd className="mt-1 font-medium text-slate-950">{invoice.quotation.quotationNumber}</dd>
              </div>
            </dl>
          </div>

          <div className="grid gap-6 border-b border-slate-200 py-8 md:grid-cols-2">
            <section>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Client</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-950">
                {invoice.lead.prospectName}
              </h3>
              <p className="mt-2 text-sm text-slate-600">{invoice.lead.title}</p>
            </section>
            <section>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Timeline</p>
              <p className="mt-2 text-sm text-slate-600">
                Issued {invoice.issuedAt ? format(new Date(invoice.issuedAt), "PPP") : "Not sent yet"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Paid {invoice.paidAt ? format(new Date(invoice.paidAt), "PPP") : "Unpaid"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Cancelled{" "}
                {invoice.cancelledAt ? format(new Date(invoice.cancelledAt), "PPP") : "Active"}
              </p>
            </section>
          </div>

          <div className="py-8">
            <div className="overflow-hidden rounded-[24px] border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-950 text-slate-100">
                  <tr>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">Qty</th>
                    <th className="px-4 py-3 font-medium">Unit Price</th>
                    <th className="px-4 py-3 text-right font-medium">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {invoice.lines.map((line: (typeof invoice.lines)[number]) => (
                    <tr key={line.id}>
                      <td className="px-4 py-4 text-slate-700">{line.description}</td>
                      <td className="px-4 py-4 text-slate-600">{line.quantity}</td>
                      <td className="px-4 py-4 text-slate-600">
                        Rp{line.unitPrice.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-slate-950">
                        Rp{(line.quantity * line.unitPrice).toLocaleString("id-ID")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-6 border-t border-slate-200 pt-6 md:grid-cols-[minmax(0,1fr)_320px]">
            <section>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Notes</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {invoice.notes || "No billing note attached to this invoice."}
              </p>
            </section>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between text-slate-600">
                <dt>Subtotal</dt>
                <dd>Rp{invoice.subtotal.toLocaleString("id-ID")}</dd>
              </div>
              <div className="flex items-center justify-between text-lg font-semibold text-slate-950">
                <dt>Total</dt>
                <dd>Rp{invoice.total.toLocaleString("id-ID")}</dd>
              </div>
            </dl>
          </div>
        </article>
      </section>
    </div>
  );
}
