import { NextResponse } from "next/server";
import { forbidden, getSessionUserId, notFound, unauthorized } from "@/lib/api";
import { canOpenCompanyShell } from "@/lib/company-auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { companyId } = await params;
  const [user, company, invitedMemberships] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { premiumUnlock: { select: { id: true } } },
    }),
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
        description: true,
        businessType: true,
        quotationPrefix: true,
        createdAt: true,
        updatedAt: true,
        ownerId: true,
      },
    }),
    prisma.companyLeadBoardMember.findMany({
      where: {
        userId,
        leadBoard: {
          companyId,
        },
      },
      select: { leadBoardId: true },
    }),
  ]);

  const allowed = canOpenCompanyShell({
    isOwner: company?.ownerId === userId,
    hasPremiumUnlock: Boolean(user?.premiumUnlock),
    invitedLeadBoardIds: invitedMemberships.map((membership) => membership.leadBoardId),
  });

  if (!allowed && !user?.premiumUnlock) {
    return forbidden("Company mode is locked.");
  }

  if (!company) {
    return notFound("Company not found.");
  }

  return NextResponse.json({ ok: true, data: company });
}
