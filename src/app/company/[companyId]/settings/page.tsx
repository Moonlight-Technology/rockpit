import { notFound, redirect } from "next/navigation";
import { CompanyOnboardingForm } from "@/components/company/company-onboarding-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUserId } from "@/lib/api";
import { getCompanyForUser } from "@/lib/company-service";
import { prisma } from "@/lib/prisma";

export default async function CompanySettingsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  const { companyId } = await params;

  if (companyId === "new") {
    return <CompanyOnboardingForm />;
  }

  const [company, invitedBoard] = await Promise.all([
    getCompanyForUser(userId, companyId),
    prisma.companyLeadBoard.findFirst({
      where: {
        companyId,
        members: {
          some: { userId },
        },
      },
      select: { id: true },
    }),
  ]);

  if (!company && invitedBoard) {
    redirect(`/company/${companyId}/leads`);
  }

  if (!company) {
    notFound();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <Card className="border border-white/10 bg-white/6 text-slate-100 ring-white/10">
        <CardHeader>
          <CardTitle>Workspace settings</CardTitle>
          <CardDescription className="text-slate-300">
            Task 3 provisions the company workspace and keeps settings read-only for now.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-slate-200 md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Company name</p>
            <p className="font-medium">{company.name}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Business type</p>
            <p className="font-medium">{company.businessType}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Slug</p>
            <p className="font-medium">{company.slug}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Quotation prefix</p>
            <p className="font-medium">{company.quotationPrefix}</p>
          </div>
          <div className="space-y-1 md:col-span-2">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Description</p>
            <p className="min-h-16 rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-slate-300">
              {company.description || "No description added yet."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-cyan-300/15 bg-cyan-300/8 text-slate-100 ring-cyan-300/10">
        <CardHeader>
          <CardTitle>Default setup</CardTitle>
          <CardDescription className="text-slate-300">
            Creating the company also created the default lead board structure.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-200">
          <p>Lead board: Sales Pipeline</p>
          <p>Columns: New, Qualified, Proposal, Negotiation, Won, Lost</p>
          <p>Next tasks can attach leads, quotations, and project boards to this workspace.</p>
        </CardContent>
      </Card>
    </div>
  );
}
