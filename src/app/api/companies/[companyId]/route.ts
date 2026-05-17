import { NextResponse } from "next/server";
import { forbidden, getSessionUserId, notFound, unauthorized } from "@/lib/api";
import { getCompanyForUser } from "@/lib/company-service";
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
  const [user, company] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { premiumUnlock: { select: { id: true } } },
    }),
    getCompanyForUser(userId, companyId),
  ]);

  const allowed = canOpenCompanyShell({
    isOwner: Boolean(company),
    hasPremiumUnlock: Boolean(user?.premiumUnlock),
    invitedLeadBoardIds: [],
  });

  if (!allowed && !user?.premiumUnlock) {
    return forbidden("Company mode is locked.");
  }

  if (!company) {
    return notFound("Company not found.");
  }

  return NextResponse.json({ ok: true, data: company });
}
