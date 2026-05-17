import Link from "next/link";
import { ArrowRight, FileText, Plus } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { QuotationEditor } from "@/components/company/quotation-editor";
import { getSessionUserId } from "@/lib/api";
import { listQuotationsForUser } from "@/lib/company-quotation-service";

export default async function CompanyQuotationsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  const { companyId } = await params;
  const result = await listQuotationsForUser(userId, companyId);
  if ("error" in result) {
    notFound();
  }

  const latestByLead = new Map<string, (typeof result.quotations)[number]>();
  for (const quotation of result.quotations) {
    if (!latestByLead.has(quotation.lead.id)) {
      latestByLead.set(quotation.lead.id, quotation);
    }
  }
  const leadsWithoutSeries = result.leads.filter((lead) => !latestByLead.has(lead.id));
  const leadsWithSeries = result.leads
    .map((lead) => ({
      lead,
      quotation: latestByLead.get(lead.id),
    }))
    .filter(
      (
        item
      ): item is {
        lead: (typeof result.leads)[number];
        quotation: (typeof result.quotations)[number];
      } => Boolean(item.quotation)
    );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/6 p-6 text-slate-100 ring-1 ring-white/5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">Quotations</p>
            <div>
              <h1 className="text-2xl font-semibold text-white">Company quotation series</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Create owner-managed quotations from live leads, track revisions, and keep each
                pricing thread attached to the same prospect record.
              </p>
            </div>
          </div>
          <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                Leads without series
              </p>
              <p className="mt-1 text-lg font-semibold text-white">{leadsWithoutSeries.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                Revision records
              </p>
              <p className="mt-1 text-lg font-semibold text-white">{result.quotations.length}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="space-y-4">
          <section className="rounded-3xl border border-white/10 bg-white/6 p-5 text-slate-100 ring-1 ring-white/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Existing quotation series</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Open the current revision to print, inspect totals, or create the next revision.
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-slate-300">
                {latestByLead.size} series
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {latestByLead.size > 0 ? (
                Array.from(latestByLead.values()).map((quotation) => (
                  <Link
                    key={quotation.id}
                    href={`/company/${companyId}/quotations/${quotation.id}`}
                    className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/10 p-4 transition hover:border-cyan-300/30 hover:bg-cyan-300/5"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {quotation.lead.prospectName}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                          {quotation.quotationNumber} · Rev {quotation.revisionNumber}
                        </p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                        {quotation.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                      <span>{quotation.lead.title}</span>
                      <span>Rp{quotation.total.toLocaleString("id-ID")}</span>
                      <span>{quotation.lines.length} line item{quotation.lines.length === 1 ? "" : "s"}</span>
                      <span className="inline-flex items-center gap-1 text-cyan-100">
                        Open current series
                        <ArrowRight className="size-4" />
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-6 text-sm text-slate-400">
                  No quotations yet. Start a series from one of the leads on the right.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          {leadsWithoutSeries.length > 0 ? (
            leadsWithoutSeries.map((lead) => (
              <section
                key={lead.id}
                className="rounded-3xl border border-white/10 bg-white/6 p-5 text-slate-100 ring-1 ring-white/5"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{lead.prospectName}</p>
                    <p className="mt-1 text-sm text-slate-400">{lead.title}</p>
                  </div>
                  <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-cyan-100">
                    <FileText className="size-4" />
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1">
                    {lead.stage}
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1">
                    Pipeline Rp{lead.estimatedValue.toLocaleString("id-ID")}
                  </span>
                </div>

                <QuotationEditor
                  leadId={lead.id}
                  title={`Create quotation for ${lead.prospectName}`}
                  description="The first quotation starts a numbered series. Saving again later from the detail page creates the next revision."
                  submitLabel="Create quotation"
                />
              </section>
            ))
          ) : (
            <section className="rounded-3xl border border-dashed border-white/10 bg-white/4 p-6 text-slate-300">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                  <Plus className="size-4" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">No fresh quotation starts</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Every lead already has a quotation series. Open an existing series to create a revision.
                  </p>
                </div>
              </div>
            </section>
          )}

          {leadsWithSeries.length > 0 ? (
            <section className="rounded-3xl border border-white/10 bg-white/6 p-5 text-slate-100 ring-1 ring-white/5">
              <h2 className="text-lg font-semibold text-white">Leads already in quotation flow</h2>
              <p className="mt-1 text-sm text-slate-400">
                These leads already have an active series. Revisions should be created from the latest detail page.
              </p>
              <div className="mt-4 space-y-3">
                {leadsWithSeries.map(({ lead, quotation }) => (
                  <Link
                    key={lead.id}
                    href={`/company/${companyId}/quotations/${quotation.id}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/10 p-4 transition hover:border-cyan-300/30 hover:bg-cyan-300/5"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{lead.prospectName}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                        {quotation.quotationNumber} · Rev {quotation.revisionNumber}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm text-cyan-100">
                      Continue
                      <ArrowRight className="size-4" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </div>
  );
}
