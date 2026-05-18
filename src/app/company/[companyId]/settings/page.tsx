import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
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
      <Card className="border border-white/10 bg-[#181818] text-zinc-100">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-white/10 bg-[#202020] text-zinc-200">
              Settings
            </Badge>
            <Badge variant="outline" className="border-white/10 bg-[#202020] text-zinc-400">
              Owner only
            </Badge>
          </div>
          <CardTitle>Workspace settings</CardTitle>
          <CardDescription className="text-zinc-400">
            Task 3 provisions the company workspace and keeps settings read-only for now.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-zinc-200 md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Company name</p>
            <p className="font-medium">{company.name}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Business type</p>
            <p className="font-medium">{company.businessType}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Slug</p>
            <p className="font-medium">{company.slug}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Quotation prefix</p>
            <p className="font-medium">{company.quotationPrefix}</p>
          </div>
          <div className="space-y-1 md:col-span-2">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Description</p>
            <p className="min-h-16 rounded-2xl border border-white/10 bg-[#1d1d1d] px-4 py-3 text-zinc-300">
              {company.description || "No description added yet."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-white/10 bg-[#181818] text-zinc-100">
        <CardHeader>
          <CardTitle>Default setup</CardTitle>
          <CardDescription className="text-zinc-400">
            Creating the company also created the default lead board structure.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-zinc-200">
          <p>Lead board: Sales Pipeline</p>
          <p>Columns: New, Qualified, Proposal, Negotiation, Won, Lost</p>
          <p>Next tasks can attach leads, quotations, and project boards to this workspace.</p>
        </CardContent>
      </Card>
    </div>
  );
}
