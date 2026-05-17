import { redirect, notFound } from "next/navigation";
import { getSessionUserId } from "@/lib/api";
import { canOpenCompanyShell } from "@/lib/company-auth";
import { getLeadBoardAccessForUser } from "@/lib/company-lead-service";
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

  if (companyId === "new") {
    if (!hasPremiumUnlock) {
      redirect("/");
    }

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

  const [company, leadBoardAccess] = await Promise.all([
    prisma.company.findFirst({
      where: {
        id: companyId,
        OR: [
          { ownerId: userId },
          {
            leadBoards: {
              some: {
                members: {
                  some: { userId },
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        quotationPrefix: true,
        description: true,
        ownerId: true,
      },
    }),
    getLeadBoardAccessForUser(userId, companyId),
  ]);
  const invitedLeadBoardIds =
    !("error" in leadBoardAccess) && leadBoardAccess.isMember ? [leadBoardAccess.board.id] : [];

  const allowed = canOpenCompanyShell({
    isOwner: company?.ownerId === userId,
    hasPremiumUnlock,
    invitedLeadBoardIds,
  });

  if (!allowed) {
    if (company?.ownerId === userId && !hasPremiumUnlock) {
      redirect("/");
    }

    notFound();
  }

  return <CompanyShell company={company} canManageSettings={company.ownerId === userId}>{children}</CompanyShell>;
}
