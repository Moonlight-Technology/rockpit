import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Printer } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { QuotationEditor } from "@/components/company/quotation-editor";
import { getSessionUserId } from "@/lib/api";
import { getQuotationDetailForUser } from "@/lib/company-quotation-service";

export default async function CompanyQuotationDetailPage({
  params,
}: {
  params: Promise<{ companyId: string; quotationId: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  const { companyId, quotationId } = await params;
  const result = await getQuotationDetailForUser({ userId, companyId, quotationId });
  if ("error" in result) {
    notFound();
  }
  const quotationResult = result;

  const { quotation, revisions } = quotationResult;

  return (
    <div className="space-y-6 print:space-y-0">
      <section className="rounded-3xl border border-white/10 bg-white/6 p-6 text-slate-100 ring-1 ring-white/5 print:hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Link
              href={`/company/${companyId}/quotations`}
              className="inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white"
            >
              <ArrowLeft className="size-4" />
              Back to quotations
            </Link>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">
                Printable detail
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-white">
                {quotation.quotationNumber} · Rev {quotation.revisionNumber}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Owner-only quotation record for {quotation.lead.prospectName}, ready for print or
                the next revision.
              </p>
            </div>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
            <span className="inline-flex items-center gap-2">
              <Printer className="size-4" />
              Use browser print for export
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92)_0%,rgba(248,250,252,1)_18%,rgba(255,255,255,1)_100%)] p-4 shadow-2xl shadow-black/20 sm:p-6 print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none">
        <article className="mx-auto max-w-4xl rounded-[28px] bg-white p-6 text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.22)] sm:p-10 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
          <div className="flex flex-col gap-6 border-b border-slate-200 pb-8 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Quotation</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                {quotationResult.company.name}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-slate-600">
                {quotationResult.company.description ||
                  "Company quotation issued from the sales workspace."}
              </p>
            </div>
            <dl className="grid gap-3 text-sm text-slate-600 sm:text-right">
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-slate-400">Number</dt>
                <dd className="mt-1 font-medium text-slate-950">{quotation.quotationNumber}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-slate-400">Revision</dt>
                <dd className="mt-1 font-medium text-slate-950">Rev {quotation.revisionNumber}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.22em] text-slate-400">Issued</dt>
                <dd className="mt-1 font-medium text-slate-950">
                  {quotation.issuedAt ? format(new Date(quotation.issuedAt), "PPP") : "Not issued yet"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="grid gap-6 border-b border-slate-200 py-8 md:grid-cols-2">
            <section>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Client</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-950">
                {quotation.lead.prospectName}
              </h3>
              <p className="mt-2 text-sm text-slate-600">{quotation.lead.title}</p>
            </section>
            <section>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Status</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{quotation.status}</p>
              <p className="mt-2 text-sm text-slate-600">
                Created by {quotation.createdBy.name || quotation.createdBy.email}
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
                  {quotation.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-4 text-slate-700">{line.description}</td>
                      <td className="px-4 py-4 text-slate-600">{line.quantity}</td>
                      <td className="px-4 py-4 text-slate-600">
                        Rp{line.unitPrice.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-slate-950">
                        Rp{line.lineTotal.toLocaleString("id-ID")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-200 pt-6">
            <dl className="w-full max-w-sm space-y-3 text-sm">
              <div className="flex items-center justify-between text-slate-600">
                <dt>Subtotal</dt>
                <dd>Rp{quotation.subtotal.toLocaleString("id-ID")}</dd>
              </div>
              <div className="flex items-center justify-between text-lg font-semibold text-slate-950">
                <dt>Total</dt>
                <dd>Rp{quotation.total.toLocaleString("id-ID")}</dd>
              </div>
            </dl>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] print:hidden">
        <QuotationEditor
          quotationId={quotation.id}
          leadId={quotation.lead.id}
          initialStatus={quotation.status}
          initialLines={quotation.lines.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
          }))}
          title="Create next revision"
          description="Adjust pricing, line items, or status. Saving here creates the next revision number in the same quotation series."
          submitLabel="Create revision"
        />

        <aside className="rounded-3xl border border-white/10 bg-white/6 p-5 text-slate-100 ring-1 ring-white/5">
          <h2 className="text-lg font-semibold text-white">Revision history</h2>
          <p className="mt-1 text-sm text-slate-400">
            Latest entries for the same lead-attached quotation series.
          </p>

          <div className="mt-4 space-y-3">
            {revisions.map((revision) => (
              <Link
                key={revision.id}
                href={`/company/${companyId}/quotations/${revision.id}`}
                className="block rounded-2xl border border-white/10 bg-black/10 p-4 transition hover:border-cyan-300/30 hover:bg-cyan-300/5"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">Rev {revision.revisionNumber}</p>
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    {revision.status}
                  </span>
                </div>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                  {revision.issuedAt ? format(new Date(revision.issuedAt), "PPP") : "Draft"}
                </p>
                <p className="mt-3 text-sm text-slate-300">
                  Total Rp{revision.total.toLocaleString("id-ID")}
                </p>
              </Link>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
