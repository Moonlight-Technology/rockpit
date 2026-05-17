import { redirect, notFound } from "next/navigation";
import { getSessionUserId } from "@/lib/api";
import { getCompanyForUser } from "@/lib/company-service";
import { canOpenCompanyShell } from "@/lib/company-auth";
import { prisma } from "@/lib/prisma";
import { CompanyShell } from "@/components/company/company-shell";

export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  const { companyId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { premiumUnlock: { select: { id: true } } },
  });

  const hasPremiumUnlock = Boolean(user?.premiumUnlock);

  if (!hasPremiumUnlock) {
    redirect("/");
  }

  if (companyId === "new") {
    return (
      <CompanyShell
        isOnboarding
        company={{
          id: "new",
          name: "New Company",
          slug: "new-company",
          quotationPrefix: "JASA",
          description: "",
        }}
      >
        {children}
      </CompanyShell>
    );
  }

  const company = await getCompanyForUser(userId, companyId);
  const allowed = canOpenCompanyShell({
    isOwner: Boolean(company),
    hasPremiumUnlock,
    invitedLeadBoardIds: [],
  });

  if (!allowed) {
    notFound();
  }

  return <CompanyShell company={company}>{children}</CompanyShell>;
}
