import Link from "next/link";
import { ArrowRight, FileText, Plus } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { QuotationEditorSheet } from "@/components/company/quotation-editor-sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const quotationsResult = result;

  const latestByLead = new Map<string, (typeof quotationsResult.quotations)[number]>();
  for (const quotation of quotationsResult.quotations) {
    if (!latestByLead.has(quotation.lead.id)) {
      latestByLead.set(quotation.lead.id, quotation);
    }
  }
  const leadsWithoutSeries = quotationsResult.leads.filter((lead) => !latestByLead.has(lead.id));
  const leadsWithSeries = quotationsResult.leads
    .map((lead) => ({
      lead,
      quotation: latestByLead.get(lead.id),
    }))
    .filter(
      (
        item
      ): item is {
        lead: (typeof quotationsResult.leads)[number];
        quotation: (typeof quotationsResult.quotations)[number];
      } => Boolean(item.quotation)
    );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_320px]">
        <Card className="border-border bg-card text-card-foreground">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                Quotations
              </Badge>
            </div>
            <CardTitle className="text-3xl text-card-foreground">Company quotation series</CardTitle>
            <CardDescription className="max-w-2xl text-muted-foreground">
              Create owner-managed quotations from live leads, track revisions, and keep each
              pricing thread attached to the same prospect record.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <Card className="border-border bg-card text-card-foreground">
            <CardHeader>
              <CardDescription className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Leads without series
              </CardDescription>
              <CardTitle className="text-2xl text-card-foreground">{leadsWithoutSeries.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-border bg-card text-card-foreground">
            <CardHeader>
              <CardDescription className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Revision records
              </CardDescription>
              <CardTitle className="text-2xl text-card-foreground">
                {quotationsResult.quotations.length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="space-y-4">
          <Card className="border-border bg-card text-card-foreground">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg text-card-foreground">Existing quotation series</CardTitle>
                  <CardDescription className="mt-1 text-muted-foreground">
                    Open the current revision to print, inspect totals, or create the next revision.
                  </CardDescription>
                </div>
                <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  {latestByLead.size} series
                </span>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {latestByLead.size > 0 ? (
                Array.from(latestByLead.values()).map((quotation) => (
                  <Link
                    key={quotation.id}
                    href={`/company/${companyId}/quotations/${quotation.id}`}
                    className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/40 p-4 transition hover:bg-accent/50"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-card-foreground">
                          {quotation.lead.prospectName}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          {quotation.quotationNumber} · Rev {quotation.revisionNumber}
                        </p>
                      </div>
                      <span className="rounded-full border border-border bg-background px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {quotation.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span>{quotation.lead.title}</span>
                      <span>Rp{quotation.total.toLocaleString("id-ID")}</span>
                      <span>{quotation.lines.length} line item{quotation.lines.length === 1 ? "" : "s"}</span>
                      <span className="inline-flex items-center gap-1 text-foreground">
                        Open current series
                        <ArrowRight className="size-4" />
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
                  No quotations yet. Start a series from one of the leads on the right.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {leadsWithoutSeries.length > 0 ? (
            leadsWithoutSeries.map((lead) => (
              <section
                key={lead.id}
                className="rounded-3xl border border-border bg-card p-5 text-card-foreground"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">{lead.prospectName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{lead.title}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted p-3 text-muted-foreground">
                    <FileText className="size-4" />
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <span className="rounded-full border border-border bg-background px-3 py-1">
                    {lead.stage}
                  </span>
                  <span className="rounded-full border border-border bg-background px-3 py-1">
                    Pipeline Rp{lead.estimatedValue.toLocaleString("id-ID")}
                  </span>
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    No quotation series yet. Start the first revision to begin a numbered series.
                  </p>
                  <QuotationEditorSheet
                    leadId={lead.id}
                    prospectName={lead.prospectName}
                  />
                </div>
              </section>
            ))
          ) : (
            <section className="rounded-3xl border border-dashed border-border bg-muted/30 p-6 text-muted-foreground">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-border bg-background p-3">
                  <Plus className="size-4" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-card-foreground">No fresh quotation starts</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Every lead already has a quotation series. Open an existing series to create a revision.
                  </p>
                </div>
              </div>
            </section>
          )}

          {leadsWithSeries.length > 0 ? (
            <section className="rounded-3xl border border-border bg-card p-5 text-card-foreground">
              <h2 className="text-lg font-semibold text-card-foreground">Leads already in quotation flow</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                These leads already have an active series. Revisions should be created from the latest detail page.
              </p>
              <div className="mt-4 space-y-3">
                {leadsWithSeries.map(({ lead, quotation }) => (
                  <Link
                    key={lead.id}
                    href={`/company/${companyId}/quotations/${quotation.id}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/40 p-4 transition hover:bg-accent/50"
                  >
                    <div>
                      <p className="text-sm font-semibold text-card-foreground">{lead.prospectName}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {quotation.quotationNumber} · Rev {quotation.revisionNumber}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm text-foreground">
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
